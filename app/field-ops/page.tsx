"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchOfficerFieldStatuses,
  fetchTodayActivity,
  fetchFieldActivity,
} from "@/lib/fieldOps";
import type { OfficerFieldProfile, FieldActivity, FieldStatus } from "@/lib/types";

const STATUS_COLORS: Record<FieldStatus, { bg: string; text: string; dot: string }> = {
  "On Duty":  { bg: "#e6f4ea", text: "#1e7e34", dot: "#28a745" },
  "En Route": { bg: "#fff3cd", text: "#856404", dot: "#ffc107" },
  "On Scene": { bg: "#cce5ff", text: "#004085", dot: "#0d6efd" },
  "Available":{ bg: "#d1ecf1", text: "#0c5460", dot: "#17a2b8" },
  "Break":    { bg: "#f8d7da", text: "#721c24", dot: "#dc3545" },
  "Off Duty": { bg: "#f0f0f0", text: "#6c757d", dot: "#adb5bd" },
};

function elapsed(ts?: string | null): string {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

function OfficerCard({ officer }: { officer: OfficerFieldProfile }) {
  const colors = STATUS_COLORS[officer.current_field_status] ?? STATUS_COLORS["Off Duty"];
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: 10,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {officer.first_name} {officer.last_name}
        </div>
        <span style={{
          background: colors.bg,
          color: colors.text,
          borderRadius: 20,
          padding: "3px 12px",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors.dot, display: "inline-block" }} />
          {officer.current_field_status}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#555" }}>
        @{officer.username}
        {officer.badge ? ` · Badge ${officer.badge}` : ""}
      </div>
      <div style={{ fontSize: 12, color: "#888" }}>
        Updated: {elapsed(officer.last_status_update)}
      </div>
    </div>
  );
}

type ActivityTab = "today" | "all";

export default function FieldOpsPage() {
  const [officers, setOfficers] = useState<OfficerFieldProfile[]>([]);
  const [activity, setActivity] = useState<FieldActivity[]>([]);
  const [activityTab, setActivityTab] = useState<ActivityTab>("today");
  const [filterOfficer, setFilterOfficer] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [offs, acts] = await Promise.all([
      fetchOfficerFieldStatuses(),
      activityTab === "today" ? fetchTodayActivity() : fetchFieldActivity({ limit: 200 }),
    ]);
    setOfficers(offs);
    setActivity(acts);
    setLoading(false);
  }, [activityTab]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const statusGroups = (["On Duty", "En Route", "On Scene", "Available", "Break", "Off Duty"] as FieldStatus[]).map(
    (s) => ({ status: s, officers: officers.filter((o) => o.current_field_status === s) })
  ).filter((g) => g.officers.length > 0);

  const filteredActivity = filterOfficer
    ? activity.filter((a) => a.officer_name.toLowerCase().includes(filterOfficer.toLowerCase()))
    : activity;

  const officerNames = [...new Set(activity.map((a) => a.officer_name))].sort();

  const activeCount = officers.filter((o) => o.current_field_status !== "Off Duty").length;

  return (
    <AppShell
      title="Field Operations"
      action={
        <button
          onClick={load}
          style={{
            background: "#1a8a8a",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Refresh
        </button>
      }
    >
      <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Summary bar */}
        <div style={{
          display: "flex",
          gap: 16,
          marginBottom: 28,
          flexWrap: "wrap",
        }}>
          {(["On Duty", "En Route", "On Scene", "Available", "Break", "Off Duty"] as FieldStatus[]).map((s) => {
            const count = officers.filter((o) => o.current_field_status === s).length;
            const colors = STATUS_COLORS[s];
            return (
              <div key={s} style={{
                background: colors.bg,
                border: `1px solid ${colors.dot}30`,
                borderRadius: 8,
                padding: "10px 18px",
                minWidth: 100,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{count}</div>
                <div style={{ fontSize: 11, color: colors.text, fontWeight: 600 }}>{s}</div>
              </div>
            );
          })}
          <div style={{
            background: "#f0f4f8",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: "10px 18px",
            minWidth: 100,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f2942" }}>{activeCount}</div>
            <div style={{ fontSize: 11, color: "#0f2942", fontWeight: 600 }}>Active Total</div>
          </div>
        </div>

        {/* Officer status board */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>
          Officer Status Board
        </h2>

        {loading ? (
          <p style={{ color: "#888" }}>Loading...</p>
        ) : officers.length === 0 ? (
          <p style={{ color: "#888" }}>No officers found. Ensure officers are in the People table with role "Officer" or "Administrator".</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 36 }}>
            {statusGroups.map((g) => (
              <div key={g.status}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 8 }}>
                  {g.status} ({g.officers.length})
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {g.officers.map((o) => <OfficerCard key={o.id} officer={o} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Activity Log */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942" }}>Activity Log</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {(["today", "all"] as ActivityTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActivityTab(t)}
                style={{
                  background: activityTab === t ? "#0f2942" : "#f0f4f8",
                  color: activityTab === t ? "#fff" : "#333",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {t === "today" ? "Today" : "Last 200"}
              </button>
            ))}
            <select
              value={filterOfficer}
              onChange={(e) => setFilterOfficer(e.target.value)}
              style={{ border: "1px solid #ccc", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
            >
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
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#0f2942", borderBottom: "2px solid #ddd" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "20px 12px", color: "#888", textAlign: "center" }}>
                    No activity recorded yet.
                  </td>
                </tr>
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
                      <span style={{
                        background: colors.bg,
                        color: colors.text,
                        borderRadius: 12,
                        padding: "2px 10px",
                        fontWeight: 600,
                        fontSize: 12,
                      }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>{a.location_label || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>{a.call_number || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#555" }}>
                      {a.mileage_start != null
                        ? `${a.mileage_start}${a.mileage_end != null ? ` → ${a.mileage_end}` : ""}`
                        : "—"}
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f2942", marginBottom: 14 }}>
              Today&apos;s Summary
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {officerNames.map((name) => {
                const acts = filteredActivity.filter((a) => a.officer_name === name);
                const statuses = [...new Set(acts.map((a) => a.status))];
                const miles = acts.reduce((sum, a) => {
                  if (a.mileage_start != null && a.mileage_end != null)
                    return sum + (a.mileage_end - a.mileage_start);
                  return sum;
                }, 0);
                return (
                  <div key={name} style={{
                    background: "#f8fafc",
                    border: "1px solid #e0e0e0",
                    borderRadius: 8,
                    padding: "14px 18px",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                      {acts.length} check-in{acts.length !== 1 ? "s" : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
                      Statuses: {statuses.join(", ") || "—"}
                    </div>
                    {miles > 0 && (
                      <div style={{ fontSize: 12, color: "#555" }}>
                        Mileage logged: {miles.toFixed(1)} mi
                      </div>
                    )}
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
