"use client";
import { useState } from "react";
import type { DispatchCall, Officer } from "@/lib/types";
import { moveCallToPendingFollowUp, extendFollowUp } from "@/lib/data";
import { FOLLOW_UP_REASONS } from "@/lib/constants";
import DateInput from "@/components/ui/DateInput";

interface Props {
  call: DispatchCall;
  officers: Officer[];
  currentUserName: string;
  mode: "move" | "extend";
  onClose: () => void;
  onSaved: (updated: DispatchCall) => void;
}

export default function FollowUpModal({ call, officers, currentUserName, mode, onClose, onSaved }: Props) {
  const existingReason = call.follow_up_reason || "";
  const [reason, setReason] = useState(existingReason && FOLLOW_UP_REASONS.includes(existingReason) ? existingReason : (existingReason ? "Other" : ""));
  const [otherReason, setOtherReason] = useState(existingReason && !FOLLOW_UP_REASONS.includes(existingReason) ? existingReason : "");
  const [dueDate, setDueDate] = useState(call.follow_up_due_date || "");
  const [assignedOfficer, setAssignedOfficer] = useState(call.follow_up_assigned_officer || currentUserName || "");
  const [notes, setNotes] = useState(call.follow_up_notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const finalReason = reason === "Other" ? otherReason.trim() : reason;

  const handleSave = async () => {
    setError("");
    if (!finalReason) { setError("Please select or enter a reason."); return; }
    if (!dueDate) { setError("Due date is required."); return; }
    setSaving(true);
    try {
      const updated = mode === "move"
        ? await moveCallToPendingFollowUp(call, { reason: finalReason, dueDate, assignedOfficer, notes, movedBy: currentUserName })
        : await extendFollowUp(call, { reason: finalReason, dueDate, assignedOfficer, notes, movedBy: currentUserName });
      onSaved(updated);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || "Save failed — unknown error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 10, padding: "22px 24px", width: "100%", maxWidth: 480, boxShadow: "0 8px 32px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>⏰</span>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{mode === "move" ? "Move to Pending Follow-Up" : "Extend Follow-Up"}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Call #{call.id.slice(-4)} — {call.type}
        </div>

        <div className="form-group">
          <label className="form-label">Reason for Follow-Up *</label>
          <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">— Select reason —</option>
            {FOLLOW_UP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {reason === "Other" && (
            <input className="form-input" style={{ marginTop: 8 }} value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="Describe the reason…" />
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Due Date *</label>
          <DateInput className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Assigned Officer</label>
          <select className="form-select" value={assignedOfficer} onChange={(e) => setAssignedOfficer(e.target.value)}>
            <option value="">— Unassigned —</option>
            {officers.map((o) => <option key={o.id} value={o.name}>{o.name}{o.badge ? ` #${o.badge}` : ""}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional context for the follow-up…" />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-sm"
            style={{ background: "#d97706", color: "#fff", borderColor: "#d97706", fontWeight: 700 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
