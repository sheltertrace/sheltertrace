"use client";
import { useState, useMemo } from "react";
import type { Animal, Person, DepartureReceipt } from "@/lib/types";
import { createAdoption, createPerson, updateAnimal, createDepartureReceipt } from "@/lib/data";
import { buildDepartureReceiptPayload, writeReceiptToWindow } from "@/lib/departureReceipt";
import { getCurrentUser } from "@/lib/auth";
import { today, genReceiptId } from "@/lib/utils";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import DateInput from "@/components/ui/DateInput";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

export interface AdoptionFeeItem {
  item: string;
  amount: number;
}

export interface AdoptionReceiptInfo {
  adopterName: string;
  adopterPerson: Person | null;
  fees: AdoptionFeeItem[];
  totalFees: number;
  paymentMethod: string;
  conditions?: string;
  spayNeuterAgreement: boolean;
}

interface Props {
  animal: Animal;
  people: Person[];
  onSuccess: (updated: Animal, info: AdoptionReceiptInfo, receipt: DepartureReceipt) => void;
  onClose: () => void;
}

const PAYMENT_METHODS = ["Cash", "Credit Card", "Debit Card", "Check", "Money Order", "Online"];

const DEFAULT_FEES = {
  adoptionFee: 75,
  microchipFee: 20,
  rabiesFee: 15,
  licenseFee: 10,
  spayNeuterDeposit: 50,
};

export default function AdoptionFromDetailModal({ animal, people, onSuccess, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [adopterSearch, setAdopterSearch] = useState("");
  const [selectedAdopter, setSelectedAdopter] = useState<Person | null>(null);
  const [adoptionDate, setAdoptionDate] = useState(today());
  const [adoptionNotes, setAdoptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New adopter inline creation
  const [showNewAdopter, setShowNewAdopter] = useState(false);
  const [naFirst, setNaFirst] = useState("");
  const [naLast, setNaLast] = useState("");
  const [naPhone, setNaPhone] = useState("");
  const [naEmail, setNaEmail] = useState("");
  const [naAddress, setNaAddress] = useState("");
  const [naCity, setNaCity] = useState("");
  const [naState, setNaState] = useState("GA");
  const [naZip, setNaZip] = useState("");
  const [creatingAdopter, setCreatingAdopter] = useState(false);

  // Fees
  const [includeAdoptionFee, setIncludeAdoptionFee]       = useState(true);
  const [adoptionFeeAmt, setAdoptionFeeAmt]               = useState(DEFAULT_FEES.adoptionFee);
  const [includeMicrochip, setIncludeMicrochip]           = useState(!animal.microchip);
  const [microchipAmt, setMicrochipAmt]                   = useState(DEFAULT_FEES.microchipFee);
  const [includeRabies, setIncludeRabies]                 = useState(false);
  const [rabiesAmt, setRabiesAmt]                         = useState(DEFAULT_FEES.rabiesFee);
  const [includeLicense, setIncludeLicense]               = useState(false);
  const [licenseAmt, setLicenseAmt]                       = useState(DEFAULT_FEES.licenseFee);
  const [includeSnDeposit, setIncludeSnDeposit]           = useState(!animal.fixed);
  const [snDepositAmt, setSnDepositAmt]                   = useState(DEFAULT_FEES.spayNeuterDeposit);
  const [otherFeeLabel, setOtherFeeLabel]                 = useState("");
  const [otherFeeAmt, setOtherFeeAmt]                     = useState(0);
  const [paymentMethod, setPaymentMethod]                 = useState("Cash");
  const [spayNeuterAgreement, setSpayNeuterAgreement]     = useState(!animal.fixed);
  const [conditions, setConditions]                       = useState("");

  const feeItems = useMemo<AdoptionFeeItem[]>(() => {
    const items: AdoptionFeeItem[] = [];
    if (includeAdoptionFee)  items.push({ item: "Adoption Fee", amount: adoptionFeeAmt });
    if (includeMicrochip)    items.push({ item: "Microchip Fee", amount: microchipAmt });
    if (includeRabies)       items.push({ item: "Rabies Vaccination", amount: rabiesAmt });
    if (includeLicense)      items.push({ item: "License Fee", amount: licenseAmt });
    if (includeSnDeposit)    items.push({ item: "Spay/Neuter Deposit", amount: snDepositAmt });
    if (otherFeeLabel.trim() && otherFeeAmt > 0) items.push({ item: otherFeeLabel.trim(), amount: otherFeeAmt });
    return items;
  }, [includeAdoptionFee, adoptionFeeAmt, includeMicrochip, microchipAmt, includeRabies, rabiesAmt,
      includeLicense, licenseAmt, includeSnDeposit, snDepositAmt, otherFeeLabel, otherFeeAmt]);

  const totalFees = useMemo(() => feeItems.reduce((s, f) => s + f.amount, 0), [feeItems]);

  const matches = useMemo(() => {
    if (!adopterSearch.trim()) return [];
    const q = adopterSearch.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q)).slice(0, 8);
  }, [people, adopterSearch]);

  const handleCreateAdopter = async () => {
    if (!naFirst.trim() || !naLast.trim()) return;
    setCreatingAdopter(true);
    try {
      const p = await createPerson({
        first_name: naFirst.trim(), last_name: naLast.trim(), role: "Adopter",
        phone: naPhone, email: naEmail, address: naAddress, city: naCity,
        state: naState, zip: naZip, date_added: today(),
      });
      setSelectedAdopter(p);
      setAdopterSearch(`${p.first_name} ${p.last_name}`);
      setShowNewAdopter(false);
      setNaFirst(""); setNaLast(""); setNaPhone(""); setNaEmail("");
      setNaAddress(""); setNaCity(""); setNaState("GA"); setNaZip("");
    } finally { setCreatingAdopter(false); }
  };

  const handleProcess = async () => {
    if (!selectedAdopter) return;
    setSaving(true);

    // Open print window NOW — must be synchronous inside the click handler
    // so popup blockers allow it. We write content after async work finishes.
    const printWin = window.open("", "_blank", "width=760,height=1060");

    try {
      const adopterName = `${selectedAdopter.first_name} ${selectedAdopter.last_name}`.trim();
      const receiptId = genReceiptId();

      console.log("[adoption] saving adoption record...");
      await createAdoption({
        animal_id: animal.id,
        animal_name: animal.name,
        adopter_id: selectedAdopter.id,
        adopter_name: adopterName,
        adoption_date: adoptionDate,
        notes: [adoptionNotes, conditions].filter(Boolean).join(" | ") || undefined,
        receipt_id: receiptId,
      });

      const updated = await updateAnimal(animal.id, { status: "Adopted", kennel: undefined });

      console.log("[adoption] adoption saved, generating receipt...");
      const cu = getCurrentUser();
      const officerName = cu
        ? `${cu.firstName || cu.first_name || ""} ${cu.lastName || cu.last_name || ""}`.trim() || cu.username
        : "";

      const payload = buildDepartureReceiptPayload(updated, {
        departureType: "Adoption",
        person: selectedAdopter,
        personName: adopterName,
        fees: feeItems,
        totalFees,
        paymentMethod,
        conditions,
        officerName,
        officerId: cu?.id,
      });

      const receipt = await createDepartureReceipt(payload);
      console.log("[adoption] receipt saved to database:", receipt);

      console.log("[adoption] opening print window...");
      if (printWin) {
        writeReceiptToWindow(printWin, receipt);
      } else {
        // Popup was blocked — fallback handled by parent via setPendingReceipt
        console.warn("[adoption] print window was blocked by browser");
      }

      const info: AdoptionReceiptInfo = {
        adopterName,
        adopterPerson: selectedAdopter,
        fees: feeItems,
        totalFees,
        paymentMethod,
        conditions,
        spayNeuterAgreement,
      };
      onSuccess(updated, info, receipt);
    } catch (e: unknown) {
      printWin?.close();
      const err = e as { message?: string };
      alert(`Adoption failed: ${err?.message || "Unknown error"}`);
      setSaving(false);
    }
  };

  const feeRow = (
    label: string,
    included: boolean,
    setIncluded: (v: boolean) => void,
    amt: number,
    setAmt: (v: number) => void,
    disabled?: boolean,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", flex: 1, opacity: disabled ? 0.45 : 1 }}>
        <input type="checkbox" checked={included} onChange={(e) => !disabled && setIncluded(e.target.checked)} disabled={disabled} />
        <span style={{ fontSize: 13 }}>{label}</span>
      </label>
      <input
        type="number"
        className="form-input"
        value={amt}
        onChange={(e) => setAmt(parseFloat(e.target.value) || 0)}
        style={{ width: 80, textAlign: "right", fontSize: 13, opacity: included ? 1 : 0.4 }}
        disabled={!included || disabled}
      />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-header">
          <span className="modal-title">🏡 Process Adoption — {animal.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid var(--border)", padding: "0 20px" }}>
          {[{ n: 1, label: "Adopter" }, { n: 2, label: "Fees & Receipt" }].map(({ n, label }) => (
            <div key={n}
              onClick={() => n === 2 && selectedAdopter ? setStep(2) : n === 1 ? setStep(1) : undefined}
              style={{ padding: "10px 20px", fontSize: 13, fontWeight: step === n ? 700 : 400, color: step === n ? "var(--teal)" : "var(--text-secondary)", borderBottom: step === n ? "2px solid var(--teal)" : "2px solid transparent", marginBottom: -2, cursor: "pointer" }}>
              {n}. {label}
            </div>
          ))}
        </div>

        <div className="modal-body" style={{ overflowY: "auto", flex: 1 }}>

          {/* Step 1: Adopter */}
          {step === 1 && (
            <>
              {/* Animal summary */}
              <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div><b>Animal:</b> {animal.name}</div>
                <div><b>ID:</b> <span style={{ fontFamily: "monospace" }}>{animal.id}</span></div>
                <div><b>Species:</b> {animal.species}</div>
                <div><b>Breed:</b> {animal.breed}</div>
                <div><b>Microchip:</b> {animal.microchip || "None"}</div>
                <div><b>Fixed:</b> {animal.fixed ? "✓ Yes" : "✗ No"}</div>
              </div>

              <F label="Adopter *">
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="Search by name or phone…"
                    value={adopterSearch}
                    onChange={(e) => { setAdopterSearch(e.target.value); setSelectedAdopter(null); }}
                  />
                  {matches.length > 0 && !selectedAdopter && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
                      {matches.map((p) => (
                        <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                          onClick={() => { setSelectedAdopter(p); setAdopterSearch(`${p.first_name} ${p.last_name}`); }}>
                          <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                          <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone || ""}</span>
                          <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </F>

              {selectedAdopter && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 4 }}>
                  ✓ <b>{selectedAdopter.first_name} {selectedAdopter.last_name}</b>
                  {selectedAdopter.phone && <span> · {selectedAdopter.phone}</span>}
                  {selectedAdopter.address && <span> · {selectedAdopter.address}{selectedAdopter.city ? `, ${selectedAdopter.city}` : ""}</span>}
                  <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 11 }}>{selectedAdopter.pid}</span>
                </div>
              )}

              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16, fontSize: 12 }} onClick={() => setShowNewAdopter(!showNewAdopter)}>
                {showNewAdopter ? "▲ Cancel new adopter" : "＋ Create new adopter"}
              </button>

              {showNewAdopter && (
                <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 12 }}>
                    New Adopter
                    <ScanLicenseButton
                      label="📷 Scan License"
                      onScan={(d) => {
                        if (d.firstName) setNaFirst(d.firstName);
                        if (d.lastName)  setNaLast(d.lastName);
                        if (d.address)   setNaAddress(d.address);
                        if (d.city)      setNaCity(d.city);
                        if (d.state)     setNaState(d.state);
                        if (d.zip)       setNaZip(d.zip);
                      }}
                    />
                  </div>
                  <div className="grid-2">
                    <F label="First Name *"><input className="form-input" value={naFirst} onChange={(e) => setNaFirst(e.target.value)} /></F>
                    <F label="Last Name *"><input className="form-input" value={naLast} onChange={(e) => setNaLast(e.target.value)} /></F>
                    <F label="Phone"><input className="form-input" value={naPhone} onChange={(e) => setNaPhone(e.target.value)} /></F>
                    <F label="Email"><input className="form-input" value={naEmail} onChange={(e) => setNaEmail(e.target.value)} /></F>
                    <F label="Address"><input className="form-input" value={naAddress} onChange={(e) => setNaAddress(e.target.value)} /></F>
                    <F label="City"><input className="form-input" value={naCity} onChange={(e) => setNaCity(e.target.value)} /></F>
                    <F label="State"><input className="form-input" value={naState} onChange={(e) => setNaState(e.target.value)} /></F>
                    <F label="ZIP"><input className="form-input" value={naZip} onChange={(e) => setNaZip(e.target.value)} /></F>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCreateAdopter} disabled={creatingAdopter || !naFirst.trim() || !naLast.trim()}>
                    {creatingAdopter ? "Creating…" : "Create & Select"}
                  </button>
                </div>
              )}

              <div className="grid-2">
                <F label="Adoption Date *"><DateInput className="form-input" value={adoptionDate} onChange={(e) => setAdoptionDate(e.target.value)} /></F>
              </div>
            </>
          )}

          {/* Step 2: Fees */}
          {step === 2 && (
            <>
              {selectedAdopter && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>
                  ✓ Adopter: <b>{selectedAdopter.first_name} {selectedAdopter.last_name}</b>
                  {selectedAdopter.phone && <span> · {selectedAdopter.phone}</span>}
                </div>
              )}

              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Fees</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 400 }}>Check box to include · edit amount as needed</span>
              </div>

              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 14px", marginBottom: 12 }}>
                {feeRow("Adoption Fee", includeAdoptionFee, setIncludeAdoptionFee, adoptionFeeAmt, setAdoptionFeeAmt)}
                {feeRow("Microchip Fee", includeMicrochip, setIncludeMicrochip, microchipAmt, setMicrochipAmt, !!animal.microchip && false)}
                {feeRow("Rabies Vaccination", includeRabies, setIncludeRabies, rabiesAmt, setRabiesAmt)}
                {feeRow("License Fee", includeLicense, setIncludeLicense, licenseAmt, setLicenseAmt)}
                {feeRow(
                  "Spay/Neuter Deposit" + (animal.fixed ? " (already fixed — not applicable)" : ""),
                  includeSnDeposit,
                  setIncludeSnDeposit,
                  snDepositAmt,
                  setSnDepositAmt,
                  animal.fixed,
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <input
                    className="form-input"
                    placeholder="Other fee description…"
                    value={otherFeeLabel}
                    onChange={(e) => setOtherFeeLabel(e.target.value)}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <input
                    type="number"
                    className="form-input"
                    value={otherFeeAmt || ""}
                    onChange={(e) => setOtherFeeAmt(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    style={{ width: 80, textAlign: "right", fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Total */}
              <div style={{ background: totalFees > 0 ? "#f0fdf4" : "#f8fafc", border: `1px solid ${totalFees > 0 ? "#86efac" : "var(--border)"}`, borderRadius: 6, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 16, fontFamily: "monospace", color: totalFees > 0 ? "#16a34a" : "var(--text-muted)" }}>
                  ${totalFees.toFixed(2)}
                </span>
              </div>

              {/* Payment method */}
              <F label="Payment Method">
                <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </F>

              {/* Spay/Neuter Agreement */}
              {!animal.fixed && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={spayNeuterAgreement} onChange={(e) => setSpayNeuterAgreement(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Adopter agrees to have the animal spayed/neutered within 30 days of adoption and provide proof to MCAS</span>
                </label>
              )}

              <F label="Conditions / Special Notes">
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Any special conditions, restrictions, or notes for this adoption…"
                />
              </F>

              <F label="Internal Notes">
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={adoptionNotes}
                  onChange={(e) => setAdoptionNotes(e.target.value)}
                  placeholder="Staff notes (not printed on receipt)…"
                />
              </F>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {step === 1 && (
            <button
              className="btn btn-primary"
              onClick={() => setStep(2)}
              disabled={!selectedAdopter || !adoptionDate}
            >
              Next: Fees →
            </button>
          )}
          {step === 2 && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
                onClick={handleProcess}
                disabled={saving}
              >
                {saving ? "Processing…" : "✓ Complete Adoption"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
