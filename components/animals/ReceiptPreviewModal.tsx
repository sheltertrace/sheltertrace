"use client";
import type { DepartureReceipt } from "@/lib/types";
import { printDepartureReceipt } from "@/lib/departureReceipt";

const MCAS_BLUE = "#0f2942";

function Field({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 4, marginBottom: 4, fontSize: 12 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ background: MCAS_BLUE, color: "#fff", padding: "4px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "14px 0 8px", borderRadius: 2 }}>
      {title}
    </div>
  );
}

interface Props {
  receipt: DepartureReceipt;
  onClose: () => void;
  onPrint?: () => void;
}

export default function ReceiptPreviewModal({ receipt, onClose, onPrint }: Props) {
  const a = (receipt.animal_info_snapshot || {}) as Record<string, unknown>;
  const p = (receipt.person_info_snapshot || {}) as Record<string, unknown>;
  const fees = (receipt.fees || []) as Array<{ item: string; amount: number }>;
  const isAdoption = receipt.departure_type === "Adoption";

  const depDate = receipt.departure_date ? new Date(receipt.departure_date).toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

  const adopterAddr = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");

  const handlePrint = () => (onPrint ? onPrint() : printDepartureReceipt(receipt));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 9200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface, #fff)", borderRadius: 12, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ background: MCAS_BLUE, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              🧾 {isAdoption ? "Adoption Receipt" : "Departure Receipt"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, fontFamily: "monospace", marginTop: 2 }}>{receipt.receipt_number} · {receipt.departure_type} · {depDate}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              onClick={handlePrint}
            >
              🖨 Print / Save PDF
            </button>
            <button
              style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.35)", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Receipt body */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>

          {/* Agency header */}
          <div style={{ borderBottom: `3px solid ${MCAS_BLUE}`, paddingBottom: 12, marginBottom: 4 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: MCAS_BLUE, textTransform: "uppercase" }}>Morgan County Animal Services</div>
            <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</div>
          </div>

          {/* Two-column: animal + person */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 2 }}>
            <div>
              <SectionHead title="Animal Information" />
              <Field label="Name" value={receipt.animal_name || (a.name as string)} />
              <Field label="Animal ID" value={receipt.animal_id || (a.id as string)} />
              <Field label="Species" value={a.species as string} />
              <Field label="Breed" value={a.breed as string} />
              <Field label="Color" value={a.color as string} />
              <Field label="Sex" value={a.sex as string} />
              <Field label="Age" value={a.age as string} />
              <Field label="Microchip" value={(a.microchip as string) || "None"} />
              <Field label="Rabies Tag" value={a.rabies_tag as string} />
              {isAdoption && <Field label="Spay/Neuter" value={a.fixed ? "Already Fixed" : "Agreement Required"} />}
            </div>
            <div>
              <SectionHead title={isAdoption ? "Adopter Information" : "Person / Agency"} />
              <Field label="Name" value={receipt.person_name} />
              <Field label="Phone" value={p.phone as string} />
              <Field label="Email" value={p.email as string} />
              {adopterAddr && <Field label="Address" value={adopterAddr} />}
              <SectionHead title="Departure Details" />
              <Field label="Type" value={receipt.departure_type} />
              <Field label="Date" value={depDate} />
              <Field label="Processed by" value={receipt.officer_name} />
              {receipt.payment_method && <Field label="Payment" value={receipt.payment_method} />}
            </div>
          </div>

          {/* Fees */}
          <SectionHead title="Fees" />
          {fees.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e7eb", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontSize: 11, color: "#374151" }}>Item</th>
                  <th style={{ padding: "6px 12px", textAlign: "right", fontSize: 11, color: "#374151" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "5px 12px" }}>{f.item}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", fontFamily: "monospace" }}>${f.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${MCAS_BLUE}15`, borderTop: "2px solid #e5e7eb" }}>
                  <td style={{ padding: "7px 12px", fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                  <td style={{ padding: "7px 12px", fontWeight: 900, textAlign: "right", fontFamily: "monospace", fontSize: 14 }}>${(receipt.total_fees || 0).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: "#6b7280", padding: "6px 0", fontStyle: "italic" }}>No fees assessed</div>
          )}

          {/* Conditions */}
          {receipt.conditions && (
            <>
              <SectionHead title="Conditions / Notes" />
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>{receipt.conditions}</div>
            </>
          )}
          {receipt.notes && receipt.notes !== receipt.conditions && (
            <div style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>{receipt.notes}</div>
          )}

          {/* Proof of ownership for adoptions */}
          {isAdoption && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#eff6ff", border: "2px solid #2563eb", borderRadius: 6, textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: "#1e40af", lineHeight: 1.5 }}>
                THIS RECEIPT SERVES AS PROOF OF OWNERSHIP AND ADOPTION FROM MORGAN COUNTY ANIMAL SERVICES
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", padding: "12px 24px", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0, background: "var(--surface, #fff)" }}>
          <button
            style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}
            onClick={onClose}
          >
            Close
          </button>
          <button
            style={{ background: MCAS_BLUE, color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
            onClick={handlePrint}
          >
            🖨 Print / Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
