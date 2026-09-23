import type {
  DispatchCall, DispatchCallPerson, DispatchCallAnimal, Citation, WitnessStatement, ShelterForm,
  NarrativeEntry, MedicalRecord, Person, SceneAnimal, EvidenceItem, Animal, StaffAccount,
} from "../types";
import type { BiteReport } from "../biteReportTypes";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "../shelterInfo";
import { esc, fld, wrapDocument, LOGO_TOKEN } from "./htmlUtil";

// ── Model ─────────────────────────────────────────────────────────────────────

export type SectionId =
  | "cover" | "callReview" | "narrativeHistory" | "people" | "animals" | "citations"
  | "bites" | "witnesses" | "photos" | "intake" | "medical" | "quarantine" | "documents";

// Everything the packet draws from, already loaded by the dispatch page.
export interface PacketInputs {
  call: DispatchCall;
  callNumber: string;
  status: string;
  people: DispatchCallPerson[];
  animalLinks: DispatchCallAnimal[];
  citations: Citation[];
  biteReports: BiteReport[];
  witnessStatements: WitnessStatement[];
  forms: ShelterForm[];
  narrative: NarrativeEntry[];
  // The page's own print builders, reused as-is so the packet's Call Review
  // and edit history are byte-for-byte what "Print Call Review" produces.
  buildCallReviewHtml: () => string;
  buildNarrativeHistoryHtml: () => string;
}

// Loaded when the dialog opens (needs extra queries).
export interface PacketExtras {
  // Records for impounded animals, already limited to intake-forward.
  medicalByAnimal: Record<string, MedicalRecord[]>;
  intakePeople: Record<string, { owner?: Person; finder?: Person }>;
}

export interface SectionDef {
  id: SectionId;
  label: string;   // "Citations Issued (2)"
  count: number;
  available: boolean;
}

export const COURT_PACKET_EVIDENCE_TYPE = "Court Packet";

// ── Classification helpers ────────────────────────────────────────────────────

export function evidenceUrl(e: EvidenceItem): string | undefined {
  return e.url || e.file_url || undefined;
}

export function isImageEvidence(e: EvidenceItem): boolean {
  const t = (e.file_type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  const name = (e.file_name || evidenceUrl(e) || "").toLowerCase().split("?")[0];
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/.test(name);
}

// Court packets previously saved to the call are evidence items too — never
// fold an earlier packet into the next one.
export function callEvidence(call: DispatchCall): EvidenceItem[] {
  return ((call.evidence || []) as EvidenceItem[]).filter((e) => e.type !== COURT_PACKET_EVIDENCE_TYPE);
}
export function photoEvidence(call: DispatchCall): EvidenceItem[] {
  return callEvidence(call).filter((e) => !!evidenceUrl(e) && isImageEvidence(e));
}
export function documentEvidence(call: DispatchCall): EvidenceItem[] {
  return callEvidence(call).filter((e) => !!evidenceUrl(e) && !isImageEvidence(e));
}

export function impoundedAnimals(links: DispatchCallAnimal[]): DispatchCallAnimal[] {
  return links.filter((l) => l.role === "Impounded");
}

export function editedNarrative(narrative: NarrativeEntry[]): NarrativeEntry[] {
  return narrative.filter((n) => n.edited);
}
function editCount(n: NarrativeEntry): number {
  return n.edit_count || n.edit_history?.length || 1;
}

export function quarantineRows(inputs: Pick<PacketInputs, "forms" | "biteReports">) {
  return {
    forms: inputs.forms.filter((f) => f.form_type === "rabies_quarantine"),
    bites: inputs.biteReports.filter((b) => b.quarantine_ordered === "Yes" || (b.quarantine_ordered as unknown) === true || b.quarantine_data?.ordered === true),
  };
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// ── Section list (drives the dialog's checklist) ──────────────────────────────

export function describeSections(inputs: PacketInputs, extras: PacketExtras): SectionDef[] {
  const roleCount = (role: string) => inputs.people.filter((p) => p.role === role && !p.skipped).length;
  const peopleParts = [
    [roleCount("Suspect"), "suspect"], [roleCount("Victim"), "victim"], [roleCount("Witness"), "witness", "witnesses"],
    [roleCount("Complainant"), "complainant"], [roleCount("Owner"), "owner"], [roleCount("Other"), "other"],
  ].filter(([n]) => (n as number) > 0).map(([n, one, many]) => plural(n as number, one as string, many as string | undefined));
  const skippedRoles = inputs.people.filter((p) => p.skipped).map((p) => p.role.toLowerCase());

  const linked = inputs.animalLinks;
  const impounded = impoundedAnimals(linked).length;
  const otherLinked = linked.length - impounded;
  const scene = (inputs.call.scene_animals || []) as SceneAnimal[];
  const sceneCount = scene.reduce((s, a) => s + (a.count || 1), 0);
  const animalParts = [impounded ? `${impounded} impounded` : "", otherLinked ? `${otherLinked} other linked` : "", sceneCount ? `${sceneCount} informational` : ""].filter(Boolean);

  const edited = editedNarrative(inputs.narrative);
  const edits = edited.reduce((s, n) => s + editCount(n), 0);
  const medicalCount = Object.values(extras.medicalByAnimal).reduce((s, r) => s + r.length, 0);
  const q = quarantineRows(inputs);
  const qCount = q.forms.length + q.bites.length;
  const photos = photoEvidence(inputs.call).length;
  const docs = documentEvidence(inputs.call).length;

  const defs: SectionDef[] = [
    { id: "cover", label: "Cover Page", count: 1, available: true },
    { id: "callReview", label: "Call Review (call details + narrative)", count: 1, available: true },
    { id: "narrativeHistory", label: `Narrative Edit History (${plural(edits, "edit")})`, count: edits, available: edits > 0 },
    { id: "people", label: `People on Scene (${[...peopleParts, ...(skippedRoles.length ? [`${skippedRoles.join(", ")} skipped`] : [])].join(", ")})`, count: inputs.people.length, available: inputs.people.length > 0 },
    { id: "animals", label: `Animals on Scene (${animalParts.join(", ")})`, count: linked.length + scene.length, available: linked.length + scene.length > 0 },
    { id: "citations", label: `Citations Issued (${inputs.citations.length})`, count: inputs.citations.length, available: inputs.citations.length > 0 },
    { id: "bites", label: `Bite Reports (${inputs.biteReports.length})`, count: inputs.biteReports.length, available: inputs.biteReports.length > 0 },
    { id: "witnesses", label: `Witness Statements (${inputs.witnessStatements.length})`, count: inputs.witnessStatements.length, available: inputs.witnessStatements.length > 0 },
    { id: "photos", label: `Photos and Evidence (${photos})`, count: photos, available: photos > 0 },
    { id: "intake", label: `Animal Intake Forms (${impounded})`, count: impounded, available: impounded > 0 },
    { id: "medical", label: `Medical Records for impounded animals (${medicalCount})`, count: medicalCount, available: medicalCount > 0 },
    { id: "quarantine", label: `Quarantine Records (${qCount})`, count: qCount, available: qCount > 0 },
    { id: "documents", label: `Documents attached to the call (${docs})`, count: docs, available: docs > 0 },
  ];
  return defs.filter((d) => d.available);
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmtDate = (d = new Date()) => d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const fmtDateTime = (d = new Date()) => `${fmtDate(d)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
export const staffName = (u: StaffAccount) => `${u.first_name || u.firstName || ""} ${u.last_name || u.lastName || ""}`.trim() || u.username;

function dispositionOf(call: DispatchCall): string {
  const line = (call.response_notes || "").split("\n").find((l) => l.startsWith("Disposition:"));
  return line ? line.slice(12).trim() : "";
}

// ── Cover ─────────────────────────────────────────────────────────────────────

export interface TocEntry { label: string; page: number }

export function buildCoverHtml(inputs: PacketInputs, user: StaffAccount, toc: TocEntry[]): string {
  const c = inputs.call;
  const officers = (c.assigned_officers || []) as Array<{ name: string; badge?: string }>;
  const disposition = dispositionOf(c);
  // Compact on purpose: with every section selected the TOC has 13 rows, and
  // the cover must stay a single page.
  return wrapDocument(`
    <div style="text-align:center;border-bottom:3px solid #0f2942;padding-bottom:10px;margin-bottom:14px">
      <img src="${LOGO_TOKEN}" alt="" style="width:74px;height:74px;object-fit:contain" />
      <div style="font-size:19px;font-weight:900;letter-spacing:.4px;color:#0f2942;margin-top:4px;text-transform:uppercase">${esc(AGENCY_NAME)}</div>
      <div style="font-size:11px;color:#475569;margin-top:2px">${esc(AGENCY_ADDRESS)} &nbsp;·&nbsp; ${esc(AGENCY_PHONE)}</div>
    </div>
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:24px;font-weight:900;letter-spacing:1px;color:#0f2942">DISPATCH CALL PACKET</div>
      <div style="font-size:14px;font-weight:700;color:#1e3a5f;margin-top:3px;font-family:monospace">${esc(inputs.callNumber)}</div>
    </div>
    <section style="margin-bottom:10px">
      ${fld("Call Number", inputs.callNumber)}
      ${fld("Call Type", c.type)}
      ${fld("Date of Incident", `${c.date_reported || ""}${c.time_reported ? " at " + c.time_reported : ""}`)}
      ${fld("Address", [c.address, c.city].filter(Boolean).join(", "))}
      ${fld("Assigned Officer(s)", officers.map((o) => o.name + (o.badge ? ` (Badge #${o.badge})` : "")).join("; ") || "None assigned")}
      ${fld("Status", inputs.status)}
      ${fld("Disposition", disposition || "Not recorded")}
    </section>
    <div style="font-size:11px;color:#475569;margin-bottom:12px">
      Packet generated by <strong>${esc(staffName(user))}</strong> on ${esc(fmtDateTime())}.
    </div>
    <section>
      <div class="st">Contents</div>
      <table>
        <tr><th style="padding:3px 8px">Section</th><th style="width:70px;text-align:right;padding:3px 8px">Page</th></tr>
        ${toc.map((t) => `<tr><td style="padding:3px 8px">${esc(t.label)}</td><td style="text-align:right;padding:3px 8px">${t.page}</td></tr>`).join("")}
      </table>
    </section>`, "Dispatch Call Packet");
}

// ── Certification (final page) ────────────────────────────────────────────────

export function buildCertificationHtml(inputs: PacketInputs, user: StaffAccount, totalPages: number): string {
  return wrapDocument(`
    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #0f2942;padding-bottom:12px;margin-bottom:26px">
      <img src="${LOGO_TOKEN}" alt="" style="width:58px;height:58px;object-fit:contain" />
      <div>
        <div style="font-size:15px;font-weight:900;color:#0f2942;text-transform:uppercase">${esc(AGENCY_NAME)}</div>
        <div style="font-size:10px;color:#475569">${esc(AGENCY_ADDRESS)} · ${esc(AGENCY_PHONE)}</div>
      </div>
    </div>
    <div style="font-size:16px;font-weight:900;letter-spacing:.8px;color:#0f2942;text-transform:uppercase;margin-bottom:6px">Certification of Records</div>
    <div style="font-size:11px;color:#475569;font-family:monospace;margin-bottom:22px">${esc(inputs.callNumber)}</div>
    <p style="font-size:13px;line-height:1.8;margin-bottom:34px">
      This packet contains <strong>${totalPages}</strong> pages and was generated from ${esc(AGENCY_NAME)} records on
      <strong>${esc(fmtDate())}</strong> by <strong>${esc(staffName(user))}</strong>, ${esc(user.role || "Staff")}.
    </p>
    <div style="margin-top:60px;width:340px">
      <div style="border-bottom:1px solid #000;height:34px"></div>
      <div style="font-size:10px;color:#475569;margin-top:4px">Signature</div>
      <div style="border-bottom:1px solid #000;height:26px;margin-top:22px"></div>
      <div style="font-size:10px;color:#475569;margin-top:4px">Printed name and title</div>
      <div style="border-bottom:1px solid #000;height:26px;width:160px;margin-top:22px"></div>
      <div style="font-size:10px;color:#475569;margin-top:4px">Date</div>
    </div>`, "Certification");
}

// ── People on Scene ───────────────────────────────────────────────────────────

const ROLE_ORDER: Array<[string, string]> = [
  ["Suspect", "SUSPECT"], ["Victim", "VICTIM"], ["Witness", "WITNESS"],
  ["Complainant", "COMPLAINANT"], ["Owner", "OWNER"], ["Other", "OTHER PERSON"],
];

export function buildPeopleHtml(inputs: PacketInputs): string {
  const body = ROLE_ORDER.map(([role, title]) => {
    const rows = inputs.people.filter((p) => p.role === role);
    const active = rows.filter((p) => !p.skipped);
    const skip = rows.find((p) => p.skipped);
    if (rows.length === 0) return "";
    if (active.length === 0 && skip) {
      const when = skip.added_at ? ` on ${fmtDate(new Date(skip.added_at))}` : "";
      return `<section><div class="st">${esc(title)}S</div><div>No ${esc(role.toLowerCase())} identified — skipped by ${esc(skip.added_by || "Unknown")}${esc(when)}.</div></section>`;
    }
    return active.map((p, i) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed";
      const addr = [p.address, [p.city, p.state].filter(Boolean).join(", "), p.zip].filter(Boolean).join(" ");
      return `<section class="card">
        <div class="st">${esc(title)} ${i + 1} OF ${active.length}: ${esc(name)}</div>
        ${fld("Address", addr)}${fld("Phone", p.phone)}${fld("Email", p.email)}
        ${fld("Date of Birth", p.dob)}${fld("Driver's License #", p.drivers_license)}
        ${fld("Physical Description", p.physical_description)}${fld("Notes", p.notes)}
        ${p.person?.pid ? fld("ShelterTrace Person ID", p.person.pid) : ""}
        ${fld("Added by", p.added_by ? `${p.added_by}${p.added_at ? " — " + fmtDateTime(new Date(p.added_at)) : ""}` : "")}
      </section>`;
    }).join("");
  }).join("");
  return wrapDocument(body || `<div class="muted">No people recorded on this call.</div>`, "People on Scene");
}

// ── Animals on Scene ──────────────────────────────────────────────────────────

export function buildAnimalsHtml(inputs: PacketInputs): string {
  const scene = (inputs.call.scene_animals || []) as SceneAnimal[];
  const linked = inputs.animalLinks.map((l) => {
    const a: Animal | undefined = l.animal;
    if (!a) {
      return `<section class="card"><div class="st">${esc(l.animal_id)} — ${esc(l.role)}</div><div class="muted">Animal record no longer available.</div>${fld("Link notes", l.notes)}</section>`;
    }
    const img = a.photo_url ? `<img src="${esc(a.photo_url)}" alt="" style="float:right;width:120px;height:120px;object-fit:cover;border-radius:6px;margin-left:12px" />` : "";
    return `<section class="card">${img}
      <div class="st">${esc(a.name)} (${esc(a.id)}) — ${esc(l.role)}</div>
      ${fld("Status", [a.status, a.sub_status].filter(Boolean).join(" — "))}
      ${fld("Species / Breed", [a.species, a.breed && a.breed !== "Unknown" ? a.breed : ""].filter(Boolean).join(" / "))}
      ${fld("Color / Sex", [a.color, a.sex].filter(Boolean).join(" · "))}
      ${fld("Age / Weight", [a.age, a.weight].filter(Boolean).join(" · "))}
      ${fld("Microchip", a.microchip)}${fld("Rabies Tag", a.rabies_tag)}
      ${fld("Intake", [a.intake_date, a.intake_type, a.circumstance].filter(Boolean).join(" · "))}
      ${fld("Intake Condition", a.intake_condition)}${fld("Intake Behavior", a.intake_behavior)}
      ${fld("Injuries / Notes", a.injuries)}
      ${fld("Link notes", l.notes)}
      ${fld("Linked by", l.added_by ? `${l.added_by}${l.added_at ? " — " + fmtDateTime(new Date(l.added_at)) : ""}` : "")}
      <div style="clear:both"></div>
    </section>`;
  }).join("");
  const info = scene.map((s) => `<section class="card">
      <div class="st">${s.count} ${esc(s.species)}${s.breed ? ` (${esc(s.breed)})` : ""} — informational only</div>
      ${fld("Color / Sex", [s.color, s.sex].filter(Boolean).join(" · "))}${fld("Owner", s.owner)}${fld("Temperament", s.temperament)}
      ${fld("Notes", s.notes)}${fld("Recorded by", s.added_by)}
    </section>`).join("");
  return wrapDocument(`
    <section><div class="st" style="font-size:12px">ShelterTrace Animals Linked to This Call (${inputs.animalLinks.length})</div>${linked || `<div class="muted">None.</div>`}</section>
    <section><div class="st" style="font-size:12px">Informational Scene Animals (${scene.length})</div>${info || `<div class="muted">None recorded — no additional animals were taken into care at this scene.</div>`}</section>`, "Animals on Scene");
}

// ── Witness statements ────────────────────────────────────────────────────────

export function buildWitnessHtml(list: WitnessStatement[]): string {
  const body = list.map((w, i) => {
    const name = `${w.witness_first_name} ${w.witness_last_name}`.trim();
    const addr = [w.witness_address, [w.witness_city, w.witness_state].filter(Boolean).join(", "), w.witness_zip].filter(Boolean).join(" ");
    const submitted = w.submitted_at ? fmtDateTime(new Date(w.submitted_at)) : "";
    return `<section style="${i > 0 ? "page-break-before:always;" : ""}">
      <div class="st">Witness Statement ${i + 1} of ${list.length} — ${esc(w.reference_number)}</div>
      ${fld("Witness", name)}${fld("Address", addr)}${fld("Phone", w.witness_phone)}${fld("Email", w.witness_email)}
      ${fld("Preferred Contact", w.preferred_contact)}
      ${fld("Incident", [w.incident_date, w.incident_time].filter(Boolean).join(" at "))}${fld("Incident Location", w.incident_location)}
      ${fld("Case # provided", w.provided_case_number)}${fld("Submitted", submitted)}
      <div style="margin-top:12px;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b">Statement</div>
      <div style="white-space:pre-wrap;margin-top:6px;line-height:1.7;font-size:12.5px;border:1px solid #e2e8f0;border-radius:6px;padding:12px 14px">${esc(w.statement)}</div>
      ${(w.attachments || []).length ? `<div style="margin-top:10px;font-size:11px;color:#475569">Attachments submitted: ${(w.attachments || []).map((a) => esc(a.name)).join(", ")}</div>` : ""}
      <div style="margin-top:18px;font-size:11px">
        ${w.certified ? `<div style="margin-bottom:6px">☑ The witness certified this statement is true and correct.</div>` : `<div class="muted" style="margin-bottom:6px">Certification not recorded.</div>`}
        <div><strong>Typed signature:</strong> <span style="font-family:'Brush Script MT',cursive;font-size:18px">${esc(w.typed_signature || "—")}</span></div>
        <div style="color:#64748b;margin-top:2px">Submitted ${esc(submitted || "—")}</div>
      </div>
    </section>`;
  }).join("");
  return wrapDocument(body, "Witness Statements");
}

// ── Medical ───────────────────────────────────────────────────────────────────

export function buildMedicalHtml(inputs: PacketInputs, extras: PacketExtras): string {
  const body = impoundedAnimals(inputs.animalLinks).map((l) => {
    const recs = extras.medicalByAnimal[l.animal_id] || [];
    if (recs.length === 0) return "";
    const a = l.animal;
    return `<section>
      <div class="st">${esc(a ? `${a.name} (${a.id})` : l.animal_id)} — records from intake${a?.intake_date ? ` (${esc(a.intake_date)})` : ""} forward</div>
      <table><tr><th>Date</th><th>Type</th><th>Description</th><th>Details</th><th>Vet / Staff</th><th>Next Due</th></tr>
      ${recs.map((r) => `<tr>
        <td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.description)}</td>
        <td>${esc([r.test_result ? `Result: ${r.test_result}` : "", r.dosage ? `Dose: ${r.dosage}` : "", r.route || "", r.lot_number ? `Lot ${r.lot_number}` : "", r.notes || ""].filter(Boolean).join(" · "))}</td>
        <td>${esc(r.vet || "")}</td><td>${esc(r.next_due || "")}</td></tr>`).join("")}
      </table></section>`;
  }).join("");
  return wrapDocument(body || `<div class="muted">No medical records.</div>`, "Medical Records");
}

// ── Quarantine ────────────────────────────────────────────────────────────────

export function buildQuarantineHtml(inputs: PacketInputs): string {
  const q = quarantineRows(inputs);
  const forms = q.forms.map((f, i) => {
    const d = (f.form_data || {}) as Record<string, unknown>;
    const sig = typeof d.signature === "string" && d.signature.startsWith("data:image") ? `<img src="${esc(d.signature)}" alt="" style="height:54px;background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:3px"/>` : `<span class="muted">No signature image</span>`;
    return `<section class="card">
      <div class="st">Home Quarantine Order ${i + 1} — ${esc(String(d.animal_name || d.animal_id || "Animal"))}</div>
      ${fld("Animal", [d.animal_name, d.animal_id].filter(Boolean).join(" — "))}${fld("Owner (printed name)", d.printed_name)}
      ${fld("Date", d.date)}${fld("Issuing officer", [d.officer, d.badge ? `Badge #${d.badge}` : ""].filter(Boolean).join(" — "))}
      ${fld("Created", f.created_at ? fmtDateTime(new Date(f.created_at)) : "")}
      <div style="margin-top:8px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase">Owner signature</div>${sig}
    </section>`;
  }).join("");
  const bites = q.bites.map((b) => {
    const qd = b.quarantine_data;
    const checks = (qd?.check_dates || []).filter(Boolean);
    const released = b.quarantine_released === "Yes" || (b.quarantine_released as unknown) === true;
    return `<section class="card">
      <div class="st">Bite Quarantine — Report ${esc(b.report_number || b.id || "")}</div>
      ${fld("Type", qd?.type)}${fld("Start", qd?.start_date)}${fld("End", qd?.end_date)}
      ${fld("Location", qd?.location)}${fld("Contact", [qd?.contact_name, qd?.contact_phone].filter(Boolean).join(" — "))}
      ${fld("Check dates", checks.length ? checks.join(", ") : "None recorded")}
      ${fld("Release", released ? `Released${b.quarantine_release_date ? " on " + b.quarantine_release_date : ""}` : "Not released")}
      ${fld("Disposition", b.disposition)}
    </section>`;
  }).join("");
  const animals = inputs.animalLinks.filter((l) => l.animal?.status === "Quarantine")
    .map((l) => `<div class="row"><span class="k">${esc(l.animal!.name)} (${esc(l.animal_id)})</span><span>Currently in quarantine${l.animal!.sub_status ? " — " + esc(l.animal!.sub_status) : ""}</span></div>`).join("");
  return wrapDocument(`${forms}${bites}${animals ? `<section><div class="st">Animals currently in quarantine</div>${animals}</section>` : ""}` || `<div class="muted">None.</div>`, "Quarantine Records");
}
