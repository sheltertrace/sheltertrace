"use client";
import { useState, useCallback, useEffect } from "react";
import type { Animal, Person } from "@/lib/types";
import { lookupMicrochip } from "@/lib/data";
import type { MicrochipRegistration } from "@/lib/types";
import MicrochipBadge from "@/components/ui/MicrochipBadge";
import {
  INTAKE_TYPES, CIRCUMSTANCE_TYPES, ALL_BREEDS_DOG, ALL_BREEDS_CAT,
  ALL_COLORS, COAT_TYPES, EAR_TYPES, EYE_COLORS, SIZE_OPTIONS,
  BEHAVIOR_FLAGS, TAIL_TYPES, INTAKE_EAR_TYPES, INTAKE_COAT_TYPES,
  BODY_CONDITION_SCORES, INTAKE_METHODS, STATES,
} from "@/lib/constants";
import { STATEMENT_OF_SURRENDER_TEXT } from "@/lib/shelterInfo";
import { useKennels } from "@/app/providers";
import { dobToAgeEstimate, genId, today, now24Time } from "@/lib/utils";
import AgeInput from "@/components/ui/AgeInput";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import type { AamvaData } from "@/lib/parseAamva";
import DateInput from "@/components/ui/DateInput";
import SignaturePad from "@/components/ui/SignaturePad";
import { linkAnimalToPerson, addAnimalNote } from "@/lib/data";

interface Props {
  onComplete: (animal: Partial<Animal>) => Promise<Animal>;
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
  const [intakeTime, setIntakeTime] = useState(now24Time());
  const [acoRecord, setAcoRecord] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [intakeMethod, setIntakeMethod] = useState("");
  const [processedByEmployee, setProcessedByEmployee] = useState("");

  // Step 2
  const [species, setSpecies] = useState("Dog");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [ageEstimate, setAgeEstimate] = useState("");
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
  const [tailType, setTailType] = useState("");
  const [earsTypeIntake, setEarsTypeIntake] = useState("");
  const [coatTypeDetail, setCoatTypeDetail] = useState("");
  const [collarTag, setCollarTag] = useState("");
  const [distinguishingFeatures, setDistinguishingFeatures] = useState("");
  const [ownerVet, setOwnerVet] = useState("");
  const [ownerVetPhone, setOwnerVetPhone] = useState("");

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
  const [bodyConditionScore, setBodyConditionScore] = useState("");
  const [conditionVisibleInjury, setConditionVisibleInjury] = useState(false);
  const [conditionSignsOfIllness, setConditionSignsOfIllness] = useState(false);
  const [conditionParasitesObserved, setConditionParasitesObserved] = useState(false);
  const [conditionPregnantNursing, setConditionPregnantNursing] = useState(false);
  const [assessedByInitials, setAssessedByInitials] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(today());

  // Step 5
  const [broughtBy, setBroughtBy] = useState<Person | null>(null);
  const [pSearch, setPSearch] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [npFirst, setNpFirst] = useState("");
  const [npLast, setNpLast] = useState("");
  const [npPhone, setNpPhone] = useState("");
  const [npRole, setNpRole] = useState("Contact");
  const [npAddress, setNpAddress] = useState("");
  const [npState, setNpState] = useState("GA");
  const [npZip, setNpZip] = useState("");
  const [foundAddress, setFoundAddress] = useState("");
  const [foundCity, setFoundCity] = useState("");
  const [finderWantsIfUnclaimed, setFinderWantsIfUnclaimed] = useState(false);
  const [finderWantsAdoptionContact, setFinderWantsAdoptionContact] = useState(false);
  const [statementAcknowledged, setStatementAcknowledged] = useState(false);
  const [surrenderSignature, setSurrenderSignature] = useState<string | null>(null);
  const [surrenderSignedAt, setSurrenderSignedAt] = useState<string | null>(null);
  const [finderSignature, setFinderSignature] = useState<string | null>(null);
  const [finderSignedAt, setFinderSignedAt] = useState<string | null>(null);

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
    const isOwnerOrFinder = npRole === "Previous Owner" || npRole === "Finder";
    const p = await onAddPerson({
      first_name: npFirst.trim(), last_name: npLast.trim(), phone: npPhone.trim(), role: npRole,
      address: isOwnerOrFinder ? npAddress.trim() || undefined : undefined,
      city: isOwnerOrFinder ? foundCity || undefined : foundCity,
      state: isOwnerOrFinder ? npState || undefined : undefined,
      zip: isOwnerOrFinder ? npZip.trim() || undefined : undefined,
    });
    setBroughtBy(p);
    setShowNewPerson(false);
    setNpFirst(""); setNpLast(""); setNpPhone(""); setNpAddress(""); setNpZip("");
  };

  const pMatches = pSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(pSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleFinish = async () => {
    setSaving(true);
    try {
      const animal: Partial<Animal> = {
        name: name.trim() || "Unknown",
        species, breed: breed || "Unknown", color: color || "Unknown", secondary_color: secondaryColor,
        sex, age: ageEstimate || undefined, dob: dob || undefined, weight, size: size || undefined,
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
        // MCAS Animal Intake Form fields
        intake_method: intakeMethod || undefined,
        processed_by_employee: processedByEmployee.trim() || undefined,
        body_condition_score: bodyConditionScore ? Number(bodyConditionScore) : undefined,
        tail_type: tailType || undefined,
        ears_type: earsTypeIntake || undefined,
        coat_type_detail: coatTypeDetail || undefined,
        collar_tag: collarTag.trim() || undefined,
        distinguishing_features: distinguishingFeatures.trim() || undefined,
        owner_vet: ownerVet.trim() || undefined,
        owner_vet_phone: ownerVetPhone.trim() || undefined,
        condition_visible_injury: conditionVisibleInjury,
        condition_signs_of_illness: conditionSignsOfIllness,
        condition_parasites_observed: conditionParasitesObserved,
        condition_pregnant_nursing: conditionPregnantNursing,
        behavior_friendly: intakeBehavior === "Friendly/Approachable",
        behavior_fearful_skittish: intakeBehavior === "Fearful/Skittish",
        behavior_aggressive: intakeBehavior === "Aggressive",
        behavior_feral_unhandleable: intakeBehavior === "Feral/Unhandleable",
        assessed_by_initials: assessedByInitials.trim() || undefined,
        assessment_date: assessmentDate || undefined,
        finder_wants_if_unclaimed: intakeType === "Stray" ? finderWantsIfUnclaimed : undefined,
        finder_wants_adoption_contact: intakeType === "Stray" ? finderWantsAdoptionContact : undefined,
        finder_signature: intakeType === "Stray" ? finderSignature || undefined : undefined,
        statement_of_surrender_acknowledged: intakeType === "Surrender" ? statementAcknowledged : undefined,
        surrender_signature: intakeType === "Surrender" ? surrenderSignature || undefined : undefined,
      };
      const created = await onComplete(animal);
      if (created?.id) {
        if (broughtBy) {
          await linkAnimalToPerson(created.id, broughtBy.id, broughtBy.role || "Contact");
        }
        if (initialNotes.trim()) {
          await addAnimalNote(created.id, initialNotes.trim(), "Intake");
        }
      }
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
                <DateInput className="form-input" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} />
              </F>
              <F label="Intake Time">
                <input className="form-input" type="time" value={intakeTime} onChange={(e) => setIntakeTime(e.target.value)} />
              </F>
              <F label="ACO Record # / AC#">
                <input className="form-input" value={acoRecord} onChange={(e) => setAcoRecord(e.target.value)} placeholder="ACO-..." />
              </F>
              <F label="Case Number">
                <input className="form-input" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="If applicable" />
              </F>
              <F label="Employee">
                <input className="form-input" value={processedByEmployee} onChange={(e) => setProcessedByEmployee(e.target.value)} placeholder="Staff member processing intake" />
              </F>
            </div>
            <div className="form-group">
              <label className="form-label">Intake Method</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {INTAKE_METHODS.map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, border: `1.5px solid ${intakeMethod === m ? "var(--teal)" : "var(--border)"}`, background: intakeMethod === m ? "rgba(26,138,138,0.08)" : "transparent", cursor: "pointer", fontSize: 13 }}>
                    <input type="radio" name="intakeMethod" checked={intakeMethod === m} onChange={() => setIntakeMethod(m)} />
                    {m}
                  </label>
                ))}
              </div>
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
                    <span style={{ fontSize: 28 }}>{species === "Dog" ? "🐕" : species === "Cat" ? "🐈" : "🐾"}</span>
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Upload Photo</span>
                  </div>
                )}
                <input type="file" accept="image/*,image/heic,image/heif" style={{ display: "none" }} onChange={handlePhoto} />
              </label>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {["Dog", "Cat", "Other"].map((s) => (
                    <button key={s} onClick={() => { setSpecies(s); setBreed(""); }} className={`btn btn-sm ${species === s ? "btn-primary" : "btn-secondary"}`}>
                      {s === "Dog" ? "🐕" : s === "Cat" ? "🐈" : "🐾"} {s}
                    </button>
                  ))}
                </div>
                <F label="Name">
                  <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Animal name (or leave blank)" />
                </F>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Estimated Age *</label>
              <AgeInput value={ageEstimate} onChange={setAgeEstimate} />
            </div>
            <div className="grid-3">
              <F label="Breed">
                {species === "Other" ? (
                  <input className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Describe species/breed" />
                ) : (
                  <select className="form-select" value={breed} onChange={(e) => setBreed(e.target.value)}>
                    {(species === "Cat" ? ALL_BREEDS_CAT : ALL_BREEDS_DOG).map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                  </select>
                )}
              </F>
              <F label="Sex">
                <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                  {["Unknown", "Male", "Female"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Exact DOB (if known)">
                <DateInput className="form-input" value={dob} onChange={(e) => {
                  const iso = e.target.value;
                  setDob(iso);
                  if (iso) setAgeEstimate(dobToAgeEstimate(iso));
                }} />
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

            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", margin: "20px 0 16px" }}>Intake Form — Animal Description</h3>
            <div className="grid-3">
              <F label="Tail">
                <select className="form-select" value={tailType} onChange={(e) => setTailType(e.target.value)}>
                  {TAIL_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Ears">
                <select className="form-select" value={earsTypeIntake} onChange={(e) => setEarsTypeIntake(e.target.value)}>
                  {INTAKE_EAR_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Coat">
                <select className="form-select" value={coatTypeDetail} onChange={(e) => setCoatTypeDetail(e.target.value)}>
                  {INTAKE_COAT_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Body Condition Score (1–9)">
                <select className="form-select" value={bodyConditionScore} onChange={(e) => setBodyConditionScore(e.target.value)}>
                  <option value="">— Select —</option>
                  {BODY_CONDITION_SCORES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </F>
              <F label="Collar / Tag">
                <input className="form-input" value={collarTag} onChange={(e) => setCollarTag(e.target.value)} placeholder="Description of collar/tag" />
              </F>
              <F label="Vet">
                <input className="form-input" value={ownerVet} onChange={(e) => setOwnerVet(e.target.value)} placeholder="Owner's veterinarian" />
              </F>
              <F label="Vet's Phone">
                <input className="form-input" type="tel" value={ownerVetPhone} onChange={(e) => setOwnerVetPhone(e.target.value)} placeholder="(706) 555-0000" />
              </F>
            </div>
            <F label="Distinguishing Features">
              <textarea className="form-textarea" value={distinguishingFeatures} onChange={(e) => setDistinguishingFeatures(e.target.value)} placeholder="Scars, tail kinks, unusual markings…" rows={2} />
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
                {microchip.length >= 6 && <MicrochipBadge chip={microchip} />}
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
                <DateInput className="form-input" value={microchipDate} onChange={(e) => setMicrochipDate(e.target.value)} />
              </F>
              <F label="Rabies Tag #">
                <input className="form-input" value={rabiesTag} onChange={(e) => setRabiesTag(e.target.value)} placeholder="Tag number" />
              </F>
              <F label="Rabies Tag Expiry">
                <DateInput className="form-input" value={rabiesExpiry} onChange={(e) => setRabiesExpiry(e.target.value)} />
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
                  {["", "Friendly/Approachable", "Fearful/Skittish", "Aggressive", "Feral/Unhandleable", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
            </div>
            <div className="form-group">
              <label className="form-label">Condition Assessment</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={conditionVisibleInjury} onChange={(e) => setConditionVisibleInjury(e.target.checked)} />
                  Visible Injury
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={conditionSignsOfIllness} onChange={(e) => setConditionSignsOfIllness(e.target.checked)} />
                  Signs of Illness
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={conditionParasitesObserved} onChange={(e) => setConditionParasitesObserved(e.target.checked)} />
                  Parasites Observed
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={conditionPregnantNursing} onChange={(e) => setConditionPregnantNursing(e.target.checked)} />
                  Pregnant / Nursing
                </label>
              </div>
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
            <div className="grid-2">
              <F label="Assessed By (Staff Initials)">
                <input className="form-input" value={assessedByInitials} onChange={(e) => setAssessedByInitials(e.target.value)} placeholder="e.g. JS" maxLength={6} />
              </F>
              <F label="Assessment Date">
                <DateInput className="form-input" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
              </F>
            </div>
          </div>
        )}

        {/* Step 5: Source / Brought By */}
        {step === 5 && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 16 }}>
              {intakeType === "Surrender" ? "Owner Surrender" : intakeType === "Stray" ? "Finder" : "Source / Brought By"}
            </h3>
            {intakeType === "Stray" && (
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Location Found</label>
                  <input className="form-input" value={foundAddress} onChange={(e) => setFoundAddress(e.target.value)} placeholder="Street address where found" />
                </div>
                <div className="form-group">
                  <label className="form-label">Found City</label>
                  <input className="form-input" value={foundCity} onChange={(e) => setFoundCity(e.target.value)} placeholder="City" />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{intakeType === "Surrender" ? "Owner" : intakeType === "Stray" ? "Finder" : "Brought By"} (search existing contacts)</label>
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
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setNpRole(intakeType === "Surrender" ? "Previous Owner" : intakeType === "Stray" ? "Finder" : "Contact");
                  setShowNewPerson(true);
                }}
              >+ Create New Contact</button>
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
                  {(npRole === "Previous Owner" || npRole === "Finder") && (
                    <>
                      <div className="form-group" style={{ gridColumn: "1/-1" }}>
                        <label className="form-label">Address</label>
                        <input className="form-input" value={npAddress} onChange={(e) => setNpAddress(e.target.value)} placeholder="Street address" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">City</label>
                        <input className="form-input" value={foundCity} onChange={(e) => setFoundCity(e.target.value)} placeholder="City" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State</label>
                        <select className="form-select" value={npState} onChange={(e) => setNpState(e.target.value)}>
                          {STATES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Zip</label>
                        <input className="form-input" value={npZip} onChange={(e) => setNpZip(e.target.value)} placeholder="30650" maxLength={10} />
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleCreatePerson}>Save Contact</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewPerson(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Owner Surrender certification */}
            {intakeType === "Surrender" && (
              <div style={{ marginTop: 20, borderTop: "2px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Statement of Surrender</div>
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", background: "#f9fafb", fontSize: 12, lineHeight: 1.7, color: "#1f2937", marginBottom: 12 }}>
                  {STATEMENT_OF_SURRENDER_TEXT}
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
                  <input type="checkbox" checked={statementAcknowledged} onChange={(e) => setStatementAcknowledged(e.target.checked)} style={{ marginTop: 2 }} />
                  <span><strong>I have read and agree to the Statement of Surrender</strong> as stated above.</span>
                </label>
                <SignaturePad
                  label="Owner Signature"
                  value={surrenderSignature}
                  timestamp={surrenderSignedAt}
                  onAccept={(data, ts) => { setSurrenderSignature(data); setSurrenderSignedAt(ts); }}
                  onClear={() => { setSurrenderSignature(null); setSurrenderSignedAt(null); }}
                />
              </div>
            )}

            {/* Finder certification */}
            {intakeType === "Stray" && (
              <div style={{ marginTop: 20, borderTop: "2px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Finder Preferences</div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
                  <input type="checkbox" checked={finderWantsIfUnclaimed} onChange={(e) => setFinderWantsIfUnclaimed(e.target.checked)} />
                  Wants to keep animal if unclaimed
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
                  <input type="checkbox" checked={finderWantsAdoptionContact} onChange={(e) => setFinderWantsAdoptionContact(e.target.checked)} />
                  Wants to be contacted re: adoption
                </label>
                <SignaturePad
                  label="Finder Signature"
                  value={finderSignature}
                  timestamp={finderSignedAt}
                  onAccept={(data, ts) => { setFinderSignature(data); setFinderSignedAt(ts); }}
                  onClear={() => { setFinderSignature(null); setFinderSignedAt(null); }}
                />
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
                <div><span style={{ color: "var(--text-secondary)" }}>Age:</span> {ageEstimate || "Unknown"}{dob && ` (DOB: ${dob})`}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Intake Type:</span> {intakeType}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Intake Date:</span> {intakeDate}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Kennel:</span> {kennel}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Fixed:</span> {fixed}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Microchip:</span> {microchip || "None"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Brought By:</span> {broughtBy ? `${broughtBy.first_name} ${broughtBy.last_name}` : "Unknown"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Intake Method:</span> {intakeMethod || "—"}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Body Condition Score:</span> {bodyConditionScore || "—"}</div>
              </div>
              {intakeType === "Surrender" && (
                <div style={{ marginTop: 8, fontSize: 12, color: statementAcknowledged && surrenderSignature ? "#15803d" : "#b45309" }}>
                  {statementAcknowledged && surrenderSignature ? "✓ Statement of Surrender signed" : "⚠ Statement of Surrender not yet signed"}
                </div>
              )}
              {intakeType === "Stray" && (
                <div style={{ marginTop: 8, fontSize: 12, color: finderSignature ? "#15803d" : "#b45309" }}>
                  {finderSignature ? "✓ Finder signature on file" : "⚠ Finder signature not yet captured"}
                </div>
              )}
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
