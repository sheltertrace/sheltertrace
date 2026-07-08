import type { ClinicAnimal, ClinicMedicalRecord, ClinicProcedure, ClinicSettings } from "./clinicTypes";
import type { Animal, MedicalRecord } from "./types";

const DIAG_TYPES = new Set(["Heartworm Test","FIV/FeLV Combo Test","Parvo Test","Fecal Test","Urinalysis","FIV Test","FeLV Test","Other Test"]);
function isVaccine(t: string) { return t.includes("Vaccine"); }
function isTest(t: string) { return DIAG_TYPES.has(t) || t.includes("Test"); }
function fmtDate(d?: string) { if (!d) return "—"; const [y, m, day] = d.split("-"); return m && day ? `${m}/${day}/${y}` : d; }
function yn(v?: boolean | null) { return v === true ? "Yes" : v === false ? "No" : "—"; }
function resultBadge(r?: string) {
  if (!r) return "";
  const c = r === "Positive" ? "#dc2626" : r === "Negative" ? "#15803d" : "#b45309";
  const star = r === "Positive" ? "⚠️ " : "";
  return `<span style="font-weight:800;color:${c};print-color-adjust:exact;-webkit-print-color-adjust:exact;">${star}${r.toUpperCase()}</span>`;
}

function tbl(headers: string[], rows: string[][], accentColor = "#1a3a6b"): string {
  if (rows.length === 0) return `<div style="font-size:11px;color:#94a3b8;font-style:italic;padding:4px 0;">None recorded</div>`;
  const hCells = headers.map((h) => `<th style="padding:5px 8px;text-align:left;font-size:9px;font-weight:700;background:${accentColor};color:#fff;">${h}</th>`).join("");
  const rRows = rows.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};">${r.map((c) => `<td style="padding:4px 8px;font-size:10px;border-bottom:1px solid #e5e7eb;">${c}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;"><thead><tr>${hCells}</tr></thead><tbody>${rRows}</tbody></table>`;
}

function section(title: string, content: string) {
  return `<div style="margin-bottom:14px;"><div style="background:#1a3a6b;color:#fff;padding:4px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${title}</div>${content}</div>`;
}

export interface PrintOptions {
  includeVaccines: boolean;
  includeTests: boolean;
  includeMedications: boolean;
  includeProcedures: boolean;
  includeNotes: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export function buildClinicAnimalRecordHTML(
  animal: ClinicAnimal | Animal,
  settings: ClinicSettings,
  medRecords: (ClinicMedicalRecord | MedicalRecord)[],
  procedures: ClinicProcedure[],
  clientName: string,
  opts: PrintOptions,
): string {
  const name = animal.name || "Unknown";
  const vetLine = [settings.vet_name, settings.vet_credentials].filter(Boolean).join(", ");

  const filterDate = (d?: string) => {
    if (!d) return true;
    if (opts.dateFrom && d < opts.dateFrom) return false;
    if (opts.dateTo && d > opts.dateTo) return false;
    return true;
  };

    const getBy = (m: ClinicMedicalRecord | MedicalRecord): string => {
    const vet = "vet" in m ? (m as MedicalRecord).vet : undefined;
    const adm = "administered_by" in m ? (m as ClinicMedicalRecord).administered_by : undefined;
    return vet || adm || "—";
  };

  const meds = medRecords.filter((m) => filterDate(m.date || ""));
  const vaccines = meds.filter((m) => isVaccine(m.type || ""));
  const tests = meds.filter((m) => isTest(m.type || ""));
  const treatments = meds.filter((m) => !isVaccine(m.type || "") && !isTest(m.type || ""));
  const filteredProcs = procedures.filter((p) => filterDate(p.procedure_date || ""));

  const source = (m: ClinicMedicalRecord | MedicalRecord) =>
    "idexx_status" in m ? `<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;padding:1px 4px;border-radius:3px;">MCAS</span>` : `<span style="font-size:9px;background:#dcfce7;color:#15803d;padding:1px 4px;border-radius:3px;">Clinic</span>`;

  const vaccSection = !opts.includeVaccines ? "" : section("Vaccination History", tbl(
    ["Date", "Vaccine", "Lot #", "Manufacturer", "Next Due", "By"],
    vaccines.map((m) => [fmtDate(m.date || ""), m.type || "—", m.lot_number || "—", ("manufacturer" in m ? m.manufacturer : "") || "—", fmtDate(m.next_due || ""), getBy(m)])
  ));

  const testSection = !opts.includeTests ? "" : section("Diagnostic Test Results", tbl(
    ["Date", "Test", "Result", "By", "Source"],
    tests.map((m) => [fmtDate(m.date || ""), m.type || "—", resultBadge(("test_result" in m ? m.test_result : "") || "Pending"), getBy(m), source(m)])
  ));

  const medSection = !opts.includeMedications ? "" : section("Medications / Treatments", tbl(
    ["Date", "Medication", "Dosage", "Route", "By"],
    treatments.map((m) => [fmtDate(m.date || ""), m.description || m.type || "—", m.dosage || "—", m.route || "—", getBy(m)])
  ));

  const procSection = !opts.includeProcedures ? "" : section("Procedures & Surgeries", tbl(
    ["Date", "Procedure", "Outcome", "Performed By", "Cost"],
    filteredProcs.map((p) => [fmtDate(p.procedure_date || ""), p.procedure_type || "—", p.outcome || "—", p.performed_by || "—", p.cost ? `$${p.cost}` : "—"])
  ));

  return `<!DOCTYPE html><html><head><title>Animal Record — ${name}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:20px;font-size:11px;color:#111;}@media print{@page{size:letter;margin:0.75in;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a6b;padding-bottom:10px;margin-bottom:14px;">
    <div>
      ${settings.logo_url ? `<img src="${settings.logo_url}" style="height:36px;margin-bottom:4px;display:block;" />` : ""}
      <div style="font-size:15px;font-weight:900;color:#1a3a6b;">${settings.clinic_name || "Veterinary Clinic"}</div>
      <div style="font-size:10px;color:#475569;">${vetLine}</div>
      ${settings.license_number ? `<div style="font-size:9px;color:#64748b;">License: ${settings.license_number}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:900;color:#1a3a6b;text-transform:uppercase;">Animal Medical Record</div>
      <div style="font-size:10px;color:#64748b;">Printed ${new Date().toLocaleDateString()}</div>
      ${opts.dateFrom || opts.dateTo ? `<div style="font-size:10px;color:#64748b;">Period: ${opts.dateFrom || "all"} to ${opts.dateTo || "all"}</div>` : ""}
    </div>
  </div>

  ${section("Animal Information", `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;padding:8px;background:#f8fafc;border-radius:4px;">
      ${[
        ["Name", name], ["Species", animal.species || "—"],
        ["Breed", animal.breed || "—"], ["Color", animal.color || "—"],
        ["Sex", animal.sex || "—"], ["Age", animal.age || "—"],
        ["Weight", ("weight" in animal ? animal.weight : "") || "—"],
        ["Sterilized", yn("fixed" in animal ? animal.fixed : undefined)],
        ["Microchip", animal.microchip || "—"], ["County / Agency", clientName],
        ["Status", animal.status || "Active"],
      ].map(([l, v]) => `<div style="font-size:10px;"><span style="font-weight:700;color:#64748b;">${l}:</span> ${v}</div>`).join("")}
    </div>
  `)}

  ${vaccSection}${testSection}${medSection}${procSection}

  <div style="margin-top:20px;padding-top:12px;border-top:1px solid #d1d5db;display:grid;grid-template-columns:1fr 1fr;gap:30px;">
    <div><div style="border-bottom:1.5px solid #000;height:36px;"></div><div style="font-size:9px;color:#64748b;margin-top:3px;">Attending Veterinarian Signature</div><div style="font-size:10px;margin-top:2px;">${vetLine}</div></div>
    <div><div style="border-bottom:1.5px solid #000;height:36px;"></div><div style="font-size:9px;color:#64748b;margin-top:3px;">Date</div></div>
  </div>
  <div style="margin-top:12px;text-align:center;font-size:9px;color:#94a3b8;">
    Record generated by ${settings.clinic_name || "AWA Georgia"} · ShelterTrace
  </div>
  </body></html>`;
}

export function printClinicAnimalRecord(
  animal: ClinicAnimal | Animal,
  settings: ClinicSettings,
  medRecords: (ClinicMedicalRecord | MedicalRecord)[],
  procedures: ClinicProcedure[],
  clientName: string,
  opts: PrintOptions,
): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(buildClinicAnimalRecordHTML(animal, settings, medRecords, procedures, clientName, opts));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
