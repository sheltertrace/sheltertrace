"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchAnimals, fetchAdoptions, fetchMedical, fetchTransfers } from "@/lib/data";
import type { Animal, AdoptionRecord, MedicalRecord, Transfer, RescueGroup } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";
import { printTransferReceipt } from "@/components/transfers/TransferWizard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);

  // Transfer report filters
  const [trDateFrom, setTrDateFrom] = useState("");
  const [trDateTo, setTrDateTo] = useState("");
  const [trAgency, setTrAgency] = useState("All");
  const [trSpecies, setTrSpecies] = useState("All");
  const [trOfficer, setTrOfficer] = useState("All");

  const load = useCallback(async () => {
    try {
      const [a, ad, m, tr] = await Promise.all([fetchAnimals(), fetchAdoptions(), fetchMedical(), fetchTransfers()]);
      setAnimals(a);
      setAdoptions(ad);
      setMedical(m);
      setTransfers(tr);
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

  // ── Transfer report data ─────────────────────────────────────────────────────

  // Build a flat row per animal per transfer for filtering/display
  type TransferRow = {
    transfer: Transfer;
    animalId: string;
    animalName: string;
    species: string;
    breed: string;
  };

  const transferRows = useMemo<TransferRow[]>(() => {
    const rows: TransferRow[] = [];
    for (const t of transfers) {
      const ids: string[] = t.animal_ids || [];
      const names: string[] = (t.animal_names as string[] | undefined) || [];
      const snapshots = (t.animal_info_snapshot || []) as Record<string, unknown>[];
      ids.forEach((id, i) => {
        const snap = snapshots[i];
        const liveAnimal = animals.find((a) => a.id === id);
        rows.push({
          transfer: t,
          animalId: id,
          animalName: names[i] || id,
          species: (snap?.species as string) || liveAnimal?.species || "—",
          breed: (snap?.breed as string) || liveAnimal?.breed || "—",
        });
      });
    }
    return rows;
  }, [transfers, animals]);

  const transferAgencies = useMemo(() => {
    const set = new Set(transfers.map((t) => t.rescue_group_name || "Unknown"));
    return ["All", ...Array.from(set).sort()];
  }, [transfers]);

  const transferOfficers = useMemo(() => {
    const set = new Set(transfers.map((t) => t.officer || "Unknown").filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [transfers]);

  const filteredTransferRows = useMemo(() => {
    return transferRows.filter((r) => {
      const t = r.transfer;
      if (trDateFrom && t.date < trDateFrom) return false;
      if (trDateTo && t.date > trDateTo) return false;
      if (trAgency !== "All" && t.rescue_group_name !== trAgency) return false;
      if (trSpecies !== "All" && r.species !== trSpecies) return false;
      if (trOfficer !== "All" && t.officer !== trOfficer) return false;
      return true;
    });
  }, [transferRows, trDateFrom, trDateTo, trAgency, trSpecies, trOfficer]);

  const transferStats = useMemo(() => {
    const now = new Date();
    const thisMonth = transfers.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const thisYear = transfers.filter((t) => new Date(t.date).getFullYear() === now.getFullYear());

    const byAgency: Record<string, number> = {};
    transfers.forEach((t) => {
      const name = t.rescue_group_name || "Unknown";
      byAgency[name] = (byAgency[name] || 0) + (t.animal_ids || []).length;
    });

    const bySpecies: Record<string, number> = {};
    transferRows.forEach((r) => {
      if (r.species !== "—") bySpecies[r.species] = (bySpecies[r.species] || 0) + 1;
    });

    return {
      thisMonth: thisMonth.reduce((s, t) => s + (t.animal_ids || []).length, 0),
      thisYear: thisYear.reduce((s, t) => s + (t.animal_ids || []).length, 0),
      total: transferRows.length,
      byAgency: Object.entries(byAgency).sort((a, b) => b[1] - a[1]).slice(0, 5),
      bySpecies: Object.entries(bySpecies).sort((a, b) => b[1] - a[1]),
    };
  }, [transfers, transferRows]);

  const exportTransferCSV = () => {
    const header = ["Receipt #", "Date", "Animal ID", "Animal Name", "Species", "Breed", "Receiving Agency", "Officer"].join(",");
    const rows = filteredTransferRows.map((r) => [
      r.transfer.transfer_number,
      r.transfer.date,
      r.animalId,
      r.animalName,
      r.species,
      r.breed,
      r.transfer.rescue_group_name || "",
      r.transfer.officer || "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfers-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTransferReport = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = filteredTransferRows.map((r, i) => `
      <tr style="${i % 2 === 1 ? "background:#f8fafc;" : ""}">
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-family:monospace;font-size:10px;">${r.transfer.transfer_number}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${formatDate(r.transfer.date)}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;font-family:monospace;">${r.animalId}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:11px;font-weight:700;">${r.animalName}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${r.species}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${r.breed}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${r.transfer.rescue_group_name || "—"}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px;">${r.transfer.officer || "—"}</td>
      </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Transfer Report</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:0.5in;}@page{size:letter landscape;margin:0;}</style>
</head><body>
<div style="background:#0f2942;color:#fff;padding:12px 16px;border-radius:6px;margin-bottom:16px;display:flex;justify-content:space-between;">
  <div><div style="font-size:16px;font-weight:900;">MORGAN COUNTY ANIMAL SERVICES</div><div style="font-size:10px;color:#93c5fd;">Transfer Report · Generated ${formatDate(today())}</div></div>
  <div style="text-align:right;font-size:11px;color:#bfdbfe;">${filteredTransferRows.length} records</div>
</div>
<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
<thead><tr style="background:#1e3a5f;color:#fff;">
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Receipt #</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Date</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Animal ID</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Name</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Species</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Breed</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Agency</th>
  <th style="padding:5px 8px;font-size:9px;text-align:left;text-transform:uppercase;">Officer</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    w.document.close();
  };

  // ── Deduplicate transfer rows by transfer ID for the table (show one row per transfer, not per animal)
  const transferTableRows = useMemo(() => {
    const seen = new Set<string>();
    return filteredTransferRows.filter((r) => {
      if (seen.has(r.transfer.id)) return false;
      seen.add(r.transfer.id);
      return true;
    });
  }, [filteredTransferRows]);

  const reportCards = [
    { id: "intakes", title: "Intake Report", desc: "Monthly intake by species, source, and circumstance", icon: "📥" },
    { id: "outcomes", title: "Outcome Report", desc: "Adoption, euthanasia, foster, and return rates", icon: "📤" },
    { id: "medical", title: "Medical Report", desc: "Medical records by type, vet, and cost", icon: "🏥" },
    { id: "length", title: "Length of Stay", desc: "Average days in shelter by species and outcome", icon: "📅" },
    { id: "breeds", title: "Breed Analysis", desc: "Top 10 breeds by intake count", icon: "🐾" },
    { id: "species", title: "Species Breakdown", desc: "Animal count and percentage by species", icon: "🐕" },
    { id: "monthly", title: "Monthly Trend", desc: "Intakes vs adoptions over the last 6 months", icon: "📈" },
    { id: "status", title: "Status Summary", desc: "Current population by status", icon: "📊" },
    { id: "transfers", title: "Transfer Reports", desc: "Transfers to rescue groups and agencies with receipts", icon: "🚌" },
  ];

  return (
    <AppShell title="Reports & Analytics">
      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Avg Length of Stay", value: `${stats.avgStay}d`, color: "#6366f1", icon: "📅" },
          { label: "Medical Records", value: medical.length, color: "#ef4444", icon: "💊" },
          { label: "Spay/Neuter Rate", value: `${stats.spayNeuterRate}%`, color: "#22c55e", icon: "✂️" },
          { label: "Transfers This Year", value: transferStats.thisYear, color: "#0f2942", icon: "🚌" },
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
            style={{ border: `2px solid ${activeReport === r.id ? "var(--teal)" : "var(--border)"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", background: activeReport === r.id ? "#f0fdfa" : "var(--surface)", transition: "all 0.15s" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Transfer Reports ── */}
      {(activeReport === "transfers") && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Transfer Reports</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={exportTransferCSV}>⬇ Export CSV</button>
              <button className="btn btn-secondary btn-sm" onClick={printTransferReport}>🖨 Print Report</button>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "This Month", value: transferStats.thisMonth },
              { label: "This Year", value: transferStats.thisYear },
              { label: "All Time", value: transferStats.total },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center", padding: "12px 8px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#0f2942" }}>{value}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Animals Transferred — {label}</div>
              </div>
            ))}
          </div>

          {/* Top agencies + species side by side */}
          {(transferStats.byAgency.length > 0 || transferStats.bySpecies.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              {transferStats.byAgency.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Top Agencies</div>
                  {transferStats.byAgency.map(([name, count]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
                      <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                      <div style={{ fontWeight: 700, minWidth: 28, textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
              {transferStats.bySpecies.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>By Species</div>
                  {transferStats.bySpecies.map(([sp, count]) => (
                    <div key={sp} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, minWidth: 60 }}>{sp}</div>
                      <div style={{ flex: 1, height: 14, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#0f2942", borderRadius: 3, width: `${(count / transferStats.total) * 100}%` }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>From</label>
              <input className="form-input" type="date" value={trDateFrom} onChange={(e) => setTrDateFrom(e.target.value)} style={{ width: 140 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>To</label>
              <input className="form-input" type="date" value={trDateTo} onChange={(e) => setTrDateTo(e.target.value)} style={{ width: 140 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Agency</label>
              <select className="form-select" value={trAgency} onChange={(e) => setTrAgency(e.target.value)} style={{ width: 180 }}>
                {transferAgencies.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Species</label>
              <select className="form-select" value={trSpecies} onChange={(e) => setTrSpecies(e.target.value)} style={{ width: 120 }}>
                {["All", "Dog", "Cat", "Other"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Officer</label>
              <select className="form-select" value={trOfficer} onChange={(e) => setTrOfficer(e.target.value)} style={{ width: 160 }}>
                {transferOfficers.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            {(trDateFrom || trDateTo || trAgency !== "All" || trSpecies !== "All" || trOfficer !== "All") && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setTrDateFrom(""); setTrDateTo(""); setTrAgency("All"); setTrSpecies("All"); setTrOfficer("All"); }}>
                ✕ Clear filters
              </button>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
              {transferTableRows.length} transfer{transferTableRows.length !== 1 ? "s" : ""} · {filteredTransferRows.length} animal{filteredTransferRows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date</th>
                  <th>Animals</th>
                  <th>Receiving Agency</th>
                  <th>Officer</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="empty-state">Loading…</td></tr>
                ) : transferTableRows.length === 0 ? (
                  <tr><td colSpan={6} className="empty-state">No transfers match the selected filters</td></tr>
                ) : transferTableRows.map((r) => {
                  const t = r.transfer;
                  const animalList = (t.animal_names as string[] | undefined)?.join(", ") || (t.animal_ids || []).join(", ");
                  return (
                    <tr key={t.id} className="hover-row">
                      <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{t.transfer_number}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(t.date)}</td>
                      <td style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{(t.animal_ids || []).length} animal{(t.animal_ids || []).length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animalList}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{t.rescue_group_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.officer || "—"}</td>
                      <td>
                        {t.agency_info_snapshot ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const grp = t.agency_info_snapshot as unknown as RescueGroup;
                              type SnapAnimal = Animal & { medical_records?: MedicalRecord[] };
                              const raw = (t.animal_info_snapshot || []) as unknown as SnapAnimal[];
                              const snapAnimals: Animal[] = raw.map(({ medical_records: _mr, ...a }) => a as Animal);
                              const medMap: Record<string, MedicalRecord[]> = {};
                              raw.forEach((a) => { if (a.id && a.medical_records) medMap[a.id] = a.medical_records; });
                              printTransferReceipt(t, grp, snapAnimals, medMap);
                            }}
                          >
                            🖨 View Receipt
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No receipt</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
