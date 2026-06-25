"use client";
import { useState, useEffect, useMemo } from "react";
import { fetchAuditLog } from "@/lib/superAdminData";
import type { AuditLogEntry } from "@/lib/superAdminTypes";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterTarget, setFilterTarget] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => { fetchAuditLog(500).then(setEntries).finally(() => setLoading(false)); }, []);

  const actionTypes = useMemo(() => [...new Set(entries.map((e) => e.action))].sort(), [entries]);
  const targetTypes = useMemo(() => [...new Set(entries.map((e) => e.target_type).filter(Boolean))].sort(), [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filterAction !== "all") list = list.filter((e) => e.action === filterAction);
    if (filterTarget !== "all") list = list.filter((e) => e.target_type === filterTarget);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.action.toLowerCase().includes(q) || (e.target_type || "").toLowerCase().includes(q) || (e.target_id || "").toLowerCase().includes(q) || JSON.stringify(e.details || {}).toLowerCase().includes(q));
    }
    return list;
  }, [entries, search, filterAction, filterTarget]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const headers = ["Timestamp", "Admin", "Action", "Target Type", "Target ID", "Details"];
    const rows = filtered.map((e) => [
      e.created_at || "", e.super_admin_id, e.action,
      e.target_type || "", e.target_id || "", JSON.stringify(e.details || {}),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>📋 Audit Log</h1>
        <button className="btn btn-secondary" onClick={exportCSV}>📥 Export CSV</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <select className="form-select" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }} style={{ maxWidth: 200 }}>
          <option value="all">All Actions</option>
          {actionTypes.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select className="form-select" value={filterTarget} onChange={(e) => { setFilterTarget(e.target.value); setPage(0); }} style={{ maxWidth: 160 }}>
          <option value="all">All Targets</option>
          {targetTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} entries</span>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Timestamp</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No entries</td></tr>
              ) : paged.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{e.created_at ? new Date(e.created_at).toLocaleString() : "—"}</td>
                  <td style={{ fontSize: 12, fontFamily: "monospace" }}>{e.super_admin_id?.slice(0, 8)}</td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{e.action}</td>
                  <td style={{ fontSize: 12 }}>
                    {e.target_type && <span className="badge" style={{ background: "#f1f5f9", color: "#475569", marginRight: 4 }}>{e.target_type}</span>}
                    {e.target_id && <span style={{ fontFamily: "monospace", fontSize: 11 }}>{e.target_id.slice(0, 12)}</span>}
                  </td>
                  <td>
                    {e.details ? (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        {expanded === e.id ? "▲ Hide" : "▼ Show"}
                      </button>
                    ) : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}
                    {expanded === e.id && e.details && (
                      <pre style={{ fontSize: 10, background: "#f8fafc", padding: 8, borderRadius: 4, marginTop: 4, maxWidth: 400, overflow: "auto", whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Page {page + 1} of {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
