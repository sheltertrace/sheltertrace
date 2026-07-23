"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchCalls, fetchOfficers, reopenFollowUp, closeFollowUp } from "@/lib/data";
import type { DispatchCall, Officer } from "@/lib/types";
import { CALL_STATUSES, CALL_STATUS_COLORS, PRIORITY_COLORS, OFFICER_STATUS_COLORS, CALL_PRIORITIES, FOLLOW_UP_ELIGIBLE_STATUSES } from "@/lib/constants";
import { today, formatDate } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import FollowUpModal from "@/components/dispatch/FollowUpModal";

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function DispatchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const currentUserName = user ? `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username : "Staff";

  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [tab, setTab] = useState<"queue" | "followup" | "officers" | "history">(() => searchParams.get("tab") === "followup" ? "followup" : "queue");
  const [search, setSearch] = useState("");

  // Follow-up tab filters
  const [fuOfficerFilter, setFuOfficerFilter] = useState("All");
  const [fuReasonFilter, setFuReasonFilter] = useState("All");
  const [fuOverdueOnly, setFuOverdueOnly] = useState(false);

  // Move / extend modal
  const [followUpTarget, setFollowUpTarget] = useState<{ call: DispatchCall; mode: "move" | "extend" } | null>(null);
  const [closingCall, setClosingCall] = useState<DispatchCall | null>(null);
  const [closeDisposition, setCloseDisposition] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([fetchCalls(), fetchOfficers()]);
      setCalls(c);
      setOfficers(o);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyUpdatedCall = (updated: DispatchCall) => {
    setCalls((prev) => prev.map((c) => c.id === updated.id ? updated : c));
  };

  const filtered = useMemo(() => calls.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.type || "").toLowerCase().includes(q) || (c.caller || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q);
    return matchSearch && (filterPriority === "All" || c.priority === filterPriority) && (filterStatus === "All" || c.status === filterStatus);
  }), [calls, search, filterPriority, filterStatus]);

  const pendingCount = calls.filter((c) => c.status === "Pending").length;
  const activeCount = calls.filter((c) => ["Dispatched", "En Route", "On Scene"].includes(c.status || "")).length;
  const resolvedToday = calls.filter((c) => c.status === "Resolved" && c.date_reported === today()).length;
  const criticalCount = calls.filter((c) => c.priority === "Critical" && c.status !== "Resolved").length;

  const activeQueue = filtered.filter((c) => !["Resolved", "Cancelled", "Pending Follow-Up"].includes(c.status || ""));
  const historyQueue = filtered.filter((c) => ["Resolved", "Cancelled"].includes(c.status || ""));

  const followUpCalls = useMemo(() => calls.filter((c) => c.status === "Pending Follow-Up"), [calls]);
  const followUpOfficers = useMemo(() => [...new Set(followUpCalls.map((c) => c.follow_up_assigned_officer).filter(Boolean))] as string[], [followUpCalls]);
  const followUpReasons = useMemo(() => [...new Set(followUpCalls.map((c) => c.follow_up_reason).filter(Boolean))] as string[], [followUpCalls]);

  const followUpFiltered = useMemo(() => {
    return followUpCalls
      .filter((c) => fuOfficerFilter === "All" || c.follow_up_assigned_officer === fuOfficerFilter)
      .filter((c) => fuReasonFilter === "All" || c.follow_up_reason === fuReasonFilter)
      .filter((c) => !fuOverdueOnly || (c.follow_up_due_date ? daysUntil(c.follow_up_due_date) < 0 : false))
      .sort((a, b) => (a.follow_up_due_date || "9999-99-99").localeCompare(b.follow_up_due_date || "9999-99-99"));
  }, [followUpCalls, fuOfficerFilter, fuReasonFilter, fuOverdueOnly]);

  const handleReopen = async (call: DispatchCall) => {
    setActionSaving(true);
    try {
      const updated = await reopenFollowUp(call, currentUserName);
      applyUpdatedCall(updated);
    } finally { setActionSaving(false); }
  };

  const handleClose = async () => {
    if (!closingCall) return;
    setActionSaving(true);
    try {
      const updated = await closeFollowUp(closingCall, currentUserName, closeDisposition.trim());
      applyUpdatedCall(updated);
      setClosingCall(null);
      setCloseDisposition("");
    } finally { setActionSaving(false); }
  };

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
        {(["queue", "followup", "officers", "history"] as const).map((t) => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "queue" ? `Call Queue (${activeQueue.length})`
              : t === "followup" ? `⏰ Pending Follow-Up (${followUpCalls.length})`
              : t === "officers" ? `Officers (${officers.length})`
              : `History (${historyQueue.length})`}
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
          {["All", ...CALL_STATUSES.filter((s) => s !== "Pending Follow-Up")].map((s) => (
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
                <tr><th>Priority</th><th>ID</th><th>Type</th><th>Address</th><th>Caller</th><th>Status</th><th>Officers</th><th>Reported</th><th></th></tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={9} className="empty-state">Loading…</td></tr>
                  : (tab === "queue" ? activeQueue : historyQueue).length === 0
                    ? <tr><td colSpan={9} className="empty-state">No calls</td></tr>
                    : (tab === "queue" ? activeQueue : historyQueue).map((call) => (
                      <tr key={call.id} style={{ cursor: "pointer" }} title="Click to open field report">
                        <td onClick={() => router.push(`/dispatch/${call.id}`)}>
                          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: PRIORITY_COLORS[call.priority || ""] || "#ccc", marginRight: 6 }} />
                          {call.priority}
                        </td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontFamily: "monospace", fontSize: 11 }}>{call.id}</td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontWeight: 600 }}>{call.type}</td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontSize: 12 }}>{call.address}{call.city ? `, ${call.city}` : ""}</td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontSize: 12 }}>{call.caller || "Anonymous"}</td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)}><span className="badge" style={{ background: `${CALL_STATUS_COLORS[call.status || ""]}20`, color: CALL_STATUS_COLORS[call.status || ""] || "#6b7280" }}>{call.status}</span></td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontSize: 12 }}>{(call.assigned_officers || []).map((o) => o.name).join(", ") || "—"}</td>
                        <td onClick={() => router.push(`/dispatch/${call.id}`)} style={{ fontSize: 12, color: "var(--text-secondary)" }}>{call.date_reported} {call.time_reported}</td>
                        <td>
                          {tab === "queue" && FOLLOW_UP_ELIGIBLE_STATUSES.includes(call.status || "") && (
                            <button
                              className="btn btn-sm"
                              style={{ background: "#fff7ed", color: "#d97706", borderColor: "#fed7aa", fontSize: 11, whiteSpace: "nowrap" }}
                              onClick={(e) => { e.stopPropagation(); setFollowUpTarget({ call, mode: "move" }); }}
                            >
                              ⏰ Follow-Up
                            </button>
                          )}
                        </td>
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
                {tab === "queue" && FOLLOW_UP_ELIGIBLE_STATUSES.includes(call.status || "") && (
                  <button
                    className="btn btn-sm"
                    style={{ background: "#fff7ed", color: "#d97706", borderColor: "#fed7aa", marginTop: 8, width: "100%" }}
                    onClick={(e) => { e.stopPropagation(); setFollowUpTarget({ call, mode: "move" }); }}
                  >
                    ⏰ Move to Pending Follow-Up
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pending Follow-Up Tab */}
      {tab === "followup" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select className="form-select" style={{ maxWidth: 220 }} value={fuOfficerFilter} onChange={(e) => setFuOfficerFilter(e.target.value)}>
              <option value="All">All Officers</option>
              {followUpOfficers.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="form-select" style={{ maxWidth: 260 }} value={fuReasonFilter} onChange={(e) => setFuReasonFilter(e.target.value)}>
              <option value="All">All Reasons</option>
              {followUpReasons.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={fuOverdueOnly} onChange={(e) => setFuOverdueOnly(e.target.checked)} />
              Overdue only
            </label>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Call #</th><th>Type</th><th>Date Reported</th><th>Follow-Up Due</th>
                  <th>Days Until Due</th><th>Assigned Officer</th><th>Reason</th><th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="empty-state">Loading…</td></tr>
                ) : followUpFiltered.length === 0 ? (
                  <tr><td colSpan={8} className="empty-state">No pending follow-ups</td></tr>
                ) : followUpFiltered.map((call) => {
                  const due = call.follow_up_due_date;
                  const dLeft = due ? daysUntil(due) : null;
                  const overdue = dLeft !== null && dLeft < 0;
                  return (
                    <tr key={call.id} style={overdue ? { background: "#fef2f2" } : undefined}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>#{call.id.slice(-4)}</td>
                      <td style={{ fontWeight: 600 }}>{call.type}</td>
                      <td style={{ fontSize: 12 }}>{call.date_reported}</td>
                      <td style={{ fontSize: 12 }}>{due ? formatDate(due) : "—"}</td>
                      <td>
                        {dLeft === null ? "—" : overdue ? (
                          <span style={{ color: "#dc2626", fontWeight: 800, fontSize: 12 }}>OVERDUE ({Math.abs(dLeft)}d)</span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: dLeft <= 2 ? 700 : 400, color: dLeft <= 2 ? "#d97706" : "var(--text)" }}>{dLeft} day{dLeft === 1 ? "" : "s"}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{call.follow_up_assigned_officer || "—"}</td>
                      <td style={{ fontSize: 12 }}>{call.follow_up_reason || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => router.push(`/dispatch/${call.id}`)}>View Call</button>
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} disabled={actionSaving} onClick={() => handleReopen(call)}>Reopen</button>
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setFollowUpTarget({ call, mode: "extend" })}>Extend</button>
                          <button className="btn btn-sm" style={{ fontSize: 11, background: "#16a34a", color: "#fff", borderColor: "#16a34a" }} onClick={() => setClosingCall(call)}>Close Case</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {followUpTarget && (
        <FollowUpModal
          call={followUpTarget.call}
          officers={officers}
          currentUserName={currentUserName}
          mode={followUpTarget.mode}
          onClose={() => setFollowUpTarget(null)}
          onSaved={(updated) => { applyUpdatedCall(updated); setFollowUpTarget(null); }}
        />
      )}

      {closingCall && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setClosingCall(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 10, padding: "22px 24px", width: "100%", maxWidth: 440, boxShadow: "0 8px 32px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Close Case</div>
            <div className="form-group">
              <label className="form-label">Disposition / Resolution Notes</label>
              <textarea className="form-textarea" rows={4} value={closeDisposition} onChange={(e) => setCloseDisposition(e.target.value)} placeholder="Outcome of the follow-up, final resolution…" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setClosingCall(null)} disabled={actionSaving}>Cancel</button>
              <button className="btn btn-sm" style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a", fontWeight: 700 }} onClick={handleClose} disabled={actionSaving}>
                {actionSaving ? "Closing…" : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function DispatchPage() {
  return (
    <Suspense fallback={<AppShell title="Officer Dispatch"><div className="empty-state" style={{ padding: "60px 0" }}>Loading…</div></AppShell>}>
      <DispatchPageInner />
    </Suspense>
  );
}
