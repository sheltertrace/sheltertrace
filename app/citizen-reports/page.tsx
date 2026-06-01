"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRouter } from "next/navigation";
import { fetchCitizenReports } from "@/lib/data";
import type { CitizenReport } from "@/lib/types";
import DateInput from "@/components/ui/DateInput";
import { formatDate } from "@/lib/utils";

const STATUSES = ["All", "New", "Under Review", "Assigned", "Resolved", "Dismissed"];
const REPORT_TYPES = [
  "All",
  "Stray / Loose Animal", "Animal Neglect or Abuse", "Barking / Noise Complaint",
  "Dangerous / Aggressive Animal", "Animal Bite", "Tethering Violation",
  "Too Many Animals", "Dead Animal Pickup", "Wildlife Concern", "Licensing Violation", "Other",
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:            { bg: "#dbeafe", color: "#1d4ed8" },
  "Under Review": { bg: "#fef3c7", color: "#b45309" },
  Assigned:       { bg: "#ede9fe", color: "#6d28d9" },
  Resolved:       { bg: "#dcfce7", color: "#15803d" },
  Dismissed:      { bg: "#f1f5f9", color: "#64748b" },
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "#94a3b8", Medium: "#f59e0b", High: "#f97316", Emergency: "#dc2626",
};

export default function CitizenReportsPage() {
  const router = useRouter();
  const [reports, setReports]     = useState<CitizenReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState("All");
  const [typeFilter, setType]     = useState("All");
  const [dateFrom, setFrom]       = useState("");
  const [dateTo, setTo]           = useState("");
  const [search, setSearch]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCitizenReports({
        status: statusFilter !== "All" ? statusFilter : undefined,
        reportType: typeFilter !== "All" ? typeFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setReports(data);
    } finally { setLoading(false); }
  }, [statusFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? reports.filter(r =>
        [r.reference_number, r.location_address, r.location_city, r.reporter_first_name, r.reporter_last_name, r.report_type]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : reports;

  const counts = {
    total: reports.length,
    new: reports.filter(r => r.status === "New").length,
    review: reports.filter(r => r.status === "Under Review").length,
    assigned: reports.filter(r => r.status === "Assigned").length,
    resolved: reports.filter(r => r.status === "Resolved").length,
  };

  return (
    <AppShell title="Citizen Reports" action={
      <a href="/report-concern" target="_blank" className="btn btn-secondary btn-sm">🌐 View Public Form</a>
    }>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Total", value: counts.total, color: "#64748b" },
          { label: "New",   value: counts.new,   color: "#1d4ed8" },
          { label: "Under Review", value: counts.review, color: "#b45309" },
          { label: "Resolved", value: counts.resolved, color: "#15803d" },
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
            <select className="form-select" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: "2 1 200px" }}>
            <label className="form-label">Type</label>
            <select className="form-select" value={typeFilter} onChange={e => setType(e.target.value)}>
              {REPORT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From</label>
            <DateInput className="form-input" value={dateFrom} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To</label>
            <DateInput className="form-input" value={dateTo} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: "2 1 200px" }}>
            <label className="form-label">Search</label>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ref #, address, reporter…" />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { setStatus("All"); setType("All"); setFrom(""); setTo(""); setSearch(""); }}>
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Reports ({filtered.length})</div>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No reports match your filters</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref #</th><th>Date</th><th>Type</th><th>Location</th>
                  <th>Reporter</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sc = STATUS_COLORS[r.status] || { bg: "#f1f5f9", color: "#374151" };
                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{r.reference_number}</td>
                      <td style={{ fontSize: 12 }}>{r.created_at ? formatDate(r.created_at.slice(0, 10)) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{r.report_type}</td>
                      <td style={{ fontSize: 12 }}>
                        {[r.location_address, r.location_city].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.anonymous
                          ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Anonymous</span>
                          : [r.reporter_first_name, r.reporter_last_name].filter(Boolean).join(" ") || "—"
                        }
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 11, color: PRIORITY_COLORS[r.priority || "Medium"] }}>
                          {r.priority || "Medium"}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: sc.bg, color: sc.color, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{r.assigned_officer || "—"}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push(`/citizen-reports/${r.id}`)}>
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
