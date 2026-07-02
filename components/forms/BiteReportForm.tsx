"use client";
import { useState, useEffect, useCallback } from "react";
import type { BiteReport, BiteVictimHumanData, BiteVictimAnimalData, BiteOwnerData, BiteInjuryData, BiteAnimalData, BiteQuarantineData } from "@/lib/biteReportTypes";
import {
  LOCATION_TYPES, BODY_PARTS, INJURY_SEVERITIES_HUMAN, INJURY_SEVERITIES_ANIMAL,
  DISPOSITIONS, RABIES_STATUSES, VICTIM_RELATIONSHIPS, ANIMAL_DISPOSITIONS_AT_TIME,
  ANIMAL_CURRENT_STATUSES, QUARANTINE_TYPES, blankBiteReport,
} from "@/lib/biteReportTypes";
import { createBiteReport, updateBiteReport } from "@/lib/biteReportData";
import { getCurrentUserName, getCurrentUserId } from "@/lib/auth";
import { printBiteReport } from "@/lib/biteReportPrint";
import { today, nowTime } from "@/lib/utils";
import DateInput from "@/components/ui/DateInput";
import DragDropUpload from "@/components/ui/DragDropUpload";

interface Props {
  reportType: "animal_human" | "animal_animal";
  initialData?: Partial<BiteReport>;
  onSave?: (report: BiteReport) => void;
  onCancel?: () => void;
}

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="form-group"><label className="form-label">{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>{children}</div>;
}

function SH({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ background: "#1B3A5C", color: "#fff", padding: "8px 16px", borderRadius: 6, marginBottom: 14, marginTop: 10, fontWeight: 700, fontSize: 13 }}>
      Section {n} — {title}
    </div>
  );
}

export default function BiteReportForm({ reportType, initialData, onSave, onCancel }: Props) {
  const [report, setReport] = useState<BiteReport>(() => ({
    ...blankBiteReport(reportType),
    ...initialData,
    incident_date: initialData?.incident_date || today(),
    incident_time: initialData?.incident_time || nowTime(),
    investigating_officer: initialData?.investigating_officer || getCurrentUserName(),
    investigating_officer_id: initialData?.investigating_officer_id || getCurrentUserId() || "",
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const set = useCallback(<K extends keyof BiteReport>(key: K, val: BiteReport[K]) =>
    setReport((r) => ({ ...r, [key]: val })), []);

  const setAnimal = <K extends keyof BiteAnimalData>(key: K, val: BiteAnimalData[K]) =>
    setReport((r) => ({ ...r, biting_animal_data: { ...r.biting_animal_data, [key]: val } }));

  const setOwner = <K extends keyof BiteOwnerData>(key: K, val: BiteOwnerData[K]) =>
    setReport((r) => ({ ...r, owner_data: { ...r.owner_data, [key]: val } }));

  const setVictimH = <K extends keyof BiteVictimHumanData>(key: K, val: BiteVictimHumanData[K]) =>
    setReport((r) => ({ ...r, victim_data: { ...r.victim_data, [key]: val } }));

  const setVictimA = <K extends keyof BiteVictimAnimalData>(key: K, val: BiteVictimAnimalData[K]) =>
    setReport((r) => ({ ...r, victim_data: { ...r.victim_data, [key]: val } }));

  const setInjury = <K extends keyof BiteInjuryData>(key: K, val: BiteInjuryData[K]) =>
    setReport((r) => ({ ...r, injury_data: { ...r.injury_data, [key]: val } }));

  const setQuar = <K extends keyof BiteQuarantineData>(key: K, val: BiteQuarantineData[K]) =>
    setReport((r) => ({ ...r, quarantine_data: { ...r.quarantine_data, [key]: val } }));

  const humanVictim = report.victim_data as BiteVictimHumanData;
  const animalVictim = report.victim_data as BiteVictimAnimalData;
  const isHuman = reportType === "animal_human";

  // Auto-calculate quarantine end date (10 days from incident)
  useEffect(() => {
    if (report.quarantine_ordered && report.incident_date && !report.quarantine_data.end_date) {
      const end = new Date(report.incident_date + "T12:00:00");
      end.setDate(end.getDate() + 10);
      setQuar("end_date", end.toISOString().split("T")[0]);
    }
  }, [report.quarantine_ordered, report.incident_date]); // eslint-disable-line

  const handleSave = async () => {
    const errs: string[] = [];
    if (!report.incident_date) errs.push("Incident date is required");
    if (!report.incident_address) errs.push("Incident address is required");
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const saved = report.id
        ? await updateBiteReport(report.id, report)
        : await createBiteReport(report);
      setReport(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSave?.(saved);
    } catch (e: unknown) {
      setErrors([`Save failed: ${(e as { message?: string }).message}`]);
    } finally { setSaving(false); }
  };

  const toggleBodyPart = (part: string) => {
    const parts = report.injury_data.body_parts || [];
    setInjury("body_parts", parts.includes(part) ? parts.filter((p) => p !== part) : [...parts, part]);
  };

  const typeTitle = isHuman ? "Animal Bite Report — Animal to Human" : "Animal Bite Report — Animal to Animal";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{typeTitle}</h1>
          {report.report_number && <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--teal)", marginTop: 2 }}>{report.report_number}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {report.id && <button className="btn btn-secondary" onClick={() => printBiteReport(report)}>🖨 Print</button>}
          {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : report.id ? "Save Changes" : "Save Report"}</button>
          {saved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      {errors.length > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#dc2626" }}>• {e}</div>)}
        </div>
      )}

      {/* Section 1 — Incident */}
      <SH n="1" title="Incident Information" />
      <div className="grid-2">
        <F label="Date of Incident" required><DateInput className="form-input" value={report.incident_date} onChange={(e) => set("incident_date", e.target.value)} /></F>
        <F label="Time of Incident"><input className="form-input" type="time" value={report.incident_time} onChange={(e) => set("incident_time", e.target.value)} /></F>
        <F label="Location — Address" required><input className="form-input" value={report.incident_address} onChange={(e) => set("incident_address", e.target.value)} /></F>
        <F label="Location — City"><input className="form-input" value={report.incident_city} onChange={(e) => set("incident_city", e.target.value)} /></F>
        <F label="Location Type">
          <select className="form-select" value={report.incident_location_type} onChange={(e) => set("incident_location_type", e.target.value)}>
            <option value="">— Select —</option>
            {LOCATION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </F>
        <F label="Investigating Officer"><input className="form-input" value={report.investigating_officer} onChange={(e) => set("investigating_officer", e.target.value)} /></F>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={report.law_enforcement_notified} onChange={(e) => set("law_enforcement_notified", e.target.checked)} />
          Law enforcement notified
        </label>
        {report.law_enforcement_notified && (
          <input className="form-input" style={{ maxWidth: 240 }} placeholder="LE agency / report number" value={report.law_enforcement_report} onChange={(e) => set("law_enforcement_report", e.target.value)} />
        )}
      </div>

      {/* Section 2 — Biting Animal */}
      <SH n="2" title={isHuman ? "Biting Animal Information" : "Attacking Animal Information"} />
      <div className="grid-2">
        <F label="Animal Name"><input className="form-input" value={report.biting_animal_data.name} onChange={(e) => setAnimal("name", e.target.value)} /></F>
        <F label="Species"><input className="form-input" value={report.biting_animal_data.species} onChange={(e) => setAnimal("species", e.target.value)} placeholder="Dog / Cat / Other" /></F>
        <F label="Breed"><input className="form-input" value={report.biting_animal_data.breed} onChange={(e) => setAnimal("breed", e.target.value)} /></F>
        <F label="Color/Markings"><input className="form-input" value={report.biting_animal_data.color} onChange={(e) => setAnimal("color", e.target.value)} /></F>
        <F label="Sex">
          <select className="form-select" value={report.biting_animal_data.sex} onChange={(e) => setAnimal("sex", e.target.value)}>
            <option value="">— Select —</option>
            <option>Male</option><option>Female</option><option>Unknown</option>
          </select>
        </F>
        <F label="Age (estimate)"><input className="form-input" value={report.biting_animal_data.age} onChange={(e) => setAnimal("age", e.target.value)} placeholder="e.g. 3 years, adult" /></F>
        {isHuman && (
          <F label="Size">
            <select className="form-select" value={report.biting_animal_data.size} onChange={(e) => setAnimal("size", e.target.value)}>
              <option value="">— Select —</option>
              <option>Small</option><option>Medium</option><option>Large</option><option>Extra Large</option>
            </select>
          </F>
        )}
        <F label="Microchip #"><input className="form-input" value={report.biting_animal_data.microchip} onChange={(e) => setAnimal("microchip", e.target.value)} /></F>
        <F label="Rabies Vaccination Status">
          <select className="form-select" value={report.biting_animal_data.rabies_status} onChange={(e) => setAnimal("rabies_status", e.target.value)}>
            {RABIES_STATUSES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </F>
        <F label="Rabies Tag #"><input className="form-input" value={report.biting_animal_data.rabies_tag} onChange={(e) => setAnimal("rabies_tag", e.target.value)} /></F>
        <F label="Rabies Expiration"><DateInput className="form-input" value={report.biting_animal_data.rabies_expiration} onChange={(e) => setAnimal("rabies_expiration", e.target.value)} /></F>
        <F label="Veterinarian"><input className="form-input" value={report.biting_animal_data.veterinarian} onChange={(e) => setAnimal("veterinarian", e.target.value)} /></F>
        <F label="Vet Phone"><input className="form-input" type="tel" value={report.biting_animal_data.vet_phone} onChange={(e) => setAnimal("vet_phone", e.target.value)} /></F>
        <F label="Animal Disposition at Time of Bite">
          <select className="form-select" value={report.biting_animal_data.disposition_at_time} onChange={(e) => setAnimal("disposition_at_time", e.target.value)}>
            <option value="">— Select —</option>
            {ANIMAL_DISPOSITIONS_AT_TIME.map((d) => <option key={d}>{d}</option>)}
          </select>
        </F>
        <F label="Was Animal Provoked?">
          <select className="form-select" value={report.biting_animal_data.was_provoked} onChange={(e) => setAnimal("was_provoked", e.target.value)}>
            <option>Unknown</option><option>Yes</option><option>No</option>
          </select>
        </F>
        <F label="Animal Current Status">
          <select className="form-select" value={report.biting_animal_data.current_status} onChange={(e) => setAnimal("current_status", e.target.value)}>
            <option value="">— Select —</option>
            {ANIMAL_CURRENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </F>
      </div>

      {/* Section 3 — Owner */}
      <SH n="3" title="Animal Owner Information" />
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={report.owner_data.known} onChange={(e) => setOwner("known", e.target.checked)} /> Owner is known
        </label>
      </div>
      <div className="grid-2">
        <F label="First Name"><input className="form-input" value={report.owner_data.first_name} onChange={(e) => setOwner("first_name", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="Last Name"><input className="form-input" value={report.owner_data.last_name} onChange={(e) => setOwner("last_name", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="Address"><input className="form-input" value={report.owner_data.address} onChange={(e) => setOwner("address", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="City"><input className="form-input" value={report.owner_data.city} onChange={(e) => setOwner("city", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="Phone"><input className="form-input" type="tel" value={report.owner_data.phone} onChange={(e) => setOwner("phone", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="Email"><input className="form-input" type="email" value={report.owner_data.email} onChange={(e) => setOwner("email", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="Driver's License #"><input className="form-input" value={report.owner_data.dl_number} onChange={(e) => setOwner("dl_number", e.target.value)} disabled={!report.owner_data.known} /></F>
        <F label="DL State"><input className="form-input" value={report.owner_data.dl_state} onChange={(e) => setOwner("dl_state", e.target.value)} disabled={!report.owner_data.known} style={{ maxWidth: 80 }} /></F>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={report.owner_data.was_cited} onChange={(e) => setOwner("was_cited", e.target.checked)} /> Owner cited
        </label>
        {report.owner_data.was_cited && (
          <input className="form-input" style={{ maxWidth: 200 }} placeholder="Citation number" value={report.owner_data.citation_number} onChange={(e) => setOwner("citation_number", e.target.value)} />
        )}
      </div>

      {/* Section 4 — Victim */}
      <SH n="4" title={isHuman ? "Victim Information" : "Victim Animal Information"} />
      {isHuman ? (
        <div className="grid-2">
          <F label="First Name" required><input className="form-input" value={humanVictim.first_name} onChange={(e) => setVictimH("first_name", e.target.value)} /></F>
          <F label="Last Name" required><input className="form-input" value={humanVictim.last_name} onChange={(e) => setVictimH("last_name", e.target.value)} /></F>
          <F label="Date of Birth"><DateInput className="form-input" value={humanVictim.dob} onChange={(e) => setVictimH("dob", e.target.value)} /></F>
          <F label="Sex">
            <select className="form-select" value={humanVictim.sex} onChange={(e) => setVictimH("sex", e.target.value)}>
              <option value="">— Select —</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
          </F>
          <F label="Address"><input className="form-input" value={humanVictim.address} onChange={(e) => setVictimH("address", e.target.value)} /></F>
          <F label="City"><input className="form-input" value={humanVictim.city} onChange={(e) => setVictimH("city", e.target.value)} /></F>
          <F label="Phone"><input className="form-input" type="tel" value={humanVictim.phone} onChange={(e) => setVictimH("phone", e.target.value)} /></F>
          <F label="Email"><input className="form-input" type="email" value={humanVictim.email} onChange={(e) => setVictimH("email", e.target.value)} /></F>
          <F label="Relationship to Animal/Owner">
            <select className="form-select" value={humanVictim.relationship} onChange={(e) => setVictimH("relationship", e.target.value)}>
              <option value="">— Select —</option>
              {VICTIM_RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </F>
          <F label="Was Victim on Owner's Property?">
            <select className="form-select" value={humanVictim.on_owner_property} onChange={(e) => setVictimH("on_owner_property", e.target.value)}>
              <option value="">— Select —</option><option>Yes</option><option>No</option><option>Unknown</option>
            </select>
          </F>
        </div>
      ) : (
        <div className="grid-2">
          <F label="Animal Name"><input className="form-input" value={animalVictim.name} onChange={(e) => setVictimA("name", e.target.value)} /></F>
          <F label="Species"><input className="form-input" value={animalVictim.species} onChange={(e) => setVictimA("species", e.target.value)} /></F>
          <F label="Breed"><input className="form-input" value={animalVictim.breed} onChange={(e) => setVictimA("breed", e.target.value)} /></F>
          <F label="Color"><input className="form-input" value={animalVictim.color} onChange={(e) => setVictimA("color", e.target.value)} /></F>
          <F label="Microchip #"><input className="form-input" value={animalVictim.microchip} onChange={(e) => setVictimA("microchip", e.target.value)} /></F>
          <F label="Rabies Status">
            <select className="form-select" value={animalVictim.rabies_status} onChange={(e) => setVictimA("rabies_status", e.target.value)}>
              {RABIES_STATUSES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </F>
          <F label="Owner Name"><input className="form-input" value={`${animalVictim.owner_first_name} ${animalVictim.owner_last_name}`.trim()} onChange={(e) => { const [fn, ...rest] = e.target.value.split(" "); setVictimA("owner_first_name", fn); setVictimA("owner_last_name", rest.join(" ")); }} placeholder="First Last" /></F>
          <F label="Owner Phone"><input className="form-input" type="tel" value={animalVictim.owner_phone} onChange={(e) => setVictimA("owner_phone", e.target.value)} /></F>
        </div>
      )}

      {/* Section 5 — Injury */}
      <SH n="5" title="Bite/Injury Information" />
      {isHuman && (
        <F label="Body Part(s) Bitten">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {BODY_PARTS.map((p) => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer", padding: "3px 8px", borderRadius: 16, border: `1px solid ${report.injury_data.body_parts?.includes(p) ? "var(--teal)" : "var(--border)"}`, background: report.injury_data.body_parts?.includes(p) ? "#f0fdfa" : "#fff" }}>
                <input type="checkbox" checked={report.injury_data.body_parts?.includes(p)} onChange={() => toggleBodyPart(p)} style={{ display: "none" }} />
                {p}
              </label>
            ))}
          </div>
        </F>
      )}
      <div className="grid-2" style={{ marginTop: 8 }}>
        <F label="Severity of Injury">
          <select className="form-select" value={report.injury_data.severity} onChange={(e) => setInjury("severity", e.target.value)}>
            <option value="">— Select —</option>
            {(isHuman ? INJURY_SEVERITIES_HUMAN : INJURY_SEVERITIES_ANIMAL).map((s) => <option key={s}>{s}</option>)}
          </select>
        </F>
        {isHuman ? (
          <>
            <F label="Sought Medical Attention?">
              <select className="form-select" value={String(report.injury_data.sought_medical)} onChange={(e) => setInjury("sought_medical", e.target.value === "true")}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </F>
            {report.injury_data.sought_medical && <F label="Medical Facility"><input className="form-input" value={report.injury_data.medical_facility} onChange={(e) => setInjury("medical_facility", e.target.value)} /></F>}
            <F label="PEP Recommended?">
              <select className="form-select" value={report.injury_data.pep_recommended} onChange={(e) => setInjury("pep_recommended", e.target.value)}>
                <option>Unknown</option><option>Yes</option><option>No</option>
              </select>
            </F>
            <F label="Treating Physician"><input className="form-input" value={report.injury_data.treating_physician} onChange={(e) => setInjury("treating_physician", e.target.value)} /></F>
          </>
        ) : (
          <>
            <F label="Received Veterinary Treatment?">
              <select className="form-select" value={String(report.injury_data.vet_treated)} onChange={(e) => setInjury("vet_treated", e.target.value === "true")}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </F>
            {report.injury_data.vet_treated && <F label="Veterinary Clinic"><input className="form-input" value={report.injury_data.vet_clinic} onChange={(e) => setInjury("vet_clinic", e.target.value)} /></F>}
            <F label="Estimated Vet Bill"><input className="form-input" value={report.injury_data.estimated_bill} onChange={(e) => setInjury("estimated_bill", e.target.value)} placeholder="$" /></F>
            <F label="Seeking Restitution?">
              <select className="form-select" value={String(report.injury_data.seeking_restitution)} onChange={(e) => setInjury("seeking_restitution", e.target.value === "true")}>
                <option value="false">No</option><option value="true">Yes</option>
              </select>
            </F>
          </>
        )}
      </div>

      {/* Section 6 — Quarantine */}
      <SH n="6" title="Quarantine Information" />
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: report.quarantine_ordered ? 700 : 400 }}>
          <input type="checkbox" checked={report.quarantine_ordered} onChange={(e) => set("quarantine_ordered", e.target.checked)} />
          Quarantine ordered
        </label>
      </div>
      {report.quarantine_ordered && (
        <div className="grid-2">
          <F label="Quarantine Type">
            <select className="form-select" value={report.quarantine_data.type} onChange={(e) => setQuar("type", e.target.value)}>
              {QUARANTINE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Quarantine Location"><input className="form-input" value={report.quarantine_data.location} onChange={(e) => setQuar("location", e.target.value)} /></F>
          <F label="Start Date"><DateInput className="form-input" value={report.quarantine_data.start_date} onChange={(e) => setQuar("start_date", e.target.value)} /></F>
          <F label="End Date (auto: +10 days)"><DateInput className="form-input" value={report.quarantine_data.end_date} onChange={(e) => setQuar("end_date", e.target.value)} /></F>
          <F label="Contact Name"><input className="form-input" value={report.quarantine_data.contact_name} onChange={(e) => setQuar("contact_name", e.target.value)} /></F>
          <F label="Contact Phone"><input className="form-input" type="tel" value={report.quarantine_data.contact_phone} onChange={(e) => setQuar("contact_phone", e.target.value)} /></F>
        </div>
      )}

      {/* Section 7 — Disposition */}
      <SH n="7" title="Officer Notes & Disposition" />
      <div className="grid-2">
        <F label="Case Disposition">
          <select className="form-select" value={report.disposition} onChange={(e) => set("disposition", e.target.value)}>
            {DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </F>
        <F label="Status">
          <select className="form-select" value={report.status} onChange={(e) => set("status", e.target.value as BiteReport["status"])}>
            {["Open", "Pending", "Closed"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </F>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={report.follow_up_required} onChange={(e) => set("follow_up_required", e.target.checked)} /> Follow-up required
        </label>
        {report.follow_up_required && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>Date:</span>
            <DateInput className="form-input" style={{ maxWidth: 160 }} value={report.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} />
          </div>
        )}
      </div>
      <F label="Narrative">
        <textarea className="form-textarea" rows={5} value={report.narrative} onChange={(e) => set("narrative", e.target.value)} placeholder="Describe the incident, investigation findings, actions taken, and any relevant observations…" />
      </F>

      {/* Photos */}
      <DragDropUpload
        onFiles={(files) => {
          files.forEach((f) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) set("photos", [...report.photos, ev.target.result as string]);
            };
            reader.readAsDataURL(f);
          });
        }}
        accept="image/jpeg,image/png,image/webp"
        multiple
        compact
        label="Drop scene photos here"
      />
      {report.photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {report.photos.map((p, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={p} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
              <button onClick={() => set("photos", report.photos.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 10 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : report.id ? "Save Changes" : "Save Report"}</button>
        {report.id && <button className="btn btn-secondary" onClick={() => printBiteReport(report)}>🖨 Print Report</button>}
        {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
        {saved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  );
}
