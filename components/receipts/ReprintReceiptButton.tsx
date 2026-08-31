"use client";
import { useState } from "react";
import type { DepartureReceipt, MedicalRecord } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";
import { canReprintReceipt } from "@/lib/permissions";
import { reprintAdoptionReceipt } from "@/lib/departureReceipt";

const REPRINT_REASONS = ["Customer Request", "Original Lost", "Correction", "Records", "Other"];

interface Props {
  receipt: DepartureReceipt;
  medRecords?: MedicalRecord[];
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ReprintReceiptButton({ receipt, medRecords, label = "🖨 Reprint", className, style }: Props) {
  const user = getCurrentUser();
  const allowed = canReprintReceipt(user, receipt);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState(REPRINT_REASONS[0]);
  const [printing, setPrinting] = useState(false);

  const handleConfirm = async () => {
    setPrinting(true);
    try {
      await reprintAdoptionReceipt(receipt, { medRecords, reason });
      setShowReason(false);
    } finally {
      setPrinting(false);
    }
  };

  if (!allowed) {
    return (
      <button
        className={className || "btn btn-secondary btn-sm"}
        style={{ ...style, opacity: 0.5, cursor: "not-allowed" }}
        disabled
        title="Only Administrators, Supervisors, or the officer who processed this adoption can reprint this receipt."
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <button className={className || "btn btn-primary btn-sm"} style={style} onClick={() => setShowReason(true)}>
        {label}
      </button>
      {showReason && (
        <div className="modal-overlay" onClick={() => setShowReason(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🖨 Reprint Receipt</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReason(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                Receipt <strong style={{ fontFamily: "monospace" }}>{receipt.receipt_number}</strong> for {receipt.animal_name || receipt.animal_id}. The reprint will show the original adoption date and officer, with a notation that it was reprinted.
              </div>
              <div className="form-group">
                <label className="form-label">Reason for reprint</label>
                <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REPRINT_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowReason(false)} disabled={printing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={printing}>
                {printing ? "Printing…" : "🖨 Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
