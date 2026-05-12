"use client";
import { useState, useEffect } from "react";
import { fetchPeople, createPerson, createRedemption, linkAnimalToPerson, updateAnimal } from "@/lib/data";
import type { Animal, Person } from "@/lib/types";
import { today } from "@/lib/utils";
import StaffSelect from "@/components/ui/StaffSelect";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";

export interface RedemptionReceiptInfo {
  ownerName: string;
  ownerPerson: Person;
  fees: Array<{ item: string; amount: number }>;
  totalFees: number;
  paymentMethod?: string;
  conditions?: string;
}

interface Props {
  animal: Animal;
  onComplete: (updatedAnimal: Animal, info: RedemptionReceiptInfo) => void;
  onClose: () => void;
}

const CONDITIONS = [
  "Owner has provided valid proof of ownership",
  "All outstanding fees have been paid or waived",
  "Animal has current rabies vaccination or owner agrees to vaccinate within 30 days",
  "Animal is microchipped or owner agrees to microchip within 30 days",
  "Owner has been advised of citation(s) if applicable",
  "Owner acknowledges responsibility under Morgan County ordinances",
];

const PROOF_OPTIONS = [
  "Photo ID + Animal License",
  "Microchip Registration",
  "Veterinary Records",
  "Photo Evidence",
  "Neighbor/Witness Statement",
  "Other Documentation",
];

const DEFAULT_FEES = {
  impound: 50,
  boarding: 15,
  rabies: 15,
  microchip: 25,
  license: 10,
};

function calcTotal(fees: FeeState): number {
  return (
    (fees.includeImpound ? fees.impound : 0) +
    (fees.includeBoarding ? fees.boarding * fees.boardingDays : 0) +
    (fees.includeRabies ? fees.rabies : 0) +
    (fees.includeMicrochip ? fees.microchip : 0) +
    (fees.includeLicense ? fees.license : 0) +
    fees.otherFees
  );
}

interface FeeState {
  impound: number;
  includeImpound: boolean;
  boarding: number;
  boardingDays: number;
  includeBoarding: boolean;
  rabies: number;
  includeRabies: boolean;
  microchip: number;
  includeMicrochip: boolean;
  license: number;
  includeLicense: boolean;
  otherFees: number;
}

function printRedemptionReceipt(
  animal: Animal,
  owner: Person,
  fees: FeeState,
  paymentMethod: string,
  waiverReason: string,
  receiptNumber: string,
  proofOfOwnership: string,
  conditionsChecked: boolean[],
  conditionsNotes: string,
  citationIssued: boolean,
  citationNumber: string,
  officer: string,
  redemptionDate: string,
) {
  const total = calcTotal(fees);
  const ownerName = [owner.first_name, owner.last_name].filter(Boolean).join(" ");
  const html = `<!DOCTYPE html><html><head><title>Redemption Receipt — ${animal.name}</title>
<style>
  @page { size: letter; margin: 0.75in; @top-left { content: "Morgan County Animal Services"; font-size: 9pt; } @top-right { content: "Page " counter(page); font-size: 9pt; } }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 2px; }
  h2 { font-size: 12pt; border-bottom: 1.5px solid #333; padding-bottom: 4px; margin: 18px 0 8px; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .subtitle { font-size: 11pt; color: #444; }
  .receipt-num { font-size: 10pt; color: #555; margin-top: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .field { margin-bottom: 8px; }
  .label { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: .5px; }
  .value { font-size: 10.5pt; font-weight: 600; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #f3f4f6; font-size: 9pt; text-align: left; padding: 5px 8px; border: 1px solid #ddd; }
  td { padding: 5px 8px; border: 1px solid #eee; font-size: 10pt; }
  .total-row td { font-weight: 700; font-size: 11pt; border-top: 2px solid #333; }
  .waived { color: #16a34a; font-style: italic; }
  .condition { margin: 4px 0; font-size: 9.5pt; }
  .sig-block { margin-top: 36px; }
  .sig-line { border-bottom: 1px solid #333; width: 280px; display: inline-block; margin-right: 40px; margin-top: 32px; }
  .sig-label { font-size: 8.5pt; color: #555; }
</style></head><body>
<div class="header">
  <h1>Animal Redemption Receipt</h1>
  <div class="subtitle">Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · 706.752.1195</div>
  ${receiptNumber ? `<div class="receipt-num">Receipt #: ${receiptNumber}</div>` : ""}
</div>

<h2>Animal Information</h2>
<div class="grid2">
  <div class="field"><div class="label">Animal ID</div><div class="value">${animal.id}</div></div>
  <div class="field"><div class="label">Name</div><div class="value">${animal.name}</div></div>
  <div class="field"><div class="label">Species / Breed</div><div class="value">${animal.species}${animal.breed ? ` — ${animal.breed}` : ""}</div></div>
  <div class="field"><div class="label">Color</div><div class="value">${animal.color || "—"}</div></div>
  <div class="field"><div class="label">Microchip</div><div class="value">${animal.microchip || "None on file"}</div></div>
  <div class="field"><div class="label">Rabies Tag</div><div class="value">${animal.rabies_tag || "None on file"}</div></div>
  <div class="field"><div class="label">Intake Date</div><div class="value">${animal.intake_date || "—"}</div></div>
  <div class="field"><div class="label">Redemption Date</div><div class="value">${redemptionDate}</div></div>
</div>

<h2>Owner Information</h2>
<div class="grid2">
  <div class="field"><div class="label">Name</div><div class="value">${ownerName}</div></div>
  <div class="field"><div class="label">Person ID</div><div class="value">${owner.pid || owner.id}</div></div>
  <div class="field"><div class="label">Phone</div><div class="value">${owner.phone || "—"}</div></div>
  <div class="field"><div class="label">Address</div><div class="value">${[owner.address, owner.city, owner.state, owner.zip].filter(Boolean).join(", ") || "—"}</div></div>
  <div class="field"><div class="label">ID Type / Number</div><div class="value">${owner.id_type ? `${owner.id_type} — ${owner.id_number || ""}` : "—"}</div></div>
  <div class="field"><div class="label">Proof of Ownership</div><div class="value">${proofOfOwnership || "—"}</div></div>
</div>

<h2>Fee Summary</h2>
<table>
  <thead><tr><th>Item</th><th style="text-align:right;width:80px">Amount</th></tr></thead>
  <tbody>
    ${fees.includeImpound ? `<tr><td>Impound Fee</td><td style="text-align:right">$${fees.impound.toFixed(2)}</td></tr>` : ""}
    ${fees.includeBoarding ? `<tr><td>Boarding Fee (${fees.boardingDays} day${fees.boardingDays !== 1 ? "s" : ""} × $${fees.boarding.toFixed(2)})</td><td style="text-align:right">$${(fees.boarding * fees.boardingDays).toFixed(2)}</td></tr>` : ""}
    ${fees.includeRabies ? `<tr><td>Rabies Vaccination Fee</td><td style="text-align:right">$${fees.rabies.toFixed(2)}</td></tr>` : ""}
    ${fees.includeMicrochip ? `<tr><td>Microchip Fee</td><td style="text-align:right">$${fees.microchip.toFixed(2)}</td></tr>` : ""}
    ${fees.includeLicense ? `<tr><td>License Fee</td><td style="text-align:right">$${fees.license.toFixed(2)}</td></tr>` : ""}
    ${fees.otherFees > 0 ? `<tr><td>Other Fees</td><td style="text-align:right">$${fees.otherFees.toFixed(2)}</td></tr>` : ""}
    <tr class="total-row"><td>TOTAL</td><td style="text-align:right">$${total.toFixed(2)}</td></tr>
  </tbody>
</table>
<div style="margin-top:8px;font-size:10pt;">
  <strong>Payment Method:</strong> ${paymentMethod || "—"}
  ${paymentMethod === "Waived" && waiverReason ? `<span class="waived"> — Waived: ${waiverReason}</span>` : ""}
</div>

${citationIssued ? `<h2>Citation</h2><div style="font-size:10pt;"><strong>Citation Issued:</strong> Yes${citationNumber ? ` — #${citationNumber}` : ""}</div>` : ""}

<h2>Conditions &amp; Acknowledgements</h2>
${CONDITIONS.map((c, i) => `<div class="condition">${conditionsChecked[i] ? "☑" : "☐"} ${c}</div>`).join("")}
${conditionsNotes ? `<div style="margin-top:8px;font-size:9.5pt;"><strong>Notes:</strong> ${conditionsNotes}</div>` : ""}

<div class="sig-block">
  <div><span class="sig-line"></span><span class="sig-line"></span></div>
  <div style="display:flex;gap:40px;margin-top:4px;">
    <div style="width:280px"><span class="sig-label">Owner Signature / Date</span></div>
    <div style="width:280px"><span class="sig-label">Officer: ${officer || "_____________________"} / Date</span></div>
  </div>
</div>
</body></html>`;

  const w = window.open("", "_blank", "width=850,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

export default function RedemptionWizard({ animal, onComplete, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // Step 1 — Owner identification
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("GA");
  const [newZip, setNewZip] = useState("");
  const [newIdType, setNewIdType] = useState("Driver's License");
  const [newIdNumber, setNewIdNumber] = useState("");

  // Step 2 — Fees
  const [fees, setFees] = useState<FeeState>({
    impound: DEFAULT_FEES.impound,
    includeImpound: true,
    boarding: DEFAULT_FEES.boarding,
    boardingDays: 0,
    includeBoarding: true,
    rabies: DEFAULT_FEES.rabies,
    includeRabies: false,
    microchip: DEFAULT_FEES.microchip,
    includeMicrochip: false,
    license: DEFAULT_FEES.license,
    includeLicense: false,
    otherFees: 0,
  });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [waiverReason, setWaiverReason] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [proofOfOwnership, setProofOfOwnership] = useState("");

  // Step 3 — Conditions
  const [conditionsChecked, setConditionsChecked] = useState<boolean[]>(CONDITIONS.map(() => false));
  const [conditionsNotes, setConditionsNotes] = useState("");
  const [citationIssued, setCitationIssued] = useState(false);
  const [citationNumber, setCitationNumber] = useState("");
  const [officer, setOfficer] = useState("");
  const [redemptionDate, setRedemptionDate] = useState(today());

  useEffect(() => {
    fetchPeople().then((p) => { setPeople(p); setPeopleLoading(false); }).catch(() => setPeopleLoading(false));
  }, []);

  const filteredPeople = people.filter((p) => {
    if (!personSearch.trim()) return false;
    const q = personSearch.toLowerCase();
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.pid || "").toLowerCase().includes(q) ||
      (p.phone || "").includes(q);
  });

  const total = calcTotal(fees);

  const handleSaveNewPerson = async () => {
    if (!newFirst.trim() || !newLast.trim()) { setErrMsg("First and last name required."); return; }
    setSaving(true);
    setErrMsg("");
    try {
      const person = await createPerson({
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        phone: newPhone || undefined,
        address: newAddress || undefined,
        city: newCity || undefined,
        state: newState || undefined,
        zip: newZip || undefined,
        id_type: newIdType || undefined,
        id_number: newIdNumber || undefined,
        role: "Previous Owner",
      });
      setSelectedPerson(person);
      setShowNewPerson(false);
      setPeople((prev) => [person, ...prev]);
    } catch (e: unknown) {
      setErrMsg((e as { message?: string }).message || "Failed to create person");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!selectedPerson) return;
    setSaving(true);
    setErrMsg("");
    try {
      await createRedemption({
        animal_id: animal.id,
        person_id: selectedPerson.id,
        redemption_date: redemptionDate,
        impound_fee: fees.includeImpound ? fees.impound : 0,
        boarding_fee: fees.includeBoarding ? fees.boarding * fees.boardingDays : 0,
        boarding_days: fees.boardingDays,
        rabies_fee: fees.includeRabies ? fees.rabies : 0,
        microchip_fee: fees.includeMicrochip ? fees.microchip : 0,
        license_fee: fees.includeLicense ? fees.license : 0,
        other_fees: fees.otherFees,
        total_fees: total,
        payment_method: paymentMethod || undefined,
        waiver_reason: waiverReason || undefined,
        receipt_number: receiptNumber || undefined,
        proof_of_ownership: proofOfOwnership || undefined,
        conditions_notes: conditionsNotes || undefined,
        citation_issued: citationIssued,
        citation_number: citationNumber || undefined,
        officer: officer || undefined,
      });
      await linkAnimalToPerson(animal.id, selectedPerson.id);
      const updated = await updateAnimal(animal.id, { status: "Redeemed" });
      const feeItems: Array<{ item: string; amount: number }> = [];
      if (fees.includeImpound)  feeItems.push({ item: "Impound Fee", amount: fees.impound });
      if (fees.includeBoarding) feeItems.push({ item: `Boarding (${fees.boardingDays} days)`, amount: fees.boarding * fees.boardingDays });
      if (fees.includeRabies)   feeItems.push({ item: "Rabies Vaccination", amount: fees.rabies });
      if (fees.includeMicrochip) feeItems.push({ item: "Microchip Fee", amount: fees.microchip });
      if (fees.includeLicense)  feeItems.push({ item: "License Fee", amount: fees.license });
      if (fees.otherFees > 0)   feeItems.push({ item: "Other Fees", amount: fees.otherFees });
      onComplete(updated, {
        ownerName: `${selectedPerson.first_name} ${selectedPerson.last_name}`.trim(),
        ownerPerson: selectedPerson,
        fees: feeItems,
        totalFees: total,
        paymentMethod,
        conditions: conditionsNotes,
      });
    } catch (e: unknown) {
      setErrMsg((e as { message?: string }).message || "Failed to complete redemption");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 680, width: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">🔑 Redeem Animal — {animal.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-alt)" }}>
          {["Owner ID", "Fees & Proof", "Conditions", "Review"].map((label, i) => (
            <div
              key={i}
              style={{
                flex: 1, padding: "10px 4px", textAlign: "center", fontSize: 11, fontWeight: 600,
                color: step === i + 1 ? "var(--teal)" : step > i + 1 ? "#22c55e" : "var(--text-muted)",
                borderBottom: step === i + 1 ? "2px solid var(--teal)" : "2px solid transparent",
                cursor: step > i + 1 ? "pointer" : "default",
              }}
              onClick={() => { if (step > i + 1) setStep(i + 1); }}
            >
              {step > i + 1 ? "✓ " : `${i + 1}. `}{label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {errMsg && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", marginBottom: 14 }}>
              ⚠️ {errMsg}
            </div>
          )}

          {/* ── Step 1: Owner Identification ── */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Search for the owner in the system:</div>
              <input
                className="form-input"
                placeholder="Search by name, PID, or phone…"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                autoFocus
              />
              {selectedPerson && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedPerson.first_name} {selectedPerson.last_name}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{selectedPerson.pid || selectedPerson.id} · {selectedPerson.phone || "No phone"} · {selectedPerson.address || "No address"}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPerson(null)}>✕ Clear</button>
                </div>
              )}
              {!selectedPerson && personSearch.trim() && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
                  {peopleLoading ? (
                    <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>Loading…</div>
                  ) : filteredPeople.length === 0 ? (
                    <div style={{ padding: 12, color: "var(--text-muted)", fontSize: 12 }}>No results — <button className="btn btn-ghost btn-sm" onClick={() => setShowNewPerson(true)}>+ Create New Person</button></div>
                  ) : (
                    filteredPeople.map((p) => (
                      <div
                        key={p.id}
                        style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", fontSize: 13 }}
                        onClick={() => { setSelectedPerson(p); setPersonSearch(""); }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                        <span style={{ color: "var(--text-secondary)", marginLeft: 10 }}>{p.pid || p.id} · {p.phone || "—"}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowNewPerson(!showNewPerson)}>
                  {showNewPerson ? "▲ Cancel New Person" : "+ Create New Person"}
                </button>
              </div>

              {showNewPerson && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginTop: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    New Person
                    <ScanLicenseButton
                      label="📷 Scan License"
                      onScan={(d) => {
                        if (d.firstName)     setNewFirst(d.firstName);
                        if (d.lastName)      setNewLast(d.lastName);
                        if (d.address)       setNewAddress(d.address);
                        if (d.city)          setNewCity(d.city);
                        if (d.state)         setNewState(d.state);
                        if (d.zip)           setNewZip(d.zip);
                        if (d.licenseNumber) setNewIdNumber(d.licenseNumber);
                        setNewIdType("Driver's License");
                      }}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div><label className="form-label">First Name *</label><input className="form-input" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} /></div>
                    <div><label className="form-label">Last Name *</label><input className="form-input" value={newLast} onChange={(e) => setNewLast(e.target.value)} /></div>
                    <div><label className="form-label">Phone</label><input className="form-input" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                    <div><label className="form-label">ID Type</label>
                      <select className="form-select" value={newIdType} onChange={(e) => setNewIdType(e.target.value)}>
                        {["Driver's License","State ID","Passport","Military ID","Other"].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className="form-label">ID Number</label><input className="form-input" value={newIdNumber} onChange={(e) => setNewIdNumber(e.target.value)} /></div>
                    <div><label className="form-label">Address</label><input className="form-input" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} /></div>
                    <div><label className="form-label">City</label><input className="form-input" value={newCity} onChange={(e) => setNewCity(e.target.value)} /></div>
                    <div><label className="form-label">State / Zip</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input className="form-input" value={newState} onChange={(e) => setNewState(e.target.value)} style={{ width: 60 }} />
                        <input className="form-input" value={newZip} onChange={(e) => setNewZip(e.target.value)} placeholder="Zip" />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveNewPerson} disabled={saving}>
                      {saving ? "Saving…" : "Save Person"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Fees & Proof ── */}
          {step === 2 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div><label className="form-label">Redemption Date</label>
                  <input type="date" className="form-input" value={redemptionDate} onChange={(e) => setRedemptionDate(e.target.value)} />
                </div>
                <div><label className="form-label">Receipt Number</label>
                  <input className="form-input" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="RCP-XXXX" />
                </div>
              </div>

              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Fee Calculator</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600, fontSize: 11, color: "var(--text-secondary)" }}>Include</th>
                    <th style={{ textAlign: "left", padding: "4px 6px", fontWeight: 600, fontSize: 11, color: "var(--text-secondary)" }}>Item</th>
                    <th style={{ textAlign: "right", padding: "4px 6px", fontWeight: 600, fontSize: 11, color: "var(--text-secondary)" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "Impound", include: fees.includeImpound, setInclude: (v: boolean) => setFees((f) => ({ ...f, includeImpound: v })), amount: fees.impound, setAmount: (v: number) => setFees((f) => ({ ...f, impound: v })) },
                    { key: "Rabies Fee", include: fees.includeRabies, setInclude: (v: boolean) => setFees((f) => ({ ...f, includeRabies: v })), amount: fees.rabies, setAmount: (v: number) => setFees((f) => ({ ...f, rabies: v })) },
                    { key: "Microchip Fee", include: fees.includeMicrochip, setInclude: (v: boolean) => setFees((f) => ({ ...f, includeMicrochip: v })), amount: fees.microchip, setAmount: (v: number) => setFees((f) => ({ ...f, microchip: v })) },
                    { key: "License Fee", include: fees.includeLicense, setInclude: (v: boolean) => setFees((f) => ({ ...f, includeLicense: v })), amount: fees.license, setAmount: (v: number) => setFees((f) => ({ ...f, license: v })) },
                  ].map(({ key, include, setInclude, amount, setAmount }) => (
                    <tr key={key} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "6px 6px" }}>
                        <input type="checkbox" checked={include} onChange={(e) => setInclude(e.target.checked)} />
                      </td>
                      <td style={{ padding: "6px 6px", color: include ? "inherit" : "var(--text-muted)" }}>{key}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right" }}>
                        <input
                          type="number" min={0} step={0.01}
                          className="form-input"
                          style={{ width: 80, textAlign: "right", padding: "2px 6px" }}
                          value={amount}
                          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                          disabled={!include}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "6px 6px" }}>
                      <input type="checkbox" checked={fees.includeBoarding} onChange={(e) => setFees((f) => ({ ...f, includeBoarding: e.target.checked }))} />
                    </td>
                    <td style={{ padding: "6px 6px", color: fees.includeBoarding ? "inherit" : "var(--text-muted)" }}>
                      Boarding Fee
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                        <input
                          type="number" min={0}
                          style={{ width: 44, marginRight: 3, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}
                          value={fees.boardingDays}
                          onChange={(e) => setFees((f) => ({ ...f, boardingDays: parseInt(e.target.value) || 0 }))}
                          disabled={!fees.includeBoarding}
                        /> days × $
                        <input
                          type="number" min={0} step={0.01}
                          style={{ width: 44, marginLeft: 1, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11 }}
                          value={fees.boarding}
                          onChange={(e) => setFees((f) => ({ ...f, boarding: parseFloat(e.target.value) || 0 }))}
                          disabled={!fees.includeBoarding}
                        />
                      </span>
                    </td>
                    <td style={{ padding: "6px 6px", textAlign: "right", fontWeight: 600 }}>
                      ${(fees.includeBoarding ? fees.boarding * fees.boardingDays : 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "6px 6px" }}></td>
                    <td style={{ padding: "6px 6px", color: "var(--text-secondary)" }}>Other Fees</td>
                    <td style={{ padding: "6px 6px", textAlign: "right" }}>
                      <input
                        type="number" min={0} step={0.01}
                        className="form-input"
                        style={{ width: 80, textAlign: "right", padding: "2px 6px" }}
                        value={fees.otherFees}
                        onChange={(e) => setFees((f) => ({ ...f, otherFees: parseFloat(e.target.value) || 0 }))}
                      />
                    </td>
                  </tr>
                  <tr style={{ background: "var(--bg-alt)", fontWeight: 700 }}>
                    <td colSpan={2} style={{ padding: "8px 6px", fontSize: 14 }}>TOTAL</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontSize: 14 }}>${total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {["Cash", "Check", "Credit Card", "Debit Card", "Money Order", "Waived"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Proof of Ownership</label>
                  <select className="form-select" value={proofOfOwnership} onChange={(e) => setProofOfOwnership(e.target.value)}>
                    <option value="">— Select —</option>
                    {PROOF_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              {paymentMethod === "Waived" && (
                <div style={{ marginTop: 10 }}>
                  <label className="form-label">Waiver Reason</label>
                  <input className="form-input" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} placeholder="Reason for fee waiver…" />
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Conditions ── */}
          {step === 3 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10 }}>Confirm conditions met before release:</div>
              {CONDITIONS.map((cond, i) => (
                <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={conditionsChecked[i]}
                    onChange={(e) => {
                      const next = [...conditionsChecked];
                      next[i] = e.target.checked;
                      setConditionsChecked(next);
                    }}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{cond}</span>
                </label>
              ))}

              <div style={{ marginTop: 14 }}>
                <label className="form-label">Additional Notes</label>
                <textarea className="form-input" rows={3} value={conditionsNotes} onChange={(e) => setConditionsNotes(e.target.value)} placeholder="Any special conditions, notes, or restrictions…" style={{ resize: "vertical" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <label className="form-label">Processing Officer</label>
                  <StaffSelect value={officer} onChange={setOfficer} placeholder="— Select officer —" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="form-label">Citation Issued?</label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginTop: 4 }}>
                    <input type="checkbox" checked={citationIssued} onChange={(e) => setCitationIssued(e.target.checked)} />
                    <span style={{ fontSize: 13 }}>Yes, citation was issued</span>
                  </label>
                </div>
                {citationIssued && (
                  <div>
                    <label className="form-label">Citation Number</label>
                    <input className="form-input" value={citationNumber} onChange={(e) => setCitationNumber(e.target.value)} placeholder="CIT-XXXX" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && selectedPerson && (
            <div>
              <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12 }}>
                ⚠️ Completing this redemption will mark <strong>{animal.name}</strong> as <strong>Redeemed</strong> and cannot be undone without manually editing the animal record.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "var(--text-secondary)" }}>ANIMAL</div>
                  <div style={{ fontWeight: 600 }}>{animal.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{animal.id} · {animal.species}{animal.breed ? ` ${animal.breed}` : ""}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Intake: {animal.intake_date}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "var(--text-secondary)" }}>OWNER</div>
                  <div style={{ fontWeight: 600 }}>{selectedPerson.first_name} {selectedPerson.last_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selectedPerson.pid || selectedPerson.id}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selectedPerson.phone || "No phone"}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "var(--text-secondary)" }}>FEES</div>
                {fees.includeImpound && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Impound Fee</span><span>${fees.impound.toFixed(2)}</span></div>}
                {fees.includeBoarding && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Boarding ({fees.boardingDays}d)</span><span>${(fees.boarding * fees.boardingDays).toFixed(2)}</span></div>}
                {fees.includeRabies && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Rabies Fee</span><span>${fees.rabies.toFixed(2)}</span></div>}
                {fees.includeMicrochip && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Microchip Fee</span><span>${fees.microchip.toFixed(2)}</span></div>}
                {fees.includeLicense && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>License Fee</span><span>${fees.license.toFixed(2)}</span></div>}
                {fees.otherFees > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Other Fees</span><span>${fees.otherFees.toFixed(2)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
                  <span>TOTAL</span><span>${total.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  Payment: {paymentMethod}{paymentMethod === "Waived" && waiverReason ? ` — ${waiverReason}` : ""}
                </div>
              </div>

              <div className="card" style={{ padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "var(--text-secondary)" }}>CONDITIONS ({conditionsChecked.filter(Boolean).length}/{CONDITIONS.length})</div>
                {CONDITIONS.map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: conditionsChecked[i] ? "#16a34a" : "#dc2626", marginBottom: 2 }}>
                    {conditionsChecked[i] ? "✓" : "✗"} {c}
                  </div>
                ))}
                {conditionsNotes && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 6 }}>Notes: {conditionsNotes}</div>}
                {citationIssued && <div style={{ fontSize: 12, marginTop: 6, color: "#f59e0b" }}>⚠️ Citation issued{citationNumber ? `: #${citationNumber}` : ""}</div>}
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  className="btn btn-secondary"
                  style={{ marginRight: 10 }}
                  onClick={() =>
                    printRedemptionReceipt(
                      animal, selectedPerson, fees, paymentMethod, waiverReason, receiptNumber,
                      proofOfOwnership, conditionsChecked, conditionsNotes, citationIssued, citationNumber,
                      officer, redemptionDate,
                    )
                  }
                >
                  🖨 Print Redemption Receipt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={step === 1 ? onClose : () => { setErrMsg(""); setStep(step - 1); }} disabled={saving}>
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step < 4 ? (
            <button
              className="btn btn-primary"
              disabled={step === 1 && !selectedPerson}
              onClick={() => { setErrMsg(""); setStep(step + 1); }}
            >
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleComplete} disabled={saving || !selectedPerson}>
              {saving ? "Processing…" : "✓ Complete Redemption"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
