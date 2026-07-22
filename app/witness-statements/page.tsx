"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRouter } from "next/navigation";
import { fetchWitnessStatements } from "@/lib/data";
import type { WitnessStatement } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const STATUSES = ["All", "New", "Reviewed", "Attached", "Dismissed"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:       { bg: "#dbeafe", color: "#1d4ed8" },
  Reviewed:  { bg: "#fef3c7", color: "#b45309" },
  Attached:  { bg: "#dcfce7", color: "#15803d" },
  Dismissed: { bg: "#f1f5f9", color: "#64748b" },
};

export default function WitnessStatementsPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<WitnessStatement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState("All");
  const [search, setSearch]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWitnessStatements({ status: statusFilter !== "All" ? statusFilter : undefined });
      setStatements(data);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? statements.filter((s) =>
        [s.reference_number, s.witness_first_name, s.witness_last_name, s.incident_location, s.provided_case_number]
          .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : statements;

  const counts = {
    total: statements.length,
    new: statements.filter((s) => s.status === "New").length,
    attached: statements.filter((s) => s.status === "Attached").length,
    dismissed: statements.filter((s) => s.status === "Dismissed").length,
  };

  return (
    <AppShell title="Witness Statements" action={
      <a href="/witness-statement" target="_blank" className="btn btn-secondary btn-sm">🌐 View Public Form</a>
    }>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Total", value: counts.total, color: "#64748b" },
          { label: "New",   value: counts.new,   color: "#1d4ed8" },
          { label: "Attached", value: counts.attached, color: "#15803d" },
          { label: "Dismissed", value: counts.dismissed, color: "#64748b" },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card">
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group" style={{ marginBottom: 0, flex: "1 1 160px" }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: "2 1 240px" }}>
            <label className="form-label">Search</label>
            <input className="form-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ref #, witness name, location, case #…" />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { setStatus("All"); setSearch(""); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Statements ({filtered.length})</div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No witness statements match your filters</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref #</th><th>Submitted</th><th>Witness</th><th>Incident Date</th>
                  <th>Location</th><th>Case #</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const sc = STATUS_COLORS[s.status] || { bg: "#f1f5f9", color: "#374151" };
                  return (
                    <tr key={s.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{s.reference_number}</td>
                      <td style={{ fontSize: 12 }}>{s.submitted_at ? formatDate(s.submitted_at.slice(0, 10)) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{s.witness_first_name} {s.witness_last_name}</td>
                      <td style={{ fontSize: 12 }}>{s.incident_date ? formatDate(s.incident_date) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{s.incident_location || "—"}</td>
                      <td style={{ fontSize: 12 }}>{s.provided_case_number || "—"}</td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push(`/witness-statements/${s.id}`)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
