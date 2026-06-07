"use client";
import { useState, useEffect, useMemo } from "react";
import { createForm, fetchPeople } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Person, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import DateInput from "@/components/ui/DateInput";
import { AGENCY_NAME, AGENCY_SHORT, AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_DOTS, COUNTY_NAME, COUNTY_STATE } from "@/lib/shelterInfo";

const MCAS_BLUE = "#0f2942";

const AGREEMENT_TEXT = `VOLUNTEER AGREEMENT AND RELEASE OF LIABILITY

I, the undersigned, hereby agree to volunteer my services to ${AGENCY_NAME} ("${AGENCY_SHORT}"), a division of ${COUNTY_STATE} ("the County"). In consideration of being allowed to participate as a volunteer with ${AGENCY_SHORT}, I agree to the following terms and conditions:

1. VOLUNTEER STATUS. I understand that I am a volunteer and not an employee of ${COUNTY_NAME} or ${AGENCY_SHORT}. I will not receive wages, salary, or monetary compensation for my volunteer services. I understand that I am not entitled to any employee benefits, including but not limited to workers' compensation, unemployment insurance, health insurance, or retirement benefits.

2. COMPLIANCE WITH POLICIES. I agree to follow all policies, procedures, rules, and guidelines established by ${AGENCY_SHORT}, as may be amended from time to time. I agree to treat all animals humanely, with compassion, and in accordance with ${AGENCY_SHORT} animal care protocols. I agree to treat all staff, other volunteers, and members of the public with courtesy and respect.

3. CONFIDENTIALITY. I agree to maintain the strict confidentiality of all information I may encounter during my volunteer service, including but not limited to information regarding animals in the shelter's care, personnel matters, operational procedures, legal matters, and information about individuals who interact with ${AGENCY_SHORT}. I understand that this obligation of confidentiality continues beyond the conclusion of my volunteer service.

4. ASSUMPTION OF RISK. I acknowledge and understand that working with animals involves inherent risks of injury, including but not limited to animal bites, scratches, kicks, and other physical contact with animals. I acknowledge that I may be exposed to zoonotic diseases, animal dander, and other allergens. I voluntarily assume all such risks and acknowledge that ${AGENCY_SHORT} has informed me of these risks.

5. RELEASE OF LIABILITY. In consideration of being permitted to serve as a volunteer, I, on behalf of myself, my heirs, assigns, and personal representatives, hereby release, discharge, and hold harmless ${COUNTY_NAME}, ${AGENCY_SHORT}, and their respective officers, employees, agents, volunteers, and representatives ("Released Parties") from any and all claims, demands, actions, causes of action, damages, losses, costs, or expenses of any kind, including attorneys' fees, arising from or related to my participation as a volunteer, including but not limited to injuries caused by animals, accidents on ${AGENCY_SHORT} property, or use of ${AGENCY_SHORT} equipment.

6. INDEMNIFICATION. I agree to indemnify and hold harmless the Released Parties from any claims arising from my own negligent or intentional acts or omissions during my volunteer service.

7. PHOTOGRAPH AND MEDIA RELEASE. I grant ${AGENCY_SHORT} permission to use photographs, videos, or other media of me taken during my volunteer service for educational, promotional, and public awareness purposes, without compensation.

8. TERMINATION. I understand that my volunteer service may be terminated at any time and for any reason, with or without cause, by either ${AGENCY_SHORT} or by me. Upon termination, I agree to immediately return any ${AGENCY_SHORT} property, equipment, or materials in my possession.

9. GOVERNING LAW. This Agreement shall be governed by the laws of the State of Georgia. Any dispute arising under this Agreement shall be resolved in the courts of ${COUNTY_STATE}.

10. ENTIRE AGREEMENT. This Agreement constitutes the entire agreement between the parties with respect to my volunteer service and supersedes all prior agreements, representations, or understandings.

BY SIGNING BELOW, I CERTIFY THAT I HAVE READ THIS AGREEMENT IN ITS ENTIRETY, THAT I UNDERSTAND ITS CONTENTS, AND THAT I AGREE TO BE BOUND BY ITS TERMS.`;

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

function calcAge(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob + "T12:00");
  const now = new Date();
  const y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  return String(m < 0 || (m === 0 && now.getDate() < birth.getDate()) ? y - 1 : y);
}

function isMinor(dob: string): boolean {
  if (!dob) return false;
  return parseInt(calcAge(dob), 10) < 18;
}

export function printVolunteerAgreement(d: Record<string, unknown>) {
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;
  const blue = MCAS_BLUE;
  const sig = (key: string) => d[key]
    ? `<img src="${d[key]}" style="width:200px;height:48px;object-fit:contain;display:block"/>`
    : `<div style="width:200px;height:48px;border-bottom:1.5px solid #000"></div>`;
  const fl = (label: string, val: unknown, minW = 160) =>
    `<div style="display:inline-flex;flex-direction:column;gap:1px;margin-right:14px;margin-bottom:8px">
      <div style="border-bottom:1px solid #000;min-width:${minW}px;padding-bottom:2px;font-size:10px">${val || "&nbsp;"}</div>
      <div style="font-size:8.5px;color:#555">${label}</div>
    </div>`;
  const sh = (title: string) =>
    `<div style="background:${blue};color:#fff;padding:4px 10px;font-size:10px;font-weight:700;text-transform:uppercase;margin:12px 0 7px;letter-spacing:.5px">${title}</div>`;
  w.document.write(`<html><head><title>Volunteer Agreement & Release</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.5}
  h1{font-size:15px;font-weight:900;color:${blue};margin:0 0 2px;text-transform:uppercase}
  .sub{font-size:9px;color:#444;margin-bottom:12px}
  .agreement{font-size:9px;line-height:1.6;white-space:pre-wrap;border:1px solid #ccc;padding:10px 12px;background:#fafafa;margin-bottom:12px}
  .sigblock{display:inline-block;vertical-align:top;margin-right:30px;margin-bottom:16px}
  @media print{body{padding:14px}}</style></head><body>
  <h1>Volunteer Agreement & Release of Liability</h1>
  <div class="sub">${AGENCY_NAME} · ${AGENCY_ADDRESS} · ${AGENCY_PHONE}</div>
  ${sh("Volunteer Information")}
  <div>${fl("Name", `${d.first_name || ""} ${d.last_name || ""}`.trim())}${fl("Date of Birth", d.dob)}${fl("Age", d.age, 50)}${fl("Date", d.agreement_date, 100)}</div>
  <div>${fl("Address", d.address, 220)}${fl("City", d.city, 120)}${fl("State", d.state, 40)}${fl("Zip", d.zip, 70)}</div>
  <div>${fl("Phone", d.phone)}${fl("Email", d.email, 200)}</div>
  ${sh("Agreement")}
  <div class="agreement">${AGREEMENT_TEXT}</div>
  ${sh("Signatures")}
  <div>
    <div class="sigblock">
      <div style="font-size:9px;color:#555;margin-bottom:2px">Volunteer Signature</div>
      ${sig("volunteer_sig")}
      <div style="margin-top:4px">${fl("Printed Name", d.volunteer_print, 180)}</div>
      <div>${fl("Date", d.volunteer_sig_date, 100)}</div>
    </div>
    <div class="sigblock">
      <div style="font-size:9px;color:#555;margin-bottom:2px">${AGENCY_SHORT} Representative Signature</div>
      ${sig("rep_sig")}
      <div style="margin-top:4px">${fl("Printed Name", d.rep_print, 180)}</div>
      <div>${fl("Date", d.rep_sig_date, 100)}</div>
    </div>
  </div>
  ${d.is_minor ? `
  ${sh("Parent / Guardian Consent (Volunteer Under 18)")}
  <div style="font-size:9px;margin-bottom:8px">I, the parent or legal guardian of the above-named minor, hereby consent to the minor's participation as a volunteer with ${AGENCY_SHORT} and agree to the terms of this Agreement on the minor's behalf.</div>
  <div>
    <div class="sigblock">
      <div style="font-size:9px;color:#555;margin-bottom:2px">Parent / Guardian Signature</div>
      ${sig("guardian_sig")}
      <div style="margin-top:4px">${fl("Printed Name", d.guardian_print, 180)}</div>
      <div>${fl("Minor's Name", d.minor_name, 180)}</div>
      <div>${fl("Date", d.guardian_sig_date, 100)}</div>
    </div>
  </div>` : ""}
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export default function VolunteerAgreementForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [personQuery, setPersonQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [firstName, setFirstName] = useState(prefill?.person_first || "");
  const [lastName, setLastName] = useState(prefill?.person_last || "");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState(prefill?.person_address || "");
  const [city, setCity] = useState(prefill?.person_city || "");
  const [state, setState] = useState(prefill?.person_state || "GA");
  const [zip, setZip] = useState(prefill?.person_zip || "");
  const [phone, setPhone] = useState(prefill?.person_phone || "");
  const [email, setEmail] = useState(prefill?.person_email || "");

  const [agreementDate, setAgreementDate] = useState(today());
  const [volunteerPrint, setVolunteerPrint] = useState("");
  const [volunteerSig, setVolunteerSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [volunteerSigDate, setVolunteerSigDate] = useState(today());

  const [repPrint, setRepPrint] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");
  const [repSig, setRepSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [repSigDate, setRepSigDate] = useState(today());

  const [minorName, setMinorName] = useState("");
  const [guardianPrint, setGuardianPrint] = useState("");
  const [guardianSig, setGuardianSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [guardianSigDate, setGuardianSigDate] = useState(today());

  const age = useMemo(() => calcAge(dob), [dob]);
  const minor = useMemo(() => isMinor(dob), [dob]);

  useEffect(() => {
    fetchPeople().then((ps) => {
      setPeople(ps);
      if (prefill?.person_id) {
        const p = ps.find((x) => x.id === prefill.person_id);
        if (p) selectPerson(p);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const personResults = useMemo(() => {
    if (personQuery.trim().length < 2) return [];
    const q = personQuery.toLowerCase();
    return people.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.pid || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [personQuery, people]);

  function selectPerson(p: Person) {
    setSelectedPerson(p);
    setPersonQuery(`${p.first_name} ${p.last_name}`);
    setFirstName(p.first_name);
    setLastName(p.last_name);
    setAddress(p.address || "");
    setCity(p.city || "");
    setState(p.state || "GA");
    setZip(p.zip || "");
    setPhone(p.phone || "");
    setEmail(p.email || "");
    setVolunteerPrint(`${p.first_name} ${p.last_name}`);
    if (p.dob) setDob(p.dob);
  }

  const buildFormData = (): Record<string, unknown> => ({
    agreement_date: agreementDate,
    first_name: firstName, last_name: lastName, dob, age,
    address, city, state, zip, phone, email,
    volunteer_print: volunteerPrint,
    volunteer_sig: volunteerSig?.value || null,
    volunteer_sig_ts: volunteerSig?.timestamp || null,
    volunteer_sig_date: volunteerSigDate,
    rep_print: repPrint,
    rep_sig: repSig?.value || null,
    rep_sig_ts: repSig?.timestamp || null,
    rep_sig_date: repSigDate,
    is_minor: minor,
    minor_name: minorName,
    guardian_print: guardianPrint,
    guardian_sig: guardianSig?.value || null,
    guardian_sig_ts: guardianSig?.timestamp || null,
    guardian_sig_date: guardianSigDate,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "volunteer_agreement",
        form_data: buildFormData(),
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        status: "completed",
        officer: repPrint,
        created_by: user?.username || repPrint,
      });
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as Error).message}`);
    } finally { setSaving(false); }
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 3, display: "block" };
  const fieldStyle: React.CSSProperties = { width: "100%", padding: "6px 9px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 13, background: "var(--surface)" };
  const sectionHead: React.CSSProperties = { background: MCAS_BLUE, color: "#fff", padding: "5px 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: 4, margin: "18px 0 10px" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "95vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🤝 Volunteer Agreement & Release</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>${AGENCY_NAME}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ overflowY: "auto" }}>

          {/* Person search */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7 }}>
            <label style={{ ...labelStyle, color: "#0369a1" }}>Link to Person Record</label>
            {selectedPerson ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ flex: 1 }}>✓ <strong>{selectedPerson.first_name} {selectedPerson.last_name}</strong> · {selectedPerson.pid}</span>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setSelectedPerson(null); setPersonQuery(""); }}>Change</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="Search by name or PID…" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} />
                {personResults.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,.1)", maxHeight: 200, overflowY: "auto" }}>
                    {personResults.map((p) => (
                      <div key={p.id} onClick={() => selectPerson(p)}
                        style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                        <strong>{p.first_name} {p.last_name}</strong>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.pid}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Volunteer info */}
          <div style={sectionHead}>Volunteer Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px 80px 120px", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>First Name *</label><input style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><label style={labelStyle}>Last Name *</label><input style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div><label style={labelStyle}>Date of Birth</label><DateInput style={fieldStyle} value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            <div><label style={labelStyle}>Age</label><input style={{ ...fieldStyle, background: "var(--surface-alt)" }} value={age} readOnly /></div>
            <div><label style={labelStyle}>Agreement Date</label><DateInput style={fieldStyle} value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 80px", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Address</label><input style={fieldStyle} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><label style={labelStyle}>City</label><input style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><label style={labelStyle}>State</label><input style={fieldStyle} value={state} onChange={(e) => setState(e.target.value)} /></div>
            <div><label style={labelStyle}>Zip</label><input style={fieldStyle} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>Phone</label><input style={fieldStyle} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label style={labelStyle}>Email</label><input style={fieldStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>

          {/* Agreement text */}
          <div style={sectionHead}>Agreement Text</div>
          <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 16, maxHeight: 320, overflowY: "auto", color: "var(--text-secondary)" }}>
            {AGREEMENT_TEXT}
          </div>

          {/* Minor notice */}
          {minor && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
              ⚠ <strong>Volunteer is under 18.</strong> Parent/Guardian signature is required below.
            </div>
          )}

          {/* Volunteer signatures */}
          <div style={sectionHead}>Volunteer Signature</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 12 }}>
            <div>
              <SignaturePad
                label="Volunteer Signature"
                value={volunteerSig?.value || null}
                timestamp={volunteerSig?.timestamp || null}
                onAccept={(val, ts) => setVolunteerSig({ value: val, timestamp: ts })}
                onClear={() => setVolunteerSig(null)}
              />
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Volunteer Printed Name</label>
                <input style={fieldStyle} value={volunteerPrint} onChange={(e) => setVolunteerPrint(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Date</label>
                <DateInput style={fieldStyle} value={volunteerSigDate} onChange={(e) => setVolunteerSigDate(e.target.value)} />
              </div>
            </div>
            <div>
              <SignaturePad
                label="${AGENCY_SHORT} Representative Signature"
                value={repSig?.value || null}
                timestamp={repSig?.timestamp || null}
                onAccept={(val, ts) => setRepSig({ value: val, timestamp: ts })}
                onClear={() => setRepSig(null)}
              />
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>${AGENCY_SHORT} Representative Printed Name</label>
                <input style={fieldStyle} value={repPrint} onChange={(e) => setRepPrint(e.target.value)} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Date</label>
                <DateInput style={fieldStyle} value={repSigDate} onChange={(e) => setRepSigDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Parent/Guardian (minors only) */}
          {minor && (
            <>
              <div style={sectionHead}>Parent / Guardian Consent (Minor Volunteer)</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                I, the parent or legal guardian of the above-named minor, hereby consent to the minor&apos;s participation as a volunteer with ${AGENCY_SHORT} and agree to the terms of this Agreement on the minor&apos;s behalf.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20 }}>
                <div>
                  <SignaturePad
                    label="Parent / Guardian Signature"
                    value={guardianSig?.value || null}
                    timestamp={guardianSig?.timestamp || null}
                    onAccept={(val, ts) => setGuardianSig({ value: val, timestamp: ts })}
                    onClear={() => setGuardianSig(null)}
                  />
                  <div style={{ marginTop: 8 }}>
                    <label style={labelStyle}>Parent / Guardian Printed Name</label>
                    <input style={fieldStyle} value={guardianPrint} onChange={(e) => setGuardianPrint(e.target.value)} />
                  </div>
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Minor&apos;s Full Name</label>
                    <input style={fieldStyle} value={minorName || `${firstName} ${lastName}`.trim()} onChange={(e) => setMinorName(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date</label>
                    <DateInput style={fieldStyle} value={guardianSigDate} onChange={(e) => setGuardianSigDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => printVolunteerAgreement(buildFormData())}>🖨 Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !firstName || !lastName}>
            {saving ? "Saving…" : "Save Agreement"}
          </button>
        </div>
      </div>
    </div>
  );
}
