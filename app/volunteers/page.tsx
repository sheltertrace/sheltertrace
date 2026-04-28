"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchPeople } from "@/lib/data";
import type { Person } from "@/lib/types";
import { today, nowTime, genId } from "@/lib/utils";

interface ShiftEntry {
  id: string;
  name: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  task: string;
}

const TASKS = ["Dog Walking", "Cat Socialization", "Kennel Cleaning", "Administrative", "Events", "Photography", "Transport", "Training", "Other"];

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<ShiftEntry[]>([]);
  const [tab, setTab] = useState<"portal" | "roster" | "hours">("portal");
  const [clockedIn, setClockedIn] = useState<ShiftEntry | null>(null);
  const [selectedVol, setSelectedVol] = useState("");
  const [selectedTask, setSelectedTask] = useState(TASKS[0]);
  const [showEmail, setShowEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await fetchPeople();
      setVolunteers(p.filter((x) => x.role === "Volunteer"));
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const saved = sessionStorage.getItem("volunteer_shifts");
    if (saved) setShifts(JSON.parse(saved));
    const active = sessionStorage.getItem("volunteer_active");
    if (active) setClockedIn(JSON.parse(active));
  }, [load]);

  const saveShifts = (s: ShiftEntry[]) => {
    setShifts(s);
    sessionStorage.setItem("volunteer_shifts", JSON.stringify(s));
  };

  const handleClockIn = () => {
    if (!selectedVol) return;
    const vol = volunteers.find((v) => v.id === selectedVol);
    if (!vol) return;
    const entry: ShiftEntry = {
      id: genId(),
      name: `${vol.first_name} ${vol.last_name}`,
      date: today(),
      clockIn: nowTime(),
      clockOut: null,
      hours: null,
      task: selectedTask,
    };
    setClockedIn(entry);
    sessionStorage.setItem("volunteer_active", JSON.stringify(entry));
  };

  const handleClockOut = () => {
    if (!clockedIn) return;
    const now = new Date();
    const [inH, inM] = clockedIn.clockIn.split(":").map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = now.getHours() * 60 + now.getMinutes();
    const diffH = Math.round(((outMinutes - inMinutes + 1440) % 1440) * 10) / 600;
    const clockOut = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const completed = { ...clockedIn, clockOut, hours: diffH };
    saveShifts([completed, ...shifts]);
    setClockedIn(null);
    sessionStorage.removeItem("volunteer_active");
  };

  const totalHours = useMemo(() => {
    return shifts.reduce((s, sh) => s + (sh.hours || 0), 0);
  }, [shifts]);

  const hoursByVol = useMemo(() => {
    const m: Record<string, number> = {};
    shifts.forEach((s) => { m[s.name] = (m[s.name] || 0) + (s.hours || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [shifts]);

  const todayShifts = useMemo(() => shifts.filter((s) => s.date === today()), [shifts]);

  return (
    <AppShell title="Volunteer Portal">
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Active Volunteers", value: volunteers.length, color: "#6366f1", icon: "👥" },
          { label: "Clocked In Today", value: (clockedIn ? 1 : 0) + todayShifts.filter((s) => s.clockOut).length, color: "#22c55e", icon: "🟢" },
          { label: "Hours This Session", value: `${totalHours.toFixed(1)}h`, color: "#f59e0b", icon: "⏱️" },
          { label: "Shifts Logged", value: shifts.length, color: "#0ea5e9", icon: "📋" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: "portal", label: "Clock In/Out" },
          { key: "roster", label: `Volunteer Roster (${volunteers.length})` },
          { key: "hours", label: `Hours Log (${shifts.length})` },
        ].map(({ key, label }) => (
          <div key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as typeof tab)}>{label}</div>
        ))}
      </div>

      {/* Clock In/Out Portal */}
      {tab === "portal" && (
        <div style={{ maxWidth: 540 }}>
          {clockedIn ? (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🟢</div>
              <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4 }}>{clockedIn.name}</div>
              <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Clocked in at {clockedIn.clockIn}</div>
              <div style={{ fontSize: 14, marginBottom: 20, color: "var(--teal)", fontWeight: 600 }}>Task: {clockedIn.task}</div>
              <button className="btn btn-danger" style={{ minWidth: 160 }} onClick={handleClockOut}>Clock Out</button>
            </div>
          ) : (
            <div className="card">
              <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Clock In</h3>
              <div className="form-group">
                <label className="form-label">Select Volunteer</label>
                <select className="form-select" value={selectedVol} onChange={(e) => setSelectedVol(e.target.value)}>
                  <option value="">— Select —</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Task</label>
                <select className="form-select" value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)}>
                  {TASKS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" disabled={!selectedVol} onClick={handleClockIn} style={{ marginTop: 8 }}>Clock In</button>
            </div>
          )}

          {/* Today's Shifts */}
          {todayShifts.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Today's Completed Shifts</div>
              {todayShifts.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{s.task}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>{s.clockIn} – {s.clockOut} ({s.hours?.toFixed(1)}h)</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Volunteer Roster */}
      {tab === "roster" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEmail(true)}>📧 Mass Email</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Total Hours</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="empty-state">Loading…</td></tr>
                  : volunteers.length === 0 ? <tr><td colSpan={4} className="empty-state">No volunteers registered</td></tr>
                  : volunteers.map((v) => {
                    const hrs = shifts.filter((s) => s.name === `${v.first_name} ${v.last_name}`).reduce((s, sh) => s + (sh.hours || 0), 0);
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 700 }}>{v.first_name} {v.last_name}</td>
                        <td style={{ fontSize: 12 }}>{v.phone || "—"}</td>
                        <td style={{ fontSize: 12 }}>{v.email || "—"}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: "var(--teal)" }}>{hrs.toFixed(1)}h</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hours Log */}
      {tab === "hours" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Volunteer</th><th>Task</th><th>Clock In</th><th>Clock Out</th><th>Hours</th></tr></thead>
              <tbody>
                {shifts.length === 0 ? <tr><td colSpan={6} className="empty-state">No shifts logged this session</td></tr>
                  : shifts.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontSize: 12 }}>{s.date}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ fontSize: 12 }}>{s.task}</td>
                      <td style={{ fontSize: 12 }}>{s.clockIn}</td>
                      <td style={{ fontSize: 12 }}>{s.clockOut || "Active"}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{s.hours != null ? `${s.hours.toFixed(1)}h` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Hours by Volunteer</div>
            {hoursByVol.length === 0 ? <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No data yet</div>
              : hoursByVol.map(([name, hrs]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                  <span>{name}</span>
                  <span style={{ fontWeight: 700, color: "var(--teal)" }}>{hrs.toFixed(1)}h</span>
                </div>
              ))
            }
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 14, marginTop: 4 }}>
              <span>Total</span>
              <span style={{ color: "var(--teal)" }}>{totalHours.toFixed(1)}h</span>
            </div>
          </div>
        </div>
      )}

      {/* Mass Email Modal */}
      {showEmail && (
        <div className="modal-overlay" onClick={() => setShowEmail(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Mass Email to Volunteers</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEmail(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                Will send to {volunteers.filter((v) => v.email).length} volunteers with email addresses.
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject…" />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-textarea" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5} placeholder="Email body…" />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Recipients: {volunteers.filter((v) => v.email).map((v) => v.email).join(", ") || "No email addresses on file"}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEmail(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const emails = volunteers.filter((v) => v.email).map((v) => v.email).join(",");
                window.open(`mailto:${emails}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
                setShowEmail(false);
              }}>Send Email</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
