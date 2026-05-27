"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchAnimals, fetchAdoptions, fetchMedical, fetchTransfers, safeArray, safeAnimalNames, safeJsonArray, safeJsonObject, fetchDepartureReceipts, fetchMicrochipRegistry, fetchCitations, fetchVolunteerLogs, fetchReceipts } from "@/lib/data";
import type { Animal, AdoptionRecord, MedicalRecord, Transfer, RescueGroup, DepartureReceipt, MicrochipRegistration, Citation, VolunteerLog, Receipt } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";
import { printTransferReceipt } from "@/components/transfers/TransferWizard";
import { printDepartureReceipt } from "@/lib/departureReceipt";
import { computeDateRange, inRange, fmtMoney, fmtDateUS, printReport, downloadCsv, daysBetween, type DatePreset, type DateRange } from "@/lib/reportUtils";
import { getCurrentUser } from "@/lib/auth";
import DateInput from "@/components/ui/DateInput";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

// ── GDA Report Engine ──────────────────────────────────────────────────────────

interface GdaSection {
  beginShelter: number; beginFoster: number;
  intakeStray: number; intakeRBO: number; intakeOIE: number; intakeTransferIn: number; intakeOther: number;
  outcomeAdopt: number; outcomeRTO: number; outcomeTransferOut: number; outcomeOtherLive: number;
  outcomeDied: number; outcomeEuthOwner: number; outcomeEuthShelter: number;
  endShelter: number; endFoster: number;
  drilldown: Record<string, string[]>; // category → animal IDs
}

interface GdaReport { dogs: GdaSection; cats: GdaSection; month: number; year: number; }

function emptySection(): GdaSection {
  return { beginShelter:0,beginFoster:0,intakeStray:0,intakeRBO:0,intakeOIE:0,intakeTransferIn:0,intakeOther:0,
    outcomeAdopt:0,outcomeRTO:0,outcomeTransferOut:0,outcomeOtherLive:0,outcomeDied:0,outcomeEuthOwner:0,outcomeEuthShelter:0,
    endShelter:0,endFoster:0,drilldown:{} };
}

function gdaSpecies(s?: string | null): "dog" | "cat" | null {
  if (!s) return null;
  const l = s.toLowerCase();
  if (l.includes("dog") || l === "puppy") return "dog";
  if (l.includes("cat") || l === "kitten") return "cat";
  return null;
}

function gdaIntakeKey(intakeType?: string | null, circumstance?: string | null): keyof GdaSection {
  const t = (intakeType ?? "").toLowerCase();
  const c = (circumstance ?? "").toLowerCase();
  if (t.includes("stray") || t === "stray" || c.includes("stray") || t.includes("aco") || t.includes("at large")) return "intakeStray";
  if (t === "surrender" || t.includes("surrender") || t.includes("relinquish") || c.includes("surrender") || t === "return" || c === "return") return "intakeRBO";
  if (t.includes("euthan") || c.includes("euthan")) return "intakeOIE";
  if (t === "transfer" || t.includes("transfer in") || c.includes("transfer in")) return "intakeTransferIn";
  return "intakeOther";
}

function gdaOutcomeKey(departureType?: string | null, euthReason?: string | null): keyof GdaSection {
  const t = (departureType ?? "").toLowerCase();
  if (t.includes("adopt")) return "outcomeAdopt";
  if (t.includes("redeem") || t.includes("return") || t.includes("rto") || t.includes("owner claim") || t.includes("owner redemption")) return "outcomeRTO";
  if (t.includes("transfer")) return "outcomeTransferOut";
  if (t.includes("euthan") || t.includes("euth")) {
    const r = (euthReason ?? "").toLowerCase();
    return (r.includes("owner") || r.includes("request")) ? "outcomeEuthOwner" : "outcomeEuthShelter";
  }
  if (t.includes("died") || t.includes("death") || t.includes("doa")) return "outcomeDied";
  return "outcomeOtherLive"; // foster placement, field release, TNR, etc.
}

function computeGdaReport(year: number, month: number, animals: Animal[], departureRecs: DepartureReceipt[]): GdaReport {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0, 23, 59, 59);

  // All departure records keyed by animal_id → latest departure
  const depLatest = new Map<string, DepartureReceipt>();
  for (const dr of departureRecs) {
    if (!dr.animal_id || !dr.departure_date) continue;
    const ex = depLatest.get(dr.animal_id);
    if (!ex || dr.departure_date > (ex.departure_date ?? "")) depLatest.set(dr.animal_id, dr);
  }

  // Animal IDs that departed BEFORE this month
  const departedBefore = new Set<string>();
  for (const dr of departureRecs) {
    if (dr.animal_id && dr.departure_date && new Date(`${dr.departure_date}T12:00:00`) < firstDay)
      departedBefore.add(dr.animal_id);
  }
  // Animal IDs that departed ON OR BEFORE end of this month
  const departedByEnd = new Set<string>();
  for (const dr of departureRecs) {
    if (dr.animal_id && dr.departure_date && new Date(`${dr.departure_date}T12:00:00`) <= lastDay)
      departedByEnd.add(dr.animal_id);
  }

  const result: GdaReport = { dogs: emptySection(), cats: emptySection(), month, year };

  function addDrill(sec: GdaSection, key: string, id: string) {
    sec.drilldown[key] = [...(sec.drilldown[key] ?? []), id];
  }

  for (const a of animals) {
    if (a.intake_type === "Clinic") continue;
    const sp = gdaSpecies(a.species);
    if (!sp) continue;
    const sec = sp === "dog" ? result.dogs : result.cats;
    const intakeDate = a.intake_date ? new Date(`${a.intake_date}T12:00:00`) : null;
    if (!intakeDate) continue;

    // Intakes in this month
    if (intakeDate >= firstDay && intakeDate <= lastDay) {
      const key = gdaIntakeKey(a.intake_type, a.circumstance);
      (sec[key] as number)++;
      addDrill(sec, key, a.id);
    }

    // Beginning count (in care at start of month)
    if (intakeDate < firstDay && !departedBefore.has(a.id)) {
      const dep = depLatest.get(a.id);
      if (dep?.departure_type?.toLowerCase().includes("foster")) {
        sec.beginFoster++; addDrill(sec, "beginFoster", a.id);
      } else {
        sec.beginShelter++; addDrill(sec, "beginShelter", a.id);
      }
    }

    // Ending count (in care at end of month)
    if (intakeDate <= lastDay && !departedByEnd.has(a.id)) {
      const dep = depLatest.get(a.id);
      if (dep?.departure_type?.toLowerCase().includes("foster")) {
        sec.endFoster++; addDrill(sec, "endFoster", a.id);
      } else {
        sec.endShelter++; addDrill(sec, "endShelter", a.id);
      }
    }
  }

  // Outcomes: from departure records in this month
  for (const dr of departureRecs) {
    if (!dr.departure_date || !dr.animal_id) continue;
    const depDate = new Date(`${dr.departure_date}T12:00:00`);
    if (depDate < firstDay || depDate > lastDay) continue;
    const a = animals.find((x) => x.id === dr.animal_id);
    if (!a || a.intake_type === "Clinic") continue;
    const sp = gdaSpecies(a.species);
    if (!sp) continue;
    const sec = sp === "dog" ? result.dogs : result.cats;
    // Get euthanasia reason from animal record
    let euthReason = "";
    try { const euth = typeof a.euthanasia === "string" ? JSON.parse(a.euthanasia) : a.euthanasia; euthReason = euth?.reason ?? ""; } catch { /* ignore */ }
    const key = gdaOutcomeKey(dr.departure_type, euthReason);
    (sec[key] as number)++;
    addDrill(sec, key, a.id);
  }

  return result;
}

function gdaTotalIntakes(s: GdaSection): number {
  return s.intakeStray + s.intakeRBO + s.intakeOIE + s.intakeTransferIn + s.intakeOther;
}
function gdaTotalOutcomes(s: GdaSection): number {
  return s.outcomeAdopt + s.outcomeRTO + s.outcomeTransferOut + s.outcomeOtherLive + s.outcomeDied + s.outcomeEuthOwner + s.outcomeEuthShelter;
}
function gdaTotalBegin(s: GdaSection): number { return s.beginShelter + s.beginFoster; }
function gdaTotalEnd(s: GdaSection): number { return s.endShelter + s.endFoster; }
function gdaTotalLiveOutcomes(s: GdaSection): number {
  return s.outcomeAdopt + s.outcomeRTO + s.outcomeTransferOut + s.outcomeOtherLive;
}

function gdaReportDueDate(year: number, month: number): string {
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear  = month === 11 ? year + 1 : year;
  return `${MONTHS_FULL[nextMonth]} 10, ${nextYear}`;
}

function exportGdaCsv(data: GdaReport) {
  const rows: string[] = [
    "Category,Dogs,Cats",
    `Beginning - In Shelter,${data.dogs.beginShelter},${data.cats.beginShelter}`,
    `Beginning - In Foster,${data.dogs.beginFoster},${data.cats.beginFoster}`,
    `Intake - Stray / At Large,${data.dogs.intakeStray},${data.cats.intakeStray}`,
    `Intake - Relinquished by Owner,${data.dogs.intakeRBO},${data.cats.intakeRBO}`,
    `Intake - Owner Intended Euthanasia,${data.dogs.intakeOIE},${data.cats.intakeOIE}`,
    `Intake - Transferred In,${data.dogs.intakeTransferIn},${data.cats.intakeTransferIn}`,
    `Intake - Other,${data.dogs.intakeOther},${data.cats.intakeOther}`,
    `Intake - TOTAL,${gdaTotalIntakes(data.dogs)},${gdaTotalIntakes(data.cats)}`,
    `Outcome - Adoption,${data.dogs.outcomeAdopt},${data.cats.outcomeAdopt}`,
    `Outcome - Returned to Owner,${data.dogs.outcomeRTO},${data.cats.outcomeRTO}`,
    `Outcome - Transferred Out,${data.dogs.outcomeTransferOut},${data.cats.outcomeTransferOut}`,
    `Outcome - Other Live,${data.dogs.outcomeOtherLive},${data.cats.outcomeOtherLive}`,
    `Outcome - Died in Care,${data.dogs.outcomeDied},${data.cats.outcomeDied}`,
    `Outcome - Euthanasia (Owner Request),${data.dogs.outcomeEuthOwner},${data.cats.outcomeEuthOwner}`,
    `Outcome - Euthanasia (Shelter Decision),${data.dogs.outcomeEuthShelter},${data.cats.outcomeEuthShelter}`,
    `Outcome - TOTAL,${gdaTotalOutcomes(data.dogs)},${gdaTotalOutcomes(data.cats)}`,
    `Ending - In Shelter,${data.dogs.endShelter},${data.cats.endShelter}`,
    `Ending - In Foster,${data.dogs.endFoster},${data.cats.endFoster}`,
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `GDA-Report-${MONTHS_FULL[data.month]}-${data.year}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function printGdaReport(data: GdaReport) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const ds = (n: number) => `<td style="text-align:right;padding:5px 10px;border:1px solid #ccc">${n}</td>`;
  const dRow = (label: string, d: number, c: number, bold = false) =>
    `<tr${bold ? ' style="font-weight:700;background:#f0f4f8"' : ''}><td style="padding:5px 10px;border:1px solid #ccc">${label}</td>${ds(d)}${ds(c)}</tr>`;
  const lrr = (() => {
    const lo = gdaTotalLiveOutcomes(data.dogs) + gdaTotalLiveOutcomes(data.cats);
    const to = gdaTotalOutcomes(data.dogs) + gdaTotalOutcomes(data.cats);
    return to > 0 ? ((lo / to) * 100).toFixed(1) : "N/A";
  })();
  w.document.write(`<!DOCTYPE html><html><head><title>GDA Monthly Report — ${MONTHS_FULL[data.month]} ${data.year}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:30px auto;font-size:11pt}h1{font-size:15pt;text-align:center}h2{font-size:12pt;margin-top:20px}table{width:100%;border-collapse:collapse}th{background:#e8eef4;padding:6px 10px;border:1px solid #ccc;text-align:left}th:not(:first-child){text-align:right}.verify{margin-top:14px;font-size:10pt;color:#555}.footer{margin-top:24px;font-size:9pt;color:#aaa;text-align:center}</style>
</head><body>
<h1>Georgia Department of Agriculture<br>Monthly Shelter Report</h1>
<p style="text-align:center;margin:4px 0">Morgan County Animal Services · ${MONTHS_FULL[data.month]} ${data.year}</p>
<p style="text-align:center;font-size:10pt;color:#666">Due by ${gdaReportDueDate(data.year, data.month)}</p>
<table><thead><tr><th>Category</th><th>Dogs</th><th>Cats</th></tr></thead><tbody>
${dRow("Beginning — In Shelter", data.dogs.beginShelter, data.cats.beginShelter)}
${dRow("Beginning — In Foster", data.dogs.beginFoster, data.cats.beginFoster)}
${dRow("Beginning — TOTAL", gdaTotalBegin(data.dogs), gdaTotalBegin(data.cats), true)}
<tr><td colspan="3" style="padding:4px;background:#f9f9f9;font-weight:700;border:1px solid #ccc">INTAKES</td></tr>
${dRow("Stray / At Large", data.dogs.intakeStray, data.cats.intakeStray)}
${dRow("Relinquished by Owner", data.dogs.intakeRBO, data.cats.intakeRBO)}
${dRow("Owner Intended Euthanasia", data.dogs.intakeOIE, data.cats.intakeOIE)}
${dRow("Transferred In from Agency", data.dogs.intakeTransferIn, data.cats.intakeTransferIn)}
${dRow("Other Intakes", data.dogs.intakeOther, data.cats.intakeOther)}
${dRow("Intakes — TOTAL", gdaTotalIntakes(data.dogs), gdaTotalIntakes(data.cats), true)}
<tr><td colspan="3" style="padding:4px;background:#f9f9f9;font-weight:700;border:1px solid #ccc">OUTCOMES</td></tr>
${dRow("Adoption", data.dogs.outcomeAdopt, data.cats.outcomeAdopt)}
${dRow("Returned to Owner (RTO)", data.dogs.outcomeRTO, data.cats.outcomeRTO)}
${dRow("Transferred to Another Agency", data.dogs.outcomeTransferOut, data.cats.outcomeTransferOut)}
${dRow("Other Live Outcome", data.dogs.outcomeOtherLive, data.cats.outcomeOtherLive)}
${dRow("Died in Care", data.dogs.outcomeDied, data.cats.outcomeDied)}
${dRow("Euthanasia — Owner Request", data.dogs.outcomeEuthOwner, data.cats.outcomeEuthOwner)}
${dRow("Euthanasia — Shelter Decision", data.dogs.outcomeEuthShelter, data.cats.outcomeEuthShelter)}
${dRow("Outcomes — TOTAL", gdaTotalOutcomes(data.dogs), gdaTotalOutcomes(data.cats), true)}
${dRow("Ending — In Shelter", data.dogs.endShelter, data.cats.endShelter)}
${dRow("Ending — In Foster", data.dogs.endFoster, data.cats.endFoster)}
${dRow("Ending — TOTAL", gdaTotalEnd(data.dogs), gdaTotalEnd(data.cats), true)}
</tbody></table>
<div class="verify"><strong>Verification:</strong>
Dogs: ${gdaTotalBegin(data.dogs)} + ${gdaTotalIntakes(data.dogs)} − ${gdaTotalOutcomes(data.dogs)} = ${gdaTotalBegin(data.dogs)+gdaTotalIntakes(data.dogs)-gdaTotalOutcomes(data.dogs)} (expected ${gdaTotalEnd(data.dogs)}) ${gdaTotalBegin(data.dogs)+gdaTotalIntakes(data.dogs)-gdaTotalOutcomes(data.dogs)===gdaTotalEnd(data.dogs)?"✓":"⚠ DISCREPANCY"}<br>
Cats: ${gdaTotalBegin(data.cats)} + ${gdaTotalIntakes(data.cats)} − ${gdaTotalOutcomes(data.cats)} = ${gdaTotalBegin(data.cats)+gdaTotalIntakes(data.cats)-gdaTotalOutcomes(data.cats)} (expected ${gdaTotalEnd(data.cats)}) ${gdaTotalBegin(data.cats)+gdaTotalIntakes(data.cats)-gdaTotalOutcomes(data.cats)===gdaTotalEnd(data.cats)?"✓":"⚠ DISCREPANCY"}<br>
<strong>Live Release Rate: ${lrr}%</strong></div>
<div class="footer">Generated by ShelterTrace · Morgan County Animal Services · (706) 752-1195</div>
</body></html>`);
  w.document.close(); setTimeout(() => w.print(), 400);
}

const DEPARTURE_TYPES = ["All", "Adoption", "Owner Redemption", "Foster Placement", "Transfer Out", "Euthanasia", "Field Release", "Return to Owner"];

export default function ReportsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [departureRecs, setDepartureRecs] = useState<DepartureReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [chipRegistry, setChipRegistry] = useState<MicrochipRegistration[]>([]);
  const [chipDateFrom, setChipDateFrom] = useState("");
  const [chipDateTo, setChipDateTo] = useState(today());
  const [chipSpeciesFilter, setChipSpeciesFilter] = useState("");

  // Departure receipt filters
  const [drDateFrom, setDrDateFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0]; });
  const [drDateTo, setDrDateTo] = useState(today());
  const [drType, setDrType] = useState("All");
  const [drSearch, setDrSearch] = useState("");

  // Transfer report filters
  const [trDateFrom, setTrDateFrom] = useState("");
  const [trDateTo, setTrDateTo] = useState("");
  const [trAgency, setTrAgency] = useState("All");
  const [trSpecies, setTrSpecies] = useState("All");
  const [trOfficer, setTrOfficer] = useState("All");

  // GDA report state
  const [gdaMonth, setGdaMonth] = useState<number>(() => { const m = new Date().getMonth() - 1; return m < 0 ? 11 : m; });
  const [gdaYear,  setGdaYear]  = useState<number>(() => { return new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(); });
  const [gdaData,  setGdaData]  = useState<GdaReport | null>(null);
  const [gdaDrilldown, setGdaDrilldown] = useState<{ title: string; ids: string[] } | null>(null);
  const [gdaAnnualYear, setGdaAnnualYear] = useState(new Date().getFullYear());

  // ── Global date range ────────────────────────────────────────────────────────
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState(today());
  const range: DateRange = useMemo(() => computeDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);

  // ── Lazy-loaded datasets ─────────────────────────────────────────────────────
  const [citations,      setCitations]      = useState<Citation[]>([]);
  const [volLogs,        setVolLogs]        = useState<VolunteerLog[]>([]);
  const [receipts,       setReceipts]       = useState<Receipt[]>([]);
  const [citationsLoaded, setCitationsLoaded] = useState(false);
  const [volLogsLoaded,   setVolLogsLoaded]   = useState(false);
  const [receiptsLoaded,  setReceiptsLoaded]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, ad, m, tr, dr] = await Promise.all([fetchAnimals(), fetchAdoptions(), fetchMedical(), fetchTransfers(), fetchDepartureReceipts()]);
      setAnimals(a);
      setAdoptions(ad);
      setMedical(m);
      setTransfers(tr);
      setDepartureRecs(dr);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lazy-load datasets when the relevant report is opened
  useEffect(() => {
    if (activeReport === "citations_report" && !citationsLoaded) {
      fetchCitations().then((c) => { setCitations(c as Citation[]); setCitationsLoaded(true); });
    }
    if (activeReport === "volunteer_hours" && !volLogsLoaded) {
      fetchVolunteerLogs().then((l) => { setVolLogs(l as VolunteerLog[]); setVolLogsLoaded(true); });
    }
    if (activeReport === "financial" && !receiptsLoaded) {
      fetchReceipts().then((r) => { setReceipts(r as Receipt[]); setReceiptsLoaded(true); });
    }
  }, [activeReport]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const ids: string[] = safeArray(t.animal_ids);
      const names: string[] = safeArray(t.animal_names);
      const snapshots = safeJsonArray(t.animal_info_snapshot);
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
      byAgency[name] = (byAgency[name] || 0) + safeArray(t.animal_ids).length;
    });

    const bySpecies: Record<string, number> = {};
    transferRows.forEach((r) => {
      if (r.species !== "—") bySpecies[r.species] = (bySpecies[r.species] || 0) + 1;
    });

    return {
      thisMonth: thisMonth.reduce((s, t) => s + safeArray(t.animal_ids).length, 0),
      thisYear: thisYear.reduce((s, t) => s + safeArray(t.animal_ids).length, 0),
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
    { id: "departure_receipts", title: "Departure Receipts", desc: "All departure receipts by type, date, person, and fees", icon: "🧾" },
    { id: "microchip",     title: "Microchip Registry", desc: "Chips registered through MCAS with owner and animal info", icon: "🔬" },
    { id: "pet_licenses",  title: "Pet Licenses",       desc: "Licenses on file by status, species, expiration date",  icon: "🪪" },
    { id: "gda_monthly",     title: "GDA Monthly Report",     desc: "Georgia Dept. of Agriculture required monthly shelter report — due by the 10th", icon: "🏛️" },
    { id: "gda_annual",      title: "GDA Annual Summary",      desc: "12-month summary with live release rate, totals, and year-over-year trend", icon: "📋" },
    { id: "in_shelter",      title: "Animals in Shelter",      desc: "Current shelter population sorted by length of stay — highlights over 30 days", icon: "🏠" },
    { id: "euthanasia",      title: "Euthanasia Report",        desc: "All euthanasias in selected period with reason, species, days in shelter", icon: "💔" },
    { id: "citations_report",title: "Citation Report",          desc: "All citations issued in selected period — by officer, type, status", icon: "📋" },
    { id: "volunteer_hours", title: "Volunteer Hours",          desc: "Volunteer activity and hours logged during selected period", icon: "🙋" },
    { id: "financial",       title: "Financial Summary",        desc: "Revenue from all sources — adoption, redemption, citations, receipts", icon: "💵" },
    { id: "intake_detail",   title: "Intake Detail Report",     desc: "All intakes during selected period with full details and print/CSV", icon: "📥" },
    { id: "outcome_detail",  title: "Outcome Detail Report",    desc: "All outcomes during selected period with type, days in shelter, fees", icon: "📤" },
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

      {/* ── Global Date Range Picker ── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Date Range — applies to all new reports
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(["today","week","month","quarter","year","last_month","last_year","custom"] as DatePreset[]).map((p) => (
            <button key={p} onClick={() => setDatePreset(p)} style={{ padding: "6px 12px", borderRadius: 20, border: "2px solid", borderColor: datePreset === p ? "var(--teal)" : "var(--border)", background: datePreset === p ? "#f0fdfa" : "var(--bg)", color: datePreset === p ? "var(--teal)" : "var(--text-secondary)", fontWeight: datePreset === p ? 700 : 400, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {p === "last_month" ? "Last Month" : p === "last_year" ? "Last Year" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          {datePreset === "custom" && (
            <>
              <DateInput value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="form-input" style={{ width: 140, fontSize: 12, padding: "5px 8px" }} />
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>to</span>
              <DateInput value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="form-input" style={{ width: 140, fontSize: 12, padding: "5px 8px" }} />
            </>
          )}
          <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, marginLeft: 8 }}>📅 {range.label}</span>
        </div>
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
              <DateInput className="form-input" value={trDateFrom} onChange={(e) => setTrDateFrom(e.target.value)} style={{ width: 140 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>To</label>
              <DateInput className="form-input" value={trDateTo} onChange={(e) => setTrDateTo(e.target.value)} style={{ width: 140 }} />
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
                  const animalList = safeAnimalNames(t.animal_names) !== "N/A" ? safeAnimalNames(t.animal_names) : safeArray(t.animal_ids).join(", ");
                  return (
                    <tr key={t.id} className="hover-row">
                      <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{t.transfer_number}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(t.date)}</td>
                      <td style={{ fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{safeArray(t.animal_ids).length} animal{safeArray(t.animal_ids).length !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animalList}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{t.rescue_group_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{t.officer || "—"}</td>
                      <td>
                        {t.agency_info_snapshot ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              const grp = (safeJsonObject(t.agency_info_snapshot) || t.agency_info_snapshot) as unknown as RescueGroup;
                              type SnapAnimal = Animal & { medical_records?: MedicalRecord[] };
                              const raw = safeJsonArray(t.animal_info_snapshot) as unknown as SnapAnimal[];
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

      {/* Departure Receipts */}
      {(activeReport === "departure_receipts" || activeReport === null) && (() => {
        const filtered = departureRecs.filter((r) => {
          if (drType !== "All" && r.departure_type !== drType) return false;
          if (drDateFrom && r.departure_date < drDateFrom) return false;
          if (drDateTo && r.departure_date > drDateTo + "T23:59:59") return false;
          if (drSearch.trim()) {
            const q = drSearch.toLowerCase();
            if (!(r.animal_name || "").toLowerCase().includes(q) &&
                !(r.person_name || "").toLowerCase().includes(q) &&
                !(r.receipt_number || "").toLowerCase().includes(q)) return false;
          }
          return true;
        });
        const totalFees = filtered.reduce((s, r) => s + (r.total_fees || 0), 0);
        const byType = DEPARTURE_TYPES.slice(1).map((t) => ({
          type: t,
          count: filtered.filter((r) => r.departure_type === t).length,
        })).filter((x) => x.count > 0);

        const exportCsv = () => {
          const rows = [
            ["Receipt #", "Animal", "Departure Type", "Date", "Person", "Fees", "Officer"],
            ...filtered.map((r) => [
              r.receipt_number,
              r.animal_name,
              r.departure_type,
              r.departure_date ? new Date(r.departure_date).toLocaleDateString() : "",
              r.person_name || "",
              r.total_fees > 0 ? `$${r.total_fees.toFixed(2)}` : "",
              r.officer_name || "",
            ]),
          ];
          const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
          const a = document.createElement("a");
          a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
          a.download = `departure-receipts-${drDateFrom}-to-${drDateTo}.csv`;
          a.click();
        };

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Departure Receipts ({filtered.length})</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input className="form-input" placeholder="Search animal, person, receipt #…" value={drSearch} onChange={(e) => setDrSearch(e.target.value)} style={{ width: 220, fontSize: 12 }} />
                <select className="form-select" value={drType} onChange={(e) => setDrType(e.target.value)} style={{ width: 170, fontSize: 12 }}>
                  {DEPARTURE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <DateInput className="form-input" value={drDateFrom} onChange={(e) => setDrDateFrom(e.target.value)} style={{ width: 135, fontSize: 12 }} />
                <span style={{ fontSize: 12 }}>to</span>
                <DateInput className="form-input" value={drDateTo} onChange={(e) => setDrDateTo(e.target.value)} style={{ width: 135, fontSize: 12 }} />
                <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={filtered.length === 0}>⬇ CSV</button>
              </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 16px", minWidth: 120, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0284c7" }}>{filtered.length}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Departures</div>
              </div>
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 16px", minWidth: 120, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>${totalFees.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Fees Collected</div>
              </div>
              {byType.map((b) => (
                <div key={b.type} style={{ background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 8, padding: "10px 16px", minWidth: 100, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#7c3aed" }}>{b.count}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{b.type}</div>
                </div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13 }}>
                {departureRecs.length === 0 ? "No departure receipts on file." : "No receipts match your filters."}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Animal</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Person</th>
                      <th style={{ textAlign: "right" }}>Fees</th>
                      <th>Officer</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{r.receipt_number}</td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{r.animal_name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.animal_id}</div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>{r.departure_type}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>{r.departure_date ? new Date(r.departure_date).toLocaleDateString() : "—"}</td>
                        <td style={{ fontSize: 12 }}>{r.person_name || "—"}</td>
                        <td style={{ fontSize: 12, textAlign: "right", fontFamily: "monospace" }}>
                          {r.total_fees > 0 ? `$${r.total_fees.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ fontSize: 12 }}>{r.officer_name || "—"}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printDepartureReceipt(r)}>🖨 Print</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* ── Microchip Registry Report ── */}
      {activeReport === "microchip" && (() => {
        const unChipped = animals.filter((a) => !a.microchip && !["Adopted","Euthanized","Transferred","Redeemed"].includes(a.status));
        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🔬 Microchip Registry</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchMicrochipRegistry({ from: chipDateFrom || undefined, to: chipDateTo || undefined, species: chipSpeciesFilter || undefined }).then(setChipRegistry)}
              >
                Load / Refresh
              </button>
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: "Registered Chips", value: chipRegistry.length, color: "#0d9488" },
                { label: "Active",           value: chipRegistry.filter((r) => r.status === "Active").length, color: "#16a34a" },
                { label: "Unchipped (In Shelter)", value: unChipped.length, color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", minWidth: 140 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">From</label>
                <DateInput className="form-input" value={chipDateFrom} onChange={(e) => setChipDateFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">To</label>
                <DateInput className="form-input" value={chipDateTo} onChange={(e) => setChipDateTo(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Species</label>
                <select className="form-select" value={chipSpeciesFilter} onChange={(e) => setChipSpeciesFilter(e.target.value)}>
                  <option value="">All</option>
                  <option>Dog</option>
                  <option>Cat</option>
                </select>
              </div>
            </div>

            {/* Registry table */}
            {chipRegistry.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                Click "Load / Refresh" to fetch registry data.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Chip #</th>
                      <th>Animal</th>
                      <th>Species / Breed</th>
                      <th>Owner</th>
                      <th>Phone</th>
                      <th>Registered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chipRegistry.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.chip_number}</td>
                        <td style={{ fontWeight: 600 }}>
                          {r.animal_id ? <a href={`/animals/${r.animal_id}`} style={{ color: "var(--teal)", textDecoration: "none" }}>{r.animal_name || r.animal_id}</a> : (r.animal_name || "—")}
                        </td>
                        <td style={{ fontSize: 12 }}>{[r.species, r.breed].filter(Boolean).join(" / ") || "—"}</td>
                        <td style={{ fontSize: 12 }}>{r.owner_name || "—"}</td>
                        <td style={{ fontSize: 12 }}>{r.owner_phone || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.registration_date || "—"}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: r.status === "Active" ? "#dcfce7" : "#f1f5f9", color: r.status === "Active" ? "#15803d" : "#6b7280" }}>
                            {r.status || "Active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Unchipped animals */}
            {unChipped.length > 0 && (
              <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "#f59e0b" }}>
                  ⚠ {unChipped.length} animal{unChipped.length !== 1 ? "s" : ""} in shelter without a microchip
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {unChipped.map((a) => (
                    <a key={a.id} href={`/animals/${a.id}`} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 12, background: "#fef3c7", color: "#92400e", border: "1px solid #fbbf24", fontWeight: 600, textDecoration: "none" }}>
                      {a.name} ({a.species})
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── GDA Monthly Report ── */}
      {activeReport === "gda_monthly" && (() => {
        const dueDate = gdaReportDueDate(gdaYear, gdaMonth);
        const today10 = new Date().getDate();
        const isCurrentMonth = gdaMonth === new Date().getMonth() && gdaYear === new Date().getFullYear();
        const isPrevMonth = (gdaMonth === new Date().getMonth() - 1 && gdaYear === new Date().getFullYear()) ||
          (gdaMonth === 11 && new Date().getMonth() === 0 && gdaYear === new Date().getFullYear() - 1);
        const pastDue = isPrevMonth && today10 > 10;
        const dueSoon = isPrevMonth && today10 >= 5 && today10 <= 10;

        function GdaTable({ section, species }: { section: GdaSection; species: string }) {
          const rows: [string, keyof GdaSection, string][] = [
            ["Beginning — In Shelter", "beginShelter", "#f8fafc"],
            ["Beginning — In Foster",  "beginFoster",  "#f8fafc"],
          ];
          const intakeRows: [string, keyof GdaSection][] = [
            ["Stray / At Large", "intakeStray"],
            ["Relinquished by Owner", "intakeRBO"],
            ["Owner Intended Euthanasia", "intakeOIE"],
            ["Transferred In from Agency", "intakeTransferIn"],
            ["Other Intakes", "intakeOther"],
          ];
          const outcomeRows: [string, keyof GdaSection][] = [
            ["Adoption", "outcomeAdopt"],
            ["Returned to Owner (RTO)", "outcomeRTO"],
            ["Transferred to Another Agency", "outcomeTransferOut"],
            ["Other Live Outcome", "outcomeOtherLive"],
            ["Died in Care", "outcomeDied"],
            ["Euthanasia — Owner Request", "outcomeEuthOwner"],
            ["Euthanasia — Shelter Decision", "outcomeEuthShelter"],
          ];

          const totalIntakes  = gdaTotalIntakes(section);
          const totalOutcomes = gdaTotalOutcomes(section);
          const beginTotal    = gdaTotalBegin(section);
          const endTotal      = gdaTotalEnd(section);
          const calcEnd       = beginTotal + totalIntakes - totalOutcomes;
          const balances      = calcEnd === endTotal;

          function Cell({ val, catKey }: { val: number; catKey: keyof GdaSection }) {
            const ids = section.drilldown[catKey as string] ?? [];
            return (
              <td style={{ textAlign: "right", padding: "6px 12px", borderBottom: "1px solid var(--border-light)", cursor: ids.length ? "pointer" : "default", color: ids.length ? "var(--teal)" : "inherit", fontWeight: ids.length ? 700 : 400 }}
                onClick={() => ids.length && setGdaDrilldown({ title: `${species} — ${catKey}`, ids })}>
                {val}
              </td>
            );
          }

          return (
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: species === "Dogs" ? "#0f2942" : "#374151" }}>
                {species === "Dogs" ? "🐕" : "🐈"} {species}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <colgroup><col style={{ width: "70%" }} /><col /></colgroup>
                <tbody>
                  <tr style={{ background: "#f0f4f8" }}>
                    <td colSpan={2} style={{ padding: "5px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>Beginning Counts</td>
                  </tr>
                  {rows.map(([label, key]) => (
                    <tr key={label}><td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-light)" }}>{label}</td><Cell val={section[key] as number} catKey={key} /></tr>
                  ))}
                  <tr style={{ background: "#f0f4f8", fontWeight: 700 }}>
                    <td style={{ padding: "5px 12px" }}>TOTAL IN CARE</td>
                    <td style={{ textAlign: "right", padding: "5px 12px" }}>{beginTotal}</td>
                  </tr>

                  <tr style={{ background: "#f0f4f8" }}>
                    <td colSpan={2} style={{ padding: "5px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#16a34a" }}>Intakes</td>
                  </tr>
                  {intakeRows.map(([label, key]) => (
                    <tr key={label}><td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-light)" }}>{label}</td><Cell val={section[key] as number} catKey={key} /></tr>
                  ))}
                  <tr style={{ background: "#f0f4f8", fontWeight: 700, color: "#16a34a" }}>
                    <td style={{ padding: "5px 12px" }}>INTAKES TOTAL</td>
                    <td style={{ textAlign: "right", padding: "5px 12px" }}>{totalIntakes}</td>
                  </tr>

                  <tr style={{ background: "#f0f4f8" }}>
                    <td colSpan={2} style={{ padding: "5px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#dc2626" }}>Outcomes</td>
                  </tr>
                  {outcomeRows.map(([label, key]) => (
                    <tr key={label}><td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-light)" }}>{label}</td><Cell val={section[key] as number} catKey={key} /></tr>
                  ))}
                  <tr style={{ background: "#f0f4f8", fontWeight: 700, color: "#dc2626" }}>
                    <td style={{ padding: "5px 12px" }}>OUTCOMES TOTAL</td>
                    <td style={{ textAlign: "right", padding: "5px 12px" }}>{totalOutcomes}</td>
                  </tr>

                  <tr style={{ background: "#f0f4f8" }}>
                    <td colSpan={2} style={{ padding: "5px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>Ending Counts</td>
                  </tr>
                  <tr><td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-light)" }}>Ending — In Shelter</td><Cell val={section.endShelter} catKey="endShelter" /></tr>
                  <tr><td style={{ padding: "5px 12px", borderBottom: "1px solid var(--border-light)" }}>Ending — In Foster</td><Cell val={section.endFoster} catKey="endFoster" /></tr>
                  <tr style={{ background: "#f0f4f8", fontWeight: 700 }}>
                    <td style={{ padding: "5px 12px" }}>TOTAL IN CARE</td>
                    <td style={{ textAlign: "right", padding: "5px 12px" }}>{endTotal}</td>
                  </tr>
                </tbody>
              </table>

              {/* Verification */}
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: balances ? "#f0fdf4" : "#fef2f2", border: `1px solid ${balances ? "#86efac" : "#fca5a5"}`, fontSize: 12 }}>
                {balances
                  ? <span style={{ color: "#15803d", fontWeight: 700 }}>✓ {beginTotal} + {totalIntakes} − {totalOutcomes} = {endTotal} (balanced)</span>
                  : <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ {beginTotal} + {totalIntakes} − {totalOutcomes} = {calcEnd} but ending shows {endTotal} — DISCREPANCY of {Math.abs(calcEnd - endTotal)}</span>
                }
              </div>
            </div>
          );
        }

        const lrrTotal = gdaData
          ? (() => {
            const lo = gdaTotalLiveOutcomes(gdaData.dogs) + gdaTotalLiveOutcomes(gdaData.cats);
            const to = gdaTotalOutcomes(gdaData.dogs) + gdaTotalOutcomes(gdaData.cats);
            return to > 0 ? ((lo / to) * 100).toFixed(1) : "N/A";
          })()
          : null;

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🏛️ GDA Monthly Report</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select className="form-select" style={{ width: 130 }} value={gdaMonth} onChange={(e) => { setGdaMonth(+e.target.value); setGdaData(null); }}>
                  {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <select className="form-select" style={{ width: 90 }} value={gdaYear} onChange={(e) => { setGdaYear(+e.target.value); setGdaData(null); }}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => setGdaData(computeGdaReport(gdaYear, gdaMonth, animals, departureRecs))}>
                  Generate Report
                </button>
                {gdaData && <>
                  <button className="btn btn-secondary btn-sm" onClick={() => printGdaReport(gdaData)}>🖨 Print</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => exportGdaCsv(gdaData)}>📥 CSV</button>
                </>}
              </div>
            </div>

            {/* Due date banner */}
            {(pastDue || dueSoon) && (
              <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontWeight: 700, fontSize: 13, background: pastDue ? "#fee2e2" : "#fef3c7", color: pastDue ? "#b91c1c" : "#92400e", border: `1px solid ${pastDue ? "#fca5a5" : "#fbbf24"}` }}>
                {pastDue ? "🚨 OVERDUE" : "⚠ Due Soon"}: GDA report for {MONTHS_FULL[gdaMonth]} {gdaYear} is due by {dueDate}.
              </div>
            )}
            {!pastDue && !dueSoon && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                Report for {MONTHS_FULL[gdaMonth]} {gdaYear} · Due by {dueDate} · Click any number to drill down
              </div>
            )}

            {gdaData ? (
              <>
                {/* LRR */}
                <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                  {[
                    { label: "Total Intakes", value: gdaTotalIntakes(gdaData.dogs) + gdaTotalIntakes(gdaData.cats), color: "#16a34a" },
                    { label: "Total Outcomes", value: gdaTotalOutcomes(gdaData.dogs) + gdaTotalOutcomes(gdaData.cats), color: "#dc2626" },
                    { label: "Live Release Rate", value: `${lrrTotal}%`, color: "#0d9488" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", minWidth: 120 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Two-column table */}
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "start" }}>
                  <GdaTable section={gdaData.dogs} species="Dogs" />
                  <GdaTable section={gdaData.cats} species="Cats" />
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
                <div>Select a month and year, then click <strong>Generate Report</strong>.</div>
              </div>
            )}

            {/* Drill-down modal */}
            {gdaDrilldown && (
              <div className="modal-overlay" onClick={() => setGdaDrilldown(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                  <div className="modal-header">
                    <span className="modal-title">{gdaDrilldown.title} ({gdaDrilldown.ids.length})</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setGdaDrilldown(null)}>✕</button>
                  </div>
                  <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>Animal ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Intake Date</th><th>Intake Type</th></tr></thead>
                      <tbody>
                        {gdaDrilldown.ids.map((id) => {
                          const a = animals.find((x) => x.id === id);
                          if (!a) return null;
                          return (
                            <tr key={id}>
                              <td style={{ fontFamily: "monospace", fontSize: 11 }}><a href={`/animals/${a.id}`} style={{ color: "var(--teal)" }}>{a.id}</a></td>
                              <td style={{ fontWeight: 600 }}>{a.name}</td>
                              <td style={{ fontSize: 12 }}>{a.species}</td>
                              <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                              <td style={{ fontSize: 12 }}>{a.intake_date || "—"}</td>
                              <td style={{ fontSize: 12 }}>{a.intake_type || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setGdaDrilldown(null)}>Close</button></div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── GDA Annual Summary ── */}
      {activeReport === "gda_annual" && (() => {
        const annualData = useMemo(() =>
          Array.from({ length: 12 }, (_, i) => ({
            month: i,
            data: computeGdaReport(gdaAnnualYear, i, animals, departureRecs),
          })),
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [gdaAnnualYear, animals.length, departureRecs.length]
        );

        const yearTotals = {
          intakes:  annualData.reduce((s, m) => s + gdaTotalIntakes(m.data.dogs) + gdaTotalIntakes(m.data.cats), 0),
          outcomes: annualData.reduce((s, m) => s + gdaTotalOutcomes(m.data.dogs) + gdaTotalOutcomes(m.data.cats), 0),
          live:     annualData.reduce((s, m) => s + gdaTotalLiveOutcomes(m.data.dogs) + gdaTotalLiveOutcomes(m.data.cats), 0),
        };
        const lrr = yearTotals.outcomes > 0 ? ((yearTotals.live / yearTotals.outcomes) * 100).toFixed(1) : "N/A";

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📋 GDA Annual Summary — {gdaAnnualYear}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="form-select" style={{ width: 90 }} value={gdaAnnualYear} onChange={(e) => setGdaAnnualYear(+e.target.value)}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "Total Intakes",      value: yearTotals.intakes,  color: "#16a34a" },
                { label: "Total Outcomes",     value: yearTotals.outcomes, color: "#dc2626" },
                { label: "Live Release Rate",  value: `${lrr}%`,           color: "#0d9488" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", minWidth: 120 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Monthly breakdown table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f0f4f8" }}>
                    <th style={{ padding: "7px 10px", textAlign: "left", borderBottom: "2px solid #ddd" }}>Month</th>
                    {["Dog Intakes","Dog Outcomes","Cat Intakes","Cat Outcomes","Total Intakes","Total Outcomes","LRR %"].map((h) => (
                      <th key={h} style={{ padding: "7px 10px", textAlign: "right", borderBottom: "2px solid #ddd", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {annualData.map(({ month: m, data }) => {
                    const di = gdaTotalIntakes(data.dogs), ci = gdaTotalIntakes(data.cats);
                    const do_ = gdaTotalOutcomes(data.dogs), co = gdaTotalOutcomes(data.cats);
                    const ti = di + ci, to = do_ + co;
                    const live = gdaTotalLiveOutcomes(data.dogs) + gdaTotalLiveOutcomes(data.cats);
                    const mLrr = to > 0 ? ((live / to) * 100).toFixed(0) : "—";
                    const isCurrentM = m === new Date().getMonth() && gdaAnnualYear === new Date().getFullYear();
                    return (
                      <tr key={m} style={{ borderBottom: "1px solid var(--border-light)", background: isCurrentM ? "#f0fdf4" : undefined }}>
                        <td style={{ padding: "6px 10px", fontWeight: isCurrentM ? 700 : 400 }}>{MONTHS_FULL[m]}</td>
                        {[di, do_, ci, co, ti, to].map((v, i) => <td key={i} style={{ textAlign: "right", padding: "6px 10px", color: i === 4 ? "#16a34a" : i === 5 ? "#dc2626" : "inherit" }}>{v}</td>)}
                        <td style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#0d9488" }}>{mLrr}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "#f0f4f8", fontWeight: 700 }}>
                    <td style={{ padding: "7px 10px" }}>TOTAL {gdaAnnualYear}</td>
                    <td colSpan={4} />
                    <td style={{ textAlign: "right", padding: "7px 10px", color: "#16a34a" }}>{yearTotals.intakes}</td>
                    <td style={{ textAlign: "right", padding: "7px 10px", color: "#dc2626" }}>{yearTotals.outcomes}</td>
                    <td style={{ textAlign: "right", padding: "7px 10px", color: "#0d9488" }}>{lrr}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Animals in Shelter ── */}
      {activeReport === "in_shelter" && (() => {
        const IN_SHELTER = ["Available","Medical Hold","Quarantine","Pending","Imported","Foster"];
        const inShelter = animals
          .filter((a) => IN_SHELTER.includes(a.status) && a.intake_type !== "Clinic")
          .map((a) => ({ ...a, daysIn: a.intake_date ? Math.floor((Date.now() - new Date(`${a.intake_date}T12:00:00`).getTime()) / 86400000) : 0 }))
          .sort((a, b) => b.daysIn - a.daysIn);
        const avg = inShelter.length ? Math.round(inShelter.reduce((s, a) => s + a.daysIn, 0) / inShelter.length) : 0;
        const over30 = inShelter.filter((a) => a.daysIn > 30).length;
        const by = (key: string) => inShelter.filter((a) => a.status === key).length;

        function doPrint() {
          const rows = inShelter.map((a) =>
            `<tr style="background:${a.daysIn>30?"#fee2e2":a.daysIn>14?"#fef3c7":""}">
              <td>${a.id}</td><td>${a.name}</td><td>${a.species}</td><td>${a.breed||"—"}</td>
              <td>${a.color||"—"}</td><td>${a.sex||"—"}</td><td>${a.kennel||"—"}</td>
              <td>${a.status}</td><td>${fmtDateUS(a.intake_date)}</td>
              <td class="right bold" style="color:${a.daysIn>30?"#b91c1c":a.daysIn>14?"#92400e":""}">${a.daysIn}d</td>
              <td>${a.microchip||"—"}</td><td>${a.fixed?"Yes":"No"}</td></tr>`
          ).join("");
          printReport("Animals Currently in Shelter", `As of ${fmtDateUS(today())}`,
            `<div class="summary">
              <div class="summary-item"><div class="val">${inShelter.length}</div><div class="lbl">Total in Care</div></div>
              <div class="summary-item"><div class="val" style="color:#dc2626">${over30}</div><div class="lbl">Over 30 Days</div></div>
              <div class="summary-item"><div class="val">${avg}</div><div class="lbl">Avg Days in Shelter</div></div>
            </div>
            <table><thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Color</th><th>Sex</th><th>Kennel</th><th>Status</th><th>Intake Date</th><th>Days</th><th>Microchip</th><th>Fixed</th></tr></thead><tbody>${rows}</tbody></table>`);
        }

        function doExport() {
          downloadCsv(`Animals-In-Shelter-${today()}.csv`,
            ["Animal ID","Name","Species","Breed","Color","Sex","Kennel","Status","Intake Date","Days in Shelter","Microchip","Fixed"],
            inShelter.map((a) => [a.id,a.name,a.species,a.breed,a.color,a.sex,a.kennel,a.status,a.intake_date,a.daysIn,a.microchip,a.fixed?"Yes":"No"]));
        }

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🏠 Animals Currently in Shelter — {inShelter.length}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={doPrint}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={doExport}>📥 CSV</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { label: "Total in Care",  value: inShelter.length, color: "#0f2942" },
                { label: "Over 30 Days",   value: over30,           color: "#dc2626" },
                { label: "Avg Days",       value: `${avg}d`,        color: "#d97706" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", minWidth: 100 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
              {["Available","Medical Hold","Quarantine","Pending","Foster","Imported"].map((s) => by(s) > 0 && (
                <div key={s} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{by(s)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Kennel</th><th>Status</th><th>Intake Date</th><th>Days</th><th>Microchip</th><th>Fixed</th></tr></thead>
                <tbody>
                  {inShelter.map((a) => (
                    <tr key={a.id} style={{ background: a.daysIn > 30 ? "#fee2e2" : a.daysIn > 14 ? "#fef9eb" : undefined }}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}><a href={`/animals/${a.id}`} style={{ color: "var(--teal)" }}>{a.id}</a></td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td style={{ fontSize: 12 }}>{a.species}</td>
                      <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                      <td><span className="badge" style={{ fontSize: 10 }}>{a.status}</span></td>
                      <td style={{ fontSize: 12 }}>{fmtDateUS(a.intake_date)}</td>
                      <td style={{ fontWeight: 700, color: a.daysIn > 30 ? "#dc2626" : a.daysIn > 14 ? "#d97706" : "inherit" }}>{a.daysIn}d</td>
                      <td style={{ fontSize: 11, fontFamily: "monospace" }}>{a.microchip || "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.fixed ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Euthanasia Report ── */}
      {activeReport === "euthanasia" && (() => {
        const euths = departureRecs.filter((dr) => {
          const t = (dr.departure_type ?? "").toLowerCase();
          return t.includes("euthan") && inRange(dr.departure_date, range.from, range.to);
        });
        const reasons: Record<string, number> = {};
        euths.forEach((dr) => {
          const a = animals.find((x) => x.id === dr.animal_id);
          let reason = "Unknown";
          try { const e = typeof a?.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : a?.euthanasia; reason = (e as { reason?: string })?.reason ?? "Unknown"; } catch { /* */ }
          reasons[reason] = (reasons[reason] || 0) + 1;
        });

        function doPrint() {
          const rows = euths.map((dr) => {
            const a = animals.find((x) => x.id === dr.animal_id);
            let euth: { reason?: string; performed_by?: string; authorized_by?: string } = {};
            try { euth = typeof a?.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : (a?.euthanasia as typeof euth ?? {}); } catch { /* */ }
            const daysIn = a?.intake_date ? daysBetween(a.intake_date, dr.departure_date ?? today()) : 0;
            return `<tr><td>${a?.id??""}</td><td>${a?.name??""}</td><td>${a?.species??""}</td><td>${a?.breed??""}</td>
              <td>${fmtDateUS(a?.intake_date)}</td><td>${fmtDateUS(dr.departure_date)}</td><td class="right">${daysIn}d</td>
              <td>${euth.reason??""}</td><td>${euth.authorized_by??""}</td><td>${euth.performed_by??""}</td></tr>`;
          }).join("");
          printReport("Euthanasia Report", range.label,
            `<div class="summary"><div class="summary-item"><div class="val">${euths.length}</div><div class="lbl">Total</div></div></div>
            <table><thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Intake</th><th>Euth Date</th><th>Days</th><th>Reason</th><th>Auth By</th><th>Performed By</th></tr></thead><tbody>${rows}</tbody></table>`);
        }

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>💔 Euthanasia Report — {euths.length} · {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={doPrint}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`Euthanasia-${range.from}-${range.to}.csv`,
                  ["Animal ID","Name","Species","Breed","Intake Date","Euth Date","Days in Shelter","Reason","Auth By"],
                  euths.map((dr) => {
                    const a = animals.find((x) => x.id === dr.animal_id);
                    let e: { reason?: string; authorized_by?: string } = {};
                    try { e = typeof a?.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : (a?.euthanasia as typeof e ?? {}); } catch { /* */ }
                    return [a?.id,a?.name,a?.species,a?.breed,a?.intake_date,dr.departure_date,a?.intake_date?daysBetween(a.intake_date,dr.departure_date??today()):0,e.reason,e.authorized_by];
                  }))}>📥 CSV</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              {Object.entries(reasons).map(([reason, count]) => (
                <div key={reason} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{reason}</div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Intake Date</th><th>Euth Date</th><th>Days</th><th>Reason</th><th>Auth By</th></tr></thead>
                <tbody>
                  {euths.map((dr) => {
                    const a = animals.find((x) => x.id === dr.animal_id);
                    let e: { reason?: string; authorized_by?: string } = {};
                    try { e = typeof a?.euthanasia === "string" ? JSON.parse(a.euthanasia as unknown as string) : (a?.euthanasia as typeof e ?? {}); } catch { /* */ }
                    const daysIn = a?.intake_date ? daysBetween(a.intake_date, dr.departure_date ?? today()) : 0;
                    return (
                      <tr key={dr.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a?.id || dr.animal_id}</td>
                        <td style={{ fontWeight: 600 }}>{a?.name || "—"}</td>
                        <td style={{ fontSize: 12 }}>{a?.species || "—"}</td>
                        <td style={{ fontSize: 12 }}>{a?.breed || "—"}</td>
                        <td style={{ fontSize: 12 }}>{fmtDateUS(a?.intake_date)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDateUS(dr.departure_date)}</td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{daysIn}d</td>
                        <td style={{ fontSize: 12 }}>{e.reason || "—"}</td>
                        <td style={{ fontSize: 12 }}>{e.authorized_by || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Citation Report ── */}
      {activeReport === "citations_report" && (() => {
        const citRange = citations.filter((c) => inRange(c.date, range.from, range.to));
        const byOfficer: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let totalFines = 0;
        citRange.forEach((c) => {
          if (c.issuing_officer) byOfficer[c.issuing_officer] = (byOfficer[c.issuing_officer] || 0) + 1;
          byStatus[c.status ?? "Unknown"] = (byStatus[c.status ?? "Unknown"] || 0) + 1;
          totalFines += c.fine_amount ?? 0;
        });

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Citation Report — {citRange.length} citations · {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const rows = citRange.map((c) =>
                    `<tr><td>${c.citation_number||""}</td><td>${fmtDateUS(c.date)}</td><td>${c.violator_name||""}</td>
                    <td>${c.violation_type||""}</td><td>${c.location||""}</td>
                    <td class="right">${fmtMoney(c.fine_amount)}</td><td>${c.status||""}</td><td>${c.issuing_officer||""}</td></tr>`
                  ).join("");
                  printReport("Citation Report", range.label,
                    `<div class="summary">
                      <div class="summary-item"><div class="val">${citRange.length}</div><div class="lbl">Total</div></div>
                      <div class="summary-item"><div class="val">${fmtMoney(totalFines)}</div><div class="lbl">Fines Assessed</div></div>
                    </div>
                    <table><thead><tr><th>Citation #</th><th>Date</th><th>Violator</th><th>Violation</th><th>Location</th><th>Fine</th><th>Status</th><th>Officer</th></tr></thead><tbody>${rows}</tbody></table>`);
                }}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`Citations-${range.from}-${range.to}.csv`,
                  ["Citation #","Date","Violator","Address","Violation","Location","Fine Amount","Status","Officer"],
                  citRange.map((c) => [c.citation_number,c.date,c.violator_name,c.violator_address,c.violation_type,c.location,c.fine_amount,c.status,c.issuing_officer]))}>📥 CSV</button>
              </div>
            </div>
            {!citationsLoaded && <p style={{ color: "var(--text-muted)" }}>Loading citations…</p>}
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{citRange.length}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Citations</div>
              </div>
              <div style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{fmtMoney(totalFines)}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Fines Assessed</div>
              </div>
              {Object.entries(byStatus).map(([s, n]) => (
                <div key={s} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Citation #</th><th>Date</th><th>Violator</th><th>Violation</th><th>Fine</th><th>Court Date</th><th>Status</th><th>Officer</th></tr></thead>
                <tbody>
                  {citRange.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.citation_number}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateUS(c.date)}</td>
                      <td style={{ fontSize: 12 }}>{c.violator_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.violation_type || "—"}</td>
                      <td style={{ fontWeight: 700, color: "#16a34a" }}>{fmtMoney(c.fine_amount)}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateUS(c.court_date)}</td>
                      <td><span className="badge" style={{ fontSize: 10 }}>{c.status || "—"}</span></td>
                      <td style={{ fontSize: 12 }}>{c.issuing_officer || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Volunteer Hours Report ── */}
      {activeReport === "volunteer_hours" && (() => {
        const logsRange = volLogs.filter((l) => inRange(l.date, range.from, range.to));
        const totalHours = logsRange.reduce((s, l) => s + (l.hours ?? 0), 0);
        const byVol: Record<string, { name: string; hours: number; sessions: number }> = {};
        logsRange.forEach((l) => {
          if (!byVol[l.person_id]) byVol[l.person_id] = { name: l.person_name, hours: 0, sessions: 0 };
          byVol[l.person_id].hours += l.hours ?? 0;
          byVol[l.person_id].sessions++;
        });
        const volRanking = Object.values(byVol).sort((a, b) => b.hours - a.hours);

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🙋 Volunteer Hours — {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const rows = volRanking.map((v) =>
                    `<tr><td>${v.name}</td><td class="right">${v.sessions}</td><td class="right bold">${v.hours.toFixed(2)}h</td></tr>`
                  ).join("");
                  printReport("Volunteer Hours Report", range.label,
                    `<div class="summary">
                      <div class="summary-item"><div class="val">${totalHours.toFixed(1)}h</div><div class="lbl">Total Hours</div></div>
                      <div class="summary-item"><div class="val">${logsRange.length}</div><div class="lbl">Sessions</div></div>
                      <div class="summary-item"><div class="val">${volRanking.length}</div><div class="lbl">Volunteers</div></div>
                    </div>
                    <table><thead><tr><th>Volunteer</th><th>Sessions</th><th>Hours</th></tr></thead><tbody>${rows}</tbody></table>`);
                }}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`Volunteer-Hours-${range.from}-${range.to}.csv`,
                  ["Volunteer","Date","Task","Clock In","Clock Out","Hours"],
                  logsRange.map((l) => [l.person_name,l.date,l.task,l.clock_in,l.clock_out,l.hours]))}>📥 CSV</button>
              </div>
            </div>
            {!volLogsLoaded && <p style={{ color: "var(--text-muted)" }}>Loading volunteer logs…</p>}
            <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
              {[
                { label: "Total Hours",   value: `${totalHours.toFixed(1)}h`, color: "#0d9488" },
                { label: "Sessions",      value: logsRange.length,             color: "#6366f1" },
                { label: "Volunteers",    value: volRanking.length,            color: "#0f2942" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 14 }}>
              {volRanking.map((v) => (
                <div key={v.name} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                  <div><div style={{ fontWeight: 700 }}>{v.name}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.sessions} session{v.sessions !== 1 ? "s" : ""}</div></div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--teal)" }}>{v.hours.toFixed(1)}h</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Financial Summary ── */}
      {activeReport === "financial" && (() => {
        const depsRange = departureRecs.filter((dr) => inRange(dr.departure_date, range.from, range.to));
        const recsRange = receipts.filter((r) => inRange(r.date, range.from, range.to));
        const adoptionFees = depsRange.filter((dr) => dr.departure_type === "Adoption").reduce((s, dr) => s + (dr.total_fees ?? 0), 0);
        const redemptionFees = depsRange.filter((dr) => dr.departure_type?.includes("Redemption") || dr.departure_type?.includes("Owner")).reduce((s, dr) => s + (dr.total_fees ?? 0), 0);
        const otherDep = depsRange.filter((dr) => !dr.departure_type?.includes("Adoption") && !dr.departure_type?.includes("Redemption") && !dr.departure_type?.includes("Owner")).reduce((s, dr) => s + (dr.total_fees ?? 0), 0);
        const donations = recsRange.filter((r) => r.category === "Donations").reduce((s, r) => s + (r.total ?? 0), 0);
        const merchandise = recsRange.filter((r) => r.category === "Merchandise").reduce((s, r) => s + (r.total ?? 0), 0);
        const services = recsRange.filter((r) => r.category === "Services").reduce((s, r) => s + (r.total ?? 0), 0);
        const grandTotal = adoptionFees + redemptionFees + otherDep + donations + merchandise + services;
        const byMethod: Record<string, number> = {};
        [...depsRange, ...recsRange].forEach((r) => {
          const m = ("payment_method" in r ? r.payment_method : null) ?? "Unknown";
          byMethod[m] = (byMethod[m] || 0) + (("total_fees" in r ? r.total_fees : r.total) ?? 0);
        });

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>💵 Financial Summary — {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => printReport("Financial Summary", range.label,
                  `<div class="summary"><div class="summary-item"><div class="val">${fmtMoney(grandTotal)}</div><div class="lbl">Grand Total</div></div></div>
                  <table><thead><tr><th>Category</th><th class="right">Amount</th></tr></thead><tbody>
                    <tr><td>Adoption Fees</td><td class="right bold">${fmtMoney(adoptionFees)}</td></tr>
                    <tr><td>Redemption / Impound Fees</td><td class="right bold">${fmtMoney(redemptionFees)}</td></tr>
                    <tr><td>Other Departure Fees</td><td class="right bold">${fmtMoney(otherDep)}</td></tr>
                    <tr><td>Donations</td><td class="right bold">${fmtMoney(donations)}</td></tr>
                    <tr><td>Merchandise</td><td class="right bold">${fmtMoney(merchandise)}</td></tr>
                    <tr><td>Services</td><td class="right bold">${fmtMoney(services)}</td></tr>
                    <tr style="font-weight:700;background:#f0f4f8"><td>GRAND TOTAL</td><td class="right">${fmtMoney(grandTotal)}</td></tr>
                  </tbody></table>`)}>🖨 Print</button>
              </div>
            </div>
            {!receiptsLoaded && <p style={{ color: "var(--text-muted)" }}>Loading receipts…</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Revenue by Category</div>
                {[
                  ["Adoption Fees",              adoptionFees,   "#6366f1"],
                  ["Redemption / Impound Fees",  redemptionFees, "#0891b2"],
                  ["Other Departure Fees",       otherDep,       "#f59e0b"],
                  ["Donations",                  donations,      "#16a34a"],
                  ["Merchandise",                merchandise,    "#8b5cf6"],
                  ["Services",                   services,       "#0d9488"],
                ].map(([label, amount, color]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                    <span>{String(label)}</span>
                    <span style={{ fontWeight: 700, color: String(color) }}>{fmtMoney(amount as number)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 800, fontSize: 15, borderTop: "2px solid var(--border)" }}>
                  <span>Grand Total</span>
                  <span style={{ color: "#0f2942" }}>{fmtMoney(grandTotal)}</span>
                </div>
              </div>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>By Payment Method</div>
                {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                  <div key={method} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                    <span>{method}</span>
                    <span style={{ fontWeight: 700 }}>{fmtMoney(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Intake Detail Report ── */}
      {activeReport === "intake_detail" && (() => {
        const intakes = animals.filter((a) => inRange(a.intake_date, range.from, range.to) && a.intake_type !== "Clinic");
        const byType: Record<string, number> = {};
        const bySp: Record<string, number> = {};
        intakes.forEach((a) => {
          byType[a.intake_type || "Unknown"] = (byType[a.intake_type || "Unknown"] || 0) + 1;
          bySp[a.species || "Unknown"] = (bySp[a.species || "Unknown"] || 0) + 1;
        });

        function doPrint() {
          const rows = intakes.map((a) =>
            `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.species}</td><td>${a.breed||""}</td><td>${a.color||""}</td>
            <td>${a.sex||""}</td><td>${fmtDateUS(a.intake_date)}</td><td>${a.intake_type||""}</td>
            <td>${a.microchip||""}</td><td>${a.status}</td></tr>`
          ).join("");
          printReport("Intake Detail Report", range.label,
            `<div class="summary">
              <div class="summary-item"><div class="val">${intakes.length}</div><div class="lbl">Total Intakes</div></div>
              ${Object.entries(bySp).map(([s,n]) => `<div class="summary-item"><div class="val">${n}</div><div class="lbl">${s}</div></div>`).join("")}
            </div>
            <table><thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Color</th><th>Sex</th><th>Intake Date</th><th>Type</th><th>Microchip</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
        }

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📥 Intake Detail — {intakes.length} intakes · {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={doPrint}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`Intakes-${range.from}-${range.to}.csv`,
                  ["Animal ID","Name","Species","Breed","Color","Sex","Age","Intake Date","Intake Type","Microchip","Status"],
                  intakes.map((a) => [a.id,a.name,a.species,a.breed,a.color,a.sex,a.age,a.intake_date,a.intake_type,a.microchip,a.status]))}>📥 CSV</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              {Object.entries(bySp).map(([s, n]) => (
                <div key={s} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}>
                  <div style={{ fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s}</div>
                </div>
              ))}
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <div key={t} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px" }}>
                  <div style={{ fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Color</th><th>Sex</th><th>Intake Date</th><th>Intake Type</th><th>Microchip</th><th>Status</th></tr></thead>
                <tbody>
                  {intakes.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}><a href={`/animals/${a.id}`} style={{ color: "var(--teal)" }}>{a.id}</a></td>
                      <td style={{ fontWeight: 600 }}>{a.name}</td>
                      <td style={{ fontSize: 12 }}>{a.species}</td>
                      <td style={{ fontSize: 12 }}>{a.breed||"—"}</td>
                      <td style={{ fontSize: 12 }}>{a.color||"—"}</td>
                      <td style={{ fontSize: 12 }}>{a.sex||"—"}</td>
                      <td style={{ fontSize: 12 }}>{fmtDateUS(a.intake_date)}</td>
                      <td style={{ fontSize: 12 }}>{a.intake_type||"—"}</td>
                      <td style={{ fontSize: 11, fontFamily: "monospace" }}>{a.microchip||"—"}</td>
                      <td><span className="badge" style={{ fontSize: 10 }}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Outcome Detail Report ── */}
      {activeReport === "outcome_detail" && (() => {
        const outcomes = departureRecs.filter((dr) => inRange(dr.departure_date, range.from, range.to));
        const byType: Record<string, number> = {};
        const byType$: Record<string, number> = {};
        let totalFees = 0;
        outcomes.forEach((dr) => {
          byType[dr.departure_type || "Unknown"] = (byType[dr.departure_type || "Unknown"] || 0) + 1;
          byType$[dr.departure_type || "Unknown"] = (byType$[dr.departure_type || "Unknown"] || 0) + (dr.total_fees ?? 0);
          totalFees += dr.total_fees ?? 0;
        });
        const liveTypes = ["Adoption","Owner Redemption","Transfer Out","Field Release","Return to Owner","Foster Placement"];
        const live = outcomes.filter((dr) => liveTypes.some((t) => (dr.departure_type ?? "").includes(t.split(" ")[0]))).length;
        const lrr = outcomes.length > 0 ? ((live / outcomes.length) * 100).toFixed(1) : "N/A";

        return (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📤 Outcome Detail — {outcomes.length} · {range.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  const rows = outcomes.map((dr) => {
                    const a = animals.find((x) => x.id === dr.animal_id);
                    return `<tr><td>${a?.id||""}</td><td>${a?.name||""}</td><td>${a?.species||""}</td>
                      <td>${fmtDateUS(a?.intake_date)}</td><td>${fmtDateUS(dr.departure_date)}</td>
                      <td>${dr.departure_type||""}</td>
                      <td class="right">${a?.intake_date&&dr.departure_date?daysBetween(a.intake_date,dr.departure_date):"—"}d</td>
                      <td class="right">${fmtMoney(dr.total_fees)}</td></tr>`;
                  }).join("");
                  printReport("Outcome Detail Report", range.label,
                    `<div class="summary">
                      <div class="summary-item"><div class="val">${outcomes.length}</div><div class="lbl">Total Outcomes</div></div>
                      <div class="summary-item"><div class="val">${lrr}%</div><div class="lbl">Live Release Rate</div></div>
                      <div class="summary-item"><div class="val">${fmtMoney(totalFees)}</div><div class="lbl">Fees Collected</div></div>
                    </div>
                    <table><thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Intake</th><th>Outcome</th><th>Type</th><th>Days</th><th>Fees</th></tr></thead><tbody>${rows}</tbody></table>`);
                }}>🖨 Print</button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCsv(`Outcomes-${range.from}-${range.to}.csv`,
                  ["Animal ID","Name","Species","Intake Date","Outcome Date","Outcome Type","Days in Shelter","Fees"],
                  outcomes.map((dr) => {
                    const a = animals.find((x) => x.id === dr.animal_id);
                    return [a?.id,a?.name,a?.species,a?.intake_date,dr.departure_date,dr.departure_type,
                      a?.intake_date&&dr.departure_date?daysBetween(a.intake_date,dr.departure_date):"",dr.total_fees];
                  }))}>📥 CSV</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{outcomes.length}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Total Outcomes</div>
              </div>
              <div style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0d9488" }}>{lrr}%</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Live Release Rate</div>
              </div>
              <div style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a" }}>{fmtMoney(totalFees)}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Fees Collected</div>
              </div>
              {Object.entries(byType).map(([t, n]) => (
                <div key={t} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
                  <div style={{ fontWeight: 800 }}>{n}</div><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Intake Date</th><th>Outcome Date</th><th>Type</th><th>Days</th><th>Fees</th></tr></thead>
                <tbody>
                  {outcomes.map((dr) => {
                    const a = animals.find((x) => x.id === dr.animal_id);
                    const days = a?.intake_date && dr.departure_date ? daysBetween(a.intake_date, dr.departure_date) : null;
                    return (
                      <tr key={dr.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a?.id || dr.animal_id}</td>
                        <td style={{ fontWeight: 600 }}>{a?.name || "—"}</td>
                        <td style={{ fontSize: 12 }}>{a?.species || "—"}</td>
                        <td style={{ fontSize: 12 }}>{fmtDateUS(a?.intake_date)}</td>
                        <td style={{ fontSize: 12 }}>{fmtDateUS(dr.departure_date)}</td>
                        <td><span className="badge" style={{ fontSize: 10 }}>{dr.departure_type || "—"}</span></td>
                        <td style={{ fontSize: 12 }}>{days != null ? `${days}d` : "—"}</td>
                        <td style={{ fontWeight: 700, color: "#16a34a" }}>{fmtMoney(dr.total_fees)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Pet Licenses Report ── */}
      {activeReport === "pet_licenses" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>🪪 Pet License Registry</div>
            <a href="/pet-licenses" className="btn btn-secondary btn-sm">Manage Licenses →</a>
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            {[
              { label: "Active",         color: "#16a34a", count: animals.filter((a) => a.status === "Available").length },
              { label: "Expiring 30d",   color: "#d97706", count: 0 },
              { label: "Expired",        color: "#dc2626", count: 0 },
            ].map(({ label, color, count }) => (
              <div key={label} style={{ background: "var(--bg-alt)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 18px", minWidth: 120 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{count}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
            Use the <a href="/pet-licenses" style={{ color: "var(--teal)", fontWeight: 700 }}>Pet License Registry</a> for full filtering, bulk import, CSV export, and expiration tracking.
          </p>
        </div>
      )}
    </AppShell>
  );
}
