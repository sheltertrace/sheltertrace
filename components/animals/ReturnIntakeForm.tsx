"use client";
import { useState, useEffect } from "react";
import type { Animal, DispatchCall, Citation } from "@/lib/types";
import {
  fetchPreviousOutcome, fetchCalls, fetchCitations,
  uploadReturnIntakePhotos, submitReturnIntake, type ReturnIntakePayload,
} from "@/lib/data";
import { getCurrentUserName, getCurrentUserId } from "@/lib/auth";
import { today, now24Time, formatDate } from "@/lib/utils";
import { RETURN_INTAKE_METHODS, RETURN_REASONS, RETURNED_BY_TYPES, BODY_CONDITION_SCORES } from "@/lib/constants";
import { isFileTypeAccepted, deriveAcceptLabel } from "@/lib/fileValidation";
import DateInput from "@/components/ui/DateInput";
import StatusBadge from "@/components/ui/StatusBadge";

const PHOTO_ACCEPT = "image/*,image/heic,image/heif";
const URGENT_REASONS = new Set(["Cruelty Seizure", "Post-Adoption Return"]);

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

interface Props {
  animal: Animal;
  onSuccess: (updated: Animal) => void;
  onCancel: () => void;
}

export default function ReturnIntakeForm({ animal, onSuccess, onCancel }: Props) {
  const [previousOutcome, setPreviousOutcome] = useState<{ outcome: string; date?: string } | null>(null);
  const [openCalls, setOpenCalls] = useState<DispatchCall[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);

  const [intakeDate, setIntakeDate] = useState(today());
  const [intakeTime, setIntakeTime] = useState(now24Time());
  const [intakeMethod, setIntakeMethod] = useState(RETURN_INTAKE_METHODS[0]);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnReasonNotes, setReturnReasonNotes] = useState("");
  const [returnedByType, setReturnedByType] = useState(RETURNED_BY_TYPES[0]);
  const [returnedByName, setReturnedByName] = useState("");
  const [returnedByPhone, setReturnedByPhone] = useState("");
  const [returnedByAddress, setReturnedByAddress] = useState("");
  const [locationFound, setLocationFound] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");
  const [linkedCallId, setLinkedCallId] = useState("");
  const [linkedCitationId, setLinkedCitationId] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [bodyConditionScore, setBodyConditionScore] = useState("");
  const [intakeCondition, setIntakeCondition] = useState("");
  const [intakeBehavior, setIntakeBehavior] = useState("");
  const [injuries, setInjuries] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreviousOutcome(animal).then(setPreviousOutcome).catch(() => setPreviousOutcome(null));
    fetchCalls().then((calls) => setOpenCalls(calls.filter((c) => !["Resolved", "Cancelled"].includes(c.status || "")))).catch(() => {});
    fetchCitations().then(setCitations).catch(() => {});
  }, [animal]);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const accepted = files.filter((f) => isFileTypeAccepted(f, PHOTO_ACCEPT));
    if (accepted.length < files.length) {
      setFileError(`Some files were skipped — only ${deriveAcceptLabel(PHOTO_ACCEPT)} images are accepted.`);
    } else {
      setFileError("");
    }
    setPhotos((prev) => [...prev, ...accepted]);
    accepted.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (i: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleUseGPS = () => {
    if (!navigator.geolocation) { alert("GPS is not available on this device/browser."); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocationFound(`GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`); setGpsLoading(false); },
      () => { alert("Unable to get GPS location. Enter the address manually."); setGpsLoading(false); },
    );
  };

  const isUrgent = URGENT_REASONS.has(returnReason);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const uploadedPhotoUrls = photos.length > 0 ? await uploadReturnIntakePhotos(animal.id, photos) : [];

      const payload: ReturnIntakePayload = {
        animalId: animal.id,
        intake_date: intakeDate,
        intake_time: intakeTime,
        intake_method: intakeMethod,
        return_reason: returnReason,
        return_reason_notes: returnReasonNotes.trim() || undefined,
        previous_outcome: previousOutcome?.outcome,
        previous_outcome_date: previousOutcome?.date,
        returned_by_type: returnedByType,
        returned_by_name: returnedByName.trim() || undefined,
        returned_by_phone: returnedByPhone.trim() || undefined,
        returned_by_address: returnedByAddress.trim() || undefined,
        location_found: locationFound.trim() || undefined,
        intake_officer: getCurrentUserName(),
        intake_officer_id: getCurrentUserId() || undefined,
        case_number: caseNumber.trim() || undefined,
        linked_dispatch_call_id: linkedCallId || undefined,
        linked_citation_id: linkedCitationId || undefined,
        animal_condition_notes: conditionNotes.trim() || undefined,
        photos: uploadedPhotoUrls,
        animal_updates: {
          ...(intakeCondition ? { intake_condition: intakeCondition } : {}),
          ...(intakeBehavior ? { intake_behavior: intakeBehavior } : {}),
          ...(injuries.trim() ? { injuries: injuries.trim() } : {}),
          ...(bodyConditionScore ? { body_condition_score: Number(bodyConditionScore) } : {}),
        },
      };

      const { animal: updated } = await submitReturnIntake(payload);
      onSuccess(updated);
    } catch (e) {
      console.error("[ReturnIntakeForm] submit failed:", e);
      alert("Failed to save return intake. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>← Cancel</button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Return-to-Shelter Intake</h2>
      </div>

      <div className="card">
        {/* Existing animal summary */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", background: "#f0fdfa", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          {animal.photo_url ? (
            <img src={animal.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              {animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾"}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {animal.name} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--text-secondary)", fontSize: 12 }}>({animal.id})</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{animal.species} · {animal.breed} · {animal.sex}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Previous Outcome: <strong>{previousOutcome?.outcome || animal.status}</strong>
              {previousOutcome?.date && ` — ${formatDate(previousOutcome.date)}`}
            </div>
          </div>
          <StatusBadge status={animal.status} />
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Return Details</h3>
        <div className="grid-2">
          <F label="Intake Date *">
            <DateInput className="form-input" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} />
          </F>
          <F label="Intake Time">
            <input className="form-input" type="time" value={intakeTime} onChange={(e) => setIntakeTime(e.target.value)} />
          </F>
          <F label="Intake Method">
            <select className="form-select" value={intakeMethod} onChange={(e) => setIntakeMethod(e.target.value)}>
              {RETURN_INTAKE_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </F>
          <F label="Return Reason *">
            <select className="form-select" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
              {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </F>
        </div>
        {isUrgent && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
            ⚠ This return reason will flag a popup note for staff.
          </div>
        )}
        <F label="Return Reason Notes">
          <textarea className="form-textarea" value={returnReasonNotes} onChange={(e) => setReturnReasonNotes(e.target.value)} rows={2} placeholder="Additional details about why the animal is back…" />
        </F>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", margin: "20px 0 16px" }}>Returned By</h3>
        <div className="grid-2">
          <F label="Returned By Type">
            <select className="form-select" value={returnedByType} onChange={(e) => setReturnedByType(e.target.value)}>
              {RETURNED_BY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </F>
          <F label="Name">
            <input className="form-input" value={returnedByName} onChange={(e) => setReturnedByName(e.target.value)} placeholder="Full name" />
          </F>
          <F label="Phone">
            <input className="form-input" type="tel" value={returnedByPhone} onChange={(e) => setReturnedByPhone(e.target.value)} placeholder="(706) 555-0000" />
          </F>
          <F label="Address">
            <input className="form-input" value={returnedByAddress} onChange={(e) => setReturnedByAddress(e.target.value)} placeholder="Street address" />
          </F>
        </div>
        <F label="Location Found">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" value={locationFound} onChange={(e) => setLocationFound(e.target.value)} placeholder="Street address or GPS coordinates" style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={handleUseGPS} disabled={gpsLoading} style={{ whiteSpace: "nowrap" }}>
              {gpsLoading ? "Getting location…" : "📍 Use GPS"}
            </button>
          </div>
        </F>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", margin: "20px 0 16px" }}>Links & Case Info</h3>
        <div className="grid-2">
          <F label="Case Number">
            <input className="form-input" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="If applicable" />
          </F>
          <F label="Link to Open Dispatch Call">
            <select className="form-select" value={linkedCallId} onChange={(e) => setLinkedCallId(e.target.value)}>
              <option value="">— None —</option>
              {openCalls.map((c) => <option key={c.id} value={c.id}>#{c.id.slice(-4)} — {c.type} — {c.address}</option>)}
            </select>
          </F>
          <F label="Link to Citation">
            <select className="form-select" value={linkedCitationId} onChange={(e) => setLinkedCitationId(e.target.value)}>
              <option value="">— None —</option>
              {citations.map((c) => <option key={c.id} value={c.id}>{c.citation_number} — {c.violator_name || "Unknown"}</option>)}
            </select>
          </F>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", margin: "20px 0 16px" }}>Condition on Return</h3>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -10, marginBottom: 14 }}>Focus on what's changed since the animal's last known condition with us.</p>
        <div className="grid-2">
          <F label="Body Condition Score (1–9)">
            <select className="form-select" value={bodyConditionScore} onChange={(e) => setBodyConditionScore(e.target.value)}>
              <option value="">— Select —</option>
              {BODY_CONDITION_SCORES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </F>
          <F label="Behavior">
            <select className="form-select" value={intakeBehavior} onChange={(e) => setIntakeBehavior(e.target.value)}>
              {["", "Friendly/Approachable", "Fearful/Skittish", "Aggressive", "Feral/Unhandleable", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
            </select>
          </F>
          <F label="Overall Condition">
            <select className="form-select" value={intakeCondition} onChange={(e) => setIntakeCondition(e.target.value)}>
              {["", "Good", "Fair", "Poor", "Critical", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
            </select>
          </F>
        </div>
        <F label="Injuries / Changes Since Last With Us">
          <textarea className="form-textarea" value={injuries} onChange={(e) => setInjuries(e.target.value)} rows={2} placeholder="New injuries, weight changes, illness, etc…" />
        </F>
        <F label="Condition Notes">
          <textarea className="form-textarea" value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} rows={2} placeholder="Any other notes about the animal's condition on return…" />
        </F>

        <F label="Photos on Return">
          <input type="file" accept={PHOTO_ACCEPT} multiple onChange={handlePhotos} />
          {fileError && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{fileError}</div>}
          {photoPreviews.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {photoPreviews.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={src} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />
                  <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </F>

        <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "✓ Complete Return Intake"}
          </button>
        </div>
      </div>
    </div>
  );
}
