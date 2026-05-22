"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  fetchOfficerFieldStatuses,
  fetchTodayActivity,
  fetchFieldActivity,
} from "@/lib/fieldOps";

const OfficerMap = dynamic(() => import("@/components/map/OfficerMap"), { ssr: false });
import {
  fetchSchedules,
  fetchOverrides,
  computeEffectiveShift,
  resolveDisplayStatus,
  localDateStr,
  currentWeekDates,
  fmt12,
  DAY_LABELS,
  DAY_FULL,
} from "@/lib/schedules";
import type { OfficerFieldProfile, FieldActivity, FieldStatus, OfficerSchedule, ScheduleOverride } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FieldStatus, { bg: string; text: string; dot: string }> = {
  "On Duty":  { bg: "#e6f4ea", text: "#1e7e34", dot: "#28a745" },
  "En Route": { bg: "#fff3cd", text: "#856404", dot: "#ffc107" },
  "On Scene": { bg: "#cce5ff", text: "#004085", dot: "#0d6efd" },
  "Available":{ bg: "#d1ecf1", text: "#0c5460", dot: "#17a2b8" },
  "Break":    { bg: "#f8d7da", text: "#721c24", dot: "#dc3545" },
  "Off Duty": { bg: "#f0f0f0", text: "#6c757d", dot: "#adb5bd" },
};

// Calendar cell colors
const CAL_SCHEDULED  = { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" };
const CAL_OFF        = { bg: "#f3f4f6", border: "#d1d5db", text: "#9ca3af" };
const CAL_OVR_OFF    = { bg: "#fee2e2", border: "#ef4444", text: "#b91c1c" };
const CAL_OVR_ON     = { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(ts?: string | null): string {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Officer card ──────────────────────────────────────────────────────────────

function OfficerCard({
  officer, displayStatus, shift,
}: {
  officer: OfficerFieldProfile;
  displayStatus: FieldStatus;
  shift: ReturnType<typeof computeEffectiveShift>;
}) {
  const colors = STATUS_COLORS[displayStatus] ?? STATUS_COLORS["Off Duty"];
  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {officer.first_name} {officer.last_name}
        </div>
        <span style={{ background: colors.bg, color: colors.text, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot, display: "inline-block" }} />
          {displayStatus}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#555" }}>
        @{officer.username}{officer.badge ? ` · Badge ${officer.badge}` : ""}
        {officer.role !== "Officer" ? ` · ${officer.role}` : ""}
      </div>
      {shift.isScheduled && shift.shiftStart && shift.shiftEnd && (
        <div style={{ fontSize: 12, color: "#1a8a8a", fontWeight: 500 }}>
          {shift.isOverride ? "⚡ Override" : "📅 Scheduled"}: {fmt12(shift.shiftStart)} – {fmt12(shift.shiftEnd)}
          {shift.overrideReason ? ` · ${shift.overrideReason}` : ""}
        </div>
      )}
      {!shift.isScheduled && shift.isOverride && (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>
          📌 Override Off{shift.overrideReason ? `: ${shift.overrideReason}` : ""}
        </div>
      )}
      <div style={{ fontSize: 12, color: "#888" }}>Updated: {elapsed(officer.last_status_update)}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActivityTab = "today" | "all";

export default function FieldOpsPage() {
  const [officers, setOfficers] = useState<OfficerFieldProfile[]>([]);
  const [schedules, setSchedules] = useState<OfficerSchedule[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [activity, setActivity] = useState<FieldActivity[]>([]);
  const [activityTab, setActivityTab] = useState<ActivityTab>("today");
  const [filterOfficer, setFilterOfficer] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  const [lastMapRefresh, setLastMapRefresh] = useState<Date>(new Date());

  const today = localDateStr();
  const todayDow = new Date().getDay();
  const weekDates = currentWeekDates();

  const load = useCallback(async () => {
    const [offs, sched, ovr, acts] = await Promise.all([
      fetchOfficerFieldStatuses(),
      fetchSchedules(),
      fetchOverrides({ from: today, to: weekDates[6] }),
      activityTab === "today" ? fetchTodayActivity() : fetchFieldActivity({ limit: 200 }),
    ]);
    setOfficers(offs);
    setSchedules(sched);
    setOverrides(ovr);
    setActivity(acts);
    setLoading(false);
  }, [activityTab, today, weekDates[6]]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  // Fast 15-second refresh for officer GPS positions only (map markers)
  useEffect(() => {
    const id = setInterval(async () => {
      const offs = await fetchOfficerFieldStatuses();
      setOfficers(offs);
      setLastMapRefresh(new Date());
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  // Compute display status for each officer
  const resolved = officers.map((o) => {
    const shift = computeEffectiveShift(o.id, today, schedules, overrides);
    const { displayStatus } = resolveDisplayStatus(o.current_field_status, shift, today);
    return { officer: o, shift, displayStatus };
  });

  // Today's scheduled officers
  const todayScheduled = resolved.filter((r) => r.shift.isScheduled);
  const todayOff       = resolved.filter((r) => !r.shift.isScheduled);
  const noOfficerDays  = weekDates.filter((d) => {
    const dow = new Date(`${d}T12:00:00`).getDay();
    return !officers.some((o) => {
      const shift = computeEffectiveShift(o.id, d, schedules, overrides);
      return shift.isScheduled;
    });
  });

  // Status board groups
  const groups = (["On Scene", "En Route", "On Duty", "Available", "Break", "Off Duty"] as FieldStatus[])
    .map((s) => ({ status: s, items: resolved.filter((r) => r.displayStatus === s) }))
    .filter((g) => g.items.length > 0);

  const activeCount = resolved.filter((r) => r.displayStatus !== "Off Duty").length;

  const filteredActivity = filterOfficer
    ? activity.filter((a) => a.officer_name.toLowerCase().includes(filterOfficer.toLowerCase()))
    : activity;
  const officerNames = [...new Set(activity.map((a) => a.officer_name))].sort();

  return (
    <AppShell
      title="Field Operations"
      action={
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/field-ops/schedules" style={{ background: "#f0f4f8", color: "#0f2942", border: "1px solid #ccc", borderRadius: 6, padding: "7px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            📅 Manage Schedules
          </Link>
          <button onClick={load} style={{ background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Refresh
          </button>
        </div>
      }
    >
      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ── Status summary bar ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
          {(["On Duty", "En Route", "On Scene", "Available", "Break", "Off Duty"] as FieldStatus[]).map((s) => {
            const count = resolved.filter((r) => r.displayStatus === s).length;
            const colors = STATUS_COLORS[s];
            return (
              <div key={s} style={{ background: colors.bg, border: `1px solid ${colors.dot}30`, borderRadius: 8, padding: "10px 18px", minWidth: 90, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{count}</div>
                <div style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>{s}</div>
              </div>
            );
          })}
          <div style={{ background: "#f0f4f8", border: "1px solid #ccc", borderRadius: 8, padding: "10px 18px", minWidth: 90, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f2942" }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: "#0f2942", fontWeight: 600 }}>Active</div>
          </div>
        </div>

        {/* ── Live GPS Map ── */}
        <div style={{ marginBottom: 28, border: "1px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
          <div
            onClick={() => setMapOpen((v) => !v)}
            style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: mapOpen ? "1px solid #e0e0e0" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f2942" }}>🗺 Live Officer Map</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {officers.filter((o) => o.last_location_lat != null && o.current_field_status !== "Off Duty").length} officer{officers.filter((o) => o.last_location_lat != null && o.current_field_status !== "Off Duty").length !== 1 ? "s" : ""} on map
              </span>
              {officers.some((o) => o.tracking_active) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", animation: "gps-pulse-sm 1.5s infinite", display: "inline-block" }} />
                  GPS Active
                  <style>{`@keyframes gps-pulse-sm{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                Updated {Math.round((Date.now() - lastMapRefresh.getTime()) / 1000)}s ago · refreshes every 15s
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{mapOpen ? "▼" : "▶"}</span>
            </div>
          </div>
          {mapOpen && (
            <div style={{ padding: 0 }}>
              <OfficerMap officers={officers} height={460} />
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, marginBottom: 28, alignItems: "start" }}>
          {/* ── Officer Status Board ── */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>Officer Status Board</h2>
            {loading ? <p style={{ color: "#888" }}>Loading…</p> : officers.length === 0 ? (
              <p style={{ color: "#888" }}>No active staff found. Add staff in the Admin section.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {groups.map((g) => (
                  <div key={g.status}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {g.status} ({g.items.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                      {g.items.map(({ officer, displayStatus, shift }) => (
                        <OfficerCard key={officer.id} officer={officer} displayStatus={displayStatus} shift={shift} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Today's Schedule sidebar ── */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>
              Today&apos;s Schedule
              <span style={{ fontSize: 12, fontWeight: 400, color: "#888", marginLeft: 8 }}>{DAY_FULL[todayDow]}</span>
            </h2>

            {todayScheduled.length === 0 ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
                ⚠️ No officers scheduled today
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {todayScheduled.map(({ officer, displayStatus, shift }) => {
                  const colors = STATUS_COLORS[displayStatus];
                  return (
                    <div key={officer.id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{officer.first_name} {officer.last_name}</span>
                        <span style={{ background: colors.bg, color: colors.text, borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{displayStatus}</span>
                      </div>
                      {shift.shiftStart && shift.shiftEnd && (
                        <div style={{ fontSize: 12, color: "#1a8a8a" }}>
                          {fmt12(shift.shiftStart)} – {fmt12(shift.shiftEnd)}
                          {shift.isOverride && <span style={{ marginLeft: 6, color: "#92400e", fontWeight: 600 }}>⚡ Override</span>}
                        </div>
                      )}
                      {shift.overrideReason && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{shift.overrideReason}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {todayOff.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase" }}>
                  Off today ({todayOff.length})
                </div>
                {todayOff.map(({ officer, shift }) => (
                  <div key={officer.id} style={{ fontSize: 12, color: "#888", padding: "3px 0", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between" }}>
                    <span>{officer.first_name} {officer.last_name}</span>
                    {shift.isOverride && <span style={{ color: "#b91c1c", fontSize: 11 }}>📌 {shift.overrideReason || "Override Off"}</span>}
                  </div>
                ))}
              </div>
            )}

            {noOfficerDays.filter((d) => d > today).length > 0 && (
              <div style={{ marginTop: 16, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>⚠️ Upcoming days with no coverage</div>
                {noOfficerDays.filter((d) => d > today).map((d) => (
                  <div key={d} style={{ fontSize: 12, color: "#92400e" }}>{fmtDate(d)}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Weekly Calendar ── */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>This Week</h2>
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { label: "Scheduled", ...CAL_SCHEDULED },
              { label: "Off", ...CAL_OFF },
              { label: "Override Off", ...CAL_OVR_OFF },
              { label: "Override On", ...CAL_OVR_ON },
            ].map((l) => (
              <span key={l.label} style={{ fontSize: 11, background: l.bg, border: `1px solid ${l.border}`, color: l.text, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{l.label}</span>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
              <thead>
                <tr style={{ background: "#f0f4f8" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#0f2942", borderBottom: "2px solid #ddd", minWidth: 160 }}>Officer</th>
                  {weekDates.map((d, i) => {
                    const isToday = d === today;
                    const dow = new Date(`${d}T12:00:00`).getDay();
                    return (
                      <th key={d} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: isToday ? "#1a8a8a" : "#0f2942", borderBottom: "2px solid #ddd", minWidth: 110, background: isToday ? "#f0fdf9" : undefined }}>
                        {DAY_LABELS[dow]}
                        <div style={{ fontSize: 10, fontWeight: 400, color: "#888" }}>{d.slice(5)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {officers.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                      {o.first_name} {o.last_name}
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>{o.role}</div>
                    </td>
                    {weekDates.map((d) => {
                      const shift = computeEffectiveShift(o.id, d, schedules, overrides);
                      const ov = overrides.find((ov) => ov.officer_id === o.id && ov.override_date === d);
                      const isToday = d === today;

                      let style = CAL_OFF;
                      if (ov) style = ov.is_working ? CAL_OVR_ON : CAL_OVR_OFF;
                      else if (shift.isScheduled) style = CAL_SCHEDULED;

                      return (
                        <td key={d} style={{ padding: "6px 8px", textAlign: "center", background: isToday ? "#f8fffe" : undefined }}>
                          <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 6, padding: "4px 6px", color: style.text, fontSize: 11, fontWeight: 600 }}>
                            {ov ? (ov.is_working ? "Override On" : "Override Off") : (shift.isScheduled ? "Working" : "Off")}
                            {shift.shiftStart && shift.shiftEnd && (
                              <div style={{ fontWeight: 400, fontSize: 10, marginTop: 1 }}>
                                {fmt12(shift.shiftStart)}–{fmt12(shift.shiftEnd)}
                              </div>
                            )}
                            {ov?.reason && <div style={{ fontWeight: 400, fontSize: 10, marginTop: 1, opacity: 0.8 }}>{ov.reason}</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Activity Log ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942" }}>Activity Log</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {(["today", "all"] as ActivityTab[]).map((t) => (
              <button key={t} onClick={() => setActivityTab(t)} style={{ background: activityTab === t ? "#0f2942" : "#f0f4f8", color: activityTab === t ? "#fff" : "#333", border: "1px solid #ccc", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {t === "today" ? "Today" : "Last 200"}
              </button>
            ))}
            <select value={filterOfficer} onChange={(e) => setFilterOfficer(e.target.value)}
              style={{ border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}>
              <option value="">All Officers</option>
              {officerNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f0f4f8" }}>
                {["Time", "Officer", "Status", "Location", "Call", "Mileage", "Notes"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#0f2942", borderBottom: "2px solid #ddd" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "20px 12px", color: "#888", textAlign: "center" }}>No activity recorded yet.</td></tr>
              ) : filteredActivity.map((a) => {
                const colors = STATUS_COLORS[a.status as FieldStatus] ?? STATUS_COLORS["Off Duty"];
                const ts = new Date(a.recorded_at);
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", color: "#555", whiteSpace: "nowrap" }}>
                      {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{a.officer_name}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: colors.bg, color: colors.text, borderRadius: 12, padding: "2px 10px", fontWeight: 600, fontSize: 12 }}>{a.status}</span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>{a.location_label || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>{a.call_number || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>
                      {a.mileage_start != null ? `${a.mileage_start}${a.mileage_end != null ? ` → ${a.mileage_end}` : ""}` : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>{a.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Daily Summary */}
        {activityTab === "today" && filteredActivity.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>Today&apos;s Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {officerNames.map((name) => {
                const acts = filteredActivity.filter((a) => a.officer_name === name);
                const statuses = [...new Set(acts.map((a) => a.status))];
                const miles = acts.reduce((sum, a) => (a.mileage_start != null && a.mileage_end != null ? sum + (a.mileage_end - a.mileage_start) : sum), 0);
                return (
                  <div key={name} style={{ background: "#f8fafc", border: "1px solid #e0e0e0", borderRadius: 8, padding: "14px 18px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{acts.length} check-in{acts.length !== 1 ? "s" : ""}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Statuses: {statuses.join(", ") || "—"}</div>
                    {miles > 0 && <div style={{ fontSize: 12, color: "#555" }}>Mileage: {miles.toFixed(1)} mi</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
