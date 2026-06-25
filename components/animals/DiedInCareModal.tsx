"use client";
import { useState } from "react";
import DateInput from "@/components/ui/DateInput";
import StaffSelect from "@/components/ui/StaffSelect";
import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/utils";

const CAUSES = ["Natural Causes", "Illness / Disease", "Injury", "Congenital / Birth Defect", "Unknown", "Other"];
const LOCATIONS = ["In Kennel", "During Medical Treatment", "In Foster Care", "During Transport", "Other"];
const DISPOSITIONS = ["Cremated", "Individual Cremation", "Owner Claimed", "Buried on Premises", "Sent to Vet for Necropsy", "Other"];

export interface DiedInCareData {
  death_date: string;
  death_time: string;
  cause_of_death: string;
  death_location: string;
  death_notes: string;
  body_disposition: string;
  death_recorded_by: string;
  vet_contacted: boolean;
  vet_name: string;
}

interface Props {
  animalName: string;
  onSave: (data: DiedInCareData) => void;
  onClose: () => void;
}

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
}

export default function DiedInCareModal({ animalName, onSave, onClose }: Props) {
  const currentUser = getCurrentUser();
  const staffName = currentUser ? `${currentUser.firstName || currentUser.first_name || ""} ${currentUser.lastName || currentUser.last_name || ""}`.trim() : "";

  const [data, setData] = useState<DiedInCareData>({
    death_date: today(),
    death_time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
    cause_of_death: "",
    death_location: "",
    death_notes: "",
    body_disposition: "",
    death_recorded_by: staffName,
    vet_contacted: false,
    vet_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!data.death_date) errs.push("Date of death is required");
    if (!data.cause_of_death) errs.push("Cause of death is required");
    if (!data.death_location) errs.push("Location is required");
    if (!data.death_notes || data.death_notes.trim().length < 20) errs.push("Detailed notes must be at least 20 characters");
    if (!data.body_disposition) errs.push("Body disposition is required");
    if (!data.death_recorded_by) errs.push("Attending staff is required");
    if (data.vet_contacted && !data.vet_name.trim()) errs.push("Vet name is required when vet was contacted");
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    onSave(data);
  };

  const handleClose = () => {
    if (data.death_notes.trim().length > 0 || data.cause_of_death) {
      if (!confirm("Are you sure? The status will not be changed if you cancel.")) return;
    }
    onClose();
  };

  const set = <K extends keyof DiedInCareData>(key: K, val: DiedInCareData[K]) => setData((d) => ({ ...d, [key]: val }));

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 640, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: "#1f2937", color: "#fff" }}>
          <span className="modal-title" style={{ color: "#fff" }}>✝ Record Cause of Death — {animalName}</span>
          <button className="btn btn-ghost btn-sm" style={{ color: "#fff" }} onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
            All fields marked with * are required. This information is recorded permanently and cannot be undone.
          </div>

          <div className="grid-2">
            <F label="Date of Death" required>
              <DateInput className="form-input" value={data.death_date} onChange={(e) => set("death_date", e.target.value)} />
            </F>
            <F label="Time of Death">
              <input className="form-input" type="time" value={data.death_time} onChange={(e) => set("death_time", e.target.value)} />
            </F>
            <F label="Cause of Death" required>
              <select className="form-select" value={data.cause_of_death} onChange={(e) => set("cause_of_death", e.target.value)}>
                <option value="">— Select —</option>
                {CAUSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </F>
            <F label="Location" required>
              <select className="form-select" value={data.death_location} onChange={(e) => set("death_location", e.target.value)}>
                <option value="">— Select —</option>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </F>
            <F label="Attending Staff" required>
              <StaffSelect value={data.death_recorded_by} onChange={(v) => set("death_recorded_by", v)} />
            </F>
            <F label="Body Disposition" required>
              <select className="form-select" value={data.body_disposition} onChange={(e) => set("body_disposition", e.target.value)}>
                <option value="">— Select —</option>
                {DISPOSITIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </F>
          </div>

          <F label="Detailed Notes" required>
            <textarea
              className="form-textarea"
              rows={4}
              value={data.death_notes}
              onChange={(e) => set("death_notes", e.target.value)}
              placeholder="Describe the circumstances, symptoms observed, and any relevant medical history leading to the animal's death."
            />
            <div style={{ fontSize: 11, color: data.death_notes.trim().length >= 20 ? "#15803d" : "var(--text-muted)", marginTop: 2 }}>
              {data.death_notes.trim().length} / 20 minimum characters
            </div>
          </F>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, marginBottom: data.vet_contacted ? 8 : 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={data.vet_contacted} onChange={(e) => set("vet_contacted", e.target.checked)} />
              Was a veterinarian contacted?
            </label>
          </div>
          {data.vet_contacted && (
            <F label="Veterinarian Name" required>
              <input className="form-input" value={data.vet_name} onChange={(e) => set("vet_name", e.target.value)} placeholder="Dr. ..." />
            </F>
          )}

          {errors.length > 0 && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
              {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>• {e}</div>)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: "#1f2937", borderColor: "#1f2937" }}>
            {saving ? "Saving…" : "✝ Save & Update Status"}
          </button>
        </div>
      </div>
    </div>
  );
}
