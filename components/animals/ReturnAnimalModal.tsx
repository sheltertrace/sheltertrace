"use client";
import { useState, useEffect } from "react";
import type { Animal } from "@/lib/types";
import { KENNEL_LABELS } from "@/lib/constants";
import { today } from "@/lib/utils";
import { updateAnimal, addAnimalNote, fetchAdoptions } from "@/lib/data";

const RETURN_REASONS = [
  "Owner Surrender",
  "Behavioral Issues",
  "Allergies",
  "Moving",
  "Landlord Restriction",
  "Financial Hardship",
  "Animal Incompatibility",
  "Medical Issues",
  "Neglect/Cruelty Concern",
  "Death of Owner",
  "Other",
];

const RETURN_CONDITIONS = ["", "Good", "Fair", "Poor", "Critical", "Unknown"];
const RETURN_BEHAVIORS = ["", "Friendly", "Fearful", "Aggressive", "Anxious", "Calm", "Unknown"];

interface Props {
  animal: Animal;
  adopterName?: string;
  onSuccess: (updated: Animal) => void;
  onClose: () => void;
}

export default function ReturnAnimalModal({ animal, adopterName: adopterNameProp, onSuccess, onClose }: Props) {
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");
  const [returnDate, setReturnDate] = useState(today());
  const [condition, setCondition] = useState("");
  const [behavior, setBehavior] = useState("");
  const [kennel, setKennel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [adopterName, setAdopterName] = useState(adopterNameProp || "");

  // Fetch adopter name if not provided
  useEffect(() => {
    if (adopterNameProp) return;
    fetchAdoptions().then((recs) => {
      const match = recs.filter((r) => r.animal_id === animal.id).sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0];
      if (match?.adopter_name) setAdopterName(match.adopter_name);
    });
  }, [animal.id, adopterNameProp]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const finalReason = reason === "Other" ? (otherReason.trim() || "Other") : reason;
      const noteText = [
        `RETURNED: ${finalReason}.`,
        adopterName ? `Returned by ${adopterName} on ${returnDate}.` : `Return date: ${returnDate}.`,
        condition ? `Condition: ${condition}.` : "",
        behavior ? `Behavior: ${behavior}.` : "",
        notes.trim() ? notes.trim() : "",
      ].filter(Boolean).join(" ");

      const updated = await updateAnimal(animal.id, {
        status: "Available",
        kennel: kennel || undefined,
        ...(condition ? { intake_condition: condition } : {}),
        ...(behavior ? { intake_behavior: behavior } : {}),
      });

      await addAnimalNote(animal.id, noteText, "Return");
      onSuccess(updated);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span className="modal-title" style={{ color: "#b45309" }}>↩ Return Animal</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Animal info */}
          <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 20, fontSize: 13 }}>
            <div><span style={{ color: "var(--text-secondary)" }}>Animal:</span> <strong>{animal.name}</strong> <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>({animal.id})</span></div>
            <div><span style={{ color: "var(--text-secondary)" }}>Species:</span> {animal.species} · {animal.breed}</div>
            {adopterName && <div><span style={{ color: "var(--text-secondary)" }}>Adopted by:</span> <strong>{adopterName}</strong></div>}
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Reason for Return *</label>
              <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                {RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {reason === "Other" && (
              <div className="form-group">
                <label className="form-label">Specify Reason</label>
                <input className="form-input" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Describe reason…" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Return Date *</label>
              <input className="form-input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Condition on Return</label>
              <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {RETURN_CONDITIONS.map((c) => <option key={c} value={c}>{c || "— Select —"}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Behavior on Return</label>
              <select className="form-select" value={behavior} onChange={(e) => setBehavior(e.target.value)}>
                {RETURN_BEHAVIORS.map((b) => <option key={b} value={b}>{b || "— Select —"}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Kennel Assignment</label>
              <select className="form-select" value={kennel} onChange={(e) => setKennel(e.target.value)}>
                <option value="">Unassigned</option>
                {KENNEL_LABELS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Return Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Additional notes about this return…" />
          </div>

          <div style={{ background: "#f0fdfa", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#065f46" }}>
            The animal will be set to <strong>Available</strong> and all history (medical records, behavior flags, notes) will be preserved.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            style={{ background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" }}
            onClick={handleSubmit}
            disabled={saving || !returnDate}
          >
            {saving ? "Processing…" : "↩ Confirm Return"}
          </button>
        </div>
      </div>
    </div>
  );
}
