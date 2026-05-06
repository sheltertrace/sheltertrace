"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchCalls, fetchOfficers } from "@/lib/data";
import type { DispatchCall, Officer } from "@/lib/types";
import { CALL_STATUSES, CALL_STATUS_COLORS, PRIORITY_COLORS, OFFICER_STATUS_COLORS, CALL_PRIORITIES } from "@/lib/constants";
import { today } from "@/lib/utils";

export default function DispatchPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [tab, setTab] = useState<"queue" | "officers" | "history">("queue");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([fetchCalls(), fetchOfficers()]);
      setCalls(c);
      setOfficers(o);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => calls.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.type || "").toLowerCase().includes(q) || (c.caller || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q);
    return matchSearch && (filterPriority === "All" || c.priority === filterPriority) && (filterStatus === "All" || c.status === filterStatus);
  }), [calls, search, filterPriority, filterStatus]);

  const pendingCount = calls.filter((c) => c.status === "Pending").length;
  const activeCount = calls.filter((c) => ["Dispatched", "En Route", "On Scene"].includes(c.status || "")).length;
  const resolvedToday = calls.filter((c) => c.status === "Resolved" && c.date_reported === today()).length;
  const criticalCount = calls.filter((c) => c.priority === "Critical" && c.status !== "Resolved").length;

  const activeQueue = filtered.filter((c) => !["Resolved", "Cancelled"].includes(c.status || ""));
  const historyQueue = filtered.filter((c) => ["Resolved", "Cancelled"].includes(c.status || ""));

  return (
    <AppShell title="Officer Dispatch" action={
      <button className="btn btn-primary" onClick={() => router.push("/dispatch/new")}>+ New Call</button>
    }>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Pending", value: pendingCount, color: "#f59e0b", icon: "⏳" },
          { label: "Active", value: activeCount, color: "#0ea5e9", icon: "📡" },
          { label: "Critical", value: criticalCount, color: "#dc2626", icon: "🚨" },
          { label: "Resolved Today", value: resolvedToday, color: "#22c55e", icon: "✅" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(["queue", "officers", "history"] as const).map((t) => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "queue" ? `Call Queue (${activeQueue.length})` : t === "officers" ? `Officers (${officers.length})` : `History (${historyQueue.length})`}
          </div>
        ))}
      </div>

      {/* Filters */}
      {(tab === "queue" || tab === "history") && (
        <div className="dispatch-filters" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ flex: "1 1 200px", maxWidth: 260 }} placeholder="Search calls…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => router.push("/dispatch/new")}>+ New Call</button>
          {["All", ...CALL_PRIORITIES].map((p) => (
            <button key={p} onClick={() => setFilterPriority(p)} className={`btn btn-sm ${filterPriority === p ? "btn-primary" : "btn-secondary"}`} style={filterPriority === p && p !== "All" ? { background: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] } : {}}>{p}</button>
          ))}
          {["All", ...CALL_STATUSES].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}>{s}</button>
          ))}
        </div>
      )}

      {/* Call Queue / History */}
      {(tab === "queue" || tab === "history") && (
        <>
          {/* Desktop table */}
          <div className="dispatch-table-desktop card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr><th>Priority</th><th>ID</th><th>Type</th><th>Address</th><th>Caller</th><th>Status</th><th>Officers</th><th>Reported</th></tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={8} className="empty-state">Loading…</td></tr>
                  : (tab === "queue" ? activeQueue : historyQueue).length === 0
                    ? <tr><td colSpan={8} className="empty-state">No calls</td></tr>
                    : (tab === "queue" ? activeQueue : historyQueue).map((call) => (
                      <tr key={call.id} onClick={() => router.push(`/dispatch/${call.id}`)} style={{ cursor: "pointer" }} title="Click to open field report">
                        <td>
                          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: PRIORITY_COLORS[call.priority || ""] || "#ccc", marginRight: 6 }} />
                          {call.priority}
                        </td>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{call.id}</td>
                        <td style={{ fontWeight: 600 }}>{call.type}</td>
                        <td style={{ fontSize: 12 }}>{call.address}{call.city ? `, ${call.city}` : ""}</td>
                        <td style={{ fontSize: 12 }}>{call.caller || "Anonymous"}</td>
                        <td><span className="badge" style={{ background: `${CALL_STATUS_COLORS[call.status || ""]}20`, color: CALL_STATUS_COLORS[call.status || ""] || "#6b7280" }}>{call.status}</span></td>
                        <td style={{ fontSize: 12 }}>{(call.assigned_officers || []).map((o) => o.name).join(", ") || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{call.date_reported} {call.time_reported}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="dispatch-cards-mobile">
            {loading ? (
              <div className="card empty-state" style={{ padding: "20px 0" }}>Loading…</div>
            ) : (tab === "queue" ? activeQueue : historyQueue).length === 0 ? (
              <div className="card empty-state" style={{ padding: "20px 0" }}>No calls</div>
            ) : (tab === "queue" ? activeQueue : historyQueue).map((call) => (
              <div key={call.id} className="dispatch-call-card" onClick={() => router.push(`/dispatch/${call.id}`)}>
                <div className="dispatch-call-card-header">
                  <div className="dispatch-call-card-type">
                    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: PRIORITY_COLORS[call.priority || ""] || "#ccc", marginRight: 8, flexShrink: 0 }} />
                    {call.type}
                  </div>
                  <span className="badge" style={{ background: `${CALL_STATUS_COLORS[call.status || ""]}20`, color: CALL_STATUS_COLORS[call.status || ""] || "#6b7280", flexShrink: 0 }}>{call.status}</span>
                </div>
                {call.address && (
                  <div className="dispatch-call-card-address">📍 {call.address}{call.city ? `, ${call.city}` : ""}</div>
                )}
                <div className="dispatch-call-card-meta">
                  <span>{call.caller || "Anonymous"}</span>
                  <span>{call.date_reported} {call.time_reported}</span>
                  {call.priority && (
                    <span style={{ fontWeight: 700, color: PRIORITY_COLORS[call.priority] || "var(--text-muted)" }}>{call.priority}</span>
                  )}
                </div>
                {(call.assigned_officers || []).length > 0 && (
                  <div className="dispatch-call-card-officers">👮 {(call.assigned_officers || []).map((o) => o.name).join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Officers Tab */}
      {tab === "officers" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Badge</th><th>Status</th><th>Vehicle</th><th>Zone</th><th>Radio</th><th>Phone</th></tr></thead>
            <tbody>
              {officers.length === 0
                ? <tr><td colSpan={7} className="empty-state">No officers registered.</td></tr>
                : officers.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.name}</td>
                    <td style={{ fontSize: 12 }}>{o.badge}</td>
                    <td><span className="badge" style={{ background: `${OFFICER_STATUS_COLORS[o.status] || "#ccc"}20`, color: OFFICER_STATUS_COLORS[o.status] || "#6b7280" }}>{o.status}</span></td>
                    <td style={{ fontSize: 12 }}>{o.vehicle || "—"}</td>
                    <td style={{ fontSize: 12 }}>{o.zone || "—"}</td>
                    <td style={{ fontSize: 12 }}>{o.radio || "—"}</td>
                    <td style={{ fontSize: 12 }}>{o.phone || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
