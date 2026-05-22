"use client";

import { useState } from "react";
import { createReceipt, updateAnimal } from "@/lib/data";
import { PAYMENT_METHODS, CLINIC_SERVICES } from "@/lib/constants";
import type { MedicalRecord } from "@/lib/types";
import type { ClinicVisitRecord } from "@/lib/data";
import { today } from "@/lib/utils";

interface Props {
  visit: ClinicVisitRecord;
  onComplete: () => void;
  onClose: () => void;
}

interface LineItem {
  label: string;
  fee: number;
}

function buildDefaultLineItems(services: MedicalRecord[]): LineItem[] {
  return services.map((med) => {
    const svc = CLINIC_SERVICES.find(
      (s) => s.medical.type === med.type && s.medical.description === med.description
    );
    return { label: med.description || med.type, fee: svc?.defaultFee ?? 0 };
  });
}

export default function CheckoutModal({ visit, onComplete, onClose }: Props) {
  const services = visit.services ?? [];
  const [lineItems, setLineItems] = useState<LineItem[]>(
    services.length > 0 ? buildDefaultLineItems(services) : [{ label: "Clinic Visit", fee: 0 }]
  );
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const total = lineItems.reduce((sum, li) => sum + (li.fee || 0), 0);

  function updateFee(i: number, val: string) {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, fee: parseFloat(val) || 0 } : li));
  }

  function updateLabel(i: number, val: string) {
    setLineItems((prev) => prev.map((li, idx) => idx === i ? { ...li, label: val } : li));
  }

  function addLine() {
    setLineItems((prev) => [...prev, { label: "", fee: 0 }]);
  }

  function removeLine(i: number) {
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCheckout() {
    setSaving(true);
    try {
      // Create receipt
      await createReceipt({
        date: today(),
        category: "Services",
        line_items: lineItems.map((li) => ({ item: li.label, qty: 1, price: li.fee })),
        total,
        payment_method: paymentMethod,
        check_number: paymentMethod === "Check" ? checkNumber : undefined,
        anonymous: !visit.ownerPersonId,
        person_id: visit.ownerPersonId,
        person_name: visit.ownerName,
        animal_id: visit.id,
        notes: notes || undefined,
      });

      // Mark visit as Checked Out
      await updateAnimal(visit.id, { sub_status: "Checked Out" });

      onComplete();
    } catch (err) {
      console.error("[CheckoutModal] error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: "100%" }}>
        <div className="modal-header">
          <span className="modal-title">🧾 Checkout — {visit.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Owner & Animal summary */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 12, background: "var(--bg-alt)", borderRadius: 8, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>ANIMAL</div>
              <div style={{ fontWeight: 700 }}>{visit.name}</div>
              <div style={{ color: "var(--text-secondary)" }}>{visit.species} · {visit.breed}</div>
            </div>
            {visit.ownerName && (
              <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: 16 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>OWNER</div>
                <div style={{ fontWeight: 700 }}>{visit.ownerName}</div>
                {visit.ownerPhone && <div style={{ color: "var(--text-secondary)" }}>{visit.ownerPhone}</div>}
              </div>
            )}
          </div>

          {/* Line items */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Services &amp; Fees</label>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={addLine}>+ Add Line</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {lineItems.map((li, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    className="form-input"
                    value={li.label}
                    onChange={(e) => updateLabel(i, e.target.value)}
                    placeholder="Service name"
                    style={{ flex: 1 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>$</span>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.50"
                      value={li.fee}
                      onChange={(e) => updateFee(i, e.target.value)}
                      style={{ width: 80 }}
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", padding: "4px 8px" }} onClick={() => removeLine(i)}>✕</button>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-light)" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: total > 0 ? "#0f2942" : "#94a3b8" }}>
                Total: ${total.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          {paymentMethod === "Check" && (
            <div className="form-group">
              <label className="form-label">Check Number</label>
              <input className="form-input" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="Check #" />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: "vertical" }} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCheckout}
            disabled={saving}
            style={{ background: "#0d9488", borderColor: "#0d9488", minWidth: 160 }}
          >
            {saving ? "Processing…" : `✓ Process Payment — $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
