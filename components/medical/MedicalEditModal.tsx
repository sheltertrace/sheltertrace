"use client";
import { useState } from "react";
import type { MedicalRecord } from "@/lib/types";
import { MEDICAL_TYPES, MEDICAL_DESC_MAP } from "@/lib/constants";
import StaffSelect from "@/components/ui/StaffSelect";
import { updateMedical, deleteMedical } from "@/lib/data";
import { useAuth } from "@/app/providers";
import { formatDate, today } from "@/lib/utils";
import DateInput from "@/components/ui/DateInput";

interface Props {
  record: MedicalRecord;
  onSave: (updated: MedicalRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const STATUS_OPTIONS = ["Scheduled", "Administered", "Completed", "Pending", "Overdue", "Skipped", "Declined"];
const RESULT_OPTIONS = ["Positive", "Negative", "Pending", "Inconclusive"];
const ROUTE_OPTIONS = ["Oral", "Subcutaneous", "Intramuscular", "Intranasal", "Topical", "Intravenous", "Other"];

export default function MedicalEditModal({ record, onSave, onDelete, onClose }: Props) {
  const { user } = useAuth();

  const [type, setType]             = useState(record.type);
  const [desc, setDesc]             = useState(record.description || "");
  const [date, setDate]             = useState(record.date || today());
  const [vet, setVet]               = useState(record.vet || "");
  const [nextDue, setNextDue]       = useState(record.next_due || "");
  const [cost, setCost]             = useState(record.cost != null ? String(record.cost) : "");
  const [status, setStatus]         = useState(record.status || "");
  const [lotNumber, setLotNumber]   = useState(record.lot_number || "");
  const [manufacturer, setManufacturer] = useState(record.manufacturer || "");
  const [route, setRoute]           = useState(record.route || "");
  const [dosage, setDosage]         = useState(record.dosage || "");
  const [notes, setNotes]           = useState(record.notes || "");
  const [result, setResult]         = useState(record.result || "");

  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [errMsg, setErrMsg]         = useState("");

  const updatedByName = user ? `${user.firstName} ${user.lastName}`.trim() : "Staff";

  const handleSave = async () => {
    console.log("[medical edit] record data:", JSON.stringify(record, null, 2));
    console.log("[medical edit] record id:", record.id, typeof record.id);
    setSaving(true);
    setErrMsg("");
    try {
      const payload: Partial<MedicalRecord> = {
        type,
        description: desc,
        date,
        vet: vet || undefined,
        next_due: nextDue || undefined,
        cost: cost !== "" ? parseFloat(cost) : null,
        status: status || undefined,
        lot_number: lotNumber || undefined,
        manufacturer: manufacturer || undefined,
        route: route || undefined,
        dosage: dosage || undefined,
        notes: notes || undefined,
        result: result || undefined,
        updated_at: new Date().toISOString(),
        updated_by: updatedByName,
      };
      const updated = await updateMedical(record.id, payload);
      setSaved(true);
      setTimeout(() => {
        onSave(updated);
      }, 800);
    } catch (err: unknown) {
      const e = err as { message?: string; hint?: string };
      const detail = e.hint ? `${e.message} — ${e.hint}` : (e.message || "Unknown error");
      setErrMsg(`Save failed: ${detail}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setErrMsg("");
    try {
      await deleteMedical(record.id);
      onDelete(record.id);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrMsg(`Delete failed: ${e.message || "Unknown error"}`);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">✏️ Edit Medical Record</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Audit trail */}
          {(record.updated_by || record.updated_at) && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: 6, border: "1px solid var(--border-light)" }}>
              {record.updated_by
                ? <>Last edited by <strong>{record.updated_by}</strong>{record.updated_at ? ` on ${formatDate(record.updated_at.slice(0, 10))} at ${record.updated_at.slice(11, 16)}` : ""}</>
                : <>Last updated: {formatDate(record.updated_at!.slice(0, 10))} at {record.updated_at!.slice(11, 16)}</>
              }
            </div>
          )}

          {/* Success flash */}
          {saved && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 7, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#15803d", fontWeight: 600 }}>
              ✓ Record saved successfully
            </div>
          )}

          {/* Error */}
          {errMsg && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>
              ⚠️ {errMsg}
            </div>
          )}

          {/* Core fields */}
          <div className="grid-2" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-select" value={type} onChange={(e) => { setType(e.target.value); setDesc(""); }}>
                {MEDICAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <select className="form-select" value={desc} onChange={(e) => setDesc(e.target.value)}>
                <option value="">— Select or type below —</option>
                {(MEDICAL_DESC_MAP[type] || []).map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <DateInput className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Vet / Staff</label>
              <StaffSelect value={vet} onChange={setVet} placeholder="— None —" />
            </div>
            <div className="form-group">
              <label className="form-label">Next Due</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <DateInput className="form-input" value={nextDue} onChange={(e) => setNextDue(e.target.value)} style={{ flex: 1 }} />
                {nextDue && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNextDue("")} title="Clear" style={{ padding: "4px 8px" }}>✕</button>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— None —</option>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Extended fields */}
          <div style={{ borderTop: "1px solid var(--border-light)", margin: "12px 0 12px", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: 0.5 }}>Additional Details</div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Lot Number</label>
                <input className="form-input" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="e.g. AB12345" />
              </div>
              <div className="form-group">
                <label className="form-label">Manufacturer</label>
                <input className="form-input" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="e.g. Merck" />
              </div>
              <div className="form-group">
                <label className="form-label">Route</label>
                <select className="form-select" value={route} onChange={(e) => setRoute(e.target.value)}>
                  <option value="">— None —</option>
                  {ROUTE_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dosage</label>
                <input className="form-input" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder='e.g. 1 ml or 2 tabs' />
              </div>
              <div className="form-group">
                <label className="form-label">Result</label>
                <select className="form-select" value={result} onChange={(e) => setResult(e.target.value)}>
                  <option value="">— None —</option>
                  {RESULT_OPTIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cost ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes about this record…" />
            </div>
          </div>

          {/* Inline delete confirmation */}
          {confirmDelete && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginTop: 8 }}>
              <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 6, fontSize: 13 }}>
                ⚠️ Delete this medical record?
              </div>
              <div style={{ fontSize: 12, color: "#991b1b", marginBottom: 10 }}>
                This cannot be undone. The record will be permanently removed.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Yes, Delete"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button
            className="btn btn-sm"
            style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || confirmDelete}
          >
            🗑 Delete Record
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || saved}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
