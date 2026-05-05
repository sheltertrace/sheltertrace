"use client";
import { useState } from "react";
import { createAnimal, searchAnimals } from "@/lib/data";
import type { Animal } from "@/lib/types";
import { ALL_BREEDS_DOG, ALL_BREEDS_CAT, ALL_COLORS } from "@/lib/constants";
import { today } from "@/lib/utils";

interface Props {
  callId: string;
  callType: string;
  onAdded: (animal: Animal) => void;
  onClose: () => void;
}

function deriveIntakeInfo(callType: string): { intake_type: string; status: string; sub_status: string } {
  switch (callType) {
    case "Animal Cruelty":  return { intake_type: "Confiscation", status: "Available",    sub_status: "Stray Hold" };
    case "Bite Report":     return { intake_type: "Stray",        status: "Quarantine",   sub_status: "Bite Quarantine" };
    case "Injured Animal":  return { intake_type: "Stray",        status: "Medical Hold", sub_status: "Treatment in Progress" };
    case "Hoarding Report": return { intake_type: "Confiscation", status: "Available",    sub_status: "Stray Hold" };
    default:                return { intake_type: "Stray",        status: "Available",    sub_status: "Stray Hold" };
  }
}

const SPECIES_LIST = ["Dog", "Cat", "Bird", "Livestock", "Wildlife", "Rabbit", "Other"];
const CONDITION_LIST = ["Unknown", "Healthy", "Injured", "Critical", "Malnourished", "Aggressive", "Deceased"];

function breedList(species: string): string[] {
  if (species === "Dog") return ["", ...ALL_BREEDS_DOG.filter(Boolean)];
  if (species === "Cat") return ["", ...ALL_BREEDS_CAT.filter(Boolean)];
  return ["", "Unknown"];
}

export default function QuickIntakeModal({ callId, callType, onAdded, onClose }: Props) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [created, setCreated] = useState<Animal | null>(null);

  // Create form state
  const { intake_type: defaultIntakeType, status: defaultStatus, sub_status: defaultSubStatus } = deriveIntakeInfo(callType);
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [ageEst, setAgeEst] = useState("");
  const [weightEst, setWeightEst] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [condition, setCondition] = useState("Unknown");
  const [name, setName] = useState("");
  const [markings, setMarkings] = useState("");
  const [isDangerous, setIsDangerous] = useState(false);
  const [intakeType, setIntakeType] = useState(defaultIntakeType);
  const [status, setStatus] = useState(defaultStatus);
  const [kennel, setKennel] = useState("");

  // Link search state
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Animal[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchAnimals(q);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!species) { setErrMsg("Species is required."); return; }
    setSaving(true);
    setErrMsg("");
    try {
      const animal = await createAnimal({
        name: name.trim() || "Unknown",
        species,
        breed: breed || "Unknown",
        color: color || "Unknown",
        sex,
        age: ageEst || undefined,
        weight: weightEst || undefined,
        microchip: microchip || undefined,
        intake_condition: condition,
        status,
        sub_status: defaultSubStatus,
        intake_type: intakeType,
        intake_date: today(),
        markings: markings || undefined,
        is_dangerous: isDangerous || undefined,
        kennel: kennel || undefined,
        case_number: callId,
        circumstance: `Impounded via dispatch call ${callId} (${callType})`,
      });
      setCreated(animal);
      onAdded(animal);
    } catch (e: unknown) {
      setErrMsg((e as { message?: string }).message || "Failed to create animal record");
      setSaving(false);
    }
  };

  const handleLink = async (animal: Animal) => {
    setSaving(true);
    setErrMsg("");
    try {
      setCreated(animal);
      onAdded(animal);
    } catch (e: unknown) {
      setErrMsg((e as { message?: string }).message || "Failed to link animal");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 620, width: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">🐾 Add Impounded Animal — {callId}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Success state */}
        {created ? (
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Animal Record Created</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: "var(--teal)", marginBottom: 8, letterSpacing: 1 }}>
              {created.id}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
              {created.name} · {created.species}{created.breed && created.breed !== "Unknown" ? ` ${created.breed}` : ""} · {created.color}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              Status: {created.status} · Intake: {created.intake_type}
            </div>
            <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 8, padding: "10px 16px", fontSize: 13, marginBottom: 20 }}>
              Write <strong>{created.id}</strong> on the kennel card.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn btn-secondary" onClick={() => { setCreated(null); setSaving(false); setName(""); setBreed(""); setColor(""); setMicrochip(""); setMarkings(""); setAgeEst(""); setWeightEst(""); setKennel(""); }}>
                + Add Another
              </button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-alt)" }}>
              {[{ key: "create", label: "📋 New Intake" }, { key: "link", label: "🔗 Link Existing" }].map(({ key, label }) => (
                <button
                  key={key}
                  style={{
                    flex: 1, padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    color: mode === key ? "var(--teal)" : "var(--text-secondary)",
                    borderBottom: mode === key ? "2px solid var(--teal)" : "2px solid transparent",
                  }}
                  onClick={() => setMode(key as "create" | "link")}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
              {errMsg && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", marginBottom: 14 }}>
                  ⚠️ {errMsg}
                </div>
              )}

              {/* ── Create Mode ── */}
              {mode === "create" && (
                <div>
                  {/* Auto-fill info banner */}
                  <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#0369a1", marginBottom: 14 }}>
                    Auto-set from call type <strong>{callType}</strong>: Intake = <strong>{intakeType}</strong> · Status = <strong>{status}</strong>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <div className="form-group">
                      <label className="form-label">Name (if known)</label>
                      <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Unknown" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Species *</label>
                      <select className="form-select" value={species} onChange={(e) => { setSpecies(e.target.value); setBreed(""); }}>
                        {SPECIES_LIST.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Breed</label>
                      {["Dog", "Cat"].includes(species) ? (
                        <select className="form-select" value={breed} onChange={(e) => setBreed(e.target.value)}>
                          {breedList(species).map((b) => <option key={b} value={b}>{b || "— Unknown —"}</option>)}
                        </select>
                      ) : (
                        <input className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Unknown" />
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Color</label>
                      <select className="form-select" value={color} onChange={(e) => setColor(e.target.value)}>
                        <option value="">— Unknown —</option>
                        {ALL_COLORS.filter(Boolean).map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sex</label>
                      <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                        {["Unknown", "Male", "Female", "Male (Neutered)", "Female (Spayed)"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Condition</label>
                      <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
                        {CONDITION_LIST.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Age Estimate</label>
                      <input className="form-input" value={ageEst} onChange={(e) => setAgeEst(e.target.value)} placeholder="e.g. ~2 years, puppy" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Weight Estimate</label>
                      <input className="form-input" value={weightEst} onChange={(e) => setWeightEst(e.target.value)} placeholder="e.g. ~40 lbs" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Microchip # (if scanned)</label>
                      <input className="form-input" value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="Scan or enter manually" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kennel Assignment</label>
                      <input className="form-input" value={kennel} onChange={(e) => setKennel(e.target.value)} placeholder="e.g. A-1 (assign later OK)" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Markings / Description</label>
                    <textarea className="form-input" rows={2} value={markings} onChange={(e) => setMarkings(e.target.value)} placeholder="Collar, tags, markings, scars, notes…" style={{ resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <div className="form-group">
                      <label className="form-label">Override Intake Type</label>
                      <select className="form-select" value={intakeType} onChange={(e) => setIntakeType(e.target.value)}>
                        {["Stray", "Surrender", "Confiscation", "Transfer", "Return", "Born in Shelter"].map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Override Status</label>
                      <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {["Available", "Quarantine", "Medical Hold", "Pending", "Imported"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginTop: 4, fontSize: 13 }}>
                    <input type="checkbox" checked={isDangerous} onChange={(e) => setIsDangerous(e.target.checked)} />
                    <span style={{ fontWeight: 700, color: "#dc2626" }}>🚨 Flag as Dangerous Animal</span>
                  </label>
                </div>
              )}

              {/* ── Link Mode ── */}
              {mode === "link" && (
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                    Search for an animal already in the system to link it to this call.
                  </div>
                  <input
                    className="form-input"
                    placeholder="Search by Animal ID, name, or microchip…"
                    value={searchQ}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                  />
                  {searching && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Searching…</div>}
                  {searchResults.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 8, overflow: "hidden" }}>
                      {searchResults.map((a) => (
                        <div
                          key={a.id}
                          style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", fontSize: 13 }}
                          onClick={() => handleLink(a)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--teal)", marginRight: 10 }}>{a.id}</span>
                              <span style={{ fontWeight: 600 }}>{a.name}</span>
                            </div>
                            <span className="badge" style={{ fontSize: 10 }}>{a.status}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                            {a.species}{a.breed ? ` ${a.breed}` : ""} · {a.color} · {a.sex}
                            {a.microchip ? ` · Chip: ${a.microchip}` : ""}
                            {a.kennel ? ` · Kennel ${a.kennel}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQ.trim().length >= 2 && !searching && searchResults.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, textAlign: "center", padding: "16px 0" }}>
                      No animals found matching "{searchQ}" —{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => setMode("create")}>Create New Intake instead</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {mode === "create" && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  {saving ? "Creating…" : "✓ Create Animal Record"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
