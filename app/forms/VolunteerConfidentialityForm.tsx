"use client";
import { useState, useEffect, useMemo } from "react";
import { createForm, fetchPeople } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { ShelterForm, Person, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";

const MCAS_BLUE = "#0f2942";

const CONFIDENTIALITY_TEXT = `VOLUNTEER CONFIDENTIALITY AGREEMENT

This Confidentiality Agreement ("Agreement") is entered into between Morgan County Animal Services ("MCAS"), a division of Morgan County, Georgia, and the undersigned volunteer ("Volunteer").

WHEREAS, in the course of Volunteer's service with MCAS, Volunteer may have access to confidential and sensitive information; and

WHEREAS, MCAS desires to protect such information from unauthorized disclosure;

NOW, THEREFORE, in consideration of being permitted to serve as a volunteer with MCAS, and other good and valuable consideration, the parties agree as follows:

1. DEFINITION OF CONFIDENTIAL INFORMATION. "Confidential Information" includes, but is not limited to:
   a) Information about animals in MCAS custody, including medical history, behavior records, and case histories;
   b) Information about individuals who interact with MCAS, including adopters, owners, complainants, and witnesses;
   c) Personnel information about MCAS staff and other volunteers;
   d) Operational procedures, protocols, and internal policies of MCAS;
   e) Legal matters, pending investigations, or law enforcement activities;
   f) Financial information related to MCAS operations;
   g) Any other information designated as confidential by MCAS staff.

2. OBLIGATIONS OF VOLUNTEER. Volunteer agrees to:
   a) Hold all Confidential Information in strict confidence;
   b) Not disclose any Confidential Information to any unauthorized person, including but not limited to family members, friends, acquaintances, or other volunteers who do not have a demonstrated need to know;
   c) Not use Confidential Information for any personal benefit or the benefit of any third party;
   d) Not post, publish, or otherwise share Confidential Information on social media platforms, websites, blogs, or any other public medium, including photographs, videos, or other media taken at MCAS;
   e) Access Confidential Information only to the extent necessary to perform volunteer duties;
   f) Report any known or suspected unauthorized disclosure of Confidential Information to MCAS management immediately.

3. MEDIA AND PHOTOGRAPHY. Volunteer understands that photographing or recording animals, clients, staff, or MCAS facilities without explicit permission from MCAS management is prohibited. Any media created with MCAS authorization shall remain the property of MCAS and may not be used for personal gain or posted publicly without written permission.

4. SOCIAL MEDIA. Volunteer shall not post on social media any information about specific animals in MCAS custody, ongoing cases or investigations, individuals who interact with MCAS, or any other information that could identify MCAS clients, staff, or operations, without prior written approval from MCAS management.

5. RETURN OF MATERIALS. Upon conclusion of volunteer service, Volunteer agrees to promptly return to MCAS all documents, records, and materials containing Confidential Information, in whatever form, that are in Volunteer's possession or control.

6. SURVIVAL. The obligations set forth in this Agreement shall survive the termination or expiration of Volunteer's service with MCAS and shall continue indefinitely.

7. CONSEQUENCES OF BREACH. Volunteer understands that any violation of this Agreement may result in:
   a) Immediate termination of volunteer service;
   b) Legal action by Morgan County, including claims for damages;
   c) Referral to appropriate authorities if the breach involves criminal conduct.

8. ENTIRE AGREEMENT. This Agreement constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior agreements, representations, and understandings.

BY SIGNING BELOW, I ACKNOWLEDGE THAT I HAVE READ AND UNDERSTAND THIS AGREEMENT AND AGREE TO BE BOUND BY ITS TERMS.`;

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printVolunteerConfidentiality(d: Record<string, unknown>) {
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
  w.document.write(`<html><head><title>Volunteer Confidentiality Agreement</title>
  <style>body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.5}
  h1{font-size:15px;font-weight:900;color:${blue};margin:0 0 2px;text-transform:uppercase}
  .sub{font-size:9px;color:#444;margin-bottom:12px}
  .agreement{font-size:9px;line-height:1.6;white-space:pre-wrap;border:1px solid #ccc;padding:10px 12px;background:#fafafa;margin-bottom:12px}
  .sigblock{display:inline-block;vertical-align:top;margin-right:30px;margin-bottom:16px}
  @media print{body{padding:14px}}</style></head><body>
  <h1>Volunteer Confidentiality Agreement</h1>
  <div class="sub">Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</div>
  ${sh("Volunteer")}
  <div>${fl("Volunteer Name", `${d.first_name || ""} ${d.last_name || ""}`.trim(), 220)}${fl("Date", d.agreement_date, 110)}</div>
  ${sh("Agreement")}
  <div class="agreement">${CONFIDENTIALITY_TEXT}</div>
  ${sh("Signature")}
  <div class="sigblock">
    <div style="font-size:9px;color:#555;margin-bottom:2px">Volunteer Signature</div>
    ${sig("volunteer_sig")}
    <div style="margin-top:4px">${fl("Printed Name", d.volunteer_print, 200)}</div>
    <div>${fl("Date", d.sig_date, 110)}</div>
  </div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export default function VolunteerConfidentialityForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [people, setPeople] = useState<Person[]>([]);
  const [personQuery, setPersonQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [firstName, setFirstName] = useState(prefill?.person_first || "");
  const [lastName, setLastName] = useState(prefill?.person_last || "");

  const [agreementDate, setAgreementDate] = useState(today());
  const [volunteerPrint, setVolunteerPrint] = useState(() => {
    const f = prefill?.person_first || "";
    const l = prefill?.person_last || "";
    return `${f} ${l}`.trim();
  });
  const [volunteerSig, setVolunteerSig] = useState<{ value: string; timestamp: string } | null>(null);
  const [sigDate, setSigDate] = useState(today());
  const [processedBy] = useState(user ? `${user.firstName} ${user.lastName}`.trim() : "");

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
    setVolunteerPrint(`${p.first_name} ${p.last_name}`);
  }

  const buildFormData = (): Record<string, unknown> => ({
    agreement_date: agreementDate,
    first_name: firstName, last_name: lastName,
    volunteer_print: volunteerPrint,
    volunteer_sig: volunteerSig?.value || null,
    volunteer_sig_ts: volunteerSig?.timestamp || null,
    sig_date: sigDate,
    processed_by: processedBy,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await createForm({
        form_type: "volunteer_confidentiality",
        form_data: buildFormData(),
        linked_person_id: selectedPerson?.id || prefill?.person_id,
        status: "completed",
        officer: processedBy,
        created_by: user?.username || processedBy,
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
            <div className="modal-title">🔒 Volunteer Confidentiality Agreement</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Morgan County Animal Services</div>
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

          {/* Volunteer name + date */}
          <div style={sectionHead}>Volunteer Information</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, marginBottom: 12 }}>
            <div><label style={labelStyle}>First Name *</label><input style={fieldStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><label style={labelStyle}>Last Name *</label><input style={fieldStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            <div><label style={labelStyle}>Agreement Date</label><input style={fieldStyle} type="date" value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} /></div>
          </div>

          {/* Agreement text */}
          <div style={sectionHead}>Confidentiality Agreement</div>
          <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 16, maxHeight: 380, overflowY: "auto", color: "var(--text-secondary)" }}>
            {CONFIDENTIALITY_TEXT}
          </div>

          {/* Signature */}
          <div style={sectionHead}>Signature</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
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
                <input style={fieldStyle} type="date" value={sigDate} onChange={(e) => setSigDate(e.target.value)} />
              </div>
            </div>
            <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, fontSize: 12, color: "#15803d" }}>
              <strong>Instructions for Volunteer:</strong>
              <ol style={{ margin: "8px 0 0 16px", padding: 0, lineHeight: 1.8 }}>
                <li>Read the full agreement above carefully.</li>
                <li>Sign in the signature box using your finger or mouse.</li>
                <li>Print your name in the field below your signature.</li>
                <li>A staff member will save and file this agreement.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => printVolunteerConfidentiality(buildFormData())}>🖨 Print</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !firstName || !lastName}>
            {saving ? "Saving…" : "Save Agreement"}
          </button>
        </div>
      </div>
    </div>
  );
}
