"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/app/providers";
import { fetchAnimals, fetchCalls, fetchAdoptions, fetchMedical } from "@/lib/data";
import { fetchOfficerFieldStatuses } from "@/lib/fieldOps";
import { fetchTodayOnCall } from "@/lib/schedules";
import { fetchLostFoundReports } from "@/lib/data";
import type { Animal, DispatchCall, AdoptionRecord, MedicalRecord, OfficerFieldProfile, FieldStatus, ScheduleOverride } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/constants";
import { formatDate, currencyFmt, isImported, IN_SHELTER_STATUSES } from "@/lib/utils";
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
  const [officers, setOfficers] = useState<OfficerFieldProfile[]>([]);
  const [todayOnCall, setTodayOnCall] = useState<ScheduleOverride[]>([]);
  const [lostFoundStats, setLostFoundStats] = useState({ activeLost: 0, activeFound: 0, reunited: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, c, ad, m, offs, oc, lfReports] = await Promise.all([
        fetchAnimals(), fetchCalls(), fetchAdoptions(), fetchMedical(),
        fetchOfficerFieldStatuses(), fetchTodayOnCall(),
        fetchLostFoundReports({ limit: 500 }),
      ]);
      setAnimals(a); setCalls(c); setAdoptions(ad); setMedical(m);
      setOfficers(offs); setTodayOnCall(oc);
      setLostFoundStats({
        activeLost:  lfReports.filter((r) => r.type === "lost"  && r.status === "active").length,
        activeFound: lfReports.filter((r) => r.type === "found" && r.status === "active").length,
        reunited:    lfReports.filter((r) => r.status === "reunited").length,
      });
    } catch {
      // Supabase may not have data yet — start empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // GDA due-date reminder
  const gdaReminder = (() => {
    const now    = new Date();
    const day    = now.getDate();
    const month  = now.getMonth();
    const year   = now.getFullYear();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1 : year;
    const dueMonth  = month === 11 ? 0 : month + 1;
    const dueYear   = month === 11 ? year + 1 : year;
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dueStr = `${monthNames[dueMonth < 12 ? dueMonth : 0]} 10, ${dueYear}`;
    if (day >= 1 && day <= 10) {
      return {
        label: `GDA report for ${monthNames[prevMonth]} ${prevYear}`,
        due:   `due by ${dueStr}`,
        color: day >= 8 ? "#dc2626" : day >= 5 ? "#d97706" : "#16a34a",
        bg:    day >= 8 ? "#fee2e2" : day >= 5 ? "#fef3c7" : "#f0fdf4",
        icon:  day >= 8 ? "🚨" : day >= 5 ? "⚠️" : "📋",
        link:  "/reports",
        overdue: false,
      };
    }
    if (day > 10) {
      return {
        label: `GDA report for ${monthNames[prevMonth]} ${prevYear}`,
        due:   "is OVERDUE",
        color: "#dc2626", bg: "#fee2e2", icon: "🚨",
        link:  "/reports", overdue: true,
      };
    }
    return null;
  })();

  // Stats: count all animals with an active in-shelter status (includes any imported
  // animals that still have kennels and active statuses). Historical records are
  // imported animals with outcome statuses — exclude those from all counts.
  const shelterActive = animals.filter((a) => IN_SHELTER_STATUSES.has(a.status));
  const historicalCount = animals.filter((a) => isImported(a) && !IN_SHELTER_STATUSES.has(a.status)).length;
  const available = shelterActive.filter((a) => a.status === "Available").length;
  const adopted = animals.filter((a) => !isImported(a) && a.status === "Adopted").length;
  const medHold = shelterActive.filter((a) => a.status === "Medical Hold").length;
  const foster = shelterActive.filter((a) => a.status === "Foster" || a.status === "In Foster").length;
  const quarantine = shelterActive.filter((a) => a.status === "Quarantine").length;
  const pending = shelterActive.filter((a) => a.status === "Pending").length;
  const imported = 0; // no longer tracked as separate status
  const redeemed = animals.filter((a) => !isImported(a) && a.status === "Redeemed").length;
  const transferred = animals.filter((a) => !isImported(a) && a.status === "Transferred").length;
  const pendingCalls = calls.filter((c) => c.status === "Pending").length;
  const activeCalls = calls.filter((c) => ["Dispatched", "En Route", "On Scene"].includes(c.status || "")).length;

  // Unconfirmed (Scheduled) vaccines
  const scheduledMeds = medical.filter((m) => !m.status || m.status === "Scheduled" || m.status === "Pending");
  const animalIdsWithScheduled = [...new Set(scheduledMeds.map((m) => m.animal_id))];
  const animalsWithScheduled = animalIdsWithScheduled
    .map((id) => shelterActive.find((a) => a.id === id))
    .filter(Boolean) as Animal[];
  const [showUnconfirmedList, setShowUnconfirmedList] = useState(false);

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
          {/* GDA reminder banner */}
          {gdaReminder && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderRadius: 10, marginBottom: 16, background: gdaReminder.bg, border: `1px solid ${gdaReminder.color}30` }}>
              <span style={{ fontSize: 18 }}>{gdaReminder.icon}</span>
              <div style={{ flex: 1, fontSize: 13, color: gdaReminder.color, fontWeight: 600 }}>
                <strong>{gdaReminder.label}</strong> {gdaReminder.due}
              </div>
              <Link href={gdaReminder.link} style={{ fontSize: 12, color: gdaReminder.color, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Generate Report →
              </Link>
            </div>
          )}

          {/* Unconfirmed vaccines alert */}
          {animalsWithScheduled.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderRadius: showUnconfirmedList ? "10px 10px 0 0" : 10, background: "#fef3c7", border: "1px solid #fde68a", cursor: "pointer" }}
                onClick={() => setShowUnconfirmedList((v) => !v)}
              >
                <span style={{ fontSize: 18 }}>🕐</span>
                <div style={{ flex: 1, fontSize: 13, color: "#b45309", fontWeight: 600 }}>
                  <strong>{animalsWithScheduled.length} animal{animalsWithScheduled.length !== 1 ? "s" : ""}</strong> have unconfirmed scheduled vaccines — staff must mark each as given
                </div>
                <span style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>{showUnconfirmedList ? "▲ Hide" : "▼ View List"}</span>
              </div>
              {showUnconfirmedList && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "8px 18px 12px" }}>
                  {animalsWithScheduled.map((a) => {
                    const meds = scheduledMeds.filter((m) => m.animal_id === a.id);
                    return (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #fde68a" }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#0f2942" }}>{a.name}</span>
                          <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>{a.species} · Kennel {a.kennel || "Unassigned"}</span>
                          <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                            {meds.map((m) => m.description).join(" · ")}
                          </div>
                        </div>
                        <Link href={`/animals/${a.id}`} style={{ fontSize: 12, color: "#1a8a8a", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", marginLeft: 12 }}>
                          Confirm →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
              <div className="card-header"><span className="card-title">🐾 Shelter Population</span><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{shelterActive.length} in shelter</span></div>
              <MiniBar label="Available" count={available} max={shelterActive.length} color="#22c55e" />
              <MiniBar label="Foster" count={foster} max={shelterActive.length} color="#f59e0b" />
              <MiniBar label="Med Hold" count={medHold} max={shelterActive.length} color="#ef4444" />
              <MiniBar label="Quarantine" count={quarantine} max={shelterActive.length} color="#dc2626" />
              <MiniBar label="Pending" count={pending} max={shelterActive.length} color="#a855f7" />
              <MiniBar label="Adopted" count={adopted} max={shelterActive.length} color="#6366f1" />
              {imported > 0 && <MiniBar label="Imported" count={imported} max={shelterActive.length} color="#0ea5e9" />}
              {transferred > 0 && <MiniBar label="Transferred" count={transferred} max={shelterActive.length} color="#7c3aed" />}
              {redeemed > 0 && <MiniBar label="Redeemed" count={redeemed} max={shelterActive.length} color="#0891b2" />}
              {historicalCount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: "1px solid var(--border-light)", marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  <span>📦 Historical Records</span>
                  <Link href="/animals" onClick={() => {}} style={{ color: "var(--text-muted)", textDecoration: "none", fontWeight: 600 }}>{historicalCount}</Link>
                </div>
              )}
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Field Ops */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">🚓 Officer Field Status</span>
                <Link href="/field-ops" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View board →</Link>
              </div>

              {/* On-Call Today strip */}
              {todayOnCall.length > 0 && (
                <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 7, padding: "8px 12px", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>📞 On-Call Today</span>
                  {todayOnCall.map((oc) => (
                    <div key={oc.id} style={{ fontSize: 13, fontWeight: 700, color: "#78350f", marginTop: 2 }}>
                      {oc.officer_name ?? "Officer"}
                      {oc.shift_type && oc.shift_type !== "On-Call" && <span style={{ fontWeight: 400, color: "#92400e" }}> · {oc.shift_type}</span>}
                    </div>
                  ))}
                </div>
              )}

              {officers.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No officers on record</div>
              ) : (
                <div>
                  {(["On Duty", "En Route", "On Scene", "Available", "Break"] as FieldStatus[]).map((s) => {
                    const list = officers.filter((o) => o.current_field_status === s);
                    if (list.length === 0) return null;
                    const COLOR: Record<FieldStatus, string> = { "On Duty": "#28a745", "En Route": "#ffc107", "On Scene": "#0d6efd", "Available": "#17a2b8", "Break": "#dc3545", "Off Duty": "#adb5bd" };
                    return (
                      <div key={s} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: COLOR[s], marginBottom: 3 }}>{s.toUpperCase()}</div>
                        {list.map((o) => (
                          <div key={o.id} style={{ fontSize: 13, paddingLeft: 10, color: "var(--text)" }}>
                            {o.first_name} {o.last_name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {officers.filter((o) => o.current_field_status === "Off Duty").length} off duty
                  </div>
                </div>
              )}
            </div>

            {/* Active calls stat */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📊 Dispatch Overview</span>
                <Link href="/dispatch" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>View all →</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Pending", value: calls.filter((c) => c.status === "Pending").length, color: "#f59e0b" },
                  { label: "Active (En Route / On Scene)", value: activeCalls, color: "#0d6efd" },
                  { label: "Closed (all time)", value: calls.filter((c) => c.status === "Closed").length, color: "#22c55e" },
                ].map((r) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text)" }}>{r.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lost & Found widget */}
          {(lostFoundStats.activeLost + lostFoundStats.activeFound) > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">🔎 Lost &amp; Found</span>
                <Link href="/lost-found-admin" style={{ fontSize: 12, color: "var(--teal)", textDecoration: "none" }}>Manage →</Link>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[
                  { label: "Active Lost",  value: lostFoundStats.activeLost,  color: "#dc2626" },
                  { label: "Active Found", value: lostFoundStats.activeFound, color: "#2563eb" },
                  { label: "Reunited",     value: lostFoundStats.reunited,    color: "#16a34a" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <a href="/lost-found" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, textDecoration: "none" }}>View public board →</a>
              </div>
            </div>
          )}

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
