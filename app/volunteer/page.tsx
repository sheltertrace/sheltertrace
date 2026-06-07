"use client";
import { useState, useEffect, useCallback } from "react";
import {
  fetchPersonByPid, fetchActiveVolunteerLog, fetchVolunteerLogs,
  clockInVolunteer, clockOutVolunteer, fetchVolunteerAnnouncements,
} from "@/lib/data";
import type { Person, VolunteerLog } from "@/lib/types";
import { AGENCY_NAME, AGENCY_SHORT } from "@/lib/shelterInfo";

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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function elapsed(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}
function getMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}
function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function get30DaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

interface PortalSession {
  personId: string;
  pid: string;
  firstName: string;
  lastName: string;
}

export default function VolunteerPortalPage() {
  const [authState, setAuthState] = useState<"login" | "portal">("login");
  const [pidInput, setPidInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [activeLog, setActiveLog] = useState<VolunteerLog | null>(null);
  const [logs, setLogs] = useState<VolunteerLog[]>([]);
  const [announcements, setAnnouncements] = useState("");
  const [selectedTask, setSelectedTask] = useState(TASKS[0]);
  const [clockNow, setClockNow] = useState(new Date());
  const [processing, setProcessing] = useState(false);
  const [clockMsg, setClockMsg] = useState("");

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check for saved session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vol_portal_session");
      if (raw) {
        const s: PortalSession = JSON.parse(raw);
        setSession(s);
        setAuthState("portal");
      }
    } catch { /* ignore */ }
  }, []);

  const loadPortalData = useCallback(async (personId: string) => {
    try {
      const [log, allLogs, ann] = await Promise.all([
        fetchActiveVolunteerLog(personId),
        fetchVolunteerLogs({ personId }),
        fetchVolunteerAnnouncements(),
      ]);
      setActiveLog(log);
      setLogs(allLogs.filter((l) => l.date >= get30DaysAgo()));
      setAnnouncements(ann);
    } catch { /* fail silently */ }
  }, []);

  useEffect(() => {
    if (authState === "portal" && session) {
      loadPortalData(session.personId);
    }
  }, [authState, session, loadPortalData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const pidRaw = pidInput.trim().toUpperCase();
      const normalized = /^\d+$/.test(pidRaw)
        ? `PID-${pidRaw.padStart(5, "0")}`
        : pidRaw;
      const found = await fetchPersonByPid(normalized);
      if (!found) {
        setAuthError("Volunteer ID not found. Check your ID card and try again.");
        return;
      }
      if (found.role !== "Volunteer") {
        setAuthError("This ID is not registered as a volunteer account.");
        return;
      }
      if (found.last_name.toLowerCase() !== lastNameInput.trim().toLowerCase()) {
        setAuthError("Last name does not match. Please try again.");
        return;
      }
      const s: PortalSession = {
        personId: found.id,
        pid: normalized,
        firstName: found.first_name,
        lastName: found.last_name,
      };
      localStorage.setItem("vol_portal_session", JSON.stringify(s));
      setPerson(found);
      setSession(s);
      setAuthState("portal");
    } catch {
      setAuthError("System error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("vol_portal_session");
    setSession(null);
    setPerson(null);
    setActiveLog(null);
    setLogs([]);
    setPidInput("");
    setLastNameInput("");
    setAuthState("login");
  };

  const handleClockIn = async () => {
    if (!session) return;
    setProcessing(true);
    setClockMsg("");
    try {
      const log = await clockInVolunteer(session.personId, `${session.firstName} ${session.lastName}`, selectedTask);
      setActiveLog(log);
      setClockMsg("You are now clocked in!");
      await loadPortalData(session.personId);
    } catch {
      setClockMsg("Clock-in failed. Please try again or see staff.");
    } finally {
      setProcessing(false);
      setTimeout(() => setClockMsg(""), 3000);
    }
  };

  const handleClockOut = async () => {
    if (!activeLog) return;
    setProcessing(true);
    setClockMsg("");
    try {
      const result = await clockOutVolunteer(activeLog.id);
      setActiveLog(null);
      setClockMsg(`Clocked out! ${result.hours?.toFixed(2) ?? "—"} hours logged.`);
      await loadPortalData(session!.personId);
    } catch {
      setClockMsg("Clock-out failed. Please try again or see staff.");
    } finally {
      setProcessing(false);
      setTimeout(() => setClockMsg(""), 4000);
    }
  };

  // Compute stats
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  const yearStart = getYearStart();
  const weekHours   = logs.filter((l) => l.date >= weekStart).reduce((s, l) => s + (l.hours || 0), 0);
  const monthHours  = logs.filter((l) => l.date >= monthStart).reduce((s, l) => s + (l.hours || 0), 0);
  const yearHours   = logs.filter((l) => l.date >= yearStart).reduce((s, l) => s + (l.hours || 0), 0);

  const greeting = () => {
    const h = clockNow.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  // ── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if (authState === "login") {
    return (
      <div style={{
        minHeight: "100vh", background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #d1fae5 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🐾</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#14532d" }}>Volunteer Portal</div>
            <div style={{ fontSize: 14, color: "#4ade80", marginTop: 4 }}>{AGENCY_NAME}</div>
          </div>

          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Volunteer ID
                </label>
                <input
                  type="text"
                  value={pidInput}
                  onChange={(e) => setPidInput(e.target.value)}
                  placeholder="PID-01045 or 1045"
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 10,
                    border: "2px solid #e5e7eb", fontSize: 16,
                    fontFamily: "monospace", letterSpacing: 2,
                    outline: "none", color: "#111",
                  }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastNameInput}
                  onChange={(e) => setLastNameInput(e.target.value)}
                  placeholder="Smith"
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 10,
                    border: "2px solid #e5e7eb", fontSize: 16,
                    outline: "none", color: "#111",
                  }}
                />
              </div>

              {authError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c", marginBottom: 16 }}>
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading || !pidInput.trim() || !lastNameInput.trim()}
                style={{
                  width: "100%", padding: "16px", borderRadius: 12,
                  background: pidInput.trim() && lastNameInput.trim() ? "#16a34a" : "#d1d5db",
                  color: "#fff", border: "none", fontSize: 17,
                  fontWeight: 800, cursor: pidInput.trim() && lastNameInput.trim() ? "pointer" : "default",
                }}
              >
                {authLoading ? "Signing in…" : "Sign In →"}
              </button>
            </form>
          </div>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#6b7280" }}>
            Don&apos;t have an ID? Ask a staff member to register you.
          </div>
        </div>
      </div>
    );
  }

  // ── PORTAL DASHBOARD ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f9fafb",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{ background: "#16a34a", color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>🐾 Volunteer Portal</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{AGENCY_NAME}</div>
        </div>
        <button
          onClick={handleSignOut}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>

        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#14532d" }}>
            {greeting()}, {session?.firstName}!
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
            {clockNow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>

        {/* Announcements (if any) */}
        {announcements && (
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#854d0e", marginBottom: 6 }}>📢 Announcements</div>
            <div style={{ fontSize: 14, color: "#713f12", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{announcements}</div>
          </div>
        )}

        {/* Clock status card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: activeLog ? "#fef9c3" : "#f0fdf4", padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: activeLog ? "#b45309" : "#14532d" }}>
              {activeLog ? "🟡 Currently Clocked In" : "⚪ Not Clocked In"}
            </div>
            {activeLog && (
              <div style={{ fontSize: 13, color: "#92400e", marginTop: 2 }}>
                Since {fmt12(activeLog.clock_in)} · {elapsed(activeLog.clock_in)} · {activeLog.task}
              </div>
            )}
          </div>

          <div style={{ padding: "18px" }}>
            {!activeLog && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Select task:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TASKS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedTask(t)}
                      style={{
                        padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: selectedTask === t ? "2px solid #16a34a" : "2px solid #e5e7eb",
                        background: selectedTask === t ? "#f0fdf4" : "#f9fafb",
                        color: selectedTask === t ? "#15803d" : "#374151",
                        cursor: "pointer", minHeight: 44,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {clockMsg && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#15803d", marginBottom: 14, fontWeight: 600 }}>
                ✅ {clockMsg}
              </div>
            )}

            <button
              onClick={activeLog ? handleClockOut : handleClockIn}
              disabled={processing}
              style={{
                width: "100%", padding: "18px", borderRadius: 12, fontSize: 18, fontWeight: 900,
                background: activeLog ? "#dc2626" : "#16a34a",
                color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              {processing
                ? (activeLog ? "Clocking Out…" : "Clocking In…")
                : (activeLog ? "✓ CLOCK OUT" : "✓ CLOCK IN")}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "This Week", hours: weekHours, color: "#6366f1" },
            { label: "This Month", hours: monthHours, color: "#0ea5e9" },
            { label: "This Year", hours: yearHours, color: "#16a34a" },
          ].map(({ label, hours, color }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{hours.toFixed(1)}h</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Recent sessions */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 14, color: "#374151" }}>
            Recent Sessions (last 30 days)
          </div>
          {logs.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No sessions in the last 30 days
            </div>
          ) : (
            <div>
              {logs.slice(0, 20).map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{l.task}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
                      {fmtDate(l.date)} · {fmt12(l.clock_in)}{l.clock_out ? ` – ${fmt12(l.clock_out)}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: l.clock_out ? "#16a34a" : "#f59e0b", flexShrink: 0, marginLeft: 12 }}>
                    {l.clock_out ? `${l.hours?.toFixed(2) ?? "—"}h` : <span style={{ fontSize: 12 }}>Active</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#d1d5db" }}>
          ShelterTrace · Volunteer Portal · {AGENCY_NAME}
        </div>
      </div>
    </div>
  );
}
