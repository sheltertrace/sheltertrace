import type { BiteReport, BiteVictimHumanData, BiteVictimAnimalData, BiteOwnerData, BiteInjuryData, BiteAnimalData } from "./biteReportTypes";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "./shelterInfo";

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}
function yn(v?: boolean | null): string { return v === true ? "Yes" : v === false ? "No" : "—"; }
function fld(label: string, value?: string | null): string {
  return `<div style="display:grid;grid-template-columns:140px 1fr;margin-bottom:4px;font-size:11px;"><span style="font-weight:700;color:#374151;">${label}:</span><span>${value || "—"}</span></div>`;
}
function section(title: string, content: string): string {
  return `<div style="margin-bottom:16px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden;">
    <div style="background:#1B3A5C;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${title}</div>
    <div style="padding:10px 12px;">${content}</div>
  </div>`;
}

export function buildBiteReportHTML(report: BiteReport): string {
  const animal = report.biting_animal_data as BiteAnimalData;
  const owner = report.owner_data as BiteOwnerData;
  const injury = report.injury_data as BiteInjuryData;
  const quar = report.quarantine_data;
  const isHuman = report.report_type === "animal_human";
  const humanVictim = isHuman ? report.victim_data as BiteVictimHumanData : null;
  const animalVictim = !isHuman ? report.victim_data as BiteVictimAnimalData : null;
  const typeLabel = isHuman ? "Animal to Human" : "Animal to Animal";

  const incidentSection = section("Section 1 — Incident Information", [
    fld("Report Number", report.report_number),
    fld("Date of Incident", fmtDate(report.incident_date)),
    fld("Time of Incident", report.incident_time),
    fld("Location", report.incident_address),
    fld("City", report.incident_city),
    fld("Location Type", report.incident_location_type),
    fld("Law Enforcement Notified", yn(report.law_enforcement_notified)),
    fld("LE Report Number", report.law_enforcement_report),
    fld("Investigating Officer", report.investigating_officer),
    fld("Report Date", fmtDate(new Date().toISOString().split("T")[0])),
  ].join(""));

  const animalSection = section("Section 2 — Biting/Attacking Animal", [
    fld("Animal Name", animal.name),
    fld("Species", animal.species),
    fld("Breed", animal.breed),
    fld("Color/Markings", animal.color),
    fld("Sex", animal.sex),
    fld("Age", animal.age),
    fld("Size", animal.size),
    fld("Microchip", animal.microchip),
    fld("Rabies Status", animal.rabies_status),
    fld("Rabies Tag #", animal.rabies_tag),
    fld("Rabies Expiration", fmtDate(animal.rabies_expiration)),
    fld("Veterinarian", animal.veterinarian),
    fld("Vet Phone", animal.vet_phone),
    fld("Disposition at Time", animal.disposition_at_time),
    fld("Was Animal Provoked", animal.was_provoked),
    fld("Current Status", animal.current_status),
  ].join(""));

  const ownerSection = section("Section 3 — Animal Owner Information", [
    fld("Owner Known", yn(owner.known)),
    fld("Name", owner.known ? `${owner.first_name} ${owner.last_name}` : "Unknown"),
    fld("Address", owner.known ? `${owner.address}, ${owner.city}, ${owner.state} ${owner.zip}` : ""),
    fld("Phone", owner.phone),
    fld("Email", owner.email),
    fld("Driver's License", owner.dl_number ? `${owner.dl_number} (${owner.dl_state})` : "—"),
    fld("Owner Cited", yn(owner.was_cited)),
    fld("Citation Number", owner.citation_number),
  ].join(""));

  const victimSection = isHuman
    ? section("Section 4 — Victim Information", [
        fld("Name", `${humanVictim!.first_name} ${humanVictim!.last_name}`),
        fld("Date of Birth", fmtDate(humanVictim!.dob)),
        fld("Address", `${humanVictim!.address}, ${humanVictim!.city}, ${humanVictim!.state} ${humanVictim!.zip}`),
        fld("Phone", humanVictim!.phone),
        fld("Sex", humanVictim!.sex),
        fld("Relationship to Animal", humanVictim!.relationship),
        fld("On Owner Property", humanVictim!.on_owner_property),
      ].join(""))
    : section("Section 3 — Victim Animal", [
        fld("Animal Name", animalVictim!.name),
        fld("Species", animalVictim!.species),
        fld("Breed", animalVictim!.breed),
        fld("Color", animalVictim!.color),
        fld("Rabies Status", animalVictim!.rabies_status),
        fld("Owner", `${animalVictim!.owner_first_name} ${animalVictim!.owner_last_name}`),
        fld("Owner Phone", animalVictim!.owner_phone),
      ].join(""));

  const injurySection = section(`Section ${isHuman ? "5" : "4"} — Injury Information`, [
    isHuman && injury.body_parts?.length ? fld("Body Parts", injury.body_parts.join(", ")) : "",
    fld("Severity", injury.severity),
    isHuman ? fld("Sought Medical Attention", yn(injury.sought_medical)) : "",
    isHuman ? fld("Medical Facility", injury.medical_facility) : "",
    isHuman ? fld("PEP Recommended", injury.pep_recommended) : "",
    isHuman ? fld("Treating Physician", injury.treating_physician) : "",
    !isHuman ? fld("Received Veterinary Treatment", yn(injury.vet_treated)) : "",
    !isHuman ? fld("Veterinary Clinic", injury.vet_clinic) : "",
    !isHuman ? fld("Estimated Vet Bill", injury.estimated_bill) : "",
    !isHuman ? fld("Seeking Restitution", yn(injury.seeking_restitution)) : "",
  ].filter(Boolean).join(""));

  const quarSection = section(`Section ${isHuman ? "6" : "5"} — Quarantine Information`, [
    fld("Quarantine Ordered", yn(report.quarantine_ordered)),
    fld("Quarantine Type", quar.type),
    fld("Start Date", fmtDate(quar.start_date)),
    fld("End Date", fmtDate(quar.end_date)),
    fld("Location", quar.location),
    fld("Contact", `${quar.contact_name} ${quar.contact_phone}`),
    fld("Check Dates", quar.check_dates?.join(", ")),
    fld("Released from Quarantine", yn(report.quarantine_released)),
    fld("Release Date", fmtDate(report.quarantine_release_date)),
  ].join(""));

  const dispositionSection = section(`Section ${isHuman ? "7" : "6"} — Officer Notes & Disposition`, [
    fld("Disposition", report.disposition),
    fld("Follow-up Required", yn(report.follow_up_required)),
    fld("Follow-up Date", fmtDate(report.follow_up_date)),
    `<div style="font-size:11px;margin-top:8px;"><strong>Narrative:</strong><div style="margin-top:4px;white-space:pre-wrap;line-height:1.5;">${report.narrative || "—"}</div></div>`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:24px;padding-top:12px;border-top:1px solid #d1d5db;">
      <div><div style="border-bottom:1.5px solid #000;height:36px;"></div><div style="font-size:9px;color:#64748b;margin-top:3px;">Investigating Officer Signature / Date</div><div style="font-size:10px;margin-top:2px;">${report.investigating_officer || "___________________________"}</div></div>
      <div><div style="border-bottom:1.5px solid #000;height:36px;"></div><div style="font-size:9px;color:#64748b;margin-top:3px;">Supervisor Signature / Date</div></div>
    </div>`,
  ].join(""));

  return `<!DOCTYPE html><html><head><title>Bite Report ${report.report_number || ""}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:18px;font-size:11px;color:#111;}@media print{@page{size:letter;margin:0.4in;}}</style>
  </head><body>
  <!-- Header -->
  <div style="border-bottom:3px solid #1B3A5C;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:16px;font-weight:900;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.5px;">${AGENCY_NAME}</div>
      <div style="font-size:10px;color:#475569;">${AGENCY_ADDRESS} · ${AGENCY_PHONE}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:900;color:#1B3A5C;">ANIMAL BITE REPORT</div>
      <div style="font-size:11px;color:#475569;">${typeLabel}</div>
      <div style="font-size:12px;font-weight:700;font-family:monospace;color:#1B3A5C;">${report.report_number || "DRAFT"}</div>
    </div>
  </div>

  ${incidentSection}
  ${animalSection}
  ${ownerSection}
  ${victimSection}
  ${injurySection}
  ${quarSection}
  ${dispositionSection}

  <div style="margin-top:14px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;">
    ${AGENCY_NAME} · Bite Report · Printed ${new Date().toLocaleString()} · Page 1 of 1
  </div>
  </body></html>`;
}

export function printBiteReport(report: BiteReport): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(buildBiteReportHTML(report));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
