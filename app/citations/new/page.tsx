"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchCall, fetchPerson, createCitation, uploadCitationPhotoId } from "@/lib/data";
import type { DispatchCall, Person } from "@/lib/types";
import { today, nowTime, genCitationNumber } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import { CITABLE_ORDINANCES, MORGAN_COUNTY_ORDINANCES } from "@/lib/constants";
import SignaturePad from "@/components/ui/SignaturePad";
import PhotoIdThumb from "@/components/ui/PhotoIdThumb";

const ORDINANCE_ARTICLES = Array.from(new Set(CITABLE_ORDINANCES.map((o) => o.article)));

function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{req && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontWeight: 700, color: "var(--teal)", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, margin: "20px 0 12px", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
      {title}
    </div>
  );
}

function CitationNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callId = searchParams.get("callId");
  const { user } = useAuth();

  const [call, setCall] = useState<DispatchCall | null>(null);
  const [loadingCall, setLoadingCall] = useState(!!callId);
  const [linkedPerson, setLinkedPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");

  const [citType, setCitType] = useState<"Digital" | "Physical">("Digital");
  const [citNumber, setCitNumber] = useState(genCitationNumber());
  const [physCitNumber, setPhysCitNumber] = useState("");
  const [animalImpound, setAnimalImpound] = useState("");
  const [violations, setViolations] = useState([{ code: CITABLE_ORDINANCES[0].code, description: CITABLE_ORDINANCES[0].description, count: 1 }]);
  const [violatorFirst, setViolatorFirst] = useState("");
  const [violatorMiddle, setViolatorMiddle] = useState("");
  const [violatorLast, setViolatorLast] = useState("");
  const [violatorEmail, setViolatorEmail] = useState("");
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
  const [issuingOfficer, setIssuingOfficer] = useState(user ? `${user.firstName} ${user.lastName}` : "");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [servedBy, setServedBy] = useState("Personal Service");
  const [citDate, setCitDate] = useState(today());
  const [citTime, setCitTime] = useState(nowTime());
  const [citLocation, setCitLocation] = useState("");
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

  // Photo ID
  const [citPhotoId, setCitPhotoId] = useState<string | null>(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(false);
  const photoIdRef = useRef<HTMLInputElement>(null);

  // Load and pre-fill from dispatch call
  useEffect(() => {
    if (!callId) return;
    fetchCall(callId).then((c) => {
      if (!c) { setLoadingCall(false); return; }
      setCall(c);
      type P = Record<string, unknown>;
      const parties = (c.involved_parties || []) as P[];
      const suspect = parties.find((p) => p.role === "Suspect");
      const aSus = parties.find((p) => p.role === "AnimalSuspect");
      const aVic = parties.find((p) => p.role === "AnimalVictim");
      const s = (v: unknown) => (v as string) || "";

      // Fetch linked person for photo ID display
      const suspectPersonId = s(suspect?.person_id);
      if (suspectPersonId) {
        fetchPerson(suspectPersonId).then((p) => {
        if (p) {
          setLinkedPerson(p);
          if (p.photo_id_url) setCitPhotoId(p.photo_id_url);
        }
      });
      }

      if (suspect) {
        // Try to split name into first/middle/last
        const fullName = s(suspect.name).trim();
        const nameParts = fullName.split(/\s+/);
        if (nameParts.length === 1) {
          setViolatorFirst(nameParts[0]);
        } else if (nameParts.length === 2) {
          setViolatorFirst(nameParts[0]);
          setViolatorLast(nameParts[1]);
        } else if (nameParts.length >= 3) {
          setViolatorFirst(nameParts[0]);
          setViolatorMiddle(nameParts[1]);
          setViolatorLast(nameParts.slice(2).join(" "));
        }
        setViolatorPhone(s(suspect.phone));
        setViolatorAddress(s(suspect.address));
        setViolatorDl(s(suspect.dl));
        setViolatorDob(s(suspect.dob));
        setViolatorSex(s(suspect.sex));
        setDescHair(s(suspect.hair));
        setDescEyes(s(suspect.eyes));
        setDescWeight(s(suspect.weight));
        setDescHeight(s(suspect.height));
      }

      const loc = [c.address, c.city].filter(Boolean).join(", ");
      if (loc) setCitLocation(loc);
      if (c.city) setViolatorCity(c.city);

      const buildAnimalDesc = (p: P) =>
        [s(p.species), s(p.breed), s(p.color), s(p.sex), s(p.desc)].filter(Boolean).join(" ");
      const parts: string[] = [];
      if (aSus) parts.push(buildAnimalDesc(aSus));
      if (aVic) parts.push(buildAnimalDesc(aVic));
      if (parts.length > 0) setAnimalDesc(parts.join("; "));

      const officers = (c.assigned_officers || []) as Array<{ name: string; badge: string }>;
      if (officers.length > 0) {
        setIssuingOfficer(officers[0].name || "");
        setBadgeNumber(officers[0].badge || "");
      }

      setRemarks(`Related to dispatch call ${callId}`);
      setLoadingCall(false);
    });
  }, [callId]);

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

  const formalName = [
    violatorLast,
    violatorFirst + (violatorMiddle ? ` ${violatorMiddle.charAt(0).toUpperCase()}.` : ""),
  ].filter(Boolean).join(", ");

  const canSave = !!citNumber && (!!violatorFirst || !!violatorLast) && (citType === "Physical" || !!violatorEmail.trim());

  const handleSave = async () => {
    if (!canSave) return;
    if (citType === "Digital" && !violatorEmail.trim()) {
      setEmailError("Email is required for digital citations");
      return;
    }
    setSaving(true);
    try {
      await createCitation({
        citation_number: citNumber,
        physical_cit_number: physCitNumber || undefined,
        animal_impound: animalImpound || undefined,
        call_id: callId || undefined,
        violations,
        violator_name: formalName || `${violatorFirst} ${violatorLast}`.trim(),
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
        signed_at: violatorSigAt || officerSigAt || undefined,
        photo_id_url: citPhotoId || undefined,
      });
      if (citType === "Digital" && violatorEmail.trim()) {
        setSentTo(violatorEmail.trim());
        return; // stay on page to show confirmation
      }
      router.push(callId ? `/dispatch/${callId}?step=8` : "/citations");
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to save citation: ${err?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  const backLabel = callId ? `← Back to Call ${callId}` : "← Back to Citations";
  const backHref = callId ? `/dispatch/${callId}` : "/citations";

  if (loadingCall) {
    return (
      <AppShell title="Issue Citation">
        <div className="empty-state" style={{ padding: "60px 0" }}>Loading call data…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Issue Citation">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push(backHref)} style={{ color: "var(--text-secondary)" }}>
          {backLabel}
        </button>
        {call && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 13 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#1d4ed8" }}>{call.id}</span>
              <span style={{ color: "var(--text-secondary)" }}>{call.type} · {call.address}{call.city ? `, ${call.city}` : ""}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Data pre-filled from dispatch call</span>
            </div>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {(["Digital", "Physical"] as const).map((t) => (
            <button key={t} onClick={() => setCitType(t)} className={`btn btn-sm ${citType === t ? "btn-primary" : "btn-secondary"}`}>{t}</button>
          ))}
        </div>
      </div>

      {/* Sent confirmation banner */}
      {sentTo && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <span style={{ fontWeight: 700, color: "#15803d" }}>✓ Citation #{citNumber} sent to {sentTo}</span>
            <span style={{ fontSize: 12, color: "#16a34a", marginLeft: 10 }}>The violator will receive a digital copy via email.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSentTo(null); setSaving(false); }}>Resend Citation</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push(callId ? `/dispatch/${callId}?step=8` : "/citations")}>
              {callId ? "Back to Call" : "Back to Citations"}
            </button>
          </div>
        </div>
      )}

      {/* Digital citation info banner */}
      {citType === "Digital" && !sentTo && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1d4ed8" }}>
          <strong>Digital Citation</strong> — Violator email is required. The citation will be emailed to the violator upon issuing.
        </div>
      )}

      <div style={{ maxWidth: 900 }}>
        <div className="card" style={{ padding: "24px 28px" }}>

          <SectionHeader title="Citation Identification" />
          <div className="grid-3">
            <F label="Citation Number" req><input className="form-input" value={citNumber} onChange={(e) => setCitNumber(e.target.value)} /></F>
            {citType === "Physical" && <F label="Physical Citation #"><input className="form-input" value={physCitNumber} onChange={(e) => setPhysCitNumber(e.target.value)} /></F>}
            <F label="Animal Impound #"><input className="form-input" value={animalImpound} onChange={(e) => setAnimalImpound(e.target.value)} /></F>
            {callId && <F label="Linked Call"><input className="form-input" value={callId} readOnly style={{ background: "#f8fafc", color: "var(--text-muted)" }} /></F>}
          </div>

          <SectionHeader title="Violator Information" />
          {linkedPerson?.photo_id_url && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 14 }}>
              <PhotoIdThumb url={linkedPerson.photo_id_url} name={`${linkedPerson.first_name} ${linkedPerson.last_name}`} size={52} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1d4ed8" }}>🪪 Photo ID on file</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{linkedPerson.first_name} {linkedPerson.last_name} · {linkedPerson.pid}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Click thumbnail to view full size</div>
              </div>
            </div>
          )}
          <div className="grid-3">
            <F label="First Name" req><input className="form-input" value={violatorFirst} onChange={(e) => setViolatorFirst(e.target.value)} /></F>
            <F label="Middle Name"><input className="form-input" value={violatorMiddle} onChange={(e) => setViolatorMiddle(e.target.value)} /></F>
            <F label="Last Name" req><input className="form-input" value={violatorLast} onChange={(e) => setViolatorLast(e.target.value)} /></F>
            <F label={`Email${citType === "Digital" ? " *" : ""}`}>
              <input
                className="form-input"
                type="email"
                value={violatorEmail}
                onChange={(e) => { setViolatorEmail(e.target.value); setEmailError(""); }}
                style={emailError ? { borderColor: "#dc2626" } : {}}
                placeholder={citType === "Digital" ? "Required for digital citation" : ""}
              />
              {emailError && <div style={{ color: "#dc2626", fontSize: 11, marginTop: 3 }}>{emailError}</div>}
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
            <F label="Sex">
              <select className="form-select" value={violatorSex} onChange={(e) => setViolatorSex(e.target.value)}>
                <option value="">—</option><option>M</option><option>F</option>
              </select>
            </F>
            <F label="Date of Birth"><input className="form-input" type="date" value={violatorDob} onChange={(e) => setViolatorDob(e.target.value)} /></F>
          </div>

          <SectionHeader title="Physical Description" />
          <div className="grid-4">
            <F label="Hair"><input className="form-input" value={descHair} onChange={(e) => setDescHair(e.target.value)} /></F>
            <F label="Eyes"><input className="form-input" value={descEyes} onChange={(e) => setDescEyes(e.target.value)} /></F>
            <F label="Weight"><input className="form-input" value={descWeight} onChange={(e) => setDescWeight(e.target.value)} placeholder="e.g. 180 lbs" /></F>
            <F label="Height"><input className="form-input" value={descHeight} onChange={(e) => setDescHeight(e.target.value)} placeholder='e.g. 5&apos;10"' /></F>
          </div>

          <SectionHeader title="Violations" />
          {violations.map((v, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 80px 30px", gap: 6, alignItems: "center", marginBottom: 4 }}>
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
                  : <div />
                }
              </div>
              <input className="form-input" style={{ fontSize: 12 }} value={v.description} onChange={(e) => updateViolation(i, "description", e.target.value)} placeholder="Violation description (auto-filled, editable)" />
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addViolation} style={{ marginBottom: 12 }}>+ Add Violation</button>

          <F label="Animal Description"><textarea className="form-textarea" value={animalDesc} onChange={(e) => setAnimalDesc(e.target.value)} rows={2} /></F>
          <F label="Remarks"><textarea className="form-textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} /></F>

          <SectionHeader title="Court Information" />
          <div className="grid-3">
            <F label="Court Type">
              <select className="form-select" value={courtType} onChange={(e) => setCourtType(e.target.value)}>
                <option>Magistrate</option><option>Municipal</option>
              </select>
            </F>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", alignSelf: "flex-end", paddingBottom: 10 }}>
              {courtType === "Magistrate" ? "149 E Jefferson St, Covington, GA" : "118 N Main St, Covington, GA"}
            </div>
            <F label="Court Date"><input className="form-input" type="date" value={courtDate} onChange={(e) => setCourtDate(e.target.value)} /></F>
            <F label="Court Time"><input className="form-input" value={courtTime} onChange={(e) => setCourtTime(e.target.value)} placeholder="e.g. 9:00" /></F>
            <F label="AM/PM">
              <select className="form-select" value={courtAmPm} onChange={(e) => setCourtAmPm(e.target.value)}>
                <option>AM</option><option>PM</option>
              </select>
            </F>
            <F label="Fine Amount ($)"><input className="form-input" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} placeholder="0.00" /></F>
            <F label="Due Date"><input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></F>
          </div>

          <SectionHeader title="Officer & Service" />
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

          {/* Photo ID */}
          <SectionHeader title="Violator Photo ID" />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "12px 0" }}>
            {citPhotoId ? (
              <>
                <PhotoIdThumb url={citPhotoId} name="Violator ID" size={80} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                    {linkedPerson?.photo_id_url === citPhotoId ? "🪪 Auto-filled from People record" : "🪪 Photo ID uploaded"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => photoIdRef.current?.click()} disabled={uploadingPhotoId}>Replace</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => setCitPhotoId(null)}>Remove</button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", border: "2px dashed #cbd5e1", borderRadius: 8 }}>
                <span style={{ fontSize: 28 }}>🪪</span>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>No photo ID on file</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => photoIdRef.current?.click()} disabled={uploadingPhotoId}>
                    {uploadingPhotoId ? "Uploading…" : "Upload Photo ID"}
                  </button>
                </div>
              </div>
            )}
            <input
              ref={photoIdRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !citNumber) return;
                setUploadingPhotoId(true);
                try {
                  const url = await uploadCitationPhotoId(citNumber, file);
                  setCitPhotoId(url);
                } catch { alert("Failed to upload photo ID"); }
                finally { setUploadingPhotoId(false); e.target.value = ""; }
              }}
            />
          </div>

          {/* Signatures */}
          <SectionHeader title="Signatures" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button className="btn btn-secondary" onClick={() => router.push(backHref)}>Cancel</button>
            <button
              className="btn btn-primary"
              style={{ minWidth: 200, fontWeight: 800 }}
              onClick={handleSave}
              disabled={saving || !canSave || !!sentTo}
            >
              {saving ? "Issuing…" : citType === "Digital" ? "Issue Digital Citation" : "Issue Physical Citation"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function CitationNewPage() {
  return (
    <Suspense fallback={
      <AppShell title="Issue Citation">
        <div className="empty-state" style={{ padding: "60px 0" }}>Loading…</div>
      </AppShell>
    }>
      <CitationNewInner />
    </Suspense>
  );
}
