"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { fetchPlatformStats, fetchAuditLog } from "@/lib/superAdminData";
import type { AuditLogEntry } from "@/lib/superAdminTypes";

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalCustomers: 0, active: 0, trial: 0, suspended: 0, totalUsers: 0, totalAnimals: 0, mrr: 0, trialsExpiring: 0 });
  const [recentActions, setRecentActions] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPlatformStats(), fetchAuditLog(10)])
      .then(([s, a]) => { setStats(s); setRecentActions(a); })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Customers", value: stats.totalCustomers, icon: "🏢", color: "#6366f1", bg: "#eef2ff" },
    { label: "Active Accounts", value: stats.active, icon: "🟢", color: "#15803d", bg: "#f0fdf4" },
    { label: "Trial Accounts", value: stats.trial, icon: "⏳", color: "#b45309", bg: "#fffbeb" },
    { label: "Suspended", value: stats.suspended, icon: "⚠️", color: "#dc2626", bg: "#fef2f2" },
    { label: "Total Users", value: stats.totalUsers, icon: "👤", color: "#0369a1", bg: "#f0f9ff" },
    { label: "Total Animals", value: stats.totalAnimals, icon: "🐾", color: "#1a8a8a", bg: "#f0fdfa" },
    { label: "Monthly Revenue", value: `$${stats.mrr.toLocaleString()}`, icon: "💰", color: "#15803d", bg: "#f0fdf4" },
    { label: "Trials Expiring", value: stats.trialsExpiring, icon: "🔔", color: stats.trialsExpiring > 0 ? "#dc2626" : "#64748b", bg: stats.trialsExpiring > 0 ? "#fef2f2" : "#f8fafc" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Platform Dashboard</h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>ShelterTrace Super Admin</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{loading ? "—" : c.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <Link href="/superadmin/customers?add=1" className="btn btn-primary" style={{ textDecoration: "none" }}>+ Add Customer</Link>
        <Link href="/superadmin/users?add=1" className="btn btn-secondary" style={{ textDecoration: "none" }}>+ Add User</Link>
        <Link href="/superadmin/announcements?add=1" className="btn btn-secondary" style={{ textDecoration: "none" }}>📢 Send Announcement</Link>
        <Link href="/superadmin/audit-log" className="btn btn-secondary" style={{ textDecoration: "none" }}>📋 Audit Log</Link>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>📋 Recent Platform Activity</div>
        <div style={{ padding: "8px 16px" }}>
          {loading ? <div style={{ padding: 12, color: "var(--text-muted)" }}>Loading…</div> :
            recentActions.length === 0 ? <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>No audit log entries yet</div> :
            recentActions.map((a) => (
              <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{a.action}</span>
                  {a.target_type && <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{a.target_type} {a.target_id?.slice(0, 8)}</span>}
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
