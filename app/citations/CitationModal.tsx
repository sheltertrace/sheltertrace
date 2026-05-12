"use client";
import { useState, useEffect } from "react";
import { createCitation, fetchCourtSettings, markCitationNotified } from "@/lib/data";
import { today, nowTime, genCitationNumber } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import type { Citation, CourtSettings } from "@/lib/types";
import { CITABLE_ORDINANCES, MORGAN_COUNTY_ORDINANCES } from "@/lib/constants";
import SignaturePad from "@/components/ui/SignaturePad";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import { openCourtEmail } from "@/lib/courtEmail";

const ORDINANCE_ARTICLES = Array.from(new Set(CITABLE_ORDINANCES.map((o) => o.article)));

function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{req && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function SH({ title }: { title: string }) {
  return (
    <div style={{ fontWeight: 700, color: "var(--teal)", margin: "14px 0 10px", fontSize: 13, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
      {title}
    </div>
  );
}

interface Props {
  onSave: (cit: Citation) => void;
  onClose: () => void;
}

export default function CitationModal({ onSave, onClose }: Props) {
  const { user } = useAuth();
  const [citType, setCitType] = useState<"Digital" | "Physical">("Digital");
  const [citNumber, setCitNumber] = useState(genCitationNumber());
  const [physCitNumber, setPhysCitNumber] = useState("");
  const [animalImpound, setAnimalImpound] = useState("");
  const [violations, setViolations] = useState([{ code: CITABLE_ORDINANCES[0].code, description: CITABLE_ORDINANCES[0].description, count: 1 }]);

  // Violator — split name
  const [violatorFirst, setViolatorFirst] = useState("");
  const [violatorMiddle, setViolatorMiddle] = useState("");
  const [violatorLast, setViolatorLast] = useState("");
  const [violatorEmail, setViolatorEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [violatorAddress, setViolatorAddress] = useState("");
  const [violatorCity, setViolatorCity] = useState("");
  const [violatorState, setViolatorState] = useState("GA");
  const [violatorZip, setViolatorZip] = useState("");
  const [violatorPhone, setViolatorPhone] = useState("");
  const [violatorDl, setViolatorDl] = useState("");
  const [violatorSex, setViolatorSex] = useState("");
  const [violatorDob, setViolatorDob] = useState("");
  const [descHair, setDescHair] = useState("");
  const [descEyes, setDescEyes] = useState("");
  const [descWeight, setDescWeight] = useState("");
  const [descHeight, setDescHeight] = useState("");
  const [animalDesc, setAnimalDesc] = useState("");
  const [remarks, setRemarks] = useState("");

  // Officer
  const [issuingOfficer, setIssuingOfficer] = useState(user ? `${user.firstName} ${user.lastName}` : "");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [servedBy, setServedBy] = useState("Personal Service");
  const [citDate, setCitDate] = useState(today());
  const [citTime, setCitTime] = useState(nowTime());
  const [citLocation, setCitLocation] = useState("");

  // Court
  const [courtType, setCourtType] = useState("Magistrate");
  const [courtDate, setCourtDate] = useState("");
  const [courtTime, setCourtTime] = useState("");
  const [courtAmPm, setCourtAmPm] = useState("AM");
  const [fineAmount, setFineAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [citNotes, setCitNotes] = useState("");

  // Signatures
  const [violatorSig, setViolatorSig] = useState<string | null>(null);
  const [violatorSigAt, setViolatorSigAt] = useState<string | null>(null);
  const [officerSig, setOfficerSig] = useState<string | null>(null);
  const [officerSigAt, setOfficerSigAt] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [issuedCitation, setIssuedCitation] = useState<Citation | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [courtSettings, setCourtSettings] = useState<CourtSettings>({ magistrate_email: "", municipal_email: "", portal_url: "https://sheltertrace.com/court" });

  useEffect(() => { fetchCourtSettings().then(setCourtSettings); }, []);

  const addViolation = () =>
    setViolations((prev) => [...prev, { code: CITABLE_ORDINANCES[0].code, description: CITABLE_ORDINANCES[0].description, count: 1 }]);

  const updateViolation = (i: number, field: string, val: string | number) => {
    setViolations((prev) => prev.map((v, j) => {
      if (j !== i) return v;
      if (field === "code") {
        const found = MORGAN_COUNTY_ORDINANCES.find((o) => o.code === val);
        return { ...v, code: val as string, description: found?.description || v.description };
      }
      return { ...v, [field]: val };
    }));
  };

  // Format "Last, First M." for formal documents
  const formalName = [
    violatorLast,
    violatorFirst + (violatorMiddle ? ` ${violatorMiddle.charAt(0).toUpperCase()}.` : ""),
  ].filter(Boolean).join(", ");

  const handleSave = async () => {
    if (citType === "Digital" && !violatorEmail.trim()) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    setSaving(true);
    try {
      const cit = await createCitation({
        citation_number: citNumber,
        physical_cit_number: physCitNumber || undefined,
        animal_impound: animalImpound || undefined,
        violations,
        violator_name: formalName || `${violatorFirst} ${violatorLast}`.trim() || "—",
        violator_first: violatorFirst || undefined,
        violator_middle: violatorMiddle || undefined,
        violator_last: violatorLast || undefined,
        violator_email: violatorEmail || undefined,
        violator_address: violatorAddress,
        violator_city: violatorCity,
        violator_state: violatorState,
        violator_zip: violatorZip,
        violator_phone: violatorPhone,
        violator_dl: violatorDl,
        violator_sex: violatorSex,
        violator_dob: violatorDob || undefined,
        desc_hair: descHair, desc_eyes: descEyes, desc_weight: descWeight, desc_height: descHeight,
        animal_desc: animalDesc, remarks,
        issuing_officer: issuingOfficer, badge_number: badgeNumber, served_by: servedBy,
        date: citDate, time: citTime, location: citLocation,
        court_type: courtType, court_date: courtDate || undefined, court_time: courtTime,
        court_am_pm: courtAmPm, fine_amount: fineAmount ? parseFloat(fineAmount) : null, due_date: dueDate || undefined,
        notes: citNotes, status: "Issued", citation_type: citType,
        violator_signature: violatorSig || undefined,
        officer_signature: officerSig || undefined,
        signed_at: violatorSig ? violatorSigAt || undefined : undefined,
      });
      if (citType === "Digital" && violatorEmail) {
        setSentTo(violatorEmail);
      }
      setIssuedCitation(cit);
      onSave(cit);
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      console.error("[createCitation] error:", err?.message, err?.details);
      alert(`Failed to save citation: ${err?.message || "Unknown error"}\n${err?.details || ""}`);
    } finally { setSaving(false); }
  };

  const canSave = !!citNumber && (!!violatorFirst || !!violatorLast) &&
    (citType === "Physical" || !!violatorEmail.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "95vh" }}>
        <div className="modal-header">
          <div>
            <span className="modal-title">Issue Citation</span>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {(["Digital", "Physical"] as const).map((t) => (
                <button key={t} onClick={() => { setCitType(t); setEmailError(false); }}
                  className={`btn btn-sm ${citType === t ? "btn-primary" : "btn-secondary"}`}>{t}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Digital banner */}
          {citType === "Digital" && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#1d4ed8" }}>
              📧 Digital citation — violator email is required. Citation will be sent to violator upon issuance. Signature pads enabled.
            </div>
          )}

          <SH title="Citation Identification" />
          <div className="grid-3">
            <F label="Citation Number" req><input className="form-input" value={citNumber} onChange={(e) => setCitNumber(e.target.value)} /></F>
            {citType === "Physical" && <F label="Physical Citation #"><input className="form-input" value={physCitNumber} onChange={(e) => setPhysCitNumber(e.target.value)} /></F>}
            <F label="Animal Impound #"><input className="form-input" value={animalImpound} onChange={(e) => setAnimalImpound(e.target.value)} /></F>
          </div>

          <SH title="Violator Information" />
          <div style={{ marginBottom: 12 }}>
            <ScanLicenseButton
              label="📷 Scan Driver's License — Auto-Fill Violator Info"
              style={{ fontSize: 13, padding: "8px 16px" }}
              onScan={(d) => {
                if (d.firstName)     setViolatorFirst(d.firstName);
                if (d.middleName)    setViolatorMiddle(d.middleName);
                if (d.lastName)      setViolatorLast(d.lastName);
                if (d.address)       setViolatorAddress(d.address);
                if (d.city)          setViolatorCity(d.city);
                if (d.state)         setViolatorState(d.state);
                if (d.zip)           setViolatorZip(d.zip);
                if (d.dob)           setViolatorDob(d.dob);
                if (d.licenseNumber) setViolatorDl(d.licenseNumber);
                if (d.sex)           setViolatorSex(d.sex === "Male" ? "M" : d.sex === "Female" ? "F" : "");
              }}
            />
          </div>
          <div className="grid-3">
            <F label="First Name" req>
              <input className="form-input" value={violatorFirst} onChange={(e) => setViolatorFirst(e.target.value)} />
            </F>
            <F label="Middle Name">
              <input className="form-input" value={violatorMiddle} onChange={(e) => setViolatorMiddle(e.target.value)} placeholder="Optional" />
            </F>
            <F label="Last Name" req>
              <input className="form-input" value={violatorLast} onChange={(e) => setViolatorLast(e.target.value)} />
            </F>
            <F label={citType === "Digital" ? "Email *" : "Email"}>
              <input
                className="form-input"
                type="email"
                value={violatorEmail}
                onChange={(e) => { setViolatorEmail(e.target.value); if (e.target.value) setEmailError(false); }}
                placeholder={citType === "Digital" ? "Required for digital citation" : "Optional"}
                style={emailError ? { borderColor: "#dc2626" } : undefined}
              />
              {emailError && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 3 }}>Email is required for digital citations</div>}
            </F>
            <F label="Phone"><input className="form-input" value={violatorPhone} onChange={(e) => setViolatorPhone(e.target.value)} /></F>
            <F label="Driver's License"><input className="form-input" value={violatorDl} onChange={(e) => setViolatorDl(e.target.value)} /></F>
            <F label="Address"><input className="form-input" value={violatorAddress} onChange={(e) => setViolatorAddress(e.target.value)} /></F>
            <F label="City"><input className="form-input" value={violatorCity} onChange={(e) => setViolatorCity(e.target.value)} /></F>
            <F label="State / ZIP">
              <div style={{ display: "flex", gap: 6 }}>
                <input className="form-input" value={violatorState} onChange={(e) => setViolatorState(e.target.value)} maxLength={2} style={{ width: 60 }} />
                <input className="form-input" value={violatorZip} onChange={(e) => setViolatorZip(e.target.value)} maxLength={10} />
              </div>
            </F>
            <F label="Sex"><select className="form-select" value={violatorSex} onChange={(e) => setViolatorSex(e.target.value)}><option value="">—</option><option>M</option><option>F</option></select></F>
            <F label="Date of Birth"><input className="form-input" type="date" value={violatorDob} onChange={(e) => setViolatorDob(e.target.value)} /></F>
          </div>
          {(violatorFirst || violatorLast) && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
              Formal name (citation): <strong>{formalName || `${violatorFirst} ${violatorLast}`.trim()}</strong>
            </div>
          )}

          <SH title="Physical Description" />
          <div className="grid-4">
            <F label="Hair"><input className="form-input" value={descHair} onChange={(e) => setDescHair(e.target.value)} /></F>
            <F label="Eyes"><input className="form-input" value={descEyes} onChange={(e) => setDescEyes(e.target.value)} /></F>
            <F label="Weight"><input className="form-input" value={descWeight} onChange={(e) => setDescWeight(e.target.value)} placeholder="e.g. 180 lbs" /></F>
            <F label="Height"><input className="form-input" value={descHeight} onChange={(e) => setDescHeight(e.target.value)} placeholder='e.g. 5&apos;10"' /></F>
          </div>

          <SH title="Violations" />
          {violations.map((v, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 76px 30px", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{i + 1}.</div>
                <select className="form-select" style={{ fontSize: 12 }} value={v.code} onChange={(e) => updateViolation(i, "code", e.target.value)}>
                  {ORDINANCE_ARTICLES.map((article) => (
                    <optgroup key={article} label={article}>
                      {CITABLE_ORDINANCES.filter((o) => o.article === article).map((o) => (
                        <option key={o.code} value={o.code}>{o.code} — {o.title}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0 }}>×</span>
                  <input className="form-input" type="number" min={1} value={v.count} style={{ fontSize: 12 }} title="Quantity — how many times this violation occurred" onChange={(e) => updateViolation(i, "count", parseInt(e.target.value) || 1)} />
                </div>
                {violations.length > 1
                  ? <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", padding: 4 }} onClick={() => setViolations((p) => p.filter((_, j) => j !== i))}>✕</button>
                  : <div />}
              </div>
              <input className="form-input" style={{ fontSize: 12 }} value={v.description} onChange={(e) => updateViolation(i, "description", e.target.value)} placeholder="Violation description (auto-filled, editable)" />
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addViolation} style={{ marginBottom: 12 }}>+ Add Violation</button>

          <F label="Animal Description"><textarea className="form-textarea" value={animalDesc} onChange={(e) => setAnimalDesc(e.target.value)} rows={2} /></F>
          <F label="Remarks"><textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></F>

          <SH title="Court Information" />
          <div className="grid-3">
            <F label="Court Type">
              <select className="form-select" value={courtType} onChange={(e) => setCourtType(e.target.value)}>
                <option value="Magistrate">Morgan County Magistrate Court</option><option value="State">Morgan County State Court</option>
              </select>
            </F>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", alignSelf: "flex-end", paddingBottom: 10 }}>
              {courtType === "Magistrate" ? "149 E Jefferson St, Madison, GA 30650" : "118 N Main St, Madison, GA 30650"}
            </div>
            <F label="Court Date"><input className="form-input" type="date" value={courtDate} onChange={(e) => setCourtDate(e.target.value)} /></F>
            <F label="Court Time"><input className="form-input" value={courtTime} onChange={(e) => setCourtTime(e.target.value)} placeholder="e.g. 9:00" /></F>
            <F label="AM/PM"><select className="form-select" value={courtAmPm} onChange={(e) => setCourtAmPm(e.target.value)}><option>AM</option><option>PM</option></select></F>
            <F label="Fine Amount ($)"><input className="form-input" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} placeholder="0.00" /></F>
            <F label="Due Date"><input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></F>
          </div>

          <SH title="Officer & Service" />
          <div className="grid-3">
            <F label="Issuing Officer" req><input className="form-input" value={issuingOfficer} onChange={(e) => setIssuingOfficer(e.target.value)} /></F>
            <F label="Badge Number"><input className="form-input" value={badgeNumber} onChange={(e) => setBadgeNumber(e.target.value)} /></F>
            <F label="Served By">
              <select className="form-select" value={servedBy} onChange={(e) => setServedBy(e.target.value)}>
                {["Personal Service", "Posted on Door", "Certified Mail", "Hand Delivered"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="Date"><input className="form-input" type="date" value={citDate} onChange={(e) => setCitDate(e.target.value)} /></F>
            <F label="Time"><input className="form-input" value={citTime} onChange={(e) => setCitTime(e.target.value)} /></F>
            <F label="Location"><input className="form-input" value={citLocation} onChange={(e) => setCitLocation(e.target.value)} /></F>
          </div>
          <F label="Notes"><textarea className="form-textarea" value={citNotes} onChange={(e) => setCitNotes(e.target.value)} rows={2} /></F>

          {/* Signatures — Digital only */}
          {citType === "Digital" && (
            <>
              <SH title="Signatures" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <SignaturePad
                  label="Violator Signature"
                  value={violatorSig}
                  timestamp={violatorSigAt}
                  onAccept={(data, ts) => { setViolatorSig(data); setViolatorSigAt(ts); }}
                  onClear={() => { setViolatorSig(null); setViolatorSigAt(null); }}
                />
                <SignaturePad
                  label="Officer Signature"
                  value={officerSig}
                  timestamp={officerSigAt}
                  onAccept={(data, ts) => { setOfficerSig(data); setOfficerSigAt(ts); }}
                  onClear={() => { setOfficerSig(null); setOfficerSigAt(null); }}
                />
              </div>
            </>
          )}

          {issuedCitation && (
            <div style={{ marginTop: 12, padding: "14px 16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#15803d", marginBottom: 10 }}>
                ✓ Citation #{issuedCitation.citation_number} issued successfully
              </div>
              {sentTo && (
                <div style={{ fontSize: 12, color: "#15803d", marginBottom: 10 }}>
                  Digital citation recorded for <strong>{sentTo}</strong>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {/* Print / Download */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const w = window.open("", "_blank", "width=700,height=900");
                    if (!w) return;
                    const courtAddr = issuedCitation.court_type === "Magistrate" ? "149 E Jefferson St, Madison, GA 30650" : "118 N Main St, Madison, GA 30650";
                    w.document.write(`<html><head><title>Citation ${issuedCitation.citation_number}</title><style>body{font-family:serif;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:4px 6px}.s{margin:8px 0;font-weight:bold;font-size:11px;border-bottom:2px solid #000;padding-bottom:2px;text-transform:uppercase}@media print{body{padding:12px}}</style></head><body>
                      <div style="text-align:center;margin-bottom:10px"><strong style="font-size:14px">MORGAN COUNTY ANIMAL SERVICES</strong><br>2392 Athens Hwy, Madison, GA 30650<br><em>Uniform Citation, Summons, Accusation</em></div>
                      <div class="s">Citation #${issuedCitation.citation_number} — ${issuedCitation.date || ""}</div>
                      <div class="s">VIOLATOR</div><table><tr><td><b>Name:</b> ${issuedCitation.violator_name || "—"}</td><td><b>DL:</b> ${issuedCitation.violator_dl || "—"}</td></tr><tr><td colspan="2"><b>Address:</b> ${[issuedCitation.violator_address, issuedCitation.violator_city, issuedCitation.violator_state].filter(Boolean).join(", ") || "—"}</td></tr><tr><td><b>Phone:</b> ${issuedCitation.violator_phone || "—"}</td><td><b>DOB:</b> ${issuedCitation.violator_dob || "—"}</td></tr></table>
                      <div class="s">VIOLATIONS</div><table><tr><th>Count</th><th>Code</th><th>Description</th></tr>${(issuedCitation.violations || []).map((v: {code:string;description:string;count:number}) => `<tr><td style="text-align:center">×${v.count}</td><td>§ ${v.code}</td><td>${v.description}</td></tr>`).join("")}</table>
                      <div class="s">COURT INFORMATION</div><div><b>Court:</b> ${issuedCitation.court_type} Court — ${courtAddr}</div><div><b>Date:</b> ${issuedCitation.court_date || "—"} at ${issuedCitation.court_time || "—"} ${issuedCitation.court_am_pm || ""}</div><div><b>Fine:</b> $${issuedCitation.fine_amount || "0.00"} &nbsp; <b>Due:</b> ${issuedCitation.due_date || "—"}</div>
                      <div class="s">OFFICER</div><div><b>Issuing Officer:</b> ${issuedCitation.issuing_officer || "—"} &nbsp; <b>Badge:</b> ${issuedCitation.badge_number || "—"}</div>
                    </body></html>`);
                    w.document.close();
                    setTimeout(() => w.print(), 400);
                  }}
                >
                  🖨 Print / Download
                </button>

                {/* Copy citation link */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const url = `${window.location.origin}/citations?id=${issuedCitation.id}`;
                    navigator.clipboard.writeText(url).catch(() => {});
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? "✓ Copied!" : "🔗 Copy Citation Link"}
                </button>

                {/* Send email to violator */}
                {issuedCitation.violator_email && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={emailSending}
                    onClick={async () => {
                      setEmailSending(true);
                      setEmailResult(null);
                      try {
                        const { markCitationEmailSent } = await import("@/lib/data");
                        const courtAddr = issuedCitation.court_type === "Magistrate"
                          ? "149 E Jefferson St, Madison, GA 30650"
                          : "118 N Main St, Madison, GA 30650";
                        const courtName = issuedCitation.court_type === "Magistrate"
                          ? "Morgan County Magistrate Court"
                          : "Morgan County State Court";
                        const res = await fetch("/api/send-citation-email", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            violatorEmail: issuedCitation.violator_email,
                            violatorName: [issuedCitation.violator_last, issuedCitation.violator_first].filter(Boolean).join(", ") || issuedCitation.violator_name || "",
                            citationNumber: issuedCitation.citation_number,
                            citationDate: issuedCitation.date || "",
                            violations: issuedCitation.violations || [],
                            fineAmount: issuedCitation.fine_amount,
                            dueDate: issuedCitation.due_date,
                            courtName, courtAddress: courtAddr,
                            courtDate: issuedCitation.court_date,
                            courtTime: issuedCitation.court_time,
                            courtAmPm: issuedCitation.court_am_pm,
                            officerName: issuedCitation.issuing_officer,
                            officerBadge: issuedCitation.badge_number,
                            animalInfo: issuedCitation.animal_desc,
                            remarks: issuedCitation.remarks,
                          }),
                        });
                        const json = await res.json();
                        if (!json.success) {
                          setEmailResult({ ok: false, msg: json.error || "Email service not configured. Use Print instead." });
                        } else {
                          if (issuedCitation.id) await markCitationEmailSent(issuedCitation.id);
                          setEmailResult({ ok: true, msg: `Email sent to ${issuedCitation.violator_email}` });
                        }
                      } catch (e) {
                        setEmailResult({ ok: false, msg: (e as Error).message || "Failed to send email." });
                      } finally { setEmailSending(false); }
                    }}
                  >
                    {emailSending ? "Sending…" : `✉ Email Violator (${issuedCitation.violator_email})`}
                  </button>
                )}

                {/* Court notification */}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const opened = openCourtEmail(issuedCitation, courtSettings);
                    if (opened && issuedCitation.id) {
                      await markCitationNotified(issuedCitation.id);
                    } else if (!opened) {
                      alert(`No ${issuedCitation.court_type || "Magistrate"} Court email configured. Go to Admin → Court Settings.`);
                    }
                  }}
                >
                  📧 Send Court Notification
                </button>
              </div>

              {emailResult && (
                <div style={{ fontSize: 12, color: emailResult.ok ? "#15803d" : "#b91c1c", padding: "6px 10px", background: emailResult.ok ? "#dcfce7" : "#fef2f2", borderRadius: 5, marginBottom: 6 }}>
                  {emailResult.ok ? "✓" : "⚠"} {emailResult.msg}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                Court notification opens your email client with a pre-filled message to {issuedCitation.court_type || "Magistrate"} Court
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? "Issuing…" : `Issue ${citType} Citation`}
          </button>
        </div>
      </div>
    </div>
  );
}
