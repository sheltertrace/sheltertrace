"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchCityDashboardStats, fetchApplications } from "@/lib/cityLicenseData";
import type { PetLicenseApplication } from "@/lib/cityLicenseTypes";

export default function CityPortalDashboard() {
  const [stats, setStats] = useState({ pending: 0, approved: 0, active: 0, expired: 0, expiringSoon: 0, total: 0 });
  const [recentApps, setRecentApps] = useState<PetLicenseApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchCityDashboardStats(),
      fetchApplications({ limit: 5 }),
    ]).then(([s, apps]) => { setStats(s); setRecentApps(apps); }).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Pending Review", value: stats.pending, color: stats.pending > 0 ? "#f59e0b" : "#22c55e", bg: stats.pending > 0 ? "#fffbeb" : "#f0fdf4", icon: "📋", href: "/city-portal/applications?status=Pending" },
    { label: "Approved This Year", value: stats.approved, color: "#6366f1", bg: "#eef2ff", icon: "✅", href: "/city-portal/applications?status=Approved" },
    { label: "Active Licenses", value: stats.active, color: "#15803d", bg: "#f0fdf4", icon: "🏷️", href: "/city-portal/licenses" },
    { label: "Expiring in 30 Days", value: stats.expiringSoon, color: stats.expiringSoon > 0 ? "#dc2626" : "#64748b", bg: stats.expiringSoon > 0 ? "#fef2f2" : "#f8fafc", icon: "⚠️", href: "/city-portal/licenses?expiring=1" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Dog License Dashboard</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/madison-pet-license" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ textDecoration: "none", fontSize: 12 }}>🔗 Public Form</a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.icon}</div>
              <div><div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{loading ? "—" : c.value}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.label}</div></div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>📋 Recent Applications</span>
            <Link href="/city-portal/applications" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ padding: "8px 16px" }}>
            {loading ? <div style={{ padding: 12, color: "var(--text-muted)" }}>Loading…</div> :
              recentApps.length === 0 ? <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>No applications yet.</div> :
              recentApps.map((a) => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <Link href={`/city-portal/applications/${a.id}`} style={{ fontWeight: 600, fontSize: 13, color: "var(--teal)", textDecoration: "none" }}>{a.application_number}</Link>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.owner_first_name} {a.owner_last_name} · {(a.animals as unknown[]).length} dog{(a.animals as unknown[]).length !== 1 ? "s" : ""}</div>
                  </div>
                  <span className="badge" style={{ background: a.status === "Pending" ? "#fef3c7" : a.status === "Approved" ? "#dcfce7" : "#f1f5f9", color: a.status === "Pending" ? "#b45309" : a.status === "Approved" ? "#15803d" : "#64748b", fontSize: 10 }}>{a.status}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Review Pending Applications", href: "/city-portal/applications?status=Pending", icon: "📋" },
              { label: "Issue a License", href: "/city-portal/applications", icon: "🏷️" },
              { label: "Upload Physical Form", href: "/city-portal/upload", icon: "📁" },
              { label: "License Lookup", href: "/city-portal/lookup", icon: "🔍" },
              { label: "Record a Payment", href: "/city-portal/payments", icon: "💰" },
            ].map((a) => (
              <Link key={a.href} href={a.href} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 8, textDecoration: "none", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                <span>{a.icon}</span> {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
