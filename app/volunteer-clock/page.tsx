"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchPersonByPid, fetchActiveVolunteerLog,
  clockInVolunteer, clockOutVolunteer, fetchTodayActiveVolunteers,
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
  const [processing, setProcessing] = useState(false);
  const [activeToday, setActiveToday] = useState<VolunteerLog[]>([]);
  const [completedToday, setCompletedToday] = useState<VolunteerLog[]>([]);
  const [clockNow, setClockNow] = useState(new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Focus input whenever on idle screen
  useEffect(() => {
    if (kioskState === "idle" || kioskState === "lookup") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [kioskState]);

  const loadTodayActivity = useCallback(async () => {
    try {
      const { supabase } = await import("@/lib/supabase");
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("volunteer_logs").select("*").eq("date", todayStr)
        .order("clock_in", { ascending: false });
      const all = (data as VolunteerLog[]) || [];
      setActiveToday(all.filter((l) => !l.clock_out));
      setCompletedToday(all.filter((l) => l.clock_out));
    } catch { /* fail silently */ }
  }, []);

  useEffect(() => { loadTodayActivity(); }, [loadTodayActivity]);

  const scheduleReset = useCallback((ms = 5000) => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setKioskState("idle");
      setInputVal("");
      setPerson(null);
      setActiveLog(null);
      setErrMsg("");
    }, ms);
  }, []);

  // Cancel reset timer on any interaction
  const cancelReset = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  };

  const handleLookup = useCallback(async (raw: string) => {
    const pid = raw.trim().toUpperCase();
    if (!pid) return;
    setProcessing(true);
    setErrMsg("");
    setKioskState("lookup");
    try {
      // Accept bare numbers like "1045" and expand to "PID-01045"
      const normalized = /^\d+$/.test(pid)
        ? `PID-${pid.padStart(5, "0")}`
        : pid;
      const found = await fetchPersonByPid(normalized);
      if (!found) {
        setErrMsg(`No volunteer found for ID "${pid}". Check your ID card and try again.`);
        setKioskState("error");
        scheduleReset(6000);
        return;
      }
      if (found.role !== "Volunteer") {
        setErrMsg(`${found.first_name} ${found.last_name} is not registered as a volunteer (role: ${found.role}).`);
        setKioskState("error");
        scheduleReset(6000);
        return;
      }
      const log = await fetchActiveVolunteerLog(found.id);
      setPerson(found);
      setActiveLog(log);
      setKioskState(log ? "confirm_out" : "confirm_in");
    } catch {
      setErrMsg("System error. Please try again.");
      setKioskState("error");
      scheduleReset(4000);
    } finally {
      setProcessing(false);
    }
  }, [scheduleReset]);

  // Barcode scanner detection: fast keystrokes end with Enter or auto-submit after pause
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

    // Track chars for scanner (< 60ms between keystrokes = scanner)
    if (gap < 60 && e.key.length === 1) {
      scanBuffer.current.chars += e.key;
    } else {
      scanBuffer.current = { chars: e.key.length === 1 ? e.key : "", last: now };
    }

    // If scanner buffer has 6+ chars, schedule auto-submit
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
      scheduleReset(5000);
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
      scheduleReset(6000);
    } catch {
      setErrMsg("Clock-out failed. Please try again or see staff.");
      setKioskState("error");
      scheduleReset(5000);
    } finally {
      setProcessing(false);
    }
  };

  const timeStr = clockNow.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = clockNow.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: "100vh", background: "#0f2942", color: "#fff",
      display: "flex", flexDirection: "column" as const,
      fontFamily: "system-ui, -apple-system, sans-serif",
      userSelect: "none" as const,
    },
    header: {
      padding: "20px 32px 0",
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    },
    logo: { fontSize: 22, fontWeight: 900, letterSpacing: 0.5 },
    logoSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },
    clock: { textAlign: "right" as const },
    time: { fontSize: 40, fontWeight: 900, fontVariantNumeric: "tabular-nums" as const, letterSpacing: 2 },
    dateLabel: { fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "right" as const },
    main: { flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 24 },
    inputCard: {
      width: "100%", maxWidth: 620,
      background: "rgba(255,255,255,0.07)", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.15)",
      padding: "28px 32px",
    },
    inputLabel: { fontSize: 18, fontWeight: 700, marginBottom: 14, textAlign: "center" as const, color: "rgba(255,255,255,0.9)" },
    input: {
      width: "100%", fontSize: 28, fontWeight: 700, padding: "16px 20px",
      borderRadius: 12, border: "3px solid rgba(255,255,255,0.3)",
      background: "rgba(255,255,255,0.1)", color: "#fff",
      outline: "none", textAlign: "center" as const,
      letterSpacing: 4, fontFamily: "monospace",
    },
    inputHint: { fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" as const, marginTop: 10 },
    personCard: {
      width: "100%", maxWidth: 620,
      background: "rgba(255,255,255,0.95)", borderRadius: 16,
      color: "#0f2942", padding: "28px 32px",
    },
    successCard: {
      width: "100%", maxWidth: 620,
      borderRadius: 16, padding: "40px 32px",
      textAlign: "center" as const,
    },
    activeList: {
      width: "100%", maxWidth: 900,
      background: "rgba(255,255,255,0.05)", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.1)",
      padding: "16px 20px",
    },
  };

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={S.page} onClick={() => inputRef.current?.focus()}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>Morgan County Animal Services</div>
          <div style={S.logoSub}>Volunteer Check-In Kiosk · ShelterTrace</div>
        </div>
        <div style={S.clock}>
          <div style={S.time}>{timeStr}</div>
          <div style={S.dateLabel}>{dateStr}</div>
        </div>
      </div>

      {/* Main area */}
      <div style={S.main}>

        {/* ── IDLE / LOOKUP: ID input ── */}
        {(kioskState === "idle" || kioskState === "lookup") && (
          <div style={S.inputCard}>
            <div style={S.inputLabel}>Scan your badge or enter your Volunteer ID</div>
            <input
              ref={inputRef}
              style={S.input}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="PID-01045"
              autoComplete="off"
              spellCheck={false}
              disabled={processing}
            />
            <div style={S.inputHint}>
              {processing ? "Looking up…" : "Press Enter or scan barcode to continue"}
            </div>
            {inputVal.trim() && !processing && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  style={{ fontSize: 18, padding: "12px 40px", borderRadius: 10, background: "#1a8a8a", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}
                  onClick={() => handleLookup(inputVal)}
                >
                  Look Up →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIRM CLOCK IN ── */}
        {kioskState === "confirm_in" && person && (
          <div style={S.personCard} onClick={cancelReset}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
              {person.photo_id_url ? (
                <img src={person.photo_id_url} alt="" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #1a8a8a" }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#94a3b8" }}>
                  {person.first_name[0]}{person.last_name[0]}
                </div>
              )}
              <div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#0f2942" }}>{person.first_name} {person.last_name}</div>
                <div style={{ fontSize: 15, color: "#64748b", marginTop: 2 }}>{person.pid} · Volunteer</div>
                <div style={{ display: "inline-block", marginTop: 6, padding: "3px 12px", background: "#dcfce7", color: "#15803d", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  ● Not clocked in
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 10 }}>Select today's task:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TASKS.map((t) => (
                  <button
                    key={t}
                    style={{
                      padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                      border: selectedTask === t ? "2px solid #1a8a8a" : "2px solid #e2e8f0",
                      background: selectedTask === t ? "#f0fdfa" : "#f8fafc",
                      color: selectedTask === t ? "#1a8a8a" : "#475569",
                    }}
                    onClick={() => setSelectedTask(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{ flex: 1, fontSize: 22, padding: "18px", borderRadius: 12, background: "#16a34a", color: "#fff", border: "none", fontWeight: 900, cursor: "pointer", letterSpacing: 0.5 }}
                onClick={handleClockIn}
                disabled={processing}
              >
                {processing ? "⏳ Clocking In…" : "✓ CLOCK IN"}
              </button>
              <button
                style={{ padding: "18px 20px", borderRadius: 12, background: "#f1f5f9", color: "#64748b", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 15 }}
                onClick={() => { setKioskState("idle"); setInputVal(""); setPerson(null); cancelReset(); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM CLOCK OUT ── */}
        {kioskState === "confirm_out" && person && activeLog && (
          <div style={S.personCard} onClick={cancelReset}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
              {person.photo_id_url ? (
                <img src={person.photo_id_url} alt="" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid #f59e0b" }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, color: "#f59e0b" }}>
                  {person.first_name[0]}{person.last_name[0]}
                </div>
              )}
              <div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#0f2942" }}>{person.first_name} {person.last_name}</div>
                <div style={{ fontSize: 15, color: "#64748b", marginTop: 2 }}>{person.pid} · Volunteer</div>
                <div style={{ display: "inline-block", marginTop: 6, padding: "3px 12px", background: "#fef9c3", color: "#b45309", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  ● Clocked in since {fmt12(activeLog.clock_in)} ({elapsed(activeLog.clock_in)})
                </div>
              </div>
            </div>

            <div style={{ background: "#fff7ed", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 15 }}>
              <span style={{ color: "#92400e" }}>Task:</span> <strong style={{ color: "#0f2942" }}>{activeLog.task}</strong>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{ flex: 1, fontSize: 22, padding: "18px", borderRadius: 12, background: "#dc2626", color: "#fff", border: "none", fontWeight: 900, cursor: "pointer", letterSpacing: 0.5 }}
                onClick={handleClockOut}
                disabled={processing}
              >
                {processing ? "⏳ Clocking Out…" : "✓ CLOCK OUT"}
              </button>
              <button
                style={{ padding: "18px 20px", borderRadius: 12, background: "#f1f5f9", color: "#64748b", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 15 }}
                onClick={() => { setKioskState("idle"); setInputVal(""); setPerson(null); setActiveLog(null); cancelReset(); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS: CLOCKED IN ── */}
        {kioskState === "success_in" && person && (
          <div style={{ ...S.successCard, background: "#16a34a" }}>
            <div style={{ fontSize: 80, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>Clocked In!</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{person.first_name} {person.last_name}</div>
            <div style={{ fontSize: 18, opacity: 0.85, marginBottom: 4 }}>{timeStr}</div>
            <div style={{ fontSize: 16, opacity: 0.75, marginBottom: 24 }}>Task: {selectedTask}</div>
            <div style={{ fontSize: 14, opacity: 0.6 }}>This screen will reset in a moment…</div>
          </div>
        )}

        {/* ── SUCCESS: CLOCKED OUT ── */}
        {kioskState === "success_out" && person && activeLog && (
          <div style={{ ...S.successCard, background: "#0f2942", border: "2px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: 80, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 6 }}>See you next time!</div>
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
          <div style={{ ...S.successCard, background: "#7f1d1d", border: "2px solid #fca5a5", maxWidth: 600 }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>ID Not Found</div>
            <div style={{ fontSize: 16, opacity: 0.85, lineHeight: 1.5, marginBottom: 20 }}>{errMsg}</div>
            <button
              style={{ padding: "12px 32px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#fff", border: "2px solid rgba(255,255,255,0.3)", fontWeight: 700, fontSize: 16, cursor: "pointer" }}
              onClick={() => { setKioskState("idle"); setInputVal(""); setErrMsg(""); cancelReset(); }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── TODAY'S ACTIVITY ── */}
        {(kioskState === "idle" || kioskState === "lookup") && (
          <div style={S.activeList}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {activeToday.map((log) => (
                  <div key={log.id} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 16px", minWidth: 200, flex: "1 1 200px" }}>
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
      <div style={{ padding: "12px 32px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          ShelterTrace · Volunteer Time Clock · Morgan County Animal Services
        </div>
        <a href="/volunteers" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
          Staff View →
        </a>
      </div>
    </div>
  );
}
