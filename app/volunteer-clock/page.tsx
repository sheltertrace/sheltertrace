"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  lookupPersonForKiosk, fetchActiveVolunteerLog,
  clockInVolunteer, clockOutVolunteer,
} from "@/lib/data";
import type { Person, VolunteerLog } from "@/lib/types";

const TASKS = [
  "Dog Walking", "Cat Socialization", "Kennel Cleaning",
  "Administrative", "Photography", "Transport", "Training",
  "Events", "Laundry / Dishes", "Other",
];

function fmt12(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

type KioskState = "idle" | "lookup" | "confirm_in" | "confirm_out" | "success_in" | "success_out" | "error";

export default function VolunteerClockPage() {
  const [inputVal, setInputVal] = useState("");
  const [kioskState, setKioskState] = useState<KioskState>("idle");
  const [person, setPerson] = useState<Person | null>(null);
  const [activeLog, setActiveLog] = useState<VolunteerLog | null>(null);
  const [selectedTask, setSelectedTask] = useState(TASKS[0]);
  const [errMsg, setErrMsg] = useState("");
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [activeToday, setActiveToday] = useState<VolunteerLog[]>([]);
  const [completedToday, setCompletedToday] = useState<VolunteerLog[]>([]);
  const [clockNow, setClockNow] = useState(new Date());
  const [rememberMe, setRememberMe] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref so scheduleReset can call handleLookup without circular dep
  const handleLookupRef = useRef<((raw: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Focus input on idle/lookup and on initial page load
  useEffect(() => {
    if (kioskState === "idle" || kioskState === "lookup") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [kioskState]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // Load Remember Me state on mount and auto-lookup if saved
  useEffect(() => {
    const rm = localStorage.getItem("vol_kiosk_remember") === "true";
    const savedPid = localStorage.getItem("vol_kiosk_pid") || "";
    setRememberMe(rm);
    if (rm && savedPid) {
      // Defer until handleLookupRef is set
      setTimeout(() => handleLookupRef.current?.(savedPid), 200);
    }
  }, []);

  const loadTodayActivity = useCallback(async () => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("volunteer_sessions").select("*").eq("date", todayStr)
        .order("clock_in", { ascending: false });
      const all = (data as VolunteerLog[]) || [];
      setActiveToday(all.filter((l) => !l.clock_out));
      setCompletedToday(all.filter((l) => l.clock_out));
    } catch { /* fail silently */ }
  }, []);

  useEffect(() => { loadTodayActivity(); }, [loadTodayActivity]);

  const cancelReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  };

  const scheduleReset = useCallback((ms = 5000) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      const rm = localStorage.getItem("vol_kiosk_remember") === "true";
      const savedPid = localStorage.getItem("vol_kiosk_pid") || "";
      if (rm && savedPid) {
        handleLookupRef.current?.(savedPid);
      } else {
        setKioskState("idle");
        setInputVal("");
        setPerson(null);
        setActiveLog(null);
        setErrMsg("");
        setDebugLines([]);
      }
    }, ms);
  }, []);

  const handleLookup = useCallback(async (raw: string) => {
    const inputTrimmed = raw.trim();
    if (!inputTrimmed) return;
    setProcessing(true);
    setErrMsg("");
    setDebugLines([]);
    setKioskState("lookup");
    console.log("[kiosk] lookup start:", JSON.stringify(inputTrimmed));
    try {
      const { person: found, debugLog } = await lookupPersonForKiosk(inputTrimmed);
      console.log("[kiosk] lookup result:", found ? `${found.first_name} ${found.last_name} (role: ${found.role})` : "NOT FOUND", debugLog);

      if (!found) {
        setErrMsg(`ID not found. You searched: "${inputTrimmed}". Please ask staff for help.`);
        setDebugLines(debugLog);
        setKioskState("error");
        scheduleReset(30000); // long timeout so staff can read the debug info
        return;
      }

      // Accept any person regardless of role — only reject clearly non-volunteer staff roles
      const role = (found.role || "").toLowerCase().trim();
      const nonVolunteerRoles = ["admin", "officer", "dispatcher", "vet tech", "front desk", "court clerk", "judge"];
      if (role && nonVolunteerRoles.includes(role)) {
        setErrMsg(`${found.first_name} ${found.last_name} is a staff member (${found.role}), not a volunteer. Please use the staff login instead.`);
        setDebugLines(debugLog);
        setKioskState("error");
        scheduleReset(10000);
        return;
      }

      // Save PID for Remember Me
      const rm = localStorage.getItem("vol_kiosk_remember") === "true";
      if (rm) localStorage.setItem("vol_kiosk_pid", inputTrimmed);

      const log = await fetchActiveVolunteerLog(found.id);
      console.log("[kiosk] active log:", log ? `id=${log.id} task=${log.task}` : "none");
      setPerson(found);
      setActiveLog(log);
      setInputVal("");
      setDebugLines([]);
      setKioskState(log ? "confirm_out" : "confirm_in");
    } catch (err) {
      console.error("[kiosk] lookup error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg("A system error occurred. Please try again or ask staff for help.");
      setDebugLines([`Error: ${msg}`, `Searched: "${inputTrimmed}"`]);
      setKioskState("error");
      scheduleReset(15000);
    } finally {
      setProcessing(false);
    }
  }, [scheduleReset]);

  // Keep ref in sync
  useEffect(() => { handleLookupRef.current = handleLookup; }, [handleLookup]);

  // Barcode scanner detection
  const scanBuffer = useRef<{ chars: string; last: number }>({ chars: "", last: 0 });
  const scanFlush = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const gap = now - scanBuffer.current.last;
    scanBuffer.current.last = now;

    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputRef.current?.value?.trim();
      scanBuffer.current = { chars: "", last: 0 };
      if (scanFlush.current) clearTimeout(scanFlush.current);
      if (val) handleLookup(val);
      return;
    }

    if (gap < 60 && e.key.length === 1) {
      scanBuffer.current.chars += e.key;
    } else {
      scanBuffer.current = { chars: e.key.length === 1 ? e.key : "", last: now };
    }

    if (scanBuffer.current.chars.length >= 6) {
      if (scanFlush.current) clearTimeout(scanFlush.current);
      scanFlush.current = setTimeout(() => {
        const val = inputRef.current?.value?.trim();
        if (val) handleLookup(val);
        scanBuffer.current = { chars: "", last: 0 };
      }, 80);
    }
  }, [handleLookup]);

  const handleClockIn = async () => {
    if (!person) return;
    setProcessing(true);
    cancelReset();
    try {
      await clockInVolunteer(person.id, `${person.first_name} ${person.last_name}`, selectedTask);
      setKioskState("success_in");
      await loadTodayActivity();
      scheduleReset(4000);
    } catch {
      setErrMsg("Clock-in failed. Please try again or see staff.");
      setKioskState("error");
      scheduleReset(5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleClockOut = async () => {
    if (!person || !activeLog) return;
    setProcessing(true);
    cancelReset();
    try {
      const result = await clockOutVolunteer(activeLog.id);
      setActiveLog(result);
      setKioskState("success_out");
      await loadTodayActivity();
      scheduleReset(5000);
    } catch {
      setErrMsg("Clock-out failed. Please try again or see staff.");
      setKioskState("error");
      scheduleReset(5000);
    } finally {
      setProcessing(false);
    }
  };

  const toggleRememberMe = () => {
    const next = !rememberMe;
    setRememberMe(next);
    localStorage.setItem("vol_kiosk_remember", String(next));
    if (!next) localStorage.removeItem("vol_kiosk_pid");
  };

  const timeStr = clockNow.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = clockNow.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div
      className="kiosk-page"
      onClick={() => { if (kioskState === "idle" || kioskState === "lookup") inputRef.current?.focus(); }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .kiosk-page {
          min-height: 100vh;
          background: #0f2942;
          color: #fff;
          display: flex;
          flex-direction: column;
          font-family: system-ui, -apple-system, sans-serif;
          user-select: none;
        }
        .kiosk-header {
          padding: 20px 32px 0;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .kiosk-logo { font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
        .kiosk-logo-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 2px; }
        .kiosk-clock { text-align: right; flex-shrink: 0; }
        .kiosk-time {
          font-size: 40px; font-weight: 900;
          font-variant-numeric: tabular-nums; letter-spacing: 2px;
        }
        .kiosk-date { font-size: 14px; color: rgba(255,255,255,0.6); }
        .kiosk-main {
          flex: 1; padding: 24px 32px;
          display: flex; flex-direction: column;
          align-items: center; gap: 24px;
        }
        .kiosk-input-card {
          width: 100%; max-width: 620px;
          background: rgba(255,255,255,0.07);
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 28px 32px;
        }
        .kiosk-input-label {
          font-size: 18px; font-weight: 700;
          margin-bottom: 14px; text-align: center;
          color: rgba(255,255,255,0.9);
        }
        .kiosk-input {
          width: 100%; font-size: 28px; font-weight: 700;
          padding: 16px 20px; border-radius: 12px;
          border: 3px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1); color: #fff;
          outline: none; text-align: center;
          letter-spacing: 4px; font-family: monospace;
        }
        .kiosk-input::placeholder { color: rgba(255,255,255,0.3); }
        .kiosk-input-hint {
          font-size: 13px; color: rgba(255,255,255,0.4);
          text-align: center; margin-top: 10px;
        }
        .kiosk-lookup-btn {
          font-size: 18px; padding: 12px 40px;
          border-radius: 10px; background: #1a8a8a;
          color: #fff; border: none; font-weight: 800;
          cursor: pointer; width: 100%; margin-top: 16px;
        }
        .kiosk-remember {
          display: flex; align-items: center; gap: 10px;
          margin-top: 16px; justify-content: center;
          font-size: 13px; color: rgba(255,255,255,0.5);
          cursor: pointer;
        }
        .kiosk-remember input { width: 16px; height: 16px; cursor: pointer; accent-color: #1a8a8a; }
        .kiosk-person-card {
          width: 100%; max-width: 620px;
          background: rgba(255,255,255,0.95);
          border-radius: 16px; color: #0f2942;
          padding: 28px 32px;
        }
        .kiosk-person-header {
          display: flex; align-items: center;
          gap: 20px; margin-bottom: 24px;
        }
        .kiosk-avatar {
          width: 80px; height: 80px; border-radius: 50%;
          flex-shrink: 0;
        }
        .kiosk-name { font-size: 30px; font-weight: 900; color: #0f2942; }
        .kiosk-pid { font-size: 15px; color: #64748b; margin-top: 2px; }
        .kiosk-task-grid {
          display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;
        }
        .kiosk-task-btn {
          padding: 10px 16px; border-radius: 10px;
          font-size: 14px; font-weight: 600; cursor: pointer;
          border: 2px solid #e2e8f0;
          background: #f8fafc; color: #475569;
          transition: all 0.1s;
          min-height: 44px;
        }
        .kiosk-task-btn.selected {
          border-color: #1a8a8a; background: #f0fdfa; color: #1a8a8a;
        }
        .kiosk-action-row { display: flex; gap: 12px; }
        .kiosk-btn-green {
          flex: 1; font-size: 22px; padding: 18px;
          border-radius: 12px; background: #16a34a;
          color: #fff; border: none; font-weight: 900;
          cursor: pointer; min-height: 64px;
        }
        .kiosk-btn-red {
          flex: 1; font-size: 22px; padding: 18px;
          border-radius: 12px; background: #dc2626;
          color: #fff; border: none; font-weight: 900;
          cursor: pointer; min-height: 64px;
        }
        .kiosk-btn-cancel {
          padding: 18px 20px; border-radius: 12px;
          background: #f1f5f9; color: #64748b;
          border: none; font-weight: 700;
          cursor: pointer; font-size: 15px; min-height: 64px;
        }
        .kiosk-success-card {
          width: 100%; max-width: 620px;
          border-radius: 16px; padding: 40px 32px;
          text-align: center;
        }
        .kiosk-active-list {
          width: 100%; max-width: 900px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          padding: 16px 20px;
        }
        .kiosk-active-grid {
          display: flex; flex-wrap: wrap; gap: 10px;
        }
        .kiosk-active-chip {
          background: rgba(255,255,255,0.1);
          border-radius: 10px; padding: 10px 16px;
          min-width: 200px; flex: 1 1 200px;
        }
        .kiosk-footer {
          padding: 12px 32px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex; justify-content: space-between; align-items: center;
        }
        .kiosk-footer-text { font-size: 11px; color: rgba(255,255,255,0.3); }
        .kiosk-footer a { font-size: 12px; color: rgba(255,255,255,0.3); text-decoration: none; }

        @media (max-width: 640px) {
          .kiosk-header { padding: 14px 16px 0; flex-wrap: wrap; }
          .kiosk-logo { font-size: 16px; }
          .kiosk-logo-sub { font-size: 11px; }
          .kiosk-time { font-size: 26px; letter-spacing: 1px; }
          .kiosk-date { font-size: 11px; }
          .kiosk-main { padding: 16px; gap: 16px; }
          .kiosk-input-card { padding: 20px 16px; border-radius: 12px; }
          .kiosk-input-label { font-size: 15px; }
          .kiosk-input { font-size: 22px; padding: 14px 16px; letter-spacing: 2px; }
          .kiosk-person-card { padding: 20px 16px; }
          .kiosk-person-header { gap: 14px; }
          .kiosk-avatar { width: 60px; height: 60px; }
          .kiosk-name { font-size: 22px; }
          .kiosk-task-btn { padding: 10px 12px; font-size: 13px; }
          .kiosk-btn-green, .kiosk-btn-red { font-size: 18px; padding: 16px; }
          .kiosk-btn-cancel { padding: 16px 14px; font-size: 13px; }
          .kiosk-success-card { padding: 28px 16px; }
          .kiosk-active-list { padding: 12px 14px; }
          .kiosk-active-chip { min-width: 160px; }
          .kiosk-footer { padding: 10px 16px; }
        }
      `}</style>

      {/* Header */}
      <div className="kiosk-header">
        <div>
          <div className="kiosk-logo">Morgan County Animal Services</div>
          <div className="kiosk-logo-sub">Volunteer Check-In Kiosk · ShelterTrace</div>
        </div>
        <div className="kiosk-clock">
          <div className="kiosk-time">{timeStr}</div>
          <div className="kiosk-date">{dateStr}</div>
        </div>
      </div>

      {/* Main area */}
      <div className="kiosk-main">

        {/* ── IDLE / LOOKUP: ID input ── */}
        {(kioskState === "idle" || kioskState === "lookup") && (
          <div className="kiosk-input-card">
            <div className="kiosk-input-label">Scan your badge or enter your Volunteer ID</div>
            <input
              ref={inputRef}
              className="kiosk-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="PID-01045"
              autoComplete="off"
              spellCheck={false}
              disabled={processing}
            />
            <div className="kiosk-input-hint">
              {processing ? "Looking up…" : "Press Enter or scan barcode to continue"}
            </div>
            {inputVal.trim() && !processing && (
              <button className="kiosk-lookup-btn" onClick={() => handleLookup(inputVal)}>
                Look Up →
              </button>
            )}
            <label className="kiosk-remember" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={rememberMe} onChange={toggleRememberMe} />
              Remember Me on this device
            </label>
          </div>
        )}

        {/* ── CONFIRM CLOCK IN ── */}
        {kioskState === "confirm_in" && person && (
          <div className="kiosk-person-card" onClick={cancelReset}>
            <div className="kiosk-person-header">
              {person.photo_id_url ? (
                <img src={person.photo_id_url} alt="" className="kiosk-avatar" style={{ objectFit: "cover", border: "3px solid #1a8a8a" }} />
              ) : (
                <div className="kiosk-avatar" style={{ background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#94a3b8" }}>
                  {person.first_name[0]}{person.last_name[0]}
                </div>
              )}
              <div>
                <div className="kiosk-name">{person.first_name} {person.last_name}</div>
                <div className="kiosk-pid">{person.pid} · Volunteer</div>
                <div style={{ display: "inline-block", marginTop: 6, padding: "3px 12px", background: "#dcfce7", color: "#15803d", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  ● Not clocked in
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 10 }}>Select today&apos;s task:</div>
              <div className="kiosk-task-grid">
                {TASKS.map((t) => (
                  <button
                    key={t}
                    className={`kiosk-task-btn${selectedTask === t ? " selected" : ""}`}
                    onClick={() => setSelectedTask(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="kiosk-action-row">
              <button className="kiosk-btn-green" onClick={handleClockIn} disabled={processing}>
                {processing ? "⏳ Clocking In…" : "✓ CLOCK IN"}
              </button>
              <button className="kiosk-btn-cancel" onClick={() => { setKioskState("idle"); setInputVal(""); setPerson(null); cancelReset(); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM CLOCK OUT ── */}
        {kioskState === "confirm_out" && person && activeLog && (
          <div className="kiosk-person-card" onClick={cancelReset}>
            <div className="kiosk-person-header">
              {person.photo_id_url ? (
                <img src={person.photo_id_url} alt="" className="kiosk-avatar" style={{ objectFit: "cover", border: "3px solid #f59e0b" }} />
              ) : (
                <div className="kiosk-avatar" style={{ background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>
                  {person.first_name[0]}{person.last_name[0]}
                </div>
              )}
              <div>
                <div className="kiosk-name">{person.first_name} {person.last_name}</div>
                <div className="kiosk-pid">{person.pid} · Volunteer</div>
                <div style={{ display: "inline-block", marginTop: 6, padding: "3px 12px", background: "#fef9c3", color: "#b45309", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  ● Clocked in since {fmt12(activeLog.clock_in)} ({elapsed(activeLog.clock_in)})
                </div>
              </div>
            </div>

            <div style={{ background: "#fff7ed", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 15 }}>
              <span style={{ color: "#92400e" }}>Task:</span> <strong style={{ color: "#0f2942" }}>{activeLog.task}</strong>
            </div>

            <div className="kiosk-action-row">
              <button className="kiosk-btn-red" onClick={handleClockOut} disabled={processing}>
                {processing ? "⏳ Clocking Out…" : "✓ CLOCK OUT"}
              </button>
              <button className="kiosk-btn-cancel" onClick={() => { setKioskState("idle"); setInputVal(""); setPerson(null); setActiveLog(null); cancelReset(); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS: CLOCKED IN ── */}
        {kioskState === "success_in" && person && (
          <div className="kiosk-success-card" style={{ background: "#16a34a" }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Clocked In!</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{person.first_name} {person.last_name}</div>
            <div style={{ fontSize: 18, opacity: 0.85, marginBottom: 4 }}>{timeStr}</div>
            <div style={{ fontSize: 16, opacity: 0.75, marginBottom: 24 }}>Task: {selectedTask}</div>
            <div style={{ fontSize: 14, opacity: 0.6 }}>This screen will reset in a moment…</div>
          </div>
        )}

        {/* ── SUCCESS: CLOCKED OUT ── */}
        {kioskState === "success_out" && person && activeLog && (
          <div className="kiosk-success-card" style={{ background: "#0f2942", border: "2px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 72, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>See you next time!</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{person.first_name} {person.last_name}</div>
            <div style={{ fontSize: 18, opacity: 0.85, marginBottom: 4 }}>Clocked out at {timeStr}</div>
            {activeLog.hours != null && (
              <div style={{ fontSize: 28, fontWeight: 900, color: "#1a8a8a", marginBottom: 4 }}>
                {activeLog.hours.toFixed(2)} hours logged
              </div>
            )}
            <div style={{ fontSize: 16, opacity: 0.75, marginBottom: 24 }}>Task: {activeLog.task}</div>
            <div style={{ fontSize: 14, opacity: 0.5 }}>This screen will reset in a moment…</div>
          </div>
        )}

        {/* ── ERROR ── */}
        {kioskState === "error" && (
          <div className="kiosk-success-card" style={{ background: "#7f1d1d", border: "2px solid #fca5a5" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Not Found</div>
            <div style={{ fontSize: 16, opacity: 0.85, lineHeight: 1.5, marginBottom: 20 }}>{errMsg}</div>

            {/* Debug info panel — shows what was searched for staff troubleshooting */}
            {debugLines.length > 0 && (
              <div style={{
                background: "rgba(0,0,0,0.35)", borderRadius: 8,
                padding: "12px 16px", marginBottom: 20,
                textAlign: "left", maxWidth: 480, margin: "0 auto 20px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fca5a5", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                  Debug Info (staff only)
                </div>
                {debugLines.map((line, i) => (
                  <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", lineHeight: 1.7 }}>
                    {line}
                  </div>
                ))}
              </div>
            )}

            <button
              style={{ padding: "12px 32px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
              onClick={() => { setKioskState("idle"); setInputVal(""); setErrMsg(""); setDebugLines([]); cancelReset(); }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── TODAY'S ACTIVITY (idle only) ── */}
        {(kioskState === "idle" || kioskState === "lookup") && (
          <div className="kiosk-active-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                Currently Volunteering ({activeToday.length})
              </div>
              {completedToday.length > 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {completedToday.length} completed today
                </div>
              )}
            </div>

            {activeToday.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", padding: "12px 0" }}>
                No volunteers currently checked in
              </div>
            ) : (
              <div className="kiosk-active-grid">
                {activeToday.map((log) => (
                  <div key={log.id} className="kiosk-active-chip">
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{log.person_name}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                      Since {fmt12(log.clock_in)} · {elapsed(log.clock_in)}
                    </div>
                    <div style={{ fontSize: 11, color: "#1a8a8a", marginTop: 3, fontWeight: 600 }}>{log.task}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="kiosk-footer">
        <div className="kiosk-footer-text">
          ShelterTrace · Volunteer Time Clock · Morgan County Animal Services
        </div>
        <a href="/volunteers" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
          Staff View →
        </a>
      </div>
    </div>
  );
}
