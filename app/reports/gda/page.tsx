"use client";
import { useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { fetchAnimals, fetchAdoptions, fetchTransfers, fetchDepartureReceipts, fetchRedemptions, fetchAllIntakeHistory } from "@/lib/data";
import type { Animal, AdoptionRecord, Transfer, DepartureReceipt, Redemption, AnimalIntakeHistory } from "@/lib/types";
import { downloadCsv } from "@/lib/reportUtils";
import { isInCareStatus } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

// ── Species/age column classification ────────────────────────────────────────

export type Col = "dog" | "puppy" | "cat" | "kitten" | "wildlife" | "other";

function isJuvenile(age: string | null | undefined): boolean {
  if (!age) return false;
  const lower = age.toLowerCase();
  if (["neonat", "puppy", "kitten"].some(k => lower.includes(k))) return true;
  if (["adult", "senior", "young"].some(k => lower.includes(k))) return false;
  const m = age.match(/^(\d+)\s+(days?|weeks?|months?|years?)/i);
  if (!m) return false;
  const n = parseInt(m[1]);
  const u = m[2].toLowerCase();
  const days = u.startsWith("year") ? n * 365 : u.startsWith("month") ? n * 30 : u.startsWith("week") ? n * 7 : n;
  return days < 180;
}

function getCol(a: Animal): Col {
  const sp = (a.species || "").toLowerCase();
  const juv = isJuvenile(a.age);
  if (sp === "dog") return juv ? "puppy" : "dog";
  if (sp === "cat") return juv ? "kitten" : "cat";
  if (["wildlife", "bird", "reptile", "rabbit", "squirrel", "fox", "raccoon"].some(s => sp.includes(s))) return "wildlife";
  return "other";
}

// ── Counts row ───────────────────────────────────────────────────────────────

interface Counts { dog: number; puppy: number; cat: number; kitten: number; wildlife: number; other: number; }

function zeroCounts(): Counts { return { dog:0, puppy:0, cat:0, kitten:0, wildlife:0, other:0 }; }
function rowTotal(c: Counts) { return c.dog + c.puppy + c.cat + c.kitten + c.wildlife + c.other; }
function addCounts(a: Counts, b: Counts): Counts {
  return { dog:a.dog+b.dog, puppy:a.puppy+b.puppy, cat:a.cat+b.cat, kitten:a.kitten+b.kitten, wildlife:a.wildlife+b.wildlife, other:a.other+b.other };
}
function countAnimals(animals: Animal[]): Counts {
  const c = zeroCounts();
  animals.forEach(a => c[getCol(a)]++);
  return c;
}

// ── Intake classification ────────────────────────────────────────────────────

type IntakeCat = "stray" | "owner" | "oie" | "transferIn" | "other";

function classifyIntake(intakeType?: string, circumstance?: string): IntakeCat {
  const t = (intakeType ?? "").toLowerCase();
  const c = (circumstance ?? "").toLowerCase();
  if (["stray", "aco", "confiscation", "abandoned", "at large", "field pickup"].some(k => t.includes(k) || c.includes(k))) return "stray";
  if (["surrender", "relinquish", "return"].some(k => t.includes(k) || c.includes(k))) return "owner";
  if (["intended euthanasia", "request euth", " oie"].some(k => t.includes(k))) return "oie";
  if (["transfer in", "transferred in"].some(k => t.includes(k) || c.includes(k))) return "transferIn";
  return "other";
}

// ── Outcome classification ───────────────────────────────────────────────────

type OutcomeCat = "adopt" | "rto" | "transferOut" | "rtf" | "otherLive" | "died" | "lost" | "euthShelter" | "euthOwner";

function classifyOutcome(departureType?: string, euthReason?: string, intakeType?: string): OutcomeCat {
  const t = (departureType ?? "").toLowerCase();
  const r = (euthReason ?? "").toLowerCase();
  const it = (intakeType ?? "").toLowerCase();
  if (t.includes("adopt")) return "adopt";
  if (["redemption", "reclaim", "returned to owner", "rto", "owner claim"].some(k => t.includes(k))) return "rto";
  if (["return to field", "tnr", "trap-neuter", "released to field"].some(k => t.includes(k))) return "rtf";
  if (t.includes("transfer")) return "transferOut";
  if (["euthan", "euth"].some(k => t.includes(k))) {
    const ownerSignal = ["owner request", "owner intended", "owner", "intended"].some(k => r.includes(k)) || it.includes("intended euthanasia");
    return ownerSignal ? "euthOwner" : "euthShelter";
  }
  if (["died", "dead", "doa", "natural death"].some(k => t.includes(k))) return "died";
  if (["lost", "escaped", "missing", "lost in care"].some(k => t.includes(k))) return "lost";
  return "otherLive";
}

// ── Matrix data ──────────────────────────────────────────────────────────────

interface MatrixData {
  startDate: string;
  endDate: string;
  beginning: Counts;   // A
  stray: Counts;       // B
  owner: Counts;       // C
  oie: Counts;         // D
  transferIn: Counts;  // E
  otherIntake: Counts; // F
  adopt: Counts;       // H
  rto: Counts;         // I
  transferOut: Counts; // J
  rtf: Counts;         // K
  otherLive: Counts;   // L
  died: Counts;        // N
  lost: Counts;        // O
  euthShelter: Counts; // P
  euthOwner: Counts;   // Q
  ending: Counts;      // T
  // Raw animal lists behind A and T, for the diagnostic "Show Reconciliation" view.
  beginningAnimals: Animal[];
  endingAnimals: Animal[];
}

// ── Data computation ─────────────────────────────────────────────────────────

// ── Custody timeline ─────────────────────────────────────────────────────────
// "In care on date X" can't be answered from current status alone once an
// animal can leave and come back (adoption return, redemption, then a later
// Return-to-Shelter re-intake) — current status only reflects the LATEST
// cycle, not what was true on some earlier report date. So instead we build,
// per animal, a full chronological list of every known intake and outcome
// event and walk it to find which cycle (if any) covers the date in question.
//
// Event sources:
//   intake  — the animal's original intake_date, plus every re-intake row in
//             animal_intake_history (Return-to-Shelter Intake feature)
//   outcome — adoption_records, transfers, redemptions (owner reclaim —
//             NOT recorded on departure_receipts, RedemptionWizard only
//             writes to the `redemptions` table), departure_receipts
//             (covers escaped/lost/released/etc.), euthanasia.date, and
//             death_date for natural "Died in Care" deaths (also never
//             recorded on a departure_receipts row).
interface CustodyEvent { date: string; kind: "intake" | "outcome"; label: string }

function buildCustodyEvents(
  animals: Animal[],
  adoptions: AdoptionRecord[],
  transfers: Transfer[],
  redemptions: Redemption[],
  receipts: DepartureReceipt[],
  intakeHistoryAll: AnimalIntakeHistory[],
): Map<string, CustodyEvent[]> {
  const map = new Map<string, CustodyEvent[]>();
  const push = (id: string | undefined, ev: CustodyEvent) => {
    if (!id) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(ev);
  };

  animals.forEach(a => {
    if (a.intake_date) push(a.id, { date: a.intake_date, kind: "intake", label: "Intake" });
    if (a.status === "Died in Care" && a.death_date) push(a.id, { date: a.death_date, kind: "outcome", label: "Died in Care" });
    if (a.status === "Euthanized" && a.euthanasia?.date) push(a.id, { date: a.euthanasia.date, kind: "outcome", label: "Euthanasia" });
  });
  intakeHistoryAll.forEach(h => push(h.animal_id, { date: h.intake_date, kind: "intake", label: `Return-to-Shelter Intake #${h.intake_number}` }));
  adoptions.forEach(a => push(a.animal_id, { date: a.adoption_date, kind: "outcome", label: "Adoption" }));
  transfers.forEach(t => (t.animal_ids || []).forEach(id => push(id, { date: t.date, kind: "outcome", label: "Transfer Out" })));
  redemptions.forEach(r => push(r.animal_id, { date: r.redemption_date, kind: "outcome", label: "Returned to Owner" }));
  // departure_date is stored as a full ISO timestamp (unlike every other date
  // field here, which is plain YYYY-MM-DD) — truncate so string comparisons
  // against startDate/endDate behave correctly.
  receipts.forEach(r => push(r.animal_id, { date: (r.departure_date || "").slice(0, 10), kind: "outcome", label: r.departure_type }));

  map.forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));
  return map;
}

// mode "start": an intake counts only if strictly before atDate (same-day intakes
//   are Live Intake for the period, not Beginning population); an outcome on/after
//   atDate still leaves the animal present at the start-of-day snapshot.
// mode "end": an intake counts through and including atDate; an outcome strictly
//   after atDate still leaves the animal present at the end-of-day snapshot.
// When an animal's current cycle has no recorded outcome event at all, we fall
// back to isInCareStatus(current status) — this is the one remaining place
// current status matters, and only when no structured record exists to check
// instead (e.g. Foster has no dedicated event source here; a currently-fostered
// animal's presence on a PAST date is approximated from current status).
function isInCareAt(events: CustodyEvent[] | undefined, atDate: string, mode: "start" | "end", fallbackStatus: string): boolean {
  if (!events || events.length === 0) return isInCareStatus(fallbackStatus);
  const intakeQualifies = (d: string) => (mode === "start" ? d < atDate : d <= atDate);
  const outcomeStillPresent = (d: string) => (mode === "start" ? d >= atDate : d > atDate);

  let cycleStart: string | null = null;
  for (const e of events) {
    if (e.kind === "intake" && intakeQualifies(e.date)) cycleStart = e.date;
  }
  if (cycleStart === null) return false; // not yet admitted as of this date

  const outcome = events.find(e => e.kind === "outcome" && e.date >= cycleStart!);
  if (!outcome) return isInCareStatus(fallbackStatus);
  return outcomeStillPresent(outcome.date);
}

async function computeMatrix(startDate: string, endDate: string): Promise<MatrixData> {
  const [animals, adoptions, transfers, receipts, redemptions, intakeHistoryAll] = await Promise.all([
    fetchAnimals(),
    fetchAdoptions(),
    fetchTransfers(),
    fetchDepartureReceipts(),
    fetchRedemptions(),
    fetchAllIntakeHistory(),
  ]);

  const custodyEvents = buildCustodyEvents(animals, adoptions, transfers, redemptions, receipts, intakeHistoryAll);
  const animalMap = new Map(animals.map(a => [a.id, a]));

  // A: beginning — every animal in our care as of the start-of-day snapshot on startDate
  const beginning = animals.filter(a => isInCareAt(custodyEvents.get(a.id), startDate, "start", a.status));

  // B–F: intakes during period
  const periodIntakes = animals.filter(a => a.intake_date >= startDate && a.intake_date <= endDate);
  const bucketedIntakes: Record<IntakeCat, Animal[]> = { stray:[], owner:[], oie:[], transferIn:[], other:[] };
  periodIntakes.forEach(a => bucketedIntakes[classifyIntake(a.intake_type, a.circumstance)].push(a));

  // H–Q: outcomes during period (de-duplicate across sources)
  const seenOutcomes = new Set<string>();
  const bucketedOutcomes: Record<OutcomeCat, Animal[]> = {
    adopt:[], rto:[], transferOut:[], rtf:[], otherLive:[], died:[], lost:[], euthShelter:[], euthOwner:[],
  };

  function addOutcome(animalId: string, type: string, euthReason?: string, intakeType?: string) {
    if (seenOutcomes.has(animalId)) return;
    seenOutcomes.add(animalId);
    const a = animalMap.get(animalId);
    if (!a) return;
    const cat = classifyOutcome(type, euthReason, intakeType);
    bucketedOutcomes[cat].push(a);
  }

  // From departure receipts
  receipts
    .filter(r => r.departure_date >= startDate && r.departure_date <= endDate && r.animal_id)
    .forEach(r => {
      const a = animalMap.get(r.animal_id);
      addOutcome(r.animal_id, r.departure_type, a?.euthanasia?.reason, a?.intake_type);
    });

  // From adoption records (fills gaps not covered by receipts)
  adoptions
    .filter(a => a.adoption_date >= startDate && a.adoption_date <= endDate)
    .forEach(a => addOutcome(a.animal_id, "Adoption"));

  // From transfers
  transfers
    .filter(t => t.date >= startDate && t.date <= endDate)
    .forEach(t => (t.animal_ids || []).forEach(id => addOutcome(id, "Transfer Out")));

  // From euthanized animals with date in period
  animals
    .filter(a => a.status === "Euthanized" && a.euthanasia?.date && a.euthanasia.date >= startDate && a.euthanasia.date <= endDate)
    .forEach(a => addOutcome(a.id, "Euthanasia", a.euthanasia!.reason, a.intake_type));

  // T: ending — every animal in our care as of the end-of-day snapshot on endDate
  const ending = animals.filter(a => isInCareAt(custodyEvents.get(a.id), endDate, "end", a.status));

  // Debug logging
  console.log("[GDA Report] date range:", startDate, endDate);
  console.log("[GDA Report] beginning count:", beginning.length);
  console.log("[GDA Report] intakes by type:", {
    stray: bucketedIntakes.stray.length, owner: bucketedIntakes.owner.length,
    oie: bucketedIntakes.oie.length, transferIn: bucketedIntakes.transferIn.length, other: bucketedIntakes.other.length,
  });
  console.log("[GDA Report] outcomes by type:", Object.fromEntries(Object.entries(bucketedOutcomes).map(([k, v]) => [k, v.length])));
  console.log("[GDA Report] ending count:", ending.length);

  return {
    startDate, endDate,
    beginning:   countAnimals(beginning),
    stray:       countAnimals(bucketedIntakes.stray),
    owner:       countAnimals(bucketedIntakes.owner),
    oie:         countAnimals(bucketedIntakes.oie),
    transferIn:  countAnimals(bucketedIntakes.transferIn),
    otherIntake: countAnimals(bucketedIntakes.other),
    adopt:       countAnimals(bucketedOutcomes.adopt),
    rto:         countAnimals(bucketedOutcomes.rto),
    transferOut: countAnimals(bucketedOutcomes.transferOut),
    rtf:         countAnimals(bucketedOutcomes.rtf),
    otherLive:   countAnimals(bucketedOutcomes.otherLive),
    died:        countAnimals(bucketedOutcomes.died),
    lost:        countAnimals(bucketedOutcomes.lost),
    euthShelter: countAnimals(bucketedOutcomes.euthShelter),
    euthOwner:   countAnimals(bucketedOutcomes.euthOwner),
    ending:      countAnimals(ending),
    beginningAnimals: beginning,
    endingAnimals: ending,
  };
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

interface RowDef {
  line?: string;
  heading: string;
  counts?: Counts;
  isSection?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isVerify?: boolean;
  verifyPass?: boolean;
  noLine?: boolean;
}

function buildRows(d: MatrixData): RowDef[] {
  const G = addCounts(addCounts(addCounts(d.stray, d.owner), addCounts(d.oie, d.transferIn)), d.otherIntake);
  const M = addCounts(addCounts(addCounts(d.adopt, d.rto), d.transferOut), addCounts(d.rtf, d.otherLive));
  const R = addCounts(addCounts(d.died, d.lost), addCounts(d.euthShelter, d.euthOwner));
  const S = addCounts(M, R);
  const agCheck = rowTotal(d.beginning) + rowTotal(G);
  const stCheck = rowTotal(S) + rowTotal(d.ending);
  const balanced = agCheck === stCheck;

  return [
    { line:"A", heading:`Beginning Animal Count (${fmtDate(d.startDate)})`, counts: d.beginning },
    { isSection: true, heading:"LIVE INTAKE" },
    { line:"B", heading:"Stray / At Large",          counts: d.stray },
    { line:"C", heading:"Relinquished by Owner",     counts: d.owner },
    { line:"D", heading:"Owner Intended Euthanasia", counts: d.oie },
    { line:"E", heading:"Transferred In",            counts: d.transferIn },
    { line:"F", heading:"Other Live Intakes",        counts: d.otherIntake },
    { line:"G", heading:"Total Live Intake",         counts: G, isSubtotal: true },
    { isSection: true, heading:"LIVE OUTCOMES" },
    { line:"H", heading:"Adoption",                  counts: d.adopt },
    { line:"I", heading:"Returned to Owner",         counts: d.rto },
    { line:"J", heading:"Transferred Out",           counts: d.transferOut },
    { line:"K", heading:"Returned to Field / TNR",   counts: d.rtf },
    { line:"L", heading:"Other Live Outcomes",       counts: d.otherLive },
    { line:"M", heading:"Subtotal: Live Outcomes",   counts: M, isSubtotal: true },
    { isSection: true, heading:"OTHER OUTCOMES" },
    { line:"N", heading:"Died in Care",              counts: d.died },
    { line:"O", heading:"Lost in Care / Escaped",    counts: d.lost },
    { line:"P", heading:"Shelter Euthanasia",        counts: d.euthShelter },
    { line:"Q", heading:"Owner Intended Euthanasia", counts: d.euthOwner },
    { line:"R", heading:"Subtotal: Other Outcomes",  counts: R, isSubtotal: true },
    { line:"S", heading:"Total Outcomes (M + R)",    counts: S, isTotal: true },
    { line:"T", heading:`Ending Animal Count (${fmtDate(d.endDate)})`, counts: d.ending },
    { isSection: true, heading:"VERIFICATION" },
    {
      noLine: true,
      isVerify: true,
      verifyPass: balanced,
      heading: balanced
        ? `✓ Report balances: A + G = S + T = ${agCheck}`
        : `⚠ Imbalance: A + G = ${agCheck}  ≠  S + T = ${stCheck}`,
    },
  ];
}

function fmtDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso;
}

// ── Print & export ────────────────────────────────────────────────────────────

function printMatrix(rows: RowDef[], startDate: string, endDate: string) {
  const COLS: Col[] = ["dog","puppy","cat","kitten","wildlife","other"];
  const COL_LABELS = ["Dog","Puppy","Cat","Kitten","Wildlife","Other","Total"];

  const th = (s: string, extra = "") =>
    `<th style="padding:5px 8px;background:#0f2942;color:#fff;font-size:10px;text-align:right;border:1px solid #1e3a5f;${extra}">${s}</th>`;

  const thead = `<tr>
    ${th("Line","text-align:left;min-width:30px")}
    ${th("Heading","text-align:left;min-width:220px")}
    ${COLS.map(c => th(c[0].toUpperCase() + c.slice(1))).join("")}
    ${th("Total")}
  </tr>`;

  const tbody = rows.map(row => {
    if (row.isSection) {
      return `<tr><td colspan="9" style="padding:5px 8px;background:#e5e7eb;font-size:10px;font-weight:800;text-transform:uppercase;border:1px solid #d1d5db;">${row.heading}</td></tr>`;
    }
    if (row.isVerify) {
      const bg = row.verifyPass ? "#f0fdf4" : "#fee2e2";
      const color = row.verifyPass ? "#15803d" : "#dc2626";
      return `<tr><td colspan="9" style="padding:5px 8px;background:${bg};color:${color};font-size:10px;font-weight:700;border:1px solid ${row.verifyPass ? "#86efac" : "#fca5a5"};">${row.heading}</td></tr>`;
    }
    const c = row.counts!;
    const tot = rowTotal(c);
    const bg = row.isTotal ? "#1e293b" : row.isSubtotal ? "#f1f5f9" : "#fff";
    const color = row.isTotal ? "#fff" : "#0f172a";
    const fw = (row.isTotal || row.isSubtotal) ? "font-weight:700;" : "";
    const cellStyle = `padding:5px 8px;font-size:10px;text-align:right;border:1px solid #e2e8f0;${fw}`;
    return `<tr style="background:${bg};color:${color};">
      <td style="${cellStyle}text-align:left;">${row.line || ""}</td>
      <td style="${cellStyle}text-align:left;">${row.heading}</td>
      ${COLS.map(col => `<td style="${cellStyle}">${c[col] || "0"}</td>`).join("")}
      <td style="${cellStyle}font-weight:700;">${tot}</td>
    </tr>`;
  }).join("");

  const w = window.open("", "_blank", "width=1100,height=900");
  if (!w) return;
  w.document.write(`<html><head><title>GDA Basic Animal Data Matrix</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:18px;background:#fff;}
  @media print{@page{size:letter landscape;margin:0.5in}}</style>
  </head><body>
  <div style="background:#0f2942;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
    <div>
      <div style="font-size:14px;font-weight:800;">MORGAN COUNTY ANIMAL SERVICES</div>
      <div style="font-size:10px;color:#93c5fd;margin-top:2px;">ShelterTrace · Shelter Data Systems</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#93c5fd;">
      <div style="font-weight:700;color:#fff;">GDA Shelter Animals Count</div>
      <div>Basic Animal Data Matrix</div>
      <div>Period: ${fmtDate(startDate)} – ${fmtDate(endDate)}</div>
      <div>Generated: ${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;border:2px solid #0f2942;border-top:none;">
    <thead>${thead}</thead>
    <tbody>${tbody}</tbody>
  </table>
  <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
    <span>Morgan County Animal Services · 390 Hancock Drive, Madison, GA 30650 · (706) 343-7566</span>
    <span>Report Generated by ShelterTrace — Shelter Data Systems</span>
  </div>
  </body></html>`);
  w.document.close();
  w.onload = () => w.print();
}

function exportCsv(rows: RowDef[], startDate: string, endDate: string) {
  const headers = ["Line","Heading","Dog","Puppy","Cat","Kitten","Wildlife","Other","Total"];
  const COLS: Col[] = ["dog","puppy","cat","kitten","wildlife","other"];
  const csvRows: (string | number)[][] = rows
    .filter(r => !r.isSection && !r.isVerify)
    .map(r => {
      if (!r.counts) return [r.line || "", r.heading, ...Array(7).fill("")];
      const c = r.counts;
      return [r.line || "", r.heading, ...COLS.map(col => c[col]), rowTotal(c)];
    });
  downloadCsv(`GDA-Matrix-${startDate}-${endDate}.csv`, headers, csvRows);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GdaMatrixPage() {
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const defaultYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [month, setMonth]       = useState(defaultMonth);
  const [year, setYear]         = useState(defaultYear);
  const [useCustom, setUseCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]   = useState("");
  const [matrix, setMatrix]     = useState<MatrixData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showReconciliation, setShowReconciliation] = useState(false);

  const getDateRange = useCallback((): { start: string; end: string } => {
    if (useCustom && customFrom && customTo) return { start: customFrom, end: customTo };
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }, [month, year, useCustom, customFrom, customTo]);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const { start, end } = getDateRange();
      const data = await computeMatrix(start, end);
      setMatrix(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const rows = matrix ? buildRows(matrix) : [];
  const COLS: Col[] = ["dog","puppy","cat","kitten","wildlife","other"];

  return (
    <AppShell
      title="GDA Monthly Report"
      action={<Link href="/reports" className="btn btn-secondary btn-sm">← All Reports</Link>}
    >
      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          📊 GDA Shelter Animals Count — Basic Animal Data Matrix
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
          Georgia Department of Agriculture required monthly report. Counts all animal intakes, outcomes, and shelter population by species and age category.
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            className={`btn btn-sm ${!useCustom ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setUseCustom(false)}
          >Monthly</button>
          <button
            className={`btn btn-sm ${useCustom ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setUseCustom(true)}
          >Custom Range</button>
        </div>

        {!useCustom ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Month</label>
              <select className="form-select" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Year</label>
              <select className="form-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", paddingBottom: 2 }}>
              {(() => { const r = getDateRange(); return `${fmtDate(r.start)} – ${fmtDate(r.end)}`; })()}
            </div>
          </div>
        ) : (
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date From</label>
              <input className="form-input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Date To</label>
              <input className="form-input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <button
        className="btn btn-primary"
        style={{ width: "100%", padding: 12, fontSize: 15, fontWeight: 700, marginBottom: 20 }}
        onClick={generate}
        disabled={loading}
      >
        {loading ? "Generating…" : "Generate Report"}
      </button>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", color: "#dc2626", fontSize: 12, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Matrix */}
      {matrix && (
        <div className="card">
          {/* Header */}
          <div style={{ background: "#0f2942", color: "#fff", padding: "10px 16px", margin: "-16px -16px 16px", borderRadius: "7px 7px 0 0" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>MORGAN COUNTY ANIMAL SERVICES</div>
            <div style={{ fontSize: 12, color: "#93c5fd", marginTop: 2 }}>GDA Shelter Animals Count — Basic Animal Data Matrix</div>
            <div style={{ display: "flex", gap: 24, marginTop: 6, fontSize: 11, color: "#bfdbfe" }}>
              <span>Period: {fmtDate(matrix.startDate)} – {fmtDate(matrix.endDate)}</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => printMatrix(rows, matrix.startDate, matrix.endDate)}>
              🖨 Print Report
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(rows, matrix.startDate, matrix.endDate)}>
              📥 Export CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowReconciliation(v => !v)}>
              🔍 {showReconciliation ? "Hide" : "Show"} Reconciliation
            </button>
          </div>

          {/* Diagnostic: animal IDs behind Beginning/Ending counts */}
          {showReconciliation && (
            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 10 }}>
                Reconciliation — animals contributing to each count
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                    Beginning Count ({fmtDate(matrix.startDate)}) — {matrix.beginningAnimals.length} animals
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, background: "#fff" }}>
                    {matrix.beginningAnimals.length === 0
                      ? <div style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>None</div>
                      : matrix.beginningAnimals
                          .slice()
                          .sort((a, b) => a.id.localeCompare(b.id))
                          .map(a => (
                            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 10px", fontSize: 11, borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontFamily: "monospace" }}>{a.id}</span>
                              <span>{a.name}</span>
                              <span style={{ color: "var(--text-muted)" }}>{a.species}</span>
                              <span style={{ color: "var(--text-muted)" }}>{a.status}</span>
                              <span style={{ color: "var(--text-muted)" }}>Intake: {a.intake_date}</span>
                            </div>
                          ))
                    }
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                    Ending Count ({fmtDate(matrix.endDate)}) — {matrix.endingAnimals.length} animals
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, background: "#fff" }}>
                    {matrix.endingAnimals.length === 0
                      ? <div style={{ padding: 10, fontSize: 12, color: "var(--text-muted)" }}>None</div>
                      : matrix.endingAnimals
                          .slice()
                          .sort((a, b) => a.id.localeCompare(b.id))
                          .map(a => (
                            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 10px", fontSize: 11, borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ fontFamily: "monospace" }}>{a.id}</span>
                              <span>{a.name}</span>
                              <span style={{ color: "var(--text-muted)" }}>{a.species}</span>
                              <span style={{ color: "var(--text-muted)" }}>{a.status}</span>
                              <span style={{ color: "var(--text-muted)" }}>Intake: {a.intake_date}</span>
                            </div>
                          ))
                    }
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10 }}>
                Cross-check: any animal you expect to see but don&apos;t — check its intake_date, status, and whether it has an adoption/transfer/redemption/departure-receipt record on file with an unexpected date.
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0f2942", color: "#fff" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #1e3a5f", width: 40 }}>Line</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", border: "1px solid #1e3a5f" }}>Heading</th>
                  {["Dog","Puppy","Cat","Kitten","Wildlife","Other"].map(h => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #1e3a5f", width: 70 }}>{h}</th>
                  ))}
                  <th style={{ padding: "6px 10px", textAlign: "right", border: "1px solid #1e3a5f", width: 70, fontWeight: 800 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  if (row.isSection) {
                    return (
                      <tr key={i}>
                        <td colSpan={9} style={{ padding: "6px 10px", background: "#e5e7eb", fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", border: "1px solid #d1d5db", color: "#374151" }}>
                          {row.heading}
                        </td>
                      </tr>
                    );
                  }
                  if (row.isVerify) {
                    const bg = row.verifyPass ? "#f0fdf4" : "#fee2e2";
                    const color = row.verifyPass ? "#15803d" : "#dc2626";
                    const border = row.verifyPass ? "#86efac" : "#fca5a5";
                    return (
                      <tr key={i}>
                        <td colSpan={9} style={{ padding: "8px 10px", background: bg, color, fontWeight: 700, fontSize: 12, border: `1px solid ${border}` }}>
                          {row.heading}
                        </td>
                      </tr>
                    );
                  }
                  const c = row.counts!;
                  const tot = rowTotal(c);
                  const isTotal = row.isTotal;
                  const isSub = row.isSubtotal;
                  const bg = isTotal ? "#1e293b" : isSub ? "#f1f5f9" : i % 2 === 0 ? "#fff" : "#f8fafc";
                  const color = isTotal ? "#fff" : "#0f172a";
                  const fw = isTotal || isSub ? "700" : "400";
                  const cellStyle: React.CSSProperties = { padding: "6px 10px", textAlign: "right", border: "1px solid #e2e8f0", fontWeight: fw as "700" | "400", color };
                  return (
                    <tr key={i} style={{ background: bg }}>
                      <td style={{ ...cellStyle, textAlign: "left", color: isTotal ? "#93c5fd" : "#64748b", fontSize: 11, fontWeight: 700 }}>{row.line}</td>
                      <td style={{ ...cellStyle, textAlign: "left" }}>{row.heading}</td>
                      {COLS.map(col => (
                        <td key={col} style={{ ...cellStyle, color: c[col] > 0 ? color : "#94a3b8" }}>
                          {c[col] || "0"}
                        </td>
                      ))}
                      <td style={{ ...cellStyle, fontWeight: "700", borderLeft: "2px solid #94a3b8" }}>{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <strong>Species Classification:</strong> Dog/Cat = 6+ months estimated age (or named category Adult/Senior/Young). Puppy/Kitten = under 6 months (or Neonatal/Puppy/Kitten category). Wildlife includes birds, reptiles, rabbits, and wild animals. Other includes horses, goats, livestock, and unclassified species.
            <br />
            <strong>Beginning Count:</strong> every animal in our care as of the start of {fmtDate(matrix.startDate)} — intake strictly before that date, with no adoption/transfer/redemption/departure-receipt/euthanasia/death record dated before that date. An outcome recorded on the start date itself still counts (they were present at the start of that day).
            <br />
            <strong>Ending Count:</strong> every animal in our care as of the end of {fmtDate(matrix.endDate)} — intake on or before that date, with no outcome record dated on or before that date. An outcome recorded exactly on the end date does <em>not</em> count (they had already left by end of day). This is the same day used elsewhere as &quot;in shelter&quot; — the live Current Animals count reflects <em>today</em>, so Ending Count will match it exactly only when the report&apos;s end date is today; for a closed prior period the two are expected to differ.
            <br />
            Both counts reconstruct each animal&apos;s full intake/outcome history (including Return-to-Shelter re-intakes) rather than relying on today&apos;s status, and use the same in-care status list as the dashboard&apos;s Current Animals figure (see <code>isInCareStatus()</code> in lib/utils.ts) as a fallback only when no outcome record exists for the animal&apos;s current stay. Use &quot;Show Reconciliation&quot; above to see exactly which animals are behind each count.
          </div>
        </div>
      )}
    </AppShell>
  );
}
