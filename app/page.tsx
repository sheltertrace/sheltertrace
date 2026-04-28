"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "./providers";
import { fetchAnimals, fetchCalls, fetchAdoptions, fetchMedical } from "@/lib/data";
import type { Animal, DispatchCall, AdoptionRecord, MedicalRecord } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";
import { formatDate, currencyFmt } from "@/lib/utils";
import Link from "next/link";

function StatCard({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}20` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function MiniBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ width: 90, fontSize: 12, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 12, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, transition: "width 0.5s" }} />
      </div>
      <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: "var(--text)", textAlign: "right", flexShrink: 0 }}>{count}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, c, ad, m] = await Promise.all([fetchAnimals(), fetchCalls(), fetchAdoptions(), fetchMedical()]);
      setAnimals(a);
      setCalls(c);
      setAdoptions(ad);
      setMedical(m);
    } catch {
      // Supabase may not have data yet — start empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stats
  const available = animals.filter((a) => a.status === "Available").length;
  const adopted = animals.filter((a) => a.status === "Adopted").length;
  const medHold = animals.filter((a) => a.status === "Medical Hold").length;
  const foster = animals.filter((a) => a.status === "Foster").length;
  const quarantine = animals.filter((a) => a.status === "Quarantine").length;
  const pending = animals.filter((a) => a.status === "Pending").length;
  const pendingCalls = calls.filter((c) => c.status === "Pending").length;
  const activeCalls = calls.filter((c) => ["Dispatched", "En Route", "On Scene"].includes(c.status || "")).length;

  // Monthly adoptions (last 6 months)
  const monthlyAdoptions = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const count = adoptions.filter((a) => {
        if (!a.adoption_date) return false;
        const ad = new Date(a.adoption_date);
        return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
      }).length;
      return { label, count };
    });
  })();

  const maxAdoptions = Math.max(...monthlyAdoptions.map((m) => m.count), 1);

  // Upcoming medical
  const upcomingMed = medical.filter((m) => {
    if (!m.next_due) return false;
    const due = new Date(m.next_due);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 14;
  }).slice(0, 5);

  // Recent calls
  const recentCalls = calls.slice(0, 5);

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading dashboard…</div>
      ) : (
        <div>
          {/* Stat row */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <StatCard icon="🐾" value={available} label="Available for Adoption" color="#22c55e" />
            <StatCard icon="🏡" value={adopted} label="Adopted This Year" color="#6366f1" />
            <StatCard icon="💊" value={medHold} label="Medical Hold" color="#ef4444" />
            <StatCard icon="📡" value={pendingCalls} label="Pending Dispatch Calls" color="#f59e0b" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Population breakdown */}
            <div className="card">
              <div className="card-header"><span className="card-title">🐾 Shelter Population</span><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{animals.length} total</span></div>
              <MiniBar label="Available" count={available} max={animals.length} color="#22c55e" />
              <MiniBar label="Foster" count={foster} max={animals.length} color="#f59e0b" />
              <MiniBar label="Med Hold" count={medHold} max={animals.length} color="#ef4444" />
              <MiniBar label="Quarantine" count={quarantine} max={animals.length} color="#dc2626" />
              <MiniBar label="Pending" count={pending} max={animals.length} color="#a855f7" />
              <MiniBar label="Adopted" count={adopted} max={animals.length} color="#6366f1" />
            </div>

            {/* Monthly adoptions chart */}
            <div className="card">
              <div className="card-header"><span className="card-title">📈 Monthly Adoptions</span></div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 20, position: "relative" }}>
                {monthlyAdoptions.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--teal)" }}>{m.count || ""}</div>
                    <div style={{ width: "100%", background: m.count > 0 ? "var(--teal)" : "#e2e8f0", height: `${(m.count / maxAdoptions) * 80 + (m.count > 0 ? 4 : 0)}px`, minHeight: m.count > 0 ? 4 : 2, borderRadius: "3px 3px 0 0", transition: "height 0.5s" }} />
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick links */}
            <div className="card">
              <div className="card-header"><span className="card-title">⚡ Quick Actions</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link href="/animals" className="btn btn-primary" style={{ justifyContent: "flex-start" }}>🐾 New Animal Intake</Link>
                <Link href="/dispatch" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>📡 New Dispatch Call</Link>
                <Link href="/adoptions" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>🏡 Process Adoption</Link>
                <Link href="/medical" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>💊 Add Medical Record</Link>
                <Link href="/receipts" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>🧾 Create Receipt</Link>
                <Link href="/people" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>👥 New Contact</Link>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Recent dispatch calls */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📡 Recent Dispatch Calls</span>
                <Link href="/dispatch" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
              </div>
              {recentCalls.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No calls on record</div>
              ) : (
                <div>
                  {recentCalls.map((call) => (
                    <Link key={call.id} href={`/dispatch`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)", textDecoration: "none", color: "inherit" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{call.type}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{call.address || "No address"} · {call.city || ""}</div>
                      </div>
                      <span className="badge" style={{ background: "#f1f5f9", color: "#475569", fontSize: 10 }}>{call.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming medical */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">💊 Upcoming Medical</span>
                <Link href="/medical" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
              </div>
              {upcomingMed.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No upcoming treatments</div>
              ) : (
                <div>
                  {upcomingMed.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{m.animal_name} — {m.type}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.description} · {m.vet}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>Due {formatDate(m.next_due)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Animals requiring attention */}
          {animals.filter((a) => ["Medical Hold", "Quarantine"].includes(a.status)).length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span className="card-title">⚠️ Animals Requiring Attention</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Status</th><th>Kennel</th><th>Intake Date</th></tr></thead>
                  <tbody>
                    {animals.filter((a) => ["Medical Hold", "Quarantine"].includes(a.status)).slice(0, 8).map((a) => (
                      <tr key={a.id} onClick={() => router.push(`/animals/${a.id}`)} style={{ cursor: "pointer" }}>
                        <td style={{ fontSize: 12 }}>{a.id}</td>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td>{a.species}</td>
                        <td><span className="badge" style={{ background: STATUS_COLORS[a.status] + "20", color: STATUS_COLORS[a.status] }}>{a.status}</span></td>
                        <td>{a.kennel || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(a.intake_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
