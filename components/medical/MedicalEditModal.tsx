"use client";
import { useState } from "react";
import type { MedicalRecord } from "@/lib/types";
import { MEDICAL_TYPES, MEDICAL_DESC_MAP, VET_STAFF_LIST } from "@/lib/constants";
import { updateMedical, deleteMedical } from "@/lib/data";
import { formatDate, today } from "@/lib/utils";

interface Props {
  record: MedicalRecord;
  onSave: (updated: MedicalRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const STATUS_OPTIONS = ["Pending", "Completed", "Overdue"];

export default function MedicalEditModal({ record, onSave, onDelete, onClose }: Props) {
  const [type, setType] = useState(record.type);
  const [desc, setDesc] = useState(record.description || "");
  const [date, setDate] = useState(record.date || today());
  const [vet, setVet] = useState(record.vet || "");
  const [cost, setCost] = useState(record.cost != null ? String(record.cost) : "");
  const [nextDue, setNextDue] = useState(record.next_due || "");
  const [status, setStatus] = useState(record.status || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateMedical(record.id, {
        type,
        description: desc,
        date,
        vet: vet || undefined,
        cost: cost !== "" ? parseFloat(cost) : null,
        next_due: nextDue || undefined,
        status: status || undefined,
        updated_at: new Date().toISOString(),
      });
      onSave(updated);
    } catch { } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this medical record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteMedical(record.id);
      onDelete(record.id);
    } catch { } finally { setDeleting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Edit Medical Record</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {record.updated_at && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
              Last updated: {formatDate(record.updated_at.slice(0, 10))} at {record.updated_at.slice(11, 16)}
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-select" value={type} onChange={(e) => { setType(e.target.value); setDesc(""); }}>
                {MEDICAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <select className="form-select" value={desc} onChange={(e) => setDesc(e.target.value)}>
                <option value="">— Select —</option>
                {(MEDICAL_DESC_MAP[type] || []).map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Vet / Staff</label>
              <select className="form-select" value={vet} onChange={(e) => setVet(e.target.value)}>
                <option value="">— None —</option>
                {VET_STAFF_LIST.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cost ($)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Next Due</label>
              <input className="form-input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— None —</option>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button
            className="btn btn-sm"
            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete Record"}
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
