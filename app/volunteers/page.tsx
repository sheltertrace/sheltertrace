"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchPeople, fetchVolunteerLogs, fetchVolunteerAnnouncements, saveVolunteerAnnouncements, updatePerson, fetchForms, fetchVolunteerApplications, updateVolunteerApplication, createPerson, genNextPid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Person, VolunteerLog, ShelterForm, VolunteerApplication } from "@/lib/types";
import { today, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddVolunteerModal, { printBadge } from "@/components/volunteers/AddVolunteerModal";
import DateInput from "@/components/ui/DateInput";
import { AGENCY_NAME, AGENCY_SHORT, AGENCY_ADDRESS, AGENCY_PHONE_DOTS } from "@/lib/shelterInfo";

const TASKS = ["Dog Walking", "Cat Socialization", "Kennel Cleaning", "Administrative", "Photography", "Transport", "Training", "Events", "Laundry / Dishes", "Other"];

// Safely parse any JSONB array field that Supabase may return as a JSON string,
// a real array, a plain string, or null/undefined.
function safeStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.startsWith("[")) {
      try { return JSON.parse(trimmed) as string[]; } catch { /* fall through */ }
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function fmt12(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours(), m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function VolunteersPage() {
  const router = useRouter();
  const [volunteers, setVolunteers] = useState<Person[]>([]);
  const [logs, setLogs]             = useState<VolunteerLog[]>([]);
  const [volForms, setVolForms]     = useState<ShelterForm[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"roster" | "today" | "hours" | "report" | "tools" | "applications">("today");
  const [applications, setApplications] = useState<VolunteerApplication[]>([]);
  const [reviewingApp, setReviewingApp] = useState<VolunteerApplication | null>(null);
  const [reviewNotes, setReviewNotes]   = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [appFilter, setAppFilter]       = useState<"all" | "pending" | "approved" | "rejected" | "more_info">("pending");

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

  // QR code modal
  const [showQR, setShowQR] = useState(false);

  // Add / edit / view volunteer modals
  const [showAddVolunteer, setShowAddVolunteer] = useState(false);
  const [editVolunteer, setEditVolunteer] = useState<Person | null>(null);

  // Tools tab
  const [announcements,    setAnnouncements]    = useState("");
  const [announcementsOrig, setAnnouncementsOrig] = useState("");
  const [annSaving,        setAnnSaving]        = useState(false);
  const [annSaved,         setAnnSaved]         = useState(false);

  // Direct diagnostic: bypasses fetchVolunteerApplications entirely to confirm
  // what the DB actually returns for this table with this client.
  useEffect(() => {
    console.log("[applications] direct diagnostic query starting...");
    supabase
      .from("volunteer_applications")
      .select("id, first_name, last_name, status, submitted_at")
      .then((res: { data: unknown; error: unknown }) => {
        console.log("[applications] DIRECT result:", JSON.stringify(res.data), "error:", JSON.stringify(res.error));
      });
  }, []);

  const load = useCallback(async () => {
    try {
      const [p, l, ann, apps, agrs, confs, volApps] = await Promise.all([
        fetchPeople(), fetchVolunteerLogs(), fetchVolunteerAnnouncements(),
        fetchForms("volunteer_application"), fetchForms("volunteer_agreement"), fetchForms("volunteer_confidentiality"),
        fetchVolunteerApplications(),
      ]);
      setVolunteers(p.filter((x) => (x.role || "").toLowerCase().startsWith("volunteer")));
      setLogs(l);
      setAnnouncements(ann);
      setAnnouncementsOrig(ann);
      setVolForms([...apps, ...agrs, ...confs]);
      setApplications(volApps);
    } catch (err) {
      console.error("[volunteers] load() failed:", err);
    } finally { setLoading(false); }
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
<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;padding:1in;font-size:11pt}h1{font-size:16pt;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:14px}th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:10pt}td{padding:6px 10px;border-bottom:1px solid #e2e8f0}tfoot td{font-weight:700;border-top:2px solid #333}.meta{color:#64748b;font-size:10pt;margin-bottom:20px}</style></head>
<body><h1>Volunteer Hours Report</h1>
<div class="meta">{AGENCY_NAME} · ${filterFrom} to ${filterTo}</div>
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

      {/* Access banner */}
      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🖥️ Volunteer Access</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 12 }}>Kiosk clock-in tablet · personal volunteer portal · QR codes for posting</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddVolunteer(true)}>+ Add Volunteer</button>
          <Link href="/volunteers/forms" className="btn btn-secondary btn-sm">📋 Volunteer Forms</Link>
          <Link href="/volunteer-clock" target="_blank" className="btn btn-secondary btn-sm">Open Kiosk →</Link>
          <Link href="/volunteer" target="_blank" className="btn btn-secondary btn-sm">Volunteer Portal →</Link>
          <Link href="/volunteer-apply" target="_blank" className="btn btn-secondary btn-sm">📝 Apply Page →</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowQR(true)}>📲 QR Codes</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { key: "today",        label: `Today's Activity (${todayLogs.length})` },
          { key: "roster",       label: `Volunteer Roster (${volunteers.length})` },
          { key: "hours",        label: "Hours Log" },
          { key: "report",       label: "Hours Report" },
          { key: "tools",        label: "⚙ Tools" },
          { key: "applications", label: "Applications", badge: applications.filter((a) => a.status === "pending").length },
        ].map(({ key, label, badge }) => (
          <div
            key={key}
            className={`tab ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key as typeof tab)}
            style={{ position: "relative" }}
          >
            {label}
            {badge != null && badge > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 800,
                borderRadius: 999, minWidth: 18, height: 18, padding: "0 5px",
                marginLeft: 6, lineHeight: 1,
              }}>
                {badge}
              </span>
            )}
          </div>
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
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/volunteers/${l.person_id}`} style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 700 }}>{l.person_name}</Link>
                      </td>
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
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/volunteers/${l.person_id}`} style={{ color: "var(--teal)", textDecoration: "none", fontWeight: 700 }}>{l.person_name}</Link>
                      </td>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {volunteers.filter((v) => v.role === "Volunteer").length} active · {volunteers.filter((v) => v.role !== "Volunteer").length} inactive
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEmail(true)}>📧 Mass Email</button>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>PID</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th style={{ textAlign: "right" }}>Total Hrs</th>
                  <th>Last Session</th>
                  <th>Forms</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="empty-state">Loading…</td></tr>
                ) : volunteers.length === 0 ? (
                  <tr><td colSpan={9} className="empty-state">No volunteers yet — click "Add Volunteer" to register one</td></tr>
                ) : (
                  volunteers.map((v) => {
                    const volLogs = logs.filter((l) => l.person_id === v.id);
                    const hrs = volLogs.reduce((s, l) => s + (l.hours || 0), 0);
                    const lastSession = volLogs.filter((l) => l.clock_out).sort((a, b) => b.date.localeCompare(a.date))[0];
                    const isActive = v.role === "Volunteer";
                    const personForms = volForms.filter((f) => f.linked_person_id === v.id);
                    const hasApp  = personForms.some((f) => f.form_type === "volunteer_application");
                    const hasAgr  = personForms.some((f) => f.form_type === "volunteer_agreement");
                    const hasConf = personForms.some((f) => f.form_type === "volunteer_confidentiality");
                    const allDone = hasApp && hasAgr && hasConf;
                    return (
                      <tr key={v.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                        <td>
                          <Link
                            href={`/volunteers/${v.id}`}
                            style={{ fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}
                          >
                            {v.first_name} {v.last_name}
                          </Link>
                        </td>
                        <td style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{v.pid || "—"}</td>
                        <td style={{ fontSize: 12 }}>{v.phone || "—"}</td>
                        <td style={{ fontSize: 12 }}>{v.email || "—"}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: hrs > 0 ? "var(--teal)" : "var(--text-muted)", textAlign: "right" }}>{hrs.toFixed(1)}h</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{lastSession ? formatDate(lastSession.date) : "—"}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <span title="Volunteer Application" style={{ fontSize: 10, padding: "1px 6px", borderRadius: 9, fontWeight: 700, background: hasApp ? "#dcfce7" : "#f1f5f9", color: hasApp ? "#15803d" : "#94a3b8", border: `1px solid ${hasApp ? "#86efac" : "#e2e8f0"}` }}>App{hasApp ? " ✓" : " ✗"}</span>
                            <span title="Volunteer Agreement & Release" style={{ fontSize: 10, padding: "1px 6px", borderRadius: 9, fontWeight: 700, background: hasAgr ? "#dcfce7" : "#f1f5f9", color: hasAgr ? "#15803d" : "#94a3b8", border: `1px solid ${hasAgr ? "#86efac" : "#e2e8f0"}` }}>Agr{hasAgr ? " ✓" : " ✗"}</span>
                            <span title="Volunteer Confidentiality Agreement" style={{ fontSize: 10, padding: "1px 6px", borderRadius: 9, fontWeight: 700, background: hasConf ? "#dcfce7" : "#f1f5f9", color: hasConf ? "#15803d" : "#94a3b8", border: `1px solid ${hasConf ? "#86efac" : "#e2e8f0"}` }}>Conf{hasConf ? " ✓" : " ✗"}</span>
                          </div>
                        </td>
                        <td>
                          {isActive
                            ? <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Active</span>
                            : <span style={{ fontSize: 11, background: "#f1f5f9", color: "#94a3b8", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>Inactive</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                            <button className="btn btn-ghost btn-sm" title="Print Badge" onClick={() => printBadge(v)}>🖨</button>
                            <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setEditVolunteer(v)}>✏️</button>
                            <button
                              className="btn btn-ghost btn-sm"
                              title={isActive ? "Deactivate" : "Reactivate"}
                              onClick={async () => {
                                const newRole = isActive ? "Volunteer (Inactive)" : "Volunteer";
                                const updated = await updatePerson(v.id, { role: newRole });
                                setVolunteers((prev) => prev.map((x) => x.id === v.id ? updated : x));
                              }}
                            >
                              {isActive ? "🚫" : "✅"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
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
                <DateInput className="form-input" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                <label className="form-label">To</label>
                <DateInput className="form-input" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
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

      {/* ── TOOLS ── */}
      {tab === "tools" && (() => {
        const kioskUrl = typeof window !== "undefined" ? `${window.location.origin}/volunteer-clock` : "/volunteer-clock";
        const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/volunteer` : "/volunteer";
        const qrBase = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=";

        const printQR = () => {
          const html = `<!DOCTYPE html><html><head><title>Volunteer QR Codes</title>
<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;padding:40px;text-align:center}h1{font-size:20pt;margin-bottom:6px}.pair{display:flex;justify-content:center;gap:60px;margin-top:30px}.box{text-align:center}.box img{display:block;margin:0 auto 12px}.url{font-size:9pt;color:#666;word-break:break-all;max-width:220px}.title{font-size:14pt;font-weight:bold;margin-bottom:4px}</style></head>
<body><h1>{AGENCY_NAME} — Volunteer Access</h1>
<p style="color:#666;font-size:10pt">Scan a QR code with your phone to get started</p>
<div class="pair">
  <div class="box">
    <div class="title">🖥️ Kiosk Clock-In</div>
    <p style="font-size:10pt;color:#555;margin-bottom:12px">For tablet at front desk</p>
    <img src="${qrBase}${encodeURIComponent(kioskUrl)}" width="200" height="200" />
    <div class="url">${kioskUrl}</div>
  </div>
  <div class="box">
    <div class="title">📱 My Volunteer Portal</div>
    <p style="font-size:10pt;color:#555;margin-bottom:12px">For your personal phone</p>
    <img src="${qrBase}${encodeURIComponent(portalUrl)}" width="200" height="200" />
    <div class="url">${portalUrl}</div>
  </div>
</div></body></html>`;
          const w = window.open("", "_blank", "width=760,height=600");
          if (!w) return;
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 400);
        };

        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            {/* Announcements */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📢 Volunteer Announcements</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                Shown on the volunteer portal. Leave blank to hide.
              </div>
              <textarea
                className="form-textarea"
                rows={6}
                value={announcements}
                onChange={(e) => { setAnnouncements(e.target.value); setAnnSaved(false); }}
                placeholder="Enter announcements for volunteers (e.g. upcoming events, schedule changes)…"
              />
              <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={annSaving || announcements === announcementsOrig}
                  onClick={async () => {
                    setAnnSaving(true);
                    try {
                      await saveVolunteerAnnouncements(announcements);
                      setAnnouncementsOrig(announcements);
                      setAnnSaved(true);
                      setTimeout(() => setAnnSaved(false), 3000);
                    } finally { setAnnSaving(false); }
                  }}
                >
                  {annSaving ? "Saving…" : "Save"}
                </button>
                {announcements !== announcementsOrig && !annSaving && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setAnnouncements(announcementsOrig); setAnnSaved(false); }}>
                    Discard
                  </button>
                )}
                {annSaved && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Saved</span>}
              </div>
            </div>

            {/* QR Codes */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📲 QR Codes for Volunteers</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
                Print these and post them for easy volunteer access.
              </div>
              <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`${qrBase}${encodeURIComponent(kioskUrl)}`}
                    alt="Kiosk QR"
                    width={160} height={160}
                    style={{ borderRadius: 8, border: "2px solid var(--border)" }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>🖥️ Kiosk Clock-In</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Tablet / front desk</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <img
                    src={`${qrBase}${encodeURIComponent(portalUrl)}`}
                    alt="Portal QR"
                    width={160} height={160}
                    style={{ borderRadius: 8, border: "2px solid var(--border)" }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>📱 Volunteer Portal</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Personal phone</div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={printQR} style={{ width: "100%" }}>
                🖨 Print QR Sheet
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── APPLICATIONS TAB ── */}
      {tab === "applications" && (() => {
        const filtered = applications.filter((a) => appFilter === "all" || a.status === appFilter);
        const pendingCount = applications.filter((a) => a.status === "pending").length;
        const statusColor: Record<string, string> = {
          pending:   "#f59e0b",
          approved:  "#16a34a",
          rejected:  "#dc2626",
          more_info: "#2563eb",
        };
        const statusLabel: Record<string, string> = {
          pending:   "Pending",
          approved:  "Approved",
          rejected:  "Rejected",
          more_info: "More Info",
        };

        return (
          <div>
            {/* Apply link banner */}
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 18px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#374151" }}>
                <strong>Public application link:</strong>{" "}
                <span style={{ fontFamily: "monospace", color: "#0f2942" }}>
                  {typeof window !== "undefined" ? window.location.origin : ""}/volunteer-apply
                </span>
                {" — share this with prospective volunteers or post on the county website."}
              </div>
              <a
                href="/volunteer-apply"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                View Form →
              </a>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {(["pending", "approved", "rejected", "more_info", "all"] as const).map((f) => {
                const count = f === "all" ? applications.length : applications.filter((a) => a.status === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => setAppFilter(f)}
                    className={`btn btn-sm ${appFilter === f ? "btn-primary" : "btn-secondary"}`}
                    style={f === "pending" && count > 0 && appFilter !== f ? { borderColor: "#f59e0b", color: "#b45309" } : {}}
                  >
                    {f === "all" ? "All" : statusLabel[f]} ({count})
                  </button>
                );
              })}
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={load}>↻ Refresh</button>
            </div>

            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Submitted</th>
                    <th>Interests</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="empty-state">
                      {appFilter === "pending" ? "No pending applications" : "No applications in this category"}
                    </td></tr>
                  ) : (
                    filtered.map((app) => (
                      <tr
                        key={app.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => { setReviewingApp(app); setReviewNotes(app.reviewer_notes || ""); }}
                      >
                        <td style={{ fontWeight: 700 }}>
                          {app.first_name} {app.last_name}
                          {app.pid && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{app.pid}</span>}
                        </td>
                        <td style={{ fontSize: 12 }}>{app.email || "—"}</td>
                        <td style={{ fontSize: 12 }}>{app.phone || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {new Date(app.submitted_at).toLocaleDateString()}
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {(() => { const arr = safeStringArray(app.interests); return arr.slice(0, 3).join(", ") + (arr.length > 3 ? ` +${arr.length - 3}` : ""); })()}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                            background: `${statusColor[app.status]}20`,
                            color: statusColor[app.status],
                            border: `1px solid ${statusColor[app.status]}50`,
                          }}>
                            {statusLabel[app.status] || app.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); setReviewingApp(app); setReviewNotes(app.reviewer_notes || ""); }}
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── APPLICATION REVIEW MODAL ── */}
      {reviewingApp && (() => {
        const app = reviewingApp;
        const statusColor: Record<string, string> = {
          pending: "#f59e0b", approved: "#16a34a", rejected: "#dc2626", more_info: "#2563eb",
        };

        async function handleReview(action: "approved" | "rejected" | "more_info") {
          setReviewSaving(true);
          try {
            let pid = app.pid;
            let personId = app.person_id;

            if (action === "approved" && !app.person_id) {
              pid = await genNextPid();
              const newPerson = await createPerson({
                first_name: app.first_name,
                middle_name: app.middle_name,
                last_name: app.last_name,
                email: app.email,
                phone: app.phone,
                address: app.address,
                city: app.city,
                state: app.state,
                zip: app.zip,
                dob: app.dob,
                sex: app.sex,
                role: "Volunteer",
                pid,
              });
              personId = newPerson.id;
              setVolunteers((prev) => [...prev, newPerson]);
            }

            const updated = await updateVolunteerApplication(app.id, {
              status: action,
              reviewer_notes: reviewNotes.trim() || undefined,
              reviewed_at: new Date().toISOString(),
              ...(action === "approved" ? { pid, person_id: personId } : {}),
            });
            setApplications((prev) => prev.map((a) => a.id === updated.id ? updated : a));

            if (app.email) {
              await fetch("/api/send-volunteer-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: action,
                  applicantEmail: app.email,
                  applicantName: `${app.first_name} ${app.last_name}`,
                  pid: action === "approved" ? pid : undefined,
                  reviewerNotes: reviewNotes.trim() || undefined,
                }),
              });
            }

            setReviewingApp(null);
            setReviewNotes("");
          } catch (err) {
            alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
          } finally {
            setReviewSaving(false);
          }
        }

        return (
          <div className="modal-overlay" onClick={() => setReviewingApp(null)}>
            <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">
                  Volunteer Application — {app.first_name} {app.last_name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                    background: `${(statusColor[app.status] || "#6b7280")}20`,
                    color: statusColor[app.status] || "#6b7280",
                    border: `1px solid ${(statusColor[app.status] || "#6b7280")}50`,
                  }}>
                    {app.status.replace("_", " ").toUpperCase()}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReviewingApp(null)}>✕</button>
                </div>
              </div>
              <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>

                {/* Personal info */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", marginBottom: 18, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px" }}>
                  <InfoRow label="Name"     value={[app.first_name, app.middle_name, app.last_name].filter(Boolean).join(" ")} />
                  <InfoRow label="Email"    value={app.email} />
                  <InfoRow label="Phone"    value={app.phone} />
                  <InfoRow label="DOB"      value={app.dob} />
                  <InfoRow label="Address"  value={[app.address, app.city, app.state, app.zip].filter(Boolean).join(", ")} />
                  <InfoRow label="Sex"      value={app.sex} />
                  <InfoRow label="EC Name"  value={app.emergency_contact_name} />
                  <InfoRow label="EC Phone" value={app.emergency_contact_phone} />
                </div>

                {/* Application details */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942", marginBottom: 8 }}>Volunteer Interests</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(() => {
                      const arr = safeStringArray(app.interests);
                      return arr.length === 0 ? (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>None specified</span>
                      ) : arr.map((i) => (
                        <span key={i} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 12, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 600 }}>{i}</span>
                      ));
                    })()}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px", marginBottom: 14 }}>
                  <InfoRow label="Availability" value={app.availability} />
                  <InfoRow label="Has pets"     value={app.has_animals == null ? undefined : app.has_animals ? "Yes" : "No"} />
                </div>

                {app.prior_experience && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Prior Experience</div>
                    <div style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px", lineHeight: 1.7 }}>{app.prior_experience}</div>
                  </div>
                )}

                {app.why_volunteer && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Why They Want to Volunteer</div>
                    <div style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 12px", lineHeight: 1.7 }}>{app.why_volunteer}</div>
                  </div>
                )}

                <div style={{ marginBottom: 14, display: "flex", gap: 16, fontSize: 13 }}>
                  <span style={{ color: app.agree_to_terms ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                    {app.agree_to_terms ? "✓" : "✗"} Terms agreed
                  </span>
                  <span style={{ color: app.agree_to_conduct ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                    {app.agree_to_conduct ? "✓" : "✗"} Code of conduct agreed
                  </span>
                  {app.signature_name && (
                    <span style={{ color: "#374151" }}>Signed: <em style={{ fontStyle: "italic" }}>{app.signature_name}</em></span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>
                  Submitted {new Date(app.submitted_at).toLocaleString()}
                  {app.reviewed_at && ` · Reviewed ${new Date(app.reviewed_at).toLocaleString()}`}
                  {app.reviewed_by && ` by ${app.reviewed_by}`}
                </div>

                {/* Review notes */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reviewer Notes (optional — included in email to applicant)</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes for the applicant or for internal records…"
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setReviewingApp(null)} disabled={reviewSaving}>Close</button>
                <div style={{ flex: 1 }} />
                {app.status !== "more_info" && (
                  <button
                    className="btn btn-sm"
                    style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}
                    disabled={reviewSaving}
                    onClick={() => handleReview("more_info")}
                  >
                    {reviewSaving ? "Saving…" : "📋 Request More Info"}
                  </button>
                )}
                {app.status !== "rejected" && (
                  <button
                    className="btn btn-sm"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5" }}
                    disabled={reviewSaving}
                    onClick={() => handleReview("rejected")}
                  >
                    {reviewSaving ? "Saving…" : "✗ Reject"}
                  </button>
                )}
                {app.status !== "approved" && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={reviewSaving}
                    onClick={() => handleReview("approved")}
                  >
                    {reviewSaving ? "Saving…" : "✓ Approve & Create Volunteer"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ADD VOLUNTEER MODAL ── */}
      {showAddVolunteer && (
        <AddVolunteerModal
          onClose={() => setShowAddVolunteer(false)}
          onSaved={(p) => {
            setVolunteers((prev) => [...prev, p]);
            setShowAddVolunteer(false);
          }}
        />
      )}

      {/* ── EDIT VOLUNTEER MODAL ── */}
      {editVolunteer && (
        <AddVolunteerModal
          editPerson={editVolunteer}
          onClose={() => setEditVolunteer(null)}
          onSaved={(p) => {
            setVolunteers((prev) => prev.map((x) => x.id === p.id ? p : x));
            setEditVolunteer(null);
          }}
        />
      )}

      {/* ── QR CODE MODAL ── */}
      {showQR && (() => {
        const KIOSK_URL  = "https://sheltertrace.com/volunteer-clock";
        const PORTAL_URL = "https://sheltertrace.com/volunteer";
        const qr = (url: string, size = 220) =>
          `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=${size}&margin=2`;

        const printQR = () => {
          const html = `<!DOCTYPE html><html><head><title>Volunteer QR Codes — ${AGENCY_NAME}</title>
<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
  @page { size: letter; margin: 0.75in; }
  body { font-family: Arial, sans-serif; text-align: center; color: #111; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  .sub { font-size: 11pt; color: #555; margin-bottom: 32px; }
  .pair { display: flex; justify-content: center; gap: 80px; margin-top: 24px; }
  .box { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .box img { border: 2px solid #ddd; border-radius: 8px; }
  .label { font-size: 14pt; font-weight: bold; }
  .desc  { font-size: 10pt; color: #555; max-width: 200px; line-height: 1.4; }
  .url   { font-size: 8pt; color: #888; margin-top: 4px; word-break: break-all; max-width: 200px; }
  .footer{ margin-top: 48px; font-size: 9pt; color: #aaa; }
</style></head>
<body>
  <h1>{AGENCY_NAME}</h1>
  <div class="sub">Scan a QR code with your phone's camera to get started</div>
  <div class="pair">
    <div class="box">
      <img src="${qr(KIOSK_URL, 240)}" width="240" height="240" />
      <div class="label">🖥️ Scan to Clock In / Out</div>
      <div class="desc">Use on the front-desk tablet or your phone to sign in for your volunteer shift</div>
      <div class="url">${KIOSK_URL}</div>
    </div>
    <div class="box">
      <img src="${qr(PORTAL_URL, 240)}" width="240" height="240" />
      <div class="label">📱 Scan to View Your Hours</div>
      <div class="desc">Check your volunteer hours, clock in or out, and see announcements from your phone</div>
      <div class="url">${PORTAL_URL}</div>
    </div>
  </div>
  <div class="footer">ShelterTrace · Volunteer Self-Service · sheltertrace.com</div>
</body></html>`;
          const w = window.open("", "_blank", "width=800,height=700");
          if (!w) return;
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 600);
        };

        return (
          <div className="modal-overlay" onClick={() => setShowQR(false)}>
            <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">📲 Volunteer QR Codes</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowQR(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                  Print these QR codes and post them in your shelter for volunteers to scan with their phones.
                </div>
                <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={qr(KIOSK_URL)}
                      alt="Kiosk QR Code"
                      width={200} height={200}
                      style={{ borderRadius: 10, border: "2px solid var(--border)", display: "block", margin: "0 auto 10px" }}
                    />
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>🖥️ Scan to Clock In / Out</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, maxWidth: 200 }}>
                      Front-desk kiosk or personal phone
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace", wordBreak: "break-all" }}>
                      {KIOSK_URL}
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={qr(PORTAL_URL)}
                      alt="Portal QR Code"
                      width={200} height={200}
                      style={{ borderRadius: 10, border: "2px solid var(--border)", display: "block", margin: "0 auto 10px" }}
                    />
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary)" }}>📱 Scan to View Your Hours</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, maxWidth: 200 }}>
                      Personal volunteer portal
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, fontFamily: "monospace", wordBreak: "break-all" }}>
                      {PORTAL_URL}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowQR(false)}>Close</button>
                <button className="btn btn-primary" onClick={printQR}>🖨 Print QR Sheet</button>
              </div>
            </div>
          </div>
        );
      })()}

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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ padding: "4px 0" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 6 }}>{label}:</span>
      <span style={{ fontSize: 13, color: "#111827" }}>{value || <span style={{ color: "#9ca3af" }}>—</span>}</span>
    </div>
  );
}
