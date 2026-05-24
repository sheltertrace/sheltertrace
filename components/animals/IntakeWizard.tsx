"use client";
import { useState, useCallback, useEffect } from "react";
import type { Animal, Person } from "@/lib/types";
import { lookupMicrochip } from "@/lib/data";
import type { MicrochipRegistration } from "@/lib/types";
import {
  INTAKE_TYPES, CIRCUMSTANCE_TYPES, ALL_BREEDS_DOG, ALL_BREEDS_CAT,
  ALL_COLORS, COAT_TYPES, EAR_TYPES, EYE_COLORS, SIZE_OPTIONS,
  BEHAVIOR_FLAGS,
} from "@/lib/constants";
import { useKennels } from "@/app/providers";
import { calcAge, genId, today, nowTime } from "@/lib/utils";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import type { AamvaData } from "@/lib/parseAamva";

interface Props {
  onComplete: (animal: Partial<Animal>) => Promise<void>;
  onCancel: () => void;
  people: Person[];
  onAddPerson: (p: Partial<Person>) => Promise<Person>;
}

const STEPS = ["Intake Info", "Animal Info", "Identification", "Condition & Behavior", "Source / Brought By", "Kennel & Review"];

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function IntakeWizard({ onComplete, onCancel, people, onAddPerson }: Props) {
  const { kennelLabels } = useKennels();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [intakeType, setIntakeType] = useState<string>(INTAKE_TYPES[0]);
  const [circumstance, setCircumstance] = useState(CIRCUMSTANCE_TYPES[0]);
  const [intakeDate, setIntakeDate] = useState(today());
  const [intakeTime, setIntakeTime] = useState(nowTime());
  const [acoRecord, setAcoRecord] = useState("");
  const [caseNumber, setCaseNumber] = useState("");

  // Step 2
  const [species, setSpecies] = useState("Dog");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [color, setColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [size, setSize] = useState("");
  const [coatType, setCoatType] = useState("");
  const [earType, setEarType] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [markings, setMarkings] = useState("");
  const [fixed, setFixed] = useState("Unknown");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 3
  const [microchip, setMicrochip] = useState("");
  const [microchipBrand, setMicrochipBrand] = useState("");
  const [microchipDate, setMicrochipDate] = useState("");
  const [rabiesTag, setRabiesTag] = useState("");
  const [rabiesExpiry, setRabiesExpiry] = useState("");
  const [shelterTag, setShelterTag] = useState("");
  const [barCode, setBarCode] = useState("");
  const [chipMatch, setChipMatch] = useState<MicrochipRegistration | null>(null);
  const [chipSearching, setChipSearching] = useState(false);

  // Step 4
  const [intakeCondition, setIntakeCondition] = useState("");
  const [intakeBehavior, setIntakeBehavior] = useState("");
  const [injuries, setInjuries] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [behaviorFlags, setBehaviorFlags] = useState<Record<string, boolean>>({});
  const [isCrueltyCase, setIsCrueltyCase] = useState(false);
  const [isDangerous, setIsDangerous] = useState(false);

  // Step 5
  const [broughtBy, setBroughtBy] = useState<Person | null>(null);
  const [pSearch, setPSearch] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [npFirst, setNpFirst] = useState("");
  const [npLast, setNpLast] = useState("");
  const [npPhone, setNpPhone] = useState("");
  const [npRole, setNpRole] = useState("Contact");
  const [foundAddress, setFoundAddress] = useState("");
  const [foundCity, setFoundCity] = useState("");

  // Step 6
  const [kennel, setKennel] = useState("Unassigned");

  const handlePhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const toggleFlag = (id: string) => {
    setBehaviorFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Debounced chip lookup — runs when microchip field has 9+ characters
  useEffect(() => {
    if (microchip.length < 9) { setChipMatch(null); return; }
    setChipSearching(true);
    const timer = setTimeout(() => {
      lookupMicrochip(microchip.trim())
        .then((r) => { setChipMatch(r.registration); })
        .catch(() => { setChipMatch(null); })
        .finally(() => setChipSearching(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [microchip]);

  const handleCreatePerson = async () => {
    if (!npFirst.trim() || !npLast.trim()) return;
    const p = await onAddPerson({ first_name: npFirst.trim(), last_name: npLast.trim(), phone: npPhone.trim(), role: npRole, city: foundCity });
    setBroughtBy(p);
    setShowNewPerson(false);
    setNpFirst(""); setNpLast(""); setNpPhone("");
  };

  const pMatches = pSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(pSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleFinish = async () => {
    setSaving(true);
    try {
      const age = dob ? calcAge(dob) : "";
      const animal: Partial<Animal> = {
        name: name.trim() || "Unknown",
        species, breed: breed || "Unknown", color: color || "Unknown", secondary_color: secondaryColor,
        sex, age, dob: dob || undefined, weight, size: size || undefined,
        coat_type: coatType || undefined, ear_type: earType || undefined, eye_color: eyeColor || undefined,
        markings, fixed: fixed === "Yes",
        status: isCrueltyCase ? "Medical Hold" : "Available",
        intake_type: intakeType, intake_date: intakeDate, circumstance,
        kennel: kennel === "Unassigned" ? undefined : kennel,
        microchip, microchip_brand: microchipBrand, microchip_date: microchipDate || undefined,
        rabies_tag: rabiesTag, rabies_expiry: rabiesExpiry || undefined,
        shelter_tag: shelterTag, bar_code: barCode,
        aco_record: acoRecord, case_number: caseNumber,
        intake_condition: intakeCondition, intake_behavior: intakeBehavior, injuries,
        behavior_flags: behaviorFlags,
        is_cruelty_case: isCrueltyCase, is_dangerous: isDangerous,
        found_address: foundAddress, found_city: foundCity,
      };
      await onComplete(animal);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>← Cancel</button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Animal Intake — Step {step} of {STEPS.length}</h2>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i + 1 <= step ? "var(--teal)" : "#e2e8f0", transition: "background 0.3s" }} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: i + 1 === step ? "var(--teal)" : "var(--text-muted)", fontWeight: i + 1 === step ? 700 : 400 }}>
            {s}
          </div>
        ))}
      </div>

      <div className="card">
        {/* Step 1: Intake Info */}
        {step === 1 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Intake Information</h3>
            <div className="grid-2">
              <F label="Intake Type *">
                <select className="form-select" value={intakeType} onChange={(e) => setIntakeType(e.target.value)}>
                  {INTAKE_TYPES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Circumstance">
                <select className="form-select" value={circumstance} onChange={(e) => setCircumstance(e.target.value)}>
                  {CIRCUMSTANCE_TYPES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Intake Date *">
                <input className="form-input" type="date" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} />
              </F>
              <F label="Intake Time">
                <input className="form-input" type="time" value={intakeTime} onChange={(e) => setIntakeTime(e.target.value)} />
              </F>
              <F label="ACO Record #">
                <input className="form-input" value={acoRecord} onChange={(e) => setAcoRecord(e.target.value)} placeholder="ACO-..." />
              </F>
              <F label="Case Number">
                <input className="form-input" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="If applicable" />
              </F>
            </div>
          </div>
        )}

        {/* Step 2: Animal Info */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Animal Information</h3>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "flex-start" }}>
              <label style={{ cursor: "pointer", flexShrink: 0 }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="" style={{ width: 100, height: 100, borderRadius: 12, objectFit: "cover", border: "2px solid var(--border)" }} />
                ) : (
                  <div style={{ width: 100, height: 100, borderRadius: 12, background: "#f1f5f9", border: "2px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer" }}>
                    <span style={{ fontSize: 28 }}>{species === "Dog" ? "🐕" : "🐈"}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Upload Photo</span>
                  </div>
                )}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {["Dog", "Cat"].map((s) => (
                    <button key={s} onClick={() => { setSpecies(s); setBreed(""); }} className={`btn btn-sm ${species === s ? "btn-primary" : "btn-secondary"}`}>
                      {s === "Dog" ? "🐕" : "🐈"} {s}
                    </button>
                  ))}
                </div>
                <F label="Name">
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Animal name (or leave blank)" />
                </F>
              </div>
            </div>
            <div className="grid-3">
              <F label="Breed">
                <select className="form-select" value={breed} onChange={(e) => setBreed(e.target.value)}>
                  {(species === "Cat" ? ALL_BREEDS_CAT : ALL_BREEDS_DOG).map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Sex">
                <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                  {["Unknown", "Male", "Female"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Date of Birth (auto-calculates age)">
                <input className="form-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                {dob && <div style={{ fontSize: 10, color: "var(--teal)", marginTop: 3, fontWeight: 700 }}>Age: {calcAge(dob)}</div>}
              </F>
              <F label="Primary Color">
                <select className="form-select" value={color} onChange={(e) => setColor(e.target.value)}>
                  {ALL_COLORS.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Secondary Color">
                <select className="form-select" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}>
                  {ALL_COLORS.map((o) => <option key={o} value={o}>{o || "— None —"}</option>)}
                </select>
              </F>
              <F label="Size">
                <select className="form-select" value={size} onChange={(e) => setSize(e.target.value)}>
                  {SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Weight">
                <input className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 45 lbs" />
              </F>
              <F label="Coat Type">
                <select className="form-select" value={coatType} onChange={(e) => setCoatType(e.target.value)}>
                  {COAT_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Ear Type">
                <select className="form-select" value={earType} onChange={(e) => setEarType(e.target.value)}>
                  {EAR_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Eye Color">
                <select className="form-select" value={eyeColor} onChange={(e) => setEyeColor(e.target.value)}>
                  {EYE_COLORS.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Fixed (Spayed/Neutered)">
                <select className="form-select" value={fixed} onChange={(e) => setFixed(e.target.value)}>
                  {["Unknown", "Yes", "No"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
            </div>
            <F label="Markings / Description">
              <textarea className="form-textarea" value={markings} onChange={(e) => setMarkings(e.target.value)} placeholder="Distinctive markings, patterns, scars…" rows={2} />
            </F>
          </div>
        )}

        {/* Step 3: Identification */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Identification</h3>
            <div className="grid-2">
              <F label="Microchip Number">
                <input className="form-input" value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="Scan or enter chip #" />
                {chipSearching && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Searching registry…</div>}
                {chipMatch && (
                  <div style={{ marginTop: 6, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fbbf24", fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: "#92400e", marginBottom: 4 }}>⚠ Microchip already registered in MCAS</div>
                    <div style={{ color: "#78350f" }}>
                      Owner: <strong>{chipMatch.owner_name ?? "Unknown"}</strong>
                      {chipMatch.owner_phone && <> · {chipMatch.owner_phone}</>}
                    </div>
                    {chipMatch.animal_name && <div style={{ color: "#78350f" }}>Animal: {chipMatch.animal_name} ({chipMatch.species})</div>}
                    <div style={{ color: "#92400e", marginTop: 4, fontWeight: 600 }}>This may be a stray that can be returned to its owner.</div>
                  </div>
                )}
              </F>
              <F label="Microchip Brand">
                <input className="form-input" value={microchipBrand} onChange={(e) => setMicrochipBrand(e.target.value)} placeholder="HomeAgain, AKC Reunite, etc." />
              </F>
              <F label="Microchip Implant Date">
                <input className="form-input" type="date" value={microchipDate} onChange={(e) => setMicrochipDate(e.target.value)} />
              </F>
              <F label="Rabies Tag #">
                <input className="form-input" value={rabiesTag} onChange={(e) => setRabiesTag(e.target.value)} placeholder="Tag number" />
              </F>
              <F label="Rabies Tag Expiry">
                <input className="form-input" type="date" value={rabiesExpiry} onChange={(e) => setRabiesExpiry(e.target.value)} />
              </F>
              <F label="Shelter Tag #">
                <input className="form-input" value={shelterTag} onChange={(e) => setShelterTag(e.target.value)} placeholder="Internal tag" />
              </F>
              <F label="Barcode">
                <input className="form-input" value={barCode} onChange={(e) => setBarCode(e.target.value)} placeholder="Barcode ID" />
              </F>
            </div>
          </div>
        )}

        {/* Step 4: Condition & Behavior */}
        {step === 4 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Condition & Behavior</h3>
            <div className="grid-2">
              <F label="Intake Condition">
                <select className="form-select" value={intakeCondition} onChange={(e) => setIntakeCondition(e.target.value)}>
                  {["", "Good", "Fair", "Poor", "Critical", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Intake Behavior">
                <select className="form-select" value={intakeBehavior} onChange={(e) => setIntakeBehavior(e.target.value)}>
                  {["", "Friendly", "Fearful", "Aggressive", "Anxious", "Calm", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
            </div>
            <F label="Injuries / Medical Notes">
              <textarea className="form-textarea" value={injuries} onChange={(e) => setInjuries(e.target.value)} placeholder="Describe any injuries or medical concerns…" rows={2} />
            </F>
            <F label="Initial Notes">
              <textarea className="form-textarea" value={initialNotes} onChange={(e) => setInitialNotes(e.target.value)} placeholder="Additional intake notes…" rows={2} />
            </F>
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={isCrueltyCase} onChange={(e) => setIsCrueltyCase(e.target.checked)} />
                <span style={{ color: "#dc2626" }}>⚠️ Cruelty Case</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={isDangerous} onChange={(e) => setIsDangerous(e.target.checked)} />
                <span style={{ color: "#dc2626" }}>🚨 Dangerous Animal</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Behavior Flags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {BEHAVIOR_FLAGS.map((flag) => (
                  <button
                    key={flag.id}
                    onClick={() => toggleFlag(flag.id)}
                    className="flag-chip"
                    style={{
                      borderColor: behaviorFlags[flag.id] ? flag.color : "#e2e8f0",
                      background: behaviorFlags[flag.id] ? `${flag.color}20` : "#fff",
                      color: behaviorFlags[flag.id] ? flag.color : "var(--text-secondary)",
                    }}
                  >
                    {flag.icon} {flag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Source / Brought By */}
        {step === 5 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Source / Brought By</h3>
            {intakeType === "Stray" && (
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Found Address</label>
                  <input className="form-input" value={foundAddress} onChange={(e) => setFoundAddress(e.target.value)} placeholder="Street address where found" />
                </div>
                <div className="form-group">
                  <label className="form-label">Found City</label>
                  <input className="form-input" value={foundCity} onChange={(e) => setFoundCity(e.target.value)} placeholder="City" />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Brought By (search existing contacts)</label>
              <input
                className="form-input"
                value={pSearch}
                onChange={(e) => setPSearch(e.target.value)}
                placeholder="Search by name…"
              />
              {pMatches.length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 7, marginTop: 4, overflow: "hidden" }}>
                  {pMatches.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => { setBroughtBy(p); setPSearch(`${p.first_name} ${p.last_name}`); }}
                      style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                      <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.role} · {p.phone || "No phone"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {broughtBy && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>✓ {broughtBy.first_name} {broughtBy.last_name} — {broughtBy.role}</span>
                <button onClick={() => { setBroughtBy(null); setPSearch(""); }} className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }}>Remove</button>
              </div>
            )}

            {!showNewPerson ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewPerson(true)}>+ Create New Contact</button>
            ) : (
              <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>New Contact</span>
                  <ScanLicenseButton
                    label="📷 Scan License"
                    onScan={(data: AamvaData) => {
                      if (data.firstName) setNpFirst(data.firstName);
                      if (data.lastName)  setNpLast(data.lastName);
                    }}
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-input" value={npFirst} onChange={(e) => setNpFirst(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-input" value={npLast} onChange={(e) => setNpLast(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select className="form-select" value={npRole} onChange={(e) => setNpRole(e.target.value)}>
                      {["Contact", "Previous Owner", "Finder", "Surrender", "Transfer"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleCreatePerson}>Save Contact</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewPerson(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Kennel & Review */}
        {step === 6 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>Kennel Assignment & Review</h3>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Assign to Kennel</label>
              <select className="form-select" value={kennel} onChange={(e) => setKennel(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="Unassigned">Unassigned</option>
                {kennelLabels.length === 0
                  ? <option value="" disabled>No kennels configured — see Kennel page</option>
                  : kennelLabels.map((k) => <option key={k}>{k}</option>)
                }
              </select>
            </div>

            {/* Summary */}
            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Intake Summary</div>
              <div className="grid-2" style={{ gap: 8, fontSize: 13 }}>
                <div><span style={{ color: "var(--text-secondary)" }}>Name:</span> {name || "Unknown"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Species:</span> {species}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Breed:</span> {breed || "Unknown"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Sex:</span> {sex}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Color:</span> {color || "Unknown"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>DOB:</span> {dob || "Unknown"}{dob && ` (${calcAge(dob)})`}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Intake Type:</span> {intakeType}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Intake Date:</span> {intakeDate}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Kennel:</span> {kennel}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Fixed:</span> {fixed}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Microchip:</span> {microchip || "None"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Brought By:</span> {broughtBy ? `${broughtBy.first_name} ${broughtBy.last_name}` : "Unknown"}</div>
              </div>
              {(isCrueltyCase || isDangerous) && (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  {isCrueltyCase && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>⚠️ CRUELTY CASE</span>}
                  {isDangerous && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>🚨 DANGEROUS</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <button
            className="btn btn-secondary"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
          >← Back</button>
          {step < STEPS.length ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? "Saving…" : "✓ Complete Intake"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
