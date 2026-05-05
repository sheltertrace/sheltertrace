"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchPeople, fetchVolunteerLogs } from "@/lib/data";
import type { Person, VolunteerLog } from "@/lib/types";
import { today, formatDate } from "@/lib/utils";
import Link from "next/link";

const TASKS = ["Dog Walking", "Cat Socialization", "Kennel Cleaning", "Administrative", "Photography", "Transport", "Training", "Events", "Laundry / Dishes", "Other"];

function fmt12(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState<Person[]>([]);
  const [logs, setLogs]             = useState<VolunteerLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"roster" | "today" | "hours" | "report">("today");

  // Filters for report
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0];
  });
  const [filterTo,   setFilterTo]   = useState(today());
  const [filterVol,  setFilterVol]  = useState("");

  // Email modal
  const [showEmail,     setShowEmail]     = useState(false);
  const [emailSubject,  setEmailSubject]  = useState("");
  const [emailBody,     setEmailBody]     = useState("");

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([fetchPeople(), fetchVolunteerLogs()]);
      setVolunteers(p.filter((x) => x.role === "Volunteer"));
      setLogs(l);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayLogs   = useMemo(() => logs.filter((l) => l.date === today()), [logs]);
  const activeLogs  = useMemo(() => todayLogs.filter((l) => !l.clock_out), [todayLogs]);
  const totalHoursAllTime = useMemo(() => logs.reduce((s, l) => s + (l.hours || 0), 0), [logs]);

  // Report: filter by date range + volunteer
  const reportLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filterFrom && l.date < filterFrom) return false;
      if (filterTo   && l.date > filterTo)   return false;
      if (filterVol  && l.person_id !== filterVol) return false;
      return true;
    });
  }, [logs, filterFrom, filterTo, filterVol]);

  const reportTotal = useMemo(() => reportLogs.reduce((s, l) => s + (l.hours || 0), 0), [reportLogs]);

  const hoursByVol = useMemo(() => {
    const m: Record<string, { name: string; hours: number; shifts: number }> = {};
    reportLogs.forEach((l) => {
      if (!m[l.person_id]) m[l.person_id] = { name: l.person_name, hours: 0, shifts: 0 };
      m[l.person_id].hours  += l.hours  || 0;
      m[l.person_id].shifts += 1;
    });
    return Object.values(m).sort((a, b) => b.hours - a.hours);
  }, [reportLogs]);

  const taskBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    reportLogs.filter((l) => l.hours).forEach((l) => { m[l.task] = (m[l.task] || 0) + (l.hours || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [reportLogs]);

  const printReport = () => {
    const rows = hoursByVol.map((v) =>
      `<tr><td>${v.name}</td><td style="text-align:center">${v.shifts}</td><td style="text-align:right;font-weight:700">${v.hours.toFixed(2)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Volunteer Hours Report</title>
<style>body{font-family:Arial,sans-serif;padding:1in;font-size:11pt}h1{font-size:16pt;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:10pt}td{padding:6px 10px;border-bottom:1px solid #e2e8f0}tfoot td{font-weight:700;border-top:2px solid #333}.meta{color:#64748b;font-size:10pt;margin-bottom:20px}</style></head>
<body><h1>Volunteer Hours Report</h1>
<div class="meta">Morgan County Animal Services · ${filterFrom} to ${filterTo}</div>
<table><thead><tr><th>Volunteer</th><th style="text-align:center">Shifts</th><th style="text-align:right">Total Hours</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td>TOTAL (${hoursByVol.length} volunteers)</td><td></td><td style="text-align:right">${reportTotal.toFixed(2)}</td></tr></tfoot>
</table></body></html>`;
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <AppShell title="Volunteer Management">
      {/* Stat row */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Registered Volunteers", value: volunteers.length, color: "#6366f1", icon: "👥" },
          { label: "Clocked In Now",         value: activeLogs.length, color: "#22c55e", icon: "🟢" },
          { label: "Shifts Today",            value: todayLogs.length,  color: "#f59e0b", icon: "📋" },
          { label: "Total Hours Logged",      value: `${totalHoursAllTime.toFixed(1)}h`, color: "#0ea5e9", icon: "⏱️" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Kiosk link banner */}
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🖥️ Volunteer Kiosk Mode</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 12 }}>Open the self-service clock-in screen on a tablet at the front desk</span>
        </div>
        <Link href="/volunteer-clock" target="_blank" className="btn btn-primary btn-sm">
          Open Kiosk →
        </Link>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { key: "today",   label: `Today's Activity (${todayLogs.length})` },
          { key: "roster",  label: `Volunteer Roster (${volunteers.length})` },
          { key: "hours",   label: "Hours Log" },
          { key: "report",  label: "Hours Report" },
        ].map(({ key, label }) => (
          <div key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as typeof tab)}>{label}</div>
        ))}
      </div>

      {/* ── TODAY'S ACTIVITY ── */}
      {tab === "today" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
              Currently Clocked In ({activeLogs.length})
            </div>
            {activeLogs.length === 0 ? (
              <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>No one clocked in right now</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Volunteer</th><th>Task</th><th>Since</th></tr></thead>
                <tbody>
                  {activeLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.person_name}</td>
                      <td style={{ fontSize: 12 }}>{l.task}</td>
                      <td style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>{fmt12(l.clock_in)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
              Completed Shifts Today ({todayLogs.filter((l) => l.clock_out).length})
            </div>
            {todayLogs.filter((l) => l.clock_out).length === 0 ? (
              <div style={{ padding: 20, color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>No completed shifts yet today</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Volunteer</th><th>Task</th><th>In</th><th>Out</th><th>Hrs</th></tr></thead>
                <tbody>
                  {todayLogs.filter((l) => l.clock_out).map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.person_name}</td>
                      <td style={{ fontSize: 12 }}>{l.task}</td>
                      <td style={{ fontSize: 12 }}>{fmt12(l.clock_in)}</td>
                      <td style={{ fontSize: 12 }}>{l.clock_out ? fmt12(l.clock_out) : "—"}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: "var(--teal)" }}>{l.hours?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ROSTER ── */}
      {tab === "roster" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEmail(true)}>📧 Mass Email</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>PID</th><th>Phone</th><th>Email</th><th>Total Hours</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="empty-state">Loading…</td></tr>
                  : volunteers.length === 0 ? <tr><td colSpan={5} className="empty-state">No volunteers registered (add via People with role "Volunteer")</td></tr>
                  : volunteers.map((v) => {
                    const hrs = logs.filter((l) => l.person_id === v.id && l.hours).reduce((s, l) => s + (l.hours || 0), 0);
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 700 }}>{v.first_name} {v.last_name}</td>
                        <td style={{ fontSize: 12, fontFamily: "monospace" }}>{v.pid || "—"}</td>
                        <td style={{ fontSize: 12 }}>{v.phone || "—"}</td>
                        <td style={{ fontSize: 12 }}>{v.email || "—"}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: hrs > 0 ? "var(--teal)" : "var(--text-muted)" }}>{hrs.toFixed(1)}h</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HOURS LOG ── */}
      {tab === "hours" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Volunteer</th><th>Task</th><th>Clock In</th><th>Clock Out</th><th>Hours</th></tr></thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={6} className="empty-state">No shifts logged yet</td></tr>
                : logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{formatDate(l.date)}</td>
                    <td style={{ fontWeight: 600 }}>{l.person_name}</td>
                    <td style={{ fontSize: 12 }}>{l.task}</td>
                    <td style={{ fontSize: 12 }}>{fmt12(l.clock_in)}</td>
                    <td style={{ fontSize: 12 }}>{l.clock_out ? fmt12(l.clock_out) : <span style={{ color: "#16a34a", fontWeight: 600 }}>Active</span>}</td>
                    <td style={{ fontSize: 12, fontWeight: 700, color: l.hours ? "var(--teal)" : "var(--text-muted)" }}>
                      {l.hours != null ? `${l.hours.toFixed(2)}h` : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── HOURS REPORT ── */}
      {tab === "report" && (
        <div>
          {/* Filters */}
          <div className="card" style={{ padding: "14px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                <label className="form-label">From</label>
                <input type="date" className="form-input" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                <label className="form-label">To</label>
                <input type="date" className="form-input" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
                <label className="form-label">Volunteer</label>
                <select className="form-select" value={filterVol} onChange={(e) => setFilterVol(e.target.value)}>
                  <option value="">All Volunteers</option>
                  {volunteers.map((v) => <option key={v.id} value={v.id}>{v.first_name} {v.last_name}</option>)}
                </select>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={printReport}>🖨 Print Report</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
            {/* By volunteer */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
                Hours by Volunteer ({reportLogs.length} shifts · {reportTotal.toFixed(2)}h total)
              </div>
              <table className="data-table">
                <thead><tr><th>Volunteer</th><th style={{ textAlign: "right" }}>Shifts</th><th style={{ textAlign: "right" }}>Hours</th></tr></thead>
                <tbody>
                  {hoursByVol.length === 0 ? <tr><td colSpan={3} className="empty-state">No data for selected range</td></tr>
                    : hoursByVol.map((v) => (
                      <tr key={v.name}>
                        <td style={{ fontWeight: 600 }}>{v.name}</td>
                        <td style={{ fontSize: 12, textAlign: "right" }}>{v.shifts}</td>
                        <td style={{ fontWeight: 700, color: "var(--teal)", textAlign: "right" }}>{v.hours.toFixed(2)}h</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* By task */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Hours by Task</div>
              {taskBreakdown.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>No data</div>
              ) : (
                taskBreakdown.map(([task, hrs]) => (
                  <div key={task} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{task}</span>
                    <span style={{ fontWeight: 700, color: "var(--teal)" }}>{hrs.toFixed(1)}h</span>
                  </div>
                ))
              )}
              {taskBreakdown.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 700, fontSize: 14, marginTop: 4, borderTop: "1px solid var(--border)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--teal)" }}>{reportTotal.toFixed(1)}h</span>
                </div>
              )}
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
                Sending to {volunteers.filter((v) => v.email).length} of {volunteers.length} volunteers with email on file.
              </div>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject…" />
              </div>
              <div className="form-group">
                <label className="form-label">Message</label>
                <textarea className="form-textarea" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5} placeholder="Email body…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEmail(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const emails = volunteers.filter((v) => v.email).map((v) => v.email).join(",");
                window.open(`mailto:${emails}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
                setShowEmail(false);
              }}>Open Email Client</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
