import type { BiteReport, BiteVictimHumanData, BiteOwnerData, BiteInjuryData, BiteAnimalData, AttackingAnimalEntry, VictimAnimalEntry } from "./biteReportTypes";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "./shelterInfo";

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}
function yn(v?: string | boolean | null): string {
  if (v === true || v === "yes") return "Yes";
  if (v === false || v === "no") return "No";
  if (v === "unknown") return "Unknown";
  return "Not Recorded";
}
function fld(label: string, value?: string | null): string {
  return `<div style="display:grid;grid-template-columns:150px 1fr;margin-bottom:4px;font-size:11px;"><span style="font-weight:700;color:#374151;">${label}:</span><span>${value || "—"}</span></div>`;
}
function section(title: string, content: string): string {
  return `<div style="margin-bottom:14px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden;">
    <div style="background:#1B3A5C;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${title}</div>
    <div style="padding:10px 12px;">${content}</div>
  </div>`;
}
function subSection(title: string, content: string): string {
  return `<div style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:10px;">
    <div style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">${title}</div>
    ${content}
  </div>`;
}

// ── Attacking animal section builder ─────────────────────────────────────────

function buildAttackingAnimalHTML(entry: AttackingAnimalEntry, idx: number, total: number): string {
  const a = entry.animal;
  const o = entry.owner;
  const heading = total > 1 ? `Attacking Animal ${idx + 1} of ${total}` : "Attacking Animal";

  const animalFields = [
    fld("Animal Name", a.name),
    fld("Species", a.species),
    fld("Breed", a.breed),
    fld("Color/Markings", a.color),
    fld("Sex", a.sex),
    fld("Age", a.age),
    fld("Microchip", a.microchip),
    fld("Rabies Status", a.rabies_status),
    fld("Rabies Tag #", a.rabies_tag),
    fld("Rabies Expiration", fmtDate(a.rabies_expiration)),
    fld("Veterinarian", a.veterinarian),
    fld("Vet Phone", a.vet_phone),
    fld("Disposition at Time", a.disposition_at_time),
    fld("Was Animal Provoked", a.was_provoked),
    fld("Current Status", a.current_status),
  ].join("");

  const ownerFields = [
    fld("Owner Known", yn(o.known)),
    fld("Name", o.known ? `${o.first_name} ${o.last_name}` : "Unknown"),
    fld("Address", o.known ? [o.address, o.city, o.state, o.zip].filter(Boolean).join(", ") : ""),
    fld("Primary Phone", o.phone),
    fld("Email", o.email),
    fld("Driver's License", o.dl_number ? `${o.dl_number} (${o.dl_state})` : "—"),
    fld("Was Present at Attack", yn(entry.was_owner_present)),
    fld("Owner Cited", yn(o.was_cited)),
    fld("Citation Number", o.citation_number),
  ].join("");

  return section(heading, animalFields + subSection("Owner Information", ownerFields));
}

// ── Victim animal section builder ─────────────────────────────────────────────

function buildVictimAnimalHTML(entry: VictimAnimalEntry, idx: number, total: number): string {
  const a = entry.animal;
  const o = entry.owner;
  const inj = entry.injury;
  const heading = total > 1 ? `Victim Animal ${idx + 1} of ${total}` : "Victim Animal";

  const animalFields = [
    fld("Animal Name", a.name),
    fld("Species", a.species),
    fld("Breed", a.breed),
    fld("Color", a.color),
    fld("Sex", a.sex),
    fld("Age", a.age),
    fld("Microchip", a.microchip),
    fld("Rabies Status", a.rabies_status),
    fld("Rabies Tag #", a.rabies_tag),
    fld("Veterinarian", a.veterinarian),
    fld("Vet Phone", a.vet_phone),
  ].join("");

  const ownerFields = [
    fld("Owner Known", yn(o.known)),
    fld("Name", o.known ? `${o.first_name} ${o.last_name}` : "Unknown"),
    fld("Address", o.known ? [o.address, o.city, o.state, o.zip].filter(Boolean).join(", ") : ""),
    fld("Primary Phone", o.phone),
    fld("Secondary Phone", o.phone2),
    fld("Email", o.email),
    fld("Was Present During Incident", yn(o.was_present)),
    fld("Seeking Restitution", yn(o.seeking_restitution)),
    fld("Estimated Vet Costs", o.estimated_vet_costs),
  ].join("");

  const injFields = [
    inj.body_parts?.length ? fld("Body Parts Injured", inj.body_parts.join(", ")) : "",
    fld("Severity", inj.severity),
    fld("Received Vet Treatment", yn(inj.vet_treated)),
    inj.vet_treated ? fld("Veterinary Clinic", inj.vet_clinic) : "",
    fld("Estimated Vet Bill", inj.estimated_bill),
  ].filter(Boolean).join("");

  return section(
    heading,
    animalFields +
    subSection("Victim Owner Information", ownerFields) +
    subSection("Injury Information", injFields)
  );
}

// ── Main HTML builder ─────────────────────────────────────────────────────────

export function buildBiteReportHTML(report: BiteReport): string {
  const injury = report.injury_data as BiteInjuryData;
  const quar = report.quarantine_data;
  const isHuman = report.report_type === "animal_human";
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

  // ── Animal to Human sections ───────────────────────────────────────────────
  let animalSections = "";
  let victimSections = "";
  let injurySectionNum = "5";

  if (isHuman) {
    const animal = report.biting_animal_data as BiteAnimalData;
    const owner = report.owner_data as BiteOwnerData;
    const humanVictim = report.victim_data as BiteVictimHumanData;

    animalSections = section("Section 2 — Biting Animal", [
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

    victimSections = ownerSection + section("Section 4 — Victim Information", [
      fld("Name", `${humanVictim.first_name} ${humanVictim.last_name}`),
      fld("Date of Birth", fmtDate(humanVictim.dob)),
      fld("Address", `${humanVictim.address}, ${humanVictim.city}, ${humanVictim.state} ${humanVictim.zip}`),
      fld("Phone", humanVictim.phone),
      fld("Sex", humanVictim.sex),
      fld("Relationship to Animal", humanVictim.relationship),
      fld("On Owner Property", humanVictim.on_owner_property),
    ].join(""));

    injurySectionNum = "5";
  } else {
    // ── Animal to Animal: multi-animal arrays ─────────────────────────────
    const attackingAnimals = Array.isArray(report.biting_animal_data)
      ? (report.biting_animal_data as AttackingAnimalEntry[])
      : [];
    const victimAnimals = Array.isArray(report.victim_data)
      ? (report.victim_data as VictimAnimalEntry[])
      : [];

    const attackingHeader = `<div style="font-size:12px;font-weight:700;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;">Section 2 — Attacking Animal${attackingAnimals.length > 1 ? `s (${attackingAnimals.length})` : ""}</div>`;
    animalSections = attackingHeader + attackingAnimals.map((entry, idx) =>
      buildAttackingAnimalHTML(entry, idx, attackingAnimals.length)
    ).join("");

    const victimHeader = `<div style="font-size:12px;font-weight:700;color:#1B3A5C;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;margin-top:14px;">Section 3 — Victim Animal${victimAnimals.length > 1 ? `s (${victimAnimals.length})` : ""}</div>`;
    victimSections = victimHeader + victimAnimals.map((entry, idx) =>
      buildVictimAnimalHTML(entry, idx, victimAnimals.length)
    ).join("");

    injurySectionNum = "";
  }

  const injurySection = isHuman ? section(`Section ${injurySectionNum} — Bite/Injury Information`, [
    injury.body_parts?.length ? fld("Body Parts", injury.body_parts.join(", ")) : "",
    fld("Severity", injury.severity),
    fld("Sought Medical Attention", yn(injury.sought_medical)),
    fld("Medical Facility", injury.medical_facility),
    fld("PEP Recommended", injury.pep_recommended),
    fld("Treating Physician", injury.treating_physician),
  ].filter(Boolean).join("")) : "";

  const quarSectionNum = isHuman ? "6" : "4";
  const quarSection = section(`Section ${quarSectionNum} — Quarantine Information`, [
    fld("Quarantine Ordered", yn(report.quarantine_ordered)),
    fld("Quarantine Type", quar.type),
    fld("Start Date", fmtDate(quar.start_date)),
    fld("End Date", fmtDate(quar.end_date)),
    fld("Location", quar.location),
    fld("Contact", [quar.contact_name, quar.contact_phone].filter(Boolean).join(" ")),
    fld("Check Dates", quar.check_dates?.join(", ")),
    fld("Released from Quarantine", yn(report.quarantine_released)),
    fld("Release Date", fmtDate(report.quarantine_release_date)),
  ].join(""));

  const dispSectionNum = isHuman ? "7" : "5";
  const dispositionSection = section(`Section ${dispSectionNum} — Officer Notes & Disposition`, [
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
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:18px;font-size:11px;color:#111;}@media print{@page{size:letter;margin:0.4in;}.page-break{page-break-before:always;}}</style>
  </head><body>
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
  ${animalSections}
  ${victimSections}
  ${injurySection}
  ${quarSection}
  ${dispositionSection}

  <div style="margin-top:14px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;">
    ${AGENCY_NAME} · Bite Report · Printed ${new Date().toLocaleString()}
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
