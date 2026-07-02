"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { fetchBiteReports } from "@/lib/biteReportData";
import type { BiteReport } from "@/lib/biteReportTypes";
import { printBiteReport } from "@/lib/biteReportPrint";

export default function BiteReportsPage() {
  const [reports, setReports] = useState<BiteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchBiteReports().then(setReports).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    let list = reports;
    if (filterType !== "all") list = list.filter((r) => r.report_type === filterType);
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => (r.report_number || "").toLowerCase().includes(q) || (r.incident_address || "").toLowerCase().includes(q) || (r.investigating_officer || "").toLowerCase().includes(q));
    }
    return list;
  }, [reports, filterType, filterStatus, search]);

  return (
    <AppShell title="Bite Reports"
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/bite-reports/new?type=animal_human" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>🐕→👤 Animal to Human</Link>
          <Link href="/bite-reports/new?type=animal_animal" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>🐕→🐕 Animal to Animal</Link>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search report #, address, officer…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ maxWidth: 160 }}>
          <option value="all">All Types</option>
          <option value="animal_human">Animal to Human</option>
          <option value="animal_animal">Animal to Animal</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 130 }}>
          <option value="all">All Status</option>
          <option>Open</option><option>Pending</option><option>Closed</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} report{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🐾</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No bite reports on file</div>
            <div style={{ fontSize: 13 }}>Use the buttons above to create a new report.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Report #</th><th>Type</th><th>Date</th><th>Address</th><th>Status</th><th>Officer</th><th></th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{r.report_number}</td>
                    <td><span className="badge" style={{ background: r.report_type === "animal_human" ? "#fee2e2" : "#ede9fe", color: r.report_type === "animal_human" ? "#dc2626" : "#7c3aed", fontSize: 10 }}>{r.report_type === "animal_human" ? "→ Human" : "→ Animal"}</span></td>
                    <td style={{ fontSize: 12 }}>{r.incident_date}</td>
                    <td style={{ fontSize: 12 }}>{r.incident_address || "—"}</td>
                    <td><span className="badge" style={{ background: r.status === "Open" ? "#fef3c7" : r.status === "Closed" ? "#dcfce7" : "#f1f5f9", color: r.status === "Open" ? "#b45309" : r.status === "Closed" ? "#15803d" : "#64748b", fontSize: 10 }}>{r.status}</span></td>
                    <td style={{ fontSize: 12 }}>{r.investigating_officer || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/bite-reports/${r.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, textDecoration: "none" }}>View</Link>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printBiteReport(r)}>🖨</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </AppShell>
  );
}
