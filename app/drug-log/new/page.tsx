"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/app/providers";
import DateInput from "@/components/ui/DateInput";
import SignaturePad from "@/components/ui/SignaturePad";
import {
  fetchAnimals,
  fetchDrugInventory,
  fetchEuthanasiaLog,
  createEuthanasiaLogEntry,
  updateDrugInventory,
  fetchStaffOptions,
} from "@/lib/data";
import { EUTH_REASONS } from "@/lib/constants";
import type { Animal, DrugInventory, EuthanasiaLog } from "@/lib/types";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_DOTS, AGENCY_SHORT, COUNTY_NAME, COUNTY_STATE } from "@/lib/shelterInfo";

// ── Signature adapter ─────────────────────────────────────────────────────────

interface SimpleSigPadProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

function SimpleSigPad({ label, value, onChange, required }: SimpleSigPadProps) {
  const [ts, setTs] = useState<string | null>(null);
  return (
    <SignaturePad
      label={label + (required ? " *" : "")}
      value={value || null}
      timestamp={ts}
      onAccept={(data, stamp) => { setTs(stamp); onChange(data); }}
      onClear={() => { setTs(null); onChange(""); }}
    />
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: "#0f2942", borderBottom: "2px solid #0f2942", paddingBottom: 8, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Animal suggestion item ────────────────────────────────────────────────────

function AnimalSuggestion({ animal, onSelect }: { animal: Animal; onSelect: (a: Animal) => void }) {
  return (
    <div
      onClick={() => onSelect(animal)}
      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border,#e2e8f0)", fontSize: 13 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      <strong>{animal.name}</strong>
      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{animal.species} · {animal.breed} · {animal.sex}</span>
      <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 11 }}>ID: {animal.id.slice(0, 8)}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewDrugLogPage() {
  const { user } = useAuth();
  const router = useRouter();

  const canAccess = user?.permissions?.includes("all") || user?.permissions?.includes("admin");

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [drugInventory, setDrugInventory] = useState<DrugInventory[]>([]);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<EuthanasiaLog | null>(null);
  const [err, setErr] = useState("");

  // Animal search
  const [animalSearch, setAnimalSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [animalId, setAnimalId] = useState("");
  const [animalName, setAnimalName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("");
  const [weight, setWeight] = useState("");
  const [reason, setReason] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logTime, setLogTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  // Drug
  const [selectedDrugId, setSelectedDrugId] = useState("");
  const [drugName, setDrugName] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [bottleId, setBottleId] = useState("");          // user-facing bottle number (e.g. FP-003)
  const [currentBottleBalance, setCurrentBottleBalance] = useState<number>(0);
  const [route, setRoute] = useState("");
  const [dosageDrawn, setDosageDrawn] = useState("");
  const [dosageAdministered, setDosageAdministered] = useState("");

  // Pre-sedation
  const [usePreSedation, setUsePreSedation] = useState(false);
  const [preSedDrugName, setPreSedDrugName] = useState("");   // free-text or from dropdown
  const [preSedInvId, setPreSedInvId] = useState("");         // inventory FK
  const [preSedLot, setPreSedLot] = useState("");
  const [preSedBottleId, setPreSedBottleId] = useState("");
  const [preSedConcentration, setPreSedConcentration] = useState("");
  const [preSedDeaSchedule, setPreSedDeaSchedule] = useState("");
  const [preSedBalance, setPreSedBalance] = useState<number>(0);
  const [preSedRoute, setPreSedRoute] = useState("");
  const [preSedDrawn, setPreSedDrawn] = useState("");
  const [preSedAdministered, setPreSedAdministered] = useState("");

  // Verification
  const [deathVerification, setDeathVerification] = useState("");
  const [timeOfDeath, setTimeOfDeath] = useState("");
  const [bodyDisposition, setBodyDisposition] = useState("");
  const [ownerPresent, setOwnerPresent] = useState(false);
  const [complications, setComplications] = useState("");
  const [notes, setNotes] = useState("");

  // Signatures
  const [administeredById, setAdministeredById] = useState("");
  const [administeredByName, setAdministeredByName] = useState("");
  const [adminSig, setAdminSig] = useState("");
  const [witnessId, setWitnessId] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessSig, setWitnessSig] = useState("");

  // Correction
  const [isCorrection, setIsCorrection] = useState(false);
  const [correctsLogId, setCorrectsLogId] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  useEffect(() => {
    Promise.all([
      fetchAnimals(),
      fetchDrugInventory(),
      fetchStaffOptions(),
    ]).then(([a, d, s]) => {
      setAnimals(a);
      setDrugInventory(d.filter((b) => b.bottle_status === "Active"));
      setStaffOptions(s);
    });
  }, []);

  // Hide suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectAnimal(a: Animal) {
    setAnimalSearch(a.name);
    setAnimalId(a.id);
    setAnimalName(a.name);
    setSpecies(a.species || "");
    setBreed(a.breed || "");
    setSex(a.sex || "");
    setWeight(a.weight || "");
    setShowSuggestions(false);
  }

  function handleDrugSelect(id: string) {
    setSelectedDrugId(id);
    const bottle = drugInventory.find((b) => b.id === id);
    if (bottle) {
      setDrugName(bottle.drug_name);
      setLotNumber(bottle.lot_number || "");
      setBottleId(bottle.bottle_number || bottle.lot_number || "");
      setCurrentBottleBalance(bottle.quantity_remaining_ml || 0);
    }
  }

  function handlePreSedDrugSelect(id: string) {
    setPreSedInvId(id);
    if (!id) { setPreSedDrugName(""); setPreSedLot(""); setPreSedBottleId(""); setPreSedConcentration(""); setPreSedBalance(0); return; }
    const bottle = drugInventory.find((b) => b.id === id);
    if (bottle) {
      setPreSedDrugName(bottle.drug_name);
      setPreSedLot(bottle.lot_number || "");
      setPreSedBottleId(bottle.bottle_number || bottle.lot_number || "");
      setPreSedConcentration(bottle.concentration || "");
      setPreSedBalance(bottle.quantity_remaining_ml || 0);
      setPreSedDeaSchedule(getPreSedDeaSchedule(bottle.drug_name));
    }
  }

  function getPreSedDeaSchedule(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("ketamine") || n.includes("telazol") || n.includes("tkx")) return "Schedule III";
    if (n.includes("xylazine") || n.includes("acepromazine") || n.includes("dexmedetomidine")) return "Non-Scheduled";
    return "";
  }

  const preSedWasted = (parseFloat(preSedDrawn) || 0) - (parseFloat(preSedAdministered) || 0);
  const preSedRunning = preSedBalance - (parseFloat(preSedAdministered) || 0);

  const dosageWasted = (parseFloat(dosageDrawn) || 0) - (parseFloat(dosageAdministered) || 0);
  const runningBalance = currentBottleBalance - (parseFloat(dosageAdministered) || 0);

  const filteredAnimals = animalSearch.length >= 2
    ? animals.filter((a) =>
        a.name.toLowerCase().includes(animalSearch.toLowerCase()) ||
        a.id.toLowerCase().includes(animalSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  async function handleSubmit() {
    setErr("");
    if (!animalName) { setErr("Animal name is required."); return; }
    if (!selectedDrugId) { setErr("Drug selection is required."); return; }
    if (!route) { setErr("Route of administration is required."); return; }
    const drawn = parseFloat(dosageDrawn);
    const administered = parseFloat(dosageAdministered);
    if (isNaN(drawn) || drawn <= 0) { setErr("Dosage drawn must be a positive number."); return; }
    if (isNaN(administered) || administered <= 0) { setErr("Dosage administered must be a positive number."); return; }
    if (administered > drawn) { setErr("Dosage administered cannot exceed dosage drawn."); return; }
    if (!deathVerification) { setErr("Death verification is required."); return; }
    if (!adminSig) { setErr("Administering staff signature is required."); return; }
    if (!witnessSig) { setErr("Witness signature is required."); return; }
    if (administeredByName && witnessName && administeredByName === witnessName) {
      setErr("Witness must be a different person than the administering staff."); return;
    }
    if (isCorrection && !correctionReason) { setErr("Correction reason is required."); return; }

    setSaving(true);
    try {
      const allLogs = await fetchEuthanasiaLog();
      const year = new Date().getFullYear();
      const thisYearLogs = allLogs.filter((l) => l.log_number.startsWith(`EL-${year}-`));
      const logNumber = `EL-${year}-${String(thisYearLogs.length + 1).padStart(4, "0")}`;

      const entry: Partial<EuthanasiaLog> = {
        log_number: logNumber,
        log_date: logDate,
        log_time: logTime || undefined,
        animal_id: animalId || undefined,
        animal_name: animalName,
        species: species || undefined,
        breed: breed || undefined,
        sex: sex || undefined,
        weight: weight || undefined,
        reason: reason || undefined,
        drug_inventory_id: selectedDrugId,
        drug_name: drugName,
        lot_number: lotNumber || undefined,
        bottle_id: bottleId || undefined,
        route,
        pre_sedation_drug: usePreSedation ? preSedDrugName : undefined,
        pre_sedation_route: usePreSedation ? preSedRoute : undefined,
        pre_sedation_inventory_id: (usePreSedation && preSedInvId) ? preSedInvId : undefined,
        pre_sedation_lot_number: usePreSedation ? (preSedLot || undefined) : undefined,
        pre_sedation_bottle_id: usePreSedation ? (preSedBottleId || undefined) : undefined,
        pre_sedation_concentration: usePreSedation ? (preSedConcentration || undefined) : undefined,
        pre_sedation_dea_schedule: usePreSedation ? (preSedDeaSchedule || undefined) : undefined,
        pre_sedation_dosage_drawn_ml: usePreSedation ? (parseFloat(preSedDrawn) || undefined) : undefined,
        pre_sedation_dosage_administered_ml: usePreSedation ? (parseFloat(preSedAdministered) || undefined) : undefined,
        pre_sedation_dosage_wasted_ml: (usePreSedation && preSedDrawn && preSedAdministered) ? Math.max(0, preSedWasted) : undefined,
        pre_sedation_running_balance_ml: (usePreSedation && preSedInvId) ? preSedRunning : undefined,
        dosage_drawn_ml: drawn,
        dosage_administered_ml: administered,
        dosage_wasted_ml: Math.max(0, dosageWasted),
        running_balance_ml: runningBalance,
        death_verification: deathVerification,
        time_of_death: timeOfDeath || undefined,
        body_disposition: bodyDisposition || undefined,
        administered_by_id: administeredById || undefined,
        administered_by_name: administeredByName || undefined,
        administered_by_signature: adminSig,
        witness_id: witnessId || undefined,
        witness_name: witnessName || undefined,
        witness_signature: witnessSig,
        owner_present: ownerPresent,
        complications: complications || undefined,
        notes: notes || undefined,
        is_correction: isCorrection,
        corrects_log_id: isCorrection ? (correctsLogId || undefined) : undefined,
        correction_reason: isCorrection ? correctionReason : undefined,
      };

      const result = await createEuthanasiaLogEntry(entry);
      // Deduct from main euthanasia drug bottle
      await updateDrugInventory(selectedDrugId, { quantity_remaining_ml: runningBalance });
      // Deduct from pre-sedation bottle if used
      if (usePreSedation && preSedInvId && parseFloat(preSedAdministered) > 0) {
        await updateDrugInventory(preSedInvId, { quantity_remaining_ml: preSedRunning });
      }
      setSaved(result);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess) {
    return (
      <AppShell title="New Drug Log Entry">
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Access Denied</div>
          <div style={{ color: "var(--text-muted)" }}>You do not have permission to create controlled substance records.</div>
        </div>
      </AppShell>
    );
  }

  if (saved) {
    return (
      <AppShell title="New Drug Log Entry">
        <div style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>
            Log entry {saved.log_number} saved and locked
          </div>
          <div style={{ color: "var(--text-muted)", marginBottom: 24 }}>
            This record is immutable and has been saved to the DEA-compliant controlled substance log.
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn-secondary" onClick={() => printSavedEntry(saved)}>🖨️ Print Entry</button>
            <button className="btn btn-primary" onClick={() => router.push("/drug-log")}>← Back to Drug Log</button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="New Drug Log Entry">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/drug-log")} style={{ marginBottom: 20 }}>
          ← Back to Drug Log
        </button>

        {/* SECTION 1: ANIMAL INFORMATION */}
        <Section title="Section 1 — Animal Information">
          <div style={{ marginBottom: 16 }}>
            <div className="form-label">Animal Search</div>
            <div ref={searchRef} style={{ position: "relative" }}>
              <input
                className="form-control"
                placeholder="Search by name or ID…"
                value={animalSearch}
                onChange={(e) => { setAnimalSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                style={{ width: "100%", maxWidth: 400 }}
              />
              {showSuggestions && filteredAnimals.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", maxWidth: 400, background: "var(--card-bg,#fff)", border: "1px solid var(--border,#e2e8f0)", borderRadius: 6, zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto" }}>
                  {filteredAnimals.map((a) => (
                    <AnimalSuggestion key={a.id} animal={a} onSelect={selectAnimal} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <label>
              <div className="form-label">Animal Name *</div>
              <input className="form-control" value={animalName} onChange={(e) => setAnimalName(e.target.value)} />
            </label>
            <label>
              <div className="form-label">Species</div>
              <select className="form-control" value={species} onChange={(e) => setSpecies(e.target.value)}>
                <option value="">—</option>
                {["Dog","Cat","Rabbit","Bird","Reptile","Other"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <div className="form-label">Breed</div>
              <input className="form-control" value={breed} onChange={(e) => setBreed(e.target.value)} />
            </label>
            <label>
              <div className="form-label">Sex</div>
              <select className="form-control" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">—</option>
                {["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <div className="form-label">Weight</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input className="form-control" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" style={{ width: 100 }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>lbs</span>
              </div>
            </label>
            <label>
              <div className="form-label">Date</div>
              <DateInput className="form-control" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </label>
            <label>
              <div className="form-label">Time</div>
              <input className="form-control" type="time" value={logTime} onChange={(e) => setLogTime(e.target.value)} />
            </label>
            <label style={{ gridColumn: "1/-1" }}>
              <div className="form-label">Reason for Euthanasia</div>
              <select className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">— Select Reason —</option>
                {EUTH_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
        </Section>

        {/* SECTION 2: DRUG ADMINISTRATION */}
        <Section title="Section 2 — Drug Administration">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ gridColumn: "1/-1" }}>
              <div className="form-label">Euthanasia Drug *</div>
              <select className="form-control" value={selectedDrugId} onChange={(e) => handleDrugSelect(e.target.value)}>
                <option value="">— Select Drug —</option>
                {drugInventory.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.drug_name}{b.bottle_number ? ` — Bottle #${b.bottle_number}` : ""} — Lot #{b.lot_number || "?"} ({b.quantity_remaining_ml ?? "?"} mL remaining)
                  </option>
                ))}
              </select>
            </label>
            {selectedDrugId && (
              <label>
                <div className="form-label">Bottle Number (auto-filled)</div>
                <input className="form-control" value={bottleId} onChange={(e) => setBottleId(e.target.value)}
                  style={{ background: "var(--bg-subtle,#f8fafc)" }} placeholder="e.g. FP-003" />
              </label>
            )}
            <label>
              <div className="form-label">Route *</div>
              <select className="form-control" value={route} onChange={(e) => setRoute(e.target.value)}>
                <option value="">— Select Route —</option>
                <option value="IV — Intravenous">IV — Intravenous</option>
                <option value="IP — Intraperitoneal">IP — Intraperitoneal</option>
                <option value="IC — Intracardiac">IC — Intracardiac</option>
                <option value="IM — Intramuscular">IM — Intramuscular</option>
              </select>
            </label>
            <label>
              <div className="form-label">Current Bottle Balance (mL)</div>
              <input className="form-control" value={selectedDrugId ? currentBottleBalance : ""} readOnly
                style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default" }} />
            </label>
          </div>

          {/* Pre-sedation */}
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={usePreSedation} onChange={(e) => { setUsePreSedation(e.target.checked); if (!e.target.checked) setPreSedInvId(""); }} />
              Pre-sedation drug used
            </label>
            {usePreSedation && (
              <div style={{ marginTop: 12, padding: "16px", background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0369a1", marginBottom: 12 }}>Pre-Sedation Drug Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <label style={{ gridColumn: "1/-1" }}>
                    <div className="form-label">Pre-Sedation Drug (from inventory)</div>
                    <select className="form-control" value={preSedInvId} onChange={(e) => handlePreSedDrugSelect(e.target.value)}>
                      <option value="">— Select from inventory, or enter manually below —</option>
                      {drugInventory.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.drug_name}{b.bottle_number ? ` — Bottle #${b.bottle_number}` : ""} — Lot #{b.lot_number || "?"} ({b.quantity_remaining_ml ?? "?"} mL remaining)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <div className="form-label">Drug Name</div>
                    <input className="form-control" value={preSedDrugName} onChange={(e) => setPreSedDrugName(e.target.value)}
                      list="presed-drug-list" placeholder="e.g. Ketamine, Telazol…" />
                    <datalist id="presed-drug-list">
                      {["Telazol", "Ketamine", "Xylazine", "Acepromazine", "TKX Combo", "Dexmedetomidine", "Other"].map(d => (
                        <option key={d} value={d} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <div className="form-label">DEA Schedule</div>
                    <input className="form-control" value={preSedDeaSchedule} onChange={(e) => setPreSedDeaSchedule(e.target.value)}
                      placeholder="Auto-fills from drug name" />
                  </label>
                  <label>
                    <div className="form-label">Bottle Number</div>
                    <input className="form-control" value={preSedBottleId} onChange={(e) => setPreSedBottleId(e.target.value)}
                      placeholder="e.g. K-001" />
                  </label>
                  <label>
                    <div className="form-label">Lot Number</div>
                    <input className="form-control" value={preSedLot} onChange={(e) => setPreSedLot(e.target.value)} />
                  </label>
                  <label>
                    <div className="form-label">Concentration</div>
                    <input className="form-control" value={preSedConcentration} onChange={(e) => setPreSedConcentration(e.target.value)}
                      placeholder="e.g. 100 mg/mL" />
                  </label>
                  <label>
                    <div className="form-label">Current Bottle Balance (mL)</div>
                    <input className="form-control" value={preSedInvId ? preSedBalance : ""} readOnly
                      style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default" }} />
                  </label>
                  <label>
                    <div className="form-label">Route</div>
                    <select className="form-control" value={preSedRoute} onChange={(e) => setPreSedRoute(e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="IM — Intramuscular">IM — Intramuscular</option>
                      <option value="IV — Intravenous">IV — Intravenous</option>
                      <option value="SQ — Subcutaneous">SQ — Subcutaneous</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <label>
                    <div className="form-label">Dosage Drawn (mL)</div>
                    <input className="form-control" type="number" step="0.01" min="0"
                      value={preSedDrawn} onChange={(e) => setPreSedDrawn(e.target.value)} />
                  </label>
                  <label>
                    <div className="form-label">Dosage Administered (mL)</div>
                    <input className="form-control" type="number" step="0.01" min="0"
                      value={preSedAdministered} onChange={(e) => setPreSedAdministered(e.target.value)} />
                  </label>
                  <div>
                    <div className="form-label">Dosage Wasted (mL)</div>
                    <input className="form-control" readOnly
                      value={preSedDrawn && preSedAdministered ? Math.max(0, preSedWasted).toFixed(2) : ""}
                      style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default" }} />
                  </div>
                  <div>
                    <div className="form-label">Running Balance After (mL)</div>
                    <input className="form-control" readOnly
                      value={preSedInvId && preSedAdministered ? preSedRunning.toFixed(2) : ""}
                      style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default",
                               color: preSedRunning < 0 ? "#dc2626" : undefined }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 14 }}>
            <label>
              <div className="form-label">Dosage Drawn (mL) *</div>
              <input className="form-control" type="number" step="0.01" min="0" value={dosageDrawn} onChange={(e) => setDosageDrawn(e.target.value)} />
            </label>
            <label>
              <div className="form-label">Dosage Administered (mL) *</div>
              <input className="form-control" type="number" step="0.01" min="0" value={dosageAdministered} onChange={(e) => setDosageAdministered(e.target.value)} />
            </label>
            <div>
              <div className="form-label">Dosage Wasted (mL)</div>
              <input
                className="form-control"
                value={dosageDrawn && dosageAdministered ? Math.max(0, dosageWasted).toFixed(2) : ""}
                readOnly
                style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default" }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>(must equal drawn minus administered)</div>
            </div>
            <div>
              <div className="form-label">Running Balance After (mL)</div>
              <input
                className="form-control"
                value={selectedDrugId && dosageAdministered ? runningBalance.toFixed(2) : ""}
                readOnly
                style={{ background: "var(--bg-subtle,#f8fafc)", cursor: "default", color: runningBalance < 0 ? "#dc2626" : undefined }}
              />
            </div>
          </div>
        </Section>

        {/* SECTION 3: VERIFICATION */}
        <Section title="Section 3 — Verification">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label>
              <div className="form-label">Death Verification *</div>
              <select className="form-control" value={deathVerification} onChange={(e) => setDeathVerification(e.target.value)}>
                <option value="">— Select —</option>
                <option>Lack of heartbeat</option>
                <option>Lack of respiration</option>
                <option>Lack of reflexes</option>
                <option>All of the above</option>
              </select>
            </label>
            <label>
              <div className="form-label">Time of Death</div>
              <input className="form-control" type="time" value={timeOfDeath} onChange={(e) => setTimeOfDeath(e.target.value)} />
            </label>
            <label>
              <div className="form-label">Body Disposition</div>
              <select className="form-control" value={bodyDisposition} onChange={(e) => setBodyDisposition(e.target.value)}>
                <option value="">— Select —</option>
                <option>Pickup by rendering</option>
                <option>Owner claimed</option>
                <option>Cremation</option>
                <option>Burial</option>
                <option>Other</option>
              </select>
            </label>
            <div>
              <div className="form-label">Owner Present</div>
              <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                {[["Yes", true], ["No", false]].map(([label, val]) => (
                  <label key={String(label)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 14 }}>
                    <input type="radio" checked={ownerPresent === val} onChange={() => setOwnerPresent(val as boolean)} />
                    {label as string}
                  </label>
                ))}
              </div>
            </div>
            <label style={{ gridColumn: "1/-1" }}>
              <div className="form-label">Complications</div>
              <textarea className="form-control" rows={2} value={complications} onChange={(e) => setComplications(e.target.value)} />
            </label>
            <label style={{ gridColumn: "1/-1" }}>
              <div className="form-label">Notes</div>
              <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </Section>

        {/* SECTION 4: SIGNATURES */}
        <Section title="Section 4 — Signatures (Both Required)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Administering Staff */}
            <div style={{ border: "1px solid var(--border,#e2e8f0)", borderRadius: 8, padding: 16, background: "var(--bg-subtle,#f8fafc)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                Administering Staff
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                <div className="form-label">Staff Member *</div>
                <select className="form-control" value={administeredByName} onChange={(e) => { setAdministeredByName(e.target.value); setAdministeredById(e.target.value); }}>
                  <option value="">— Select Staff —</option>
                  {staffOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <SimpleSigPad label="Administering Staff Signature" value={adminSig} onChange={setAdminSig} required />
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                Date/Time: {new Date().toLocaleString()}
              </div>
            </div>

            {/* Witness */}
            <div style={{ border: "1px solid var(--border,#e2e8f0)", borderRadius: 8, padding: 16, background: "var(--bg-subtle,#f8fafc)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0f2942", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                Witness
              </div>
              <label style={{ display: "block", marginBottom: 10 }}>
                <div className="form-label">Witness Staff Member *</div>
                <select className="form-control" value={witnessName} onChange={(e) => { setWitnessName(e.target.value); setWitnessId(e.target.value); }}>
                  <option value="">— Select Staff —</option>
                  {staffOptions.filter((s) => s !== administeredByName).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              {witnessName && witnessName === administeredByName && (
                <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", color: "#dc2626", fontSize: 12, marginBottom: 10 }}>
                  Witness must be a different person than the administering staff.
                </div>
              )}
              <SimpleSigPad label="Witness Signature" value={witnessSig} onChange={setWitnessSig} required />
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                Date/Time: {new Date().toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={isCorrection} onChange={(e) => setIsCorrection(e.target.checked)} />
              This is a Correction Entry
            </label>
            {isCorrection && (
              <div style={{ marginTop: 12, padding: 16, background: "#fef9c3", border: "1px solid #fbbf24", borderRadius: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label>
                  <div className="form-label">Corrects Log # (Original Log ID)</div>
                  <input className="form-control" value={correctsLogId} onChange={(e) => setCorrectsLogId(e.target.value)} placeholder="e.g. EL-2026-0001" />
                </label>
                <label style={{ gridColumn: "1/-1" }}>
                  <div className="form-label">Correction Reason *</div>
                  <textarea className="form-control" rows={3} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} />
                </label>
              </div>
            )}
          </div>
        </Section>

        {err && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", color: "#dc2626", marginBottom: 20, fontSize: 14 }}>
            {err}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingBottom: 40 }}>
          <button className="btn btn-ghost" onClick={() => router.push("/drug-log")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ minWidth: 160 }}>
            {saving ? "Saving…" : "Save Log Entry"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function printSavedEntry(entry: EuthanasiaLog) {
  const sig = (src: string | undefined) =>
    src ? `<img src="${src}" style="height:60px;border:1px solid #ccc;padding:4px;background:#fff;" alt="signature"/>` : "<em>Not provided</em>";

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Drug Log Entry ${entry.log_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #000; }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 48px; color: rgba(0,0,0,0.07); white-space: nowrap; pointer-events: none; z-index: 0; font-weight: 900; letter-spacing: 4px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 8px; vertical-align: top; }
    td:first-child { font-weight: bold; width: 40%; color: #333; }
    .row { display: flex; gap: 24px; }
    .col { flex: 1; }
  </style></head><body>
  <div class="watermark">CONTROLLED SUBSTANCE RECORD — CONFIDENTIAL</div>
  <div class="header">
    <div>
      <h1>${AGENCY_NAME}</h1>
      <div>Controlled Substance Euthanasia Log</div>
      <div style="margin-top:4px;font-size:11px;">GDA License · DEA Compliant</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:900;">Entry # ${entry.log_number}</div>
      <div>Date: ${entry.log_date || ""} &nbsp; Time: ${entry.log_time || ""}</div>
    </div>
  </div>
  <h2>Animal Information</h2>
  <table>
    <tr><td>Animal ID</td><td>${entry.animal_id || ""}</td><td>Name</td><td>${entry.animal_name || ""}</td></tr>
    <tr><td>Species</td><td>${entry.species || ""}</td><td>Breed</td><td>${entry.breed || ""}</td></tr>
    <tr><td>Sex</td><td>${entry.sex || ""}</td><td>Weight</td><td>${entry.weight || ""}</td></tr>
    <tr><td>Reason</td><td colspan="3">${entry.reason || ""}</td></tr>
  </table>
  <h2>Drug Administration</h2>
  <table>
    <tr><td>Drug</td><td>${entry.drug_name || ""}</td><td>Lot #</td><td>${entry.lot_number || ""}</td></tr>
    <tr><td>Route</td><td>${entry.route || ""}</td><td>Bottle #</td><td>${entry.bottle_id || ""}</td></tr>
    <tr><td>Dosage Drawn (mL)</td><td>${entry.dosage_drawn_ml ?? ""}</td><td>Dosage Administered (mL)</td><td>${entry.dosage_administered_ml ?? ""}</td></tr>
    <tr><td>Dosage Wasted (mL)</td><td>${entry.dosage_wasted_ml ?? ""}</td><td>Running Balance (mL)</td><td>${entry.running_balance_ml ?? ""}</td></tr>
    ${entry.pre_sedation_drug ? `
    <tr style="background:#f0f9ff;"><td colspan="4" style="font-weight:700;color:#0369a1;padding-top:8px;">Pre-Sedation Drug</td></tr>
    <tr><td>Drug</td><td>${entry.pre_sedation_drug}</td><td>DEA Schedule</td><td>${entry.pre_sedation_dea_schedule || ""}</td></tr>
    <tr><td>Lot #</td><td>${entry.pre_sedation_lot_number || ""}</td><td>Bottle #</td><td>${entry.pre_sedation_bottle_id || ""}</td></tr>
    <tr><td>Concentration</td><td>${entry.pre_sedation_concentration || ""}</td><td>Route</td><td>${entry.pre_sedation_route || ""}</td></tr>
    <tr><td>Drawn (mL)</td><td>${entry.pre_sedation_dosage_drawn_ml ?? ""}</td><td>Administered (mL)</td><td>${entry.pre_sedation_dosage_administered_ml ?? ""}</td></tr>
    <tr><td>Wasted (mL)</td><td>${entry.pre_sedation_dosage_wasted_ml ?? ""}</td><td>Running Balance (mL)</td><td>${entry.pre_sedation_running_balance_ml ?? ""}</td></tr>
    ` : ""}
  </table>
  <h2>Verification</h2>
  <table>
    <tr><td>Death Verification</td><td>${entry.death_verification || ""}</td><td>Time of Death</td><td>${entry.time_of_death || ""}</td></tr>
    <tr><td>Body Disposition</td><td>${entry.body_disposition || ""}</td><td>Owner Present</td><td>${entry.owner_present ? "Yes" : "No"}</td></tr>
    ${entry.complications ? `<tr><td>Complications</td><td colspan="3">${entry.complications}</td></tr>` : ""}
    ${entry.notes ? `<tr><td>Notes</td><td colspan="3">${entry.notes}</td></tr>` : ""}
    ${entry.is_correction ? `<tr><td>Correction Entry</td><td colspan="3">Corrects Log # ${entry.corrects_log_id || ""} — ${entry.correction_reason || ""}</td></tr>` : ""}
  </table>
  <h2>Signatures</h2>
  <div class="row" style="margin-top:10px;">
    <div class="col">
      <div style="font-weight:bold;margin-bottom:6px;">Administering Staff: ${entry.administered_by_name || ""}</div>
      ${sig(entry.administered_by_signature)}
    </div>
    <div class="col">
      <div style="font-weight:bold;margin-bottom:6px;">Witness: ${entry.witness_name || ""}</div>
      ${sig(entry.witness_signature)}
    </div>
  </div>
  <div style="margin-top:30px;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:8px;">
    ${AGENCY_NAME} · CONTROLLED SUBSTANCE RECORD — CONFIDENTIAL · Generated ${new Date().toLocaleString()}
  </div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  w.document.close();
}
