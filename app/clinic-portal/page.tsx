"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicDashboardStats, fetchClinicAppointments } from "@/lib/clinicData";
import type { ClinicMedicalRecord, ClinicAppointment } from "@/lib/clinicTypes";

export default function ClinicDashboardPage() {
  const { user } = useAuth();
  const { selectedClientId, selectedClient } = useClinic();
  const [stats, setStats] = useState({ animalsThisMonth: 0, appointmentsToday: 0, pendingProcedures: 0, outstandingInvoices: 0, recentMedical: [] as ClinicMedicalRecord[] });
  const [upcomingAppts, setUpcomingAppts] = useState<ClinicAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicDashboardStats(user.id, selectedClientId || undefined),
      fetchClinicAppointments(user.id, selectedClientId || undefined),
    ]).then(([s, a]) => {
      setStats(s);
      const today = new Date().toISOString().split("T")[0];
      setUpcomingAppts(a.filter((ap) => ap.appointment_date && ap.appointment_date >= today && ap.status !== "Cancelled").slice(0, 8));
    }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const cards = [
    { label: "Animals Seen This Month", value: stats.animalsThisMonth, icon: "🐾", color: "#1a8a8a", bg: "#f0fdfa" },
    { label: "Appointments Today", value: stats.appointmentsToday, icon: "📅", color: "#6366f1", bg: "#eef2ff" },
    { label: "Pending Procedures", value: stats.pendingProcedures, icon: "🔬", color: "#f59e0b", bg: "#fffbeb" },
    { label: "Outstanding Invoices", value: `$${stats.outstandingInvoices.toLocaleString()}`, icon: "💰", color: "#dc2626", bg: "#fef2f2" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            {selectedClient ? `${selectedClient.county_name} — Dashboard` : "Clinic Dashboard"}
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Welcome back, Dr. {user?.lastName || user?.firstName}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{loading ? "—" : c.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "New Animal", icon: "🐾", href: "/clinic-portal/animals?add=1" },
          { label: "New Appointment", icon: "📅", href: "/clinic-portal/appointments?add=1" },
          { label: "New Procedure", icon: "🔬", href: "/clinic-portal/procedures?add=1" },
          { label: "Create Invoice", icon: "💰", href: "/clinic-portal/invoices?add=1" },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <span>{a.icon}</span> {a.label}
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Upcoming Appointments */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>📅 Upcoming Appointments</span>
            <Link href="/clinic-portal/appointments" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ padding: "8px 16px" }}>
            {loading ? <div style={{ padding: 12, color: "var(--text-muted)" }}>Loading…</div> :
              upcomingAppts.length === 0 ? <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>No upcoming appointments</div> :
              upcomingAppts.map((a) => (
                <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.animal_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.appointment_type} · {a.appointment_date}{a.appointment_time ? ` @ ${a.appointment_time}` : ""}</div>
                  </div>
                  <span className="badge" style={{ background: a.status === "Confirmed" ? "#dcfce7" : "#f1f5f9", color: a.status === "Confirmed" ? "#15803d" : "#64748b", fontSize: 10 }}>{a.status}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Recent Medical */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
            <span>💊 Recent Medical Records</span>
            <Link href="/clinic-portal/medical" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ padding: "8px 16px" }}>
            {loading ? <div style={{ padding: 12, color: "var(--text-muted)" }}>Loading…</div> :
              stats.recentMedical.length === 0 ? <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 13 }}>No recent records</div> :
              stats.recentMedical.map((m) => (
                <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.animal_name || "—"}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.type} — {m.description || "—"}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.date}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
