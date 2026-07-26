import type { Animal, Person, EuthanasiaLog } from "./types";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE, STATEMENT_OF_SURRENDER_TEXT } from "./shelterInfo";

const INTAKE_METHOD_OPTIONS = ["Office Intake", "Field Intake", "Cage Trap", "Owner Surrender"];
const TAIL_OPTIONS = ["Long", "Short", "Bush", "Docked", "Curly"];
const EAR_OPTIONS = ["Drooping", "Erect", "Semi-Erect", "Rose Cut", "Cropped"];
const COAT_OPTIONS = ["Smooth", "Medium", "Long", "Wire Hair", "Curly"];

export interface IntakeFormOptions {
  ownerPerson?: Person | null;
  finderPerson?: Person | null;
  euthanasiaLogs?: EuthanasiaLog[];
}

function box(checked: boolean, label: string): string {
  return `<span style="margin-right:14px;font-size:10px;white-space:nowrap;">${checked ? "☒" : "☐"} ${label}</span>`;
}
function line(label: string, value?: string | null, minW = 160): string {
  return `<div style="display:inline-flex;flex-direction:column;gap:1px;margin-right:14px;margin-bottom:8px;">
    <div style="border-bottom:1px solid #000;min-width:${minW}px;padding-bottom:2px;font-size:10px;">${value || "&nbsp;"}</div>
    <div style="font-size:8.5px;color:#555;">${label}</div>
  </div>`;
}
function sectionHead(title: string): string {
  return `<div style="background:#0f2942;color:#fff;padding:4px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 8px;">${title}</div>`;
}
function sigLine(label: string, signatureDataUrl?: string | null): string {
  return `<div style="margin-top:10px;">
    ${signatureDataUrl
      ? `<img src="${signatureDataUrl}" style="height:50px;display:block;border-bottom:1px solid #000;" />`
      : `<div style="height:50px;border-bottom:1px solid #000;"></div>`}
    <div style="font-size:8.5px;color:#555;margin-top:2px;">${label}</div>
  </div>`;
}

export function buildIntakeFormHTML(animal: Partial<Animal> | null, opts: IntakeFormOptions = {}): string {
  const a = animal || ({} as Partial<Animal>);
  const { ownerPerson, finderPerson, euthanasiaLogs = [] } = opts;
  const isBlank = !animal;
  const isSurrender = a.intake_type === "Surrender";
  const isStray = a.intake_type === "Stray";
  const showEuthanasia = a.status === "Euthanized" || a.status === "Died in Care";

  const ownerAddr = ownerPerson ? [ownerPerson.address, ownerPerson.city, ownerPerson.state, ownerPerson.zip].filter(Boolean).join(", ") : "";
  const finderAddr = finderPerson ? [finderPerson.address, finderPerson.city, finderPerson.state, finderPerson.zip].filter(Boolean).join(", ") : "";

  const ownerBlock = `
    <div style="border:1px solid #cbd5e1;border-radius:4px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Owner Surrender</div>
      ${line("Owner Name", ownerPerson ? `${ownerPerson.first_name} ${ownerPerson.last_name}` : "", 220)}
      ${line("Phone", ownerPerson?.phone, 140)}
      ${line("Address", ownerAddr, 320)}
      ${sigLine("Owner Signature", a.surrender_signature)}
    </div>`;

  const finderBlock = `
    <div style="border:1px solid #cbd5e1;border-radius:4px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Finder</div>
      ${line("Finder Name", finderPerson ? `${finderPerson.first_name} ${finderPerson.last_name}` : "", 220)}
      ${line("Phone", finderPerson?.phone, 140)}
      ${line("Address", finderAddr, 320)}
      <div style="margin:6px 0;">
        ${box(!!a.finder_wants_if_unclaimed, "Wants to keep animal if unclaimed")}
        ${box(!!a.finder_wants_adoption_contact, "Wants to be contacted re: adoption")}
      </div>
      ${line("Location Found", [a.found_address, a.found_city].filter(Boolean).join(", "), 320)}
      ${sigLine("Finder Signature", a.finder_signature)}
    </div>`;

  const statementBlock = `
    <div style="border:1px solid #cbd5e1;border-radius:4px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;margin-bottom:6px;">Statement of Surrender</div>
      <div style="font-size:9.5px;line-height:1.6;color:#1f2937;margin-bottom:8px;">${STATEMENT_OF_SURRENDER_TEXT}</div>
      ${box(!!a.statement_of_surrender_acknowledged, "I have read and agree to the Statement of Surrender")}
    </div>`;

  const euthRows = euthanasiaLogs.map((log) => `
    <div style="border-bottom:1px solid #e5e7eb;padding:6px 0;">
      ${line("Euthanized Date", log.log_date, 100)}
      ${line("ACO", log.administered_by_name, 140)}
      ${line("Drug", log.drug_name, 140)}
      ${line("Bottle #", log.bottle_id || log.lot_number, 100)}
      ${line("Amount (cc)", log.dosage_administered_ml != null ? String(log.dosage_administered_ml) : "", 80)}
      <div style="margin:4px 0;">
        ${box((log.route || "").toUpperCase() === "IV", "IV")}
        ${box((log.route || "").toUpperCase() === "IC", "IC")}
        ${box((log.route || "").toUpperCase() === "IP", "IP")}
      </div>
      ${line("Reason", log.reason, 260)}
      ${log.witness_name ? line("Witness", log.witness_name, 200) : ""}
    </div>`).join("");

  const euthanasiaSection = showEuthanasia ? `
    ${sectionHead("Euthanasia Log")}
    ${euthanasiaLogs.length === 0
      ? `<div style="font-size:10px;color:#94a3b8;font-style:italic;">No euthanasia log entries on file for this animal.</div>`
      : euthRows}
  ` : "";

  return `<!DOCTYPE html><html><head>
<title>MCAS Animal Intake Form${a.id ? ` — ${a.id}` : ""}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 22px; font-size: 10px; line-height: 1.5; }
  @media print { @page { size: letter; margin: 14mm; } }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
</style>
</head><body>

  <div class="no-print" style="margin-bottom:14px;">
    <button onclick="window.print()" style="background:#0f2942;color:#fff;border:none;padding:8px 20px;border-radius:5px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save as PDF</button>
  </div>

  <div style="border-bottom:3px solid #0f2942;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:16px;font-weight:900;letter-spacing:0.3px;color:#0f2942;text-transform:uppercase;">${AGENCY_NAME}</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:2px;">${AGENCY_ADDRESS} · ${AGENCY_PHONE}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:800;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">Animal Intake Form</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:2px;">${isBlank ? "Blank Form" : `Printed ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}</div>
    </div>
  </div>

  ${sectionHead("To Be Completed By Public")}
  ${isBlank ? `${ownerBlock}${finderBlock}${statementBlock}` : isSurrender ? `${ownerBlock}${statementBlock}` : isStray ? finderBlock : ""}

  ${sectionHead("Staff Use — Intake Details")}
  <div>
    ${line("Animal ID#", a.id, 110)}
    ${line("Case #", a.case_number, 110)}
    ${line("Employee", a.processed_by_employee, 140)}
    ${line("AC#", a.aco_record, 110)}
    ${line("Date of Impound", a.intake_date, 110)}
    ${line("Pen #", a.kennel, 80)}
  </div>
  <div style="margin:6px 0;">
    ${box(a.species === "Dog", "Dog")}
    ${box(a.species === "Cat", "Cat")}
    ${box(!!a.species && a.species !== "Dog" && a.species !== "Cat", "Other")}
  </div>
  <div style="margin:6px 0;">
    ${INTAKE_METHOD_OPTIONS.map((m) => box(a.intake_method === m, m)).join("")}
  </div>
  ${line("Location Found", [a.found_address, a.found_city].filter(Boolean).join(", "), 260)}
  ${line("Microchip #", a.microchip, 200)}

  ${sectionHead("Staff Use — Animal Description")}
  <div>
    ${line("Breed", a.breed, 180)}
    ${line("Color", [a.color, a.secondary_color].filter(Boolean).join(" / "), 180)}
    ${line("Collar / Tag", a.collar_tag, 180)}
    ${line("Vet", a.owner_vet, 160)}
    ${line("Vet's Phone", a.owner_vet_phone, 140)}
    ${line("Rabies Tag #", a.rabies_tag, 120)}
  </div>
  <div style="margin:8px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Tail</div>
  <div style="margin-bottom:6px;">${TAIL_OPTIONS.map((t) => box(a.tail_type === t, t)).join("")}</div>
  <div style="margin:6px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Ears</div>
  <div style="margin-bottom:6px;">${EAR_OPTIONS.map((t) => box(a.ears_type === t, t)).join("")}</div>
  <div style="margin:6px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Coat</div>
  <div style="margin-bottom:6px;">${COAT_OPTIONS.map((t) => box(a.coat_type_detail === t, t)).join("")}</div>
  <div style="margin:6px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Sex / Alteration</div>
  <div style="margin-bottom:6px;">
    ${box(a.sex === "Male", "Male")}
    ${box(a.sex === "Female", "Female")}
    ${box(a.sex === "Female" && !!a.fixed, "Spayed")}
    ${box(a.sex === "Male" && !!a.fixed, "Neutered")}
  </div>
  ${line("Distinguishing Features", a.distinguishing_features, 400)}

  ${sectionHead("Intake Condition & Behavior Assessment")}
  <div>
    ${line("Body Condition Score (1–9)", a.body_condition_score != null ? String(a.body_condition_score) : "", 100)}
    ${line("Weight (lbs)", a.weight, 100)}
    ${line("Estimated Age", a.age, 120)}
  </div>
  <div style="margin:6px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Condition</div>
  <div style="margin-bottom:6px;">
    ${box(!!a.condition_visible_injury, "Visible Injury")}
    ${box(!!a.condition_signs_of_illness, "Signs of Illness")}
    ${box(!!a.condition_parasites_observed, "Parasites Observed")}
    ${box(!!a.condition_pregnant_nursing, "Pregnant / Nursing")}
  </div>
  <div style="margin:6px 0 2px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;">Behavior</div>
  <div style="margin-bottom:6px;">
    ${box((a.intake_behavior || "").includes("Friendly/Approachable"), "Friendly / Approachable")}
    ${box((a.intake_behavior || "").includes("Fearful/Skittish"), "Fearful / Skittish")}
    ${box((a.intake_behavior || "").includes("Aggressive"), "Aggressive")}
    ${box((a.intake_behavior || "").includes("Feral/Unhandleable"), "Feral / Unhandleable")}
  </div>
  ${line("Staff Notes / Observations", a.injuries, 500)}
  <div style="margin-top:6px;">
    ${line("Assessed By (Initials)", a.assessed_by_initials, 100)}
    ${line("Date", a.assessment_date, 100)}
  </div>

  ${sectionHead("Disposition")} <span style="font-size:9px;color:#94a3b8;">(updated later, not recorded at intake)</span>
  <div style="margin:6px 0;">
    ${box(a.status === "Adopted", "Adopted")}
    ${box(a.status === "Transferred", "Transferred / Rescue")}
    ${box(a.status === "Returned to Owner" || a.sub_status === "Returned to Owner", "Returned to Owner")}
    ${box(a.status === "Euthanized", "Euthanized")}
  </div>

  ${euthanasiaSection}

  <div style="margin-top:16px;text-align:center;font-size:8.5px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;">
    ${AGENCY_NAME} · Animal Intake Form · Printed ${new Date().toLocaleString()}
  </div>

</body></html>`;
}

export function printIntakeForm(animal: Partial<Animal> | null, opts: IntakeFormOptions = {}): void {
  const w = window.open("", "_blank", "width=860,height=1100");
  if (!w) return;
  w.document.write(buildIntakeFormHTML(animal, opts));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
