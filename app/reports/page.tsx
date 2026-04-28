"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchAnimals, fetchAdoptions, fetchMedical } from "@/lib/data";
import type { Animal, AdoptionRecord, MedicalRecord } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, ad, m] = await Promise.all([fetchAnimals(), fetchAdoptions(), fetchMedical()]);
      setAnimals(a);
      setAdoptions(ad);
      setMedical(m);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const nonEuth = animals.filter((a) => a.status !== "Euthanized");
    const adopted = animals.filter((a) => a.status === "Adopted");
    const withStay = adopted.filter((a) => a.intake_date && a.updated_at);
    const avgStay = withStay.length > 0
      ? Math.round(withStay.reduce((s, a) => s + (new Date(a.updated_at!).getTime() - new Date(a.intake_date).getTime()) / 86400000, 0) / withStay.length)
      : 0;
    const fixed = nonEuth.filter((a) => a.fixed).length;
    const spayNeuterRate = nonEuth.length > 0 ? Math.round((fixed / nonEuth.length) * 100) : 0;
    const chipped = nonEuth.filter((a) => a.microchip).length;
    const microchipRate = nonEuth.length > 0 ? Math.round((chipped / nonEuth.length) * 100) : 0;
    return { avgStay, spayNeuterRate, microchipRate };
  }, [animals, medical]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const yr = d.getFullYear(), mo = d.getMonth();
      const intakes = animals.filter((a) => { const x = new Date(a.intake_date); return x.getFullYear() === yr && x.getMonth() === mo; }).length;
      const ads = adoptions.filter((a) => { if (!a.adoption_date) return false; const x = new Date(a.adoption_date); return x.getFullYear() === yr && x.getMonth() === mo; }).length;
      return { label: MONTHS[mo], intakes, adoptions: ads };
    });
  }, [animals, adoptions]);

  const maxBar = Math.max(...monthlyData.flatMap((m) => [m.intakes, m.adoptions]), 1);

  const speciesBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    animals.forEach((a) => { counts[a.species] = (counts[a.species] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [animals]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    animals.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [animals]);

  const outcomeBreakdown = useMemo(() => {
    const outcomes = ["Adopted", "Euthanized", "Foster", "Pending"];
    return outcomes.map((o) => ({ label: o, count: animals.filter((a) => a.status === o).length }));
  }, [animals]);

  const topBreeds = useMemo(() => {
    const counts: Record<string, number> = {};
    animals.forEach((a) => { if (a.breed) counts[a.breed] = (counts[a.breed] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [animals]);

  const medByType = useMemo(() => {
    const counts: Record<string, number> = {};
    medical.forEach((m) => { counts[m.type] = (counts[m.type] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [medical]);

  const reportCards = [
    { id: "intakes", title: "Intake Report", desc: "Monthly intake by species, source, and circumstance", icon: "📥" },
    { id: "outcomes", title: "Outcome Report", desc: "Adoption, euthanasia, foster, and return rates", icon: "📤" },
    { id: "medical", title: "Medical Report", desc: "Medical records by type, vet, and cost", icon: "🏥" },
    { id: "length", title: "Length of Stay", desc: "Average days in shelter by species and outcome", icon: "📅" },
    { id: "breeds", title: "Breed Analysis", desc: "Top 10 breeds by intake count", icon: "🐾" },
    { id: "species", title: "Species Breakdown", desc: "Animal count and percentage by species", icon: "🐕" },
    { id: "monthly", title: "Monthly Trend", desc: "Intakes vs adoptions over the last 6 months", icon: "📈" },
    { id: "status", title: "Status Summary", desc: "Current population by status", icon: "📊" },
  ];

  return (
    <AppShell title="Reports & Analytics">
      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Avg Length of Stay", value: `${stats.avgStay}d`, color: "#6366f1", icon: "📅" },
          { label: "Medical Records", value: medical.length, color: "#ef4444", icon: "💊" },
          { label: "Spay/Neuter Rate", value: `${stats.spayNeuterRate}%`, color: "#22c55e", icon: "✂️" },
          { label: "Microchip Rate", value: `${stats.microchipRate}%`, color: "#0ea5e9", icon: "📡" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Report Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {reportCards.map((r) => (
          <div key={r.id} onClick={() => setActiveReport(activeReport === r.id ? null : r.id)}
            style={{ border: `2px solid ${activeReport === r.id ? "var(--teal)" : "var(--border)"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: activeReport === r.id ? "#f0fdfa" : "#fff", transition: "all 0.15s" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Monthly Trend Chart */}
      {(activeReport === "monthly" || activeReport === null) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Monthly Trend — Last 6 Months</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 160 }}>
            {monthlyData.map((m) => (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", display: "flex", gap: 3, alignItems: "flex-end", height: 130 }}>
                  <div title={`Intakes: ${m.intakes}`} style={{ flex: 1, background: "#0ea5e9", borderRadius: "3px 3px 0 0", height: `${(m.intakes / maxBar) * 100}%`, minHeight: 2 }} />
                  <div title={`Adoptions: ${m.adoptions}`} style={{ flex: 1, background: "#22c55e", borderRadius: "3px 3px 0 0", height: `${(m.adoptions / maxBar) * 100}%`, minHeight: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 12, height: 12, background: "#0ea5e9", borderRadius: 2 }} />Intakes</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><div style={{ width: 12, height: 12, background: "#22c55e", borderRadius: 2 }} />Adoptions</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Species Breakdown */}
        {(activeReport === "species" || activeReport === null) && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Species Breakdown</div>
            {loading ? <div style={{ color: "var(--text-muted)" }}>Loading…</div> :
              speciesBreakdown.map(([sp, count]) => (
                <div key={sp} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, minWidth: 80 }}>{sp}</div>
                  <div style={{ flex: 1, height: 16, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--teal)", borderRadius: 4, width: `${(count / animals.length) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: "right" }}>{count} ({Math.round((count / animals.length) * 100)}%)</div>
                </div>
              ))
            }
          </div>
        )}

        {/* Status Summary */}
        {(activeReport === "status" || activeReport === null) && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Status Summary</div>
            {loading ? <div style={{ color: "var(--text-muted)" }}>Loading…</div> :
              statusBreakdown.map(([st, count]) => (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, minWidth: 110 }}>{st}</div>
                  <div style={{ flex: 1, height: 16, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#6366f1", borderRadius: 4, width: `${(count / animals.length) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: "right" }}>{count}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Top Breeds */}
        {(activeReport === "breeds" || activeReport === null) && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Top 10 Breeds</div>
            {loading ? <div style={{ color: "var(--text-muted)" }}>Loading…</div> :
              topBreeds.map(([breed, count], i) => (
                <div key={breed} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f1f5f9", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>{breed}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{count}</div>
                </div>
              ))
            }
          </div>
        )}

        {/* Medical by Type */}
        {(activeReport === "medical" || activeReport === null) && (
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Medical Records by Type</div>
            {loading ? <div style={{ color: "var(--text-muted)" }}>Loading…</div> :
              medByType.length === 0 ? <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No medical records</div> :
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 700, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Type</th>
                      <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 700, color: "var(--text-secondary)", fontSize: 11, textTransform: "uppercase" }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medByType.map(([type, count]) => (
                      <tr key={type} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "5px 6px" }}>{type}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        )}
      </div>

      {/* Outcomes */}
      {(activeReport === "outcomes" || activeReport === null) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Outcome Report</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {outcomeBreakdown.map(({ label, count }) => (
              <div key={label} style={{ textAlign: "center", padding: 16, background: "#f8fafc", borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--teal)" }}>{count}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {animals.length > 0 ? `${Math.round((count / animals.length) * 100)}% of total` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
