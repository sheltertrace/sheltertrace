"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { fetchApplications } from "@/lib/cityLicenseData";
import type { PetLicenseApplication } from "@/lib/cityLicenseTypes";
import { APP_STATUSES } from "@/lib/cityLicenseTypes";

function daysPending(submittedAt?: string): number {
  if (!submittedAt) return 0;
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<PetLicenseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchApplications().then(setApps).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    let list = apps;
    if (filterStatus !== "all") list = list.filter((a) => a.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        `${a.owner_first_name} ${a.owner_last_name}`.toLowerCase().includes(q) ||
        (a.application_number || "").toLowerCase().includes(q) ||
        (a.owner_phone || "").includes(q)
      );
    }
    return list;
  }, [apps, search, filterStatus]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>📋 Applications</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search name, phone, app#…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        {["all", ...APP_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`} style={{ textTransform: "capitalize" }}>
            {s === "all" ? "All" : s} {s !== "all" ? `(${apps.filter((a) => a.status === s).length})` : `(${apps.length})`}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>App #</th><th>Applicant</th><th>Animals</th><th>Submitted</th><th>Days Pending</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No applications found</td></tr>
              ) : filtered.map((a) => {
                const days = daysPending(a.submitted_at);
                const statusColor = a.status === "Pending" ? "#b45309" : a.status === "Approved" ? "#15803d" : a.status === "Denied" ? "#dc2626" : "#64748b";
                const statusBg = a.status === "Pending" ? "#fef3c7" : a.status === "Approved" ? "#dcfce7" : a.status === "Denied" ? "#fee2e2" : "#f1f5f9";
                return (
                  <tr key={a.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{a.application_number}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.owner_first_name} {a.owner_last_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.owner_phone}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{(a.animals as unknown[]).length} dog{(a.animals as unknown[]).length !== 1 ? "s" : ""}</td>
                    <td style={{ fontSize: 12 }}>{a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}</td>
                    <td><span style={{ fontWeight: 700, color: days > 5 ? "#dc2626" : "inherit" }}>{days}d</span></td>
                    <td><span className="badge" style={{ background: "#f1f5f9", color: "#475569", fontSize: 10, textTransform: "capitalize" }}>{a.submission_type?.replace("_", " ")}</span></td>
                    <td><span className="badge" style={{ background: statusBg, color: statusColor, textTransform: "capitalize" }}>{a.status}</span></td>
                    <td><Link href={`/city-portal/applications/${a.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, textDecoration: "none" }}>Review →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
