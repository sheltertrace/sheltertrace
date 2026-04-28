"use client";
import { useState, useEffect } from "react";
import { createForm, fetchOfficers, fetchPeople } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import { MCAS_SEAL_LOGO } from "@/lib/mcasLogo";
import type { ShelterForm, Officer, Person, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";

const VIOLATIONS = [
  { id: "at_large",    label: "Animal running at large causing a nuisance.", section: "Section 10-7" },
  { id: "rabies",      label: "Failure to provide proof and/or display proof of a current rabies vaccination.", section: "Section 10-6" },
  { id: "barking",     label: "Animal barking excessively or emitting disturbing noises causing a nuisance.", section: "Section 10-7" },
  { id: "abandoned",   label: "Abandoned Animal.", section: "Section 10-7" },
  { id: "humane_care", label: "Failure to provide an animal with humane care.", section: "Section 10-7" },
  { id: "disposal",    label: "Failure to properly dispose of a deceased animal.", section: "Section 10-7" },
  { id: "fighting",    label: "Allowing or permitting animals to fight.", section: "Section 10-7" },
  { id: "hindering",   label: "Hindering or interfering with county employee's job duties", section: "10-20" },
] as const;

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printRFC(data: Record<string, unknown>, logo: string) {
  const w = window.open("", "_blank", "width=750,height=1050");
  if (!w) return;
  const checks = (data.checkboxes || {}) as Record<string, boolean>;
  const checkRow = (id: string, label: string, section: string) =>
    `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;">
      <div style="width:13px;height:13px;border:1.5px solid #000;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:10px;">${checks[id] ? "✓" : ""}</div>
      <div style="font-size:10.5px;line-height:1.4">${label} <span style="font-style:italic;color:#555">(${section})</span></div>
    </div>`;
  const sigHtml = data.signature
    ? `<img src="${data.signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px"/>`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #000"></div>`;
  w.document.write(`<html><head><title>Request for Compliance</title>
  <style>body{font-family:Arial,sans-serif;font-size:10.5px;padding:22px;margin:0;line-height:1.45}
  .line{border-bottom:1px solid #000;display:inline-block;min-width:100px}
  @media print{body{padding:14px}}</style></head><body>
  <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:4px">
    <img src="${logo}" style="width:70px;height:70px;object-fit:contain;flex-shrink:0" />
    <div>
      <div style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.5px">Morgan County Animal Services</div>
      <div style="font-size:10px;margin-top:2px">2392 ATHENS HWY. MADISON GA, 30650 &nbsp; PHONE: 706.752.1195</div>
      <div style="font-size:15px;font-weight:900;margin-top:6px;letter-spacing:.5px;text-transform:uppercase">Request for Compliance</div>
    </div>
  </div>
  <div style="display:flex;gap:20px;margin:12px 0 8px;flex-wrap:wrap;font-size:10.5px">
    <span><b>Name:</b> <span class="line" style="min-width:180px">&nbsp;${[data.name_first, data.name_middle, data.name_last].filter(Boolean).join(" ")}&nbsp;</span></span>
    <span><b>Date:</b> <span class="line" style="min-width:100px">&nbsp;${data.date || ""}&nbsp;</span></span>
  </div>
  <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;font-size:10.5px">
    <span><b>Address:</b> <span class="line" style="min-width:160px">&nbsp;${data.address || ""}&nbsp;</span></span>
    <span><b>City:</b> <span class="line" style="min-width:100px">&nbsp;${data.city || ""}&nbsp;</span></span>
    <span><b>Zip:</b> <span class="line" style="min-width:70px">&nbsp;${data.zip || ""}&nbsp;</span></span>
  </div>
  <div style="font-size:10.5px;margin-bottom:10px">
    On <span class="line" style="min-width:90px">&nbsp;${data.complaint_date || ""}&nbsp;</span> Animal Services received a complaint regarding one or more of the following violations:
  </div>
  ${VIOLATIONS.map((v) => checkRow(v.id, v.label, v.section)).join("")}
  <div style="margin:12px 0;font-size:10.5px;line-height:1.6">
    Above are the violations of Chapter 10, sections 10-6 and 10-7 of the county's animal ordinance. The violation(s) marked were either the result of a complaint received by our office.
    <div style="text-align:center;font-weight:700;margin:6px 0">OR</div>
    An officer witnessed a violation.
    <div style="margin-top:8px">To avoid further action such as a court citation, please make the following corrections by the date given to achieve and maintain compliance.</div>
    <div style="margin-top:6px">Thank you and please call with any questions. <b>(706) 752-1195</b></div>
  </div>
  ${data.notes ? `<div style="margin-bottom:10px"><b>Notes:</b><div style="border:1px solid #aaa;padding:6px;margin-top:3px;min-height:36px;font-size:10.5px">${data.notes}</div></div>` : ""}
  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px;font-size:10.5px">
    <span><b>Compliance by:</b> <span class="line" style="min-width:120px">&nbsp;${data.compliance_date || ""}&nbsp;</span></span>
    <span><b>Phone:</b> <span class="line" style="min-width:120px">&nbsp;${data.phone || ""}&nbsp;</span></span>
  </div>
  <div style="display:flex;gap:40px;align-items:flex-end;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;margin-bottom:4px"><b>Officer Signature:</b></div>
      ${sigHtml}
      <div style="font-size:10px;margin-top:3px">${data.officer || ""}</div>
    </div>
  </div>
  </body></html>`);
  w.document.close();
  w.print();
}

export default function RequestForComplianceForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [nameFirst, setNameFirst] = useState(prefill?.person_first || "");
  const [nameMiddle, setNameMiddle] = useState("");
  const [nameLast, setNameLast] = useState(prefill?.person_last || "");
  const [date, setDate] = useState(prefill?.call_date || today());
  const [address, setAddress] = useState(prefill?.call_address || prefill?.person_address || "");
  const [city, setCity] = useState(prefill?.call_city || prefill?.person_city || "");
  const [zip, setZip] = useState(prefill?.person_zip || "");
  const [complaintDate, setComplaintDate] = useState(prefill?.call_date || today());
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [complianceDate, setComplianceDate] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [phone, setPhone] = useState(prefill?.person_phone || "");
  const [officer, setOfficer] = useState(prefill?.call_officer || (user ? `${user.firstName} ${user.lastName}`.trim() : ""));
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [linkIds, setLinkIds] = useState<LinkIds>({
    call_id: prefill?.call_id,
    animal_id: prefill?.animal_id,
  });

  // Person search
  const [personSearch, setPersonSearch] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [sigTimestamp, setSigTimestamp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOfficers().then(setOfficers);
    fetchPeople().then(setPeople);
  }, []);

  const filteredPeople = personSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.toLowerCase()) || (p.pid || "").toLowerCase().includes(personSearch.toLowerCase()))
    : [];

  const handlePersonSelect = (p: Person) => {
    setSelectedPerson(p);
    setNameFirst(p.first_name || "");
    setNameMiddle(p.middle_name || "");
    setNameLast(p.last_name || "");
    setAddress(p.address || "");
    setCity(p.city || "");
    setZip(p.zip || "");
    setPhone(p.phone || "");
    setPersonSearch("");
  };

  const toggleCheck = (id: string) => setChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleOfficerSelect = (name: string) => setOfficer(name);

  const formData = () => ({
    name_first: nameFirst, name_middle: nameMiddle, name_last: nameLast,
    date, address, city, zip, complaint_date: complaintDate,
    checkboxes: checks, notes, compliance_date: complianceDate,
    signature: signature || undefined, phone, officer,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "request_for_compliance",
        form_data: formData() as unknown as Record<string, unknown>,
        linked_call_id: linkIds.call_id,
        linked_animal_id: linkIds.animal_id,
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        officer,
        created_by: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      });
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as { message?: string }).message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Request for Compliance</div>
            {linkIds.call_id && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Linked to call</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Person link */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Linked Person (optional — auto-fills name & address)</label>
            {selectedPerson ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>{selectedPerson.first_name} {selectedPerson.last_name}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedPerson.pid}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelectedPerson(null)}>✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="Search by name or PID…" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
                {filteredPeople.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 160, overflowY: "auto" }}>
                    {filteredPeople.slice(0, 8).map((p) => (
                      <div key={p.id} onClick={() => handlePersonSelect(p)} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span> <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{p.pid} · {p.address || "no address"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Name & Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 160px", gap: 10, marginBottom: 12 }}>
            {[["First Name", nameFirst, setNameFirst], ["Middle Name", nameMiddle, setNameMiddle], ["Last Name", nameLast, setNameLast]].map(([label, val, setter]) => (
              <div key={label as string} className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{label as string}</label>
                <input className="form-input" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} />
              </div>
            ))}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 100px", gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Address</label>
              <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zip</label>
              <input className="form-input" value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Complaint Date</label>
            <input className="form-input" type="date" value={complaintDate} onChange={(e) => setComplaintDate(e.target.value)} style={{ maxWidth: 200 }} />
          </div>

          {/* Violations */}
          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>Violation(s) (check all that apply)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {VIOLATIONS.map((v) => (
              <label key={v.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={!!checks[v.id]} onChange={() => toggleCheck(v.id)} style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15 }} />
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{v.label} <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>({v.section})</span></span>
              </label>
            ))}
          </div>

          {/* Pre-printed text block */}
          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            Above are the violations of Chapter 10, sections 10-6 and 10-7 of the county's animal ordinance. The violation(s) marked were either the result of a complaint received by our office.
            <div style={{ textAlign: "center", fontWeight: 700, margin: "6px 0", color: "var(--text)" }}>OR</div>
            An officer witnessed a violation.
            <div style={{ marginTop: 6 }}>To avoid further action such as a court citation, please make the following corrections by the date given to achieve and maintain compliance.</div>
            <div style={{ marginTop: 4 }}>Thank you and please call with any questions. <strong>(706) 752-1195</strong></div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes or required corrections…" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Compliance Deadline</label>
              <input className="form-input" type="date" value={complianceDate} onChange={(e) => setComplianceDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Phone Number</label>
              <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact phone" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Officer</label>
              <select className="form-select" value={officer} onChange={(e) => handleOfficerSelect(e.target.value)}>
                <option value="">— Select officer —</option>
                {officers.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <SignaturePad
              label="Officer Signature"
              value={signature}
              timestamp={sigTimestamp}
              onAccept={(data, ts) => { setSignature(data); setSigTimestamp(ts); }}
              onClear={() => { setSignature(null); setSigTimestamp(null); }}
            />
          </div>
          <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["person"]} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => printRFC(formData() as unknown as Record<string, unknown>, MCAS_SEAL_LOGO)}>
            🖨 Print Preview
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save & Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
