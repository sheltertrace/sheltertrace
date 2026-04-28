"use client";
import { useState } from "react";
import type { Citation, DispositionEntry } from "@/lib/types";
import { updateCitationDisposition } from "@/lib/data";
import { useAuth } from "@/app/providers";
import { today } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";

export const CITATION_STATUSES = [
  "Issued", "Served", "Active", "Continued", "Guilty", "Not Guilty",
  "Dismissed", "Paid", "Warrant Issued", "Closed",
];

const DISMISSED_REASONS = [
  "Insufficient Evidence", "First Offense Warning", "Compliance Achieved",
  "Prosecutor Discretion", "Other",
];

interface Props {
  citation: Citation;
  onSave: (updated: Citation) => void;
  onClose: () => void;
}

export default function DispositionModal({ citation, onSave, onClose }: Props) {
  const { user } = useAuth();
  const [status, setStatus]           = useState(citation.status || "Issued");
  const [dispDate, setDispDate]       = useState(today());
  const [judgeName, setJudgeName]     = useState(citation.judge_name || "");
  const [fineAmount, setFineAmount]   = useState(citation.fine_amount ? String(citation.fine_amount) : "");
  const [amountPaid, setAmountPaid]   = useState(citation.fine_paid || "");
  const [payMethod, setPayMethod]     = useState(citation.payment_method_used || "Cash");
  const [csHours, setCsHours]         = useState(citation.community_service_hours ? String(citation.community_service_hours) : "");
  const [newCourtDate, setNewCourtDate] = useState("");
  const [dismissReason, setDismissReason] = useState(citation.dismissed_reason || DISMISSED_REASONS[0]);
  const [notes, setNotes]             = useState("");
  const [createReceipt, setCreateReceipt] = useState(true);
  const [saving, setSaving]           = useState(false);

  const showFine        = ["Guilty", "Paid", "Closed"].includes(status);
  const showPaid        = ["Paid", "Closed"].includes(status);
  const showContinue    = status === "Continued";
  const showDismiss     = status === "Dismissed";
  const showWarning     = status === "Warrant Issued";

  const violatorName = citation.violator_last
    ? [citation.violator_last, citation.violator_first].filter(Boolean).join(", ")
    : (citation.violator_name || "—");

  const handleSave = async () => {
    setSaving(true);
    try {
      const entry: DispositionEntry = {
        status,
        date: dispDate,
        notes: notes || undefined,
        changedBy: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        fineAmount: fineAmount ? parseFloat(fineAmount) : undefined,
        amountPaid: amountPaid ? parseFloat(amountPaid) : undefined,
        paymentMethod: showPaid ? payMethod : undefined,
        judgeName: judgeName || undefined,
        dismissedReason: showDismiss ? dismissReason : undefined,
        communityServiceHours: csHours ? parseInt(csHours) : undefined,
        newCourtDate: showContinue ? newCourtDate : undefined,
      };
      const updated = await updateCitationDisposition(citation, entry, showPaid && createReceipt);
      onSave(updated);
    } catch (e: unknown) {
      alert(`Failed to update: ${(e as { message?: string }).message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Update Disposition</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Citation #{citation.citation_number} · {violatorName}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: 18, padding: "2px 8px" }}>✕</button>
        </div>

        <div className="modal-body">
          {/* Current status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--surface-alt)", borderRadius: 8, marginBottom: 16, border: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Current status:</span>
            <CitationStatusBadge status={citation.status || "Issued"} />
            <span style={{ fontSize: 18 }}>→</span>
            <CitationStatusBadge status={status} />
          </div>

          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">New Status *</label>
              <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {CITATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Disposition Date *</label>
              <input className="form-input" type="date" value={dispDate} onChange={(e) => setDispDate(e.target.value)} />
            </div>
          </div>

          <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Judge Name</label>
              <input className="form-input" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} placeholder="Presiding judge" />
            </div>
            {showFine && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fine Amount ($)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} placeholder="0.00" />
              </div>
            )}
          </div>

          {showPaid && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d", marginBottom: 10 }}>💳 Payment Information</div>
              <div className="grid-3" style={{ gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount Paid ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Auto-Create Receipt</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                    <input type="checkbox" id="create-receipt" checked={createReceipt} onChange={(e) => setCreateReceipt(e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="create-receipt" style={{ fontSize: 13, cursor: "pointer" }}>Create receipt</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showContinue && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 10 }}>📅 Reschedule Court Date</div>
              <div className="form-group" style={{ margin: 0, maxWidth: 220 }}>
                <label className="form-label">New Court Date</label>
                <input className="form-input" type="date" value={newCourtDate} onChange={(e) => setNewCourtDate(e.target.value)} />
              </div>
            </div>
          )}

          {showDismiss && (
            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Reason for Dismissal</div>
              <select className="form-select" value={dismissReason} onChange={(e) => setDismissReason(e.target.value)}>
                {DISMISSED_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          )}

          {showWarning && (
            <div style={{ background: "#fff1f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 4 }}>⚠️ Bench Warrant</div>
              <div style={{ fontSize: 12, color: "#991b1b" }}>
                A bench warrant will be noted for failure to appear. You can print the warrant document from the Court Portal.
              </div>
            </div>
          )}

          <div className="form-group" style={{ margin: "0 0 12px" }}>
            <label className="form-label">Community Service Hours</label>
            <input className="form-input" type="number" min="0" value={csHours} onChange={(e) => setCsHours(e.target.value)} placeholder="0" style={{ maxWidth: 140 }} />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Disposition Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Judge's ruling, conditions, remarks…" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: 160 }}>
            {saving ? "Saving…" : `Update to "${status}"`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CitationStatusBadge({ status }: { status: string }) {
  const style = statusStyle(status);
  return (
    <span className="badge" style={style}>{status}</span>
  );
}

export function statusStyle(status: string): React.CSSProperties {
  switch (status) {
    case "Issued":        return { background: "#dbeafe", color: "#1d4ed8" };
    case "Served":        return { background: "#bfdbfe", color: "#1e40af" };
    case "Active":        return { background: "#ede9fe", color: "#6d28d9" };
    case "Continued":     return { background: "#fef3c7", color: "#92400e" };
    case "Guilty":        return { background: "#dcfce7", color: "#15803d" };
    case "Paid":          return { background: "#bbf7d0", color: "#166534" };
    case "Not Guilty":    return { background: "#f1f5f9", color: "#475569" };
    case "Dismissed":     return { background: "#f1f5f9", color: "#64748b" };
    case "Warrant Issued":return { background: "#fee2e2", color: "#dc2626" };
    case "Closed":        return { background: "#e2e8f0", color: "#334155" };
    default:              return { background: "#f1f5f9", color: "#64748b" };
  }
}
