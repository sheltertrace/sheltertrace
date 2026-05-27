"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createAdoptionApplication } from "@/lib/data";
import { printBlankAdoptionForm } from "@/lib/adoptionPrint";
import DateInput from "@/components/ui/DateInput";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayDisplay() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ── Signature Pad ──────────────────────────────────────────────────────────────
function SignaturePad({ label, subLabel, onSign }: { label: string; subLabel?: string; onSign: (d: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d")!.fillStyle = "#fafafa";
    c.getContext("2d")!.fillRect(0, 0, c.width, c.height);
  }, []);

  function xy(clientX: number, clientY: number) {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: (clientX - r.left) * (c.width / r.width), y: (clientY - r.top) * (c.height / r.height) };
  }
  function begin(x: number, y: number) { drawing.current = true; lastPos.current = { x, y }; }
  function move(x: number, y: number) {
    if (!drawing.current || !lastPos.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.strokeStyle = "#0f2942"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(x, y); ctx.stroke();
    lastPos.current = { x, y }; setIsEmpty(false); onSign(canvasRef.current.toDataURL());
  }
  function end() { drawing.current = false; lastPos.current = null; }
  function clear() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fafafa"; ctx.fillRect(0, 0, c.width, c.height);
    setIsEmpty(true); onSign(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <label style={lbl}>{label}</label>
          {subLabel && <div style={{ fontSize: 11, color: "#6b7280" }}>{subLabel}</div>}
        </div>
        {!isEmpty && <button type="button" onClick={clear} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>✕ Clear</button>}
      </div>
      <canvas
        ref={canvasRef} width={740} height={110}
        style={{ border: "2px solid #d1d5db", borderRadius: 6, touchAction: "none", background: "#fafafa", display: "block", width: "100%", height: 110, cursor: "crosshair" }}
        onMouseDown={(e) => { const p = xy(e.clientX, e.clientY); begin(p.x, p.y); }}
        onMouseMove={(e) => { const p = xy(e.clientX, e.clientY); move(p.x, p.y); }}
        onMouseUp={end} onMouseLeave={end}
        onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; const p = xy(t.clientX, t.clientY); begin(p.x, p.y); }}
        onTouchMove={(e)  => { e.preventDefault(); const t = e.touches[0]; const p = xy(t.clientX, t.clientY); move(p.x, p.y); }}
        onTouchEnd={end}
      />
      {isEmpty && <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>Draw your signature above using your mouse or finger</div>}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AdoptApplyPage() {
  const [step,   setStep]   = useState<"form" | "submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // §1 Top info
  const [eventLocation, setEventLocation] = useState("");

  // §2 Animal
  const [animalName,    setAnimalName]    = useState("");
  const [animalIdNum,   setAnimalIdNum]   = useState("");
  const [species,       setSpecies]       = useState("");
  const [breed,         setBreed]         = useState("");
  const [colorMarkings, setColorMarkings] = useState("");
  const [animalAge,     setAnimalAge]     = useState("");
  const [animalSex,     setAnimalSex]     = useState("");
  const [weight,        setWeight]        = useState("");
  const [spayedNeutered,    setSpayedNeutered]    = useState(false);
  const [microchipped,      setMicrochipped]      = useState(false);
  const [vaccinated,        setVaccinated]        = useState(false);
  const [heartwormTested,   setHeartwormTested]   = useState(false);
  const [microchipNum,  setMicrochipNum]  = useState("");
  const [animalNotes,   setAnimalNotes]   = useState("");

  // §3 Adopter
  const [adopterName,   setAdopterName]   = useState("");
  const [adopterDob,    setAdopterDob]    = useState("");
  const [adopterAddr,   setAdopterAddr]   = useState("");
  const [adopterCity,   setAdopterCity]   = useState("");
  const [adopterState,  setAdopterState]  = useState("GA");
  const [adopterZip,    setAdopterZip]    = useState("");
  const [adopterPhone,  setAdopterPhone]  = useState("");
  const [adopterEmail,  setAdopterEmail]  = useState("");
  const [dlNum,         setDlNum]         = useState("");
  const [dlState,       setDlState]       = useState("GA");
  const [housing,       setHousing]       = useState("");
  const [landlordInfo,  setLandlordInfo]  = useState("");
  const [dwellingType,  setDwellingType]  = useState("");

  // §4 Household
  const [numAdults,        setNumAdults]        = useState("");
  const [childrenAges,     setChildrenAges]     = useState("");
  const [petAllergies,     setPetAllergies]     = useState<boolean | null>(null);
  const [currentPets,      setCurrentPets]      = useState("");
  const [surrenderedPet,   setSurrenderedPet]   = useState<boolean | null>(null);
  const [surrenderedExpl,  setSurrenderedExpl]  = useState("");

  // §5 Pet care
  const [petKeptDay,  setPetKeptDay]  = useState("");
  const [petSleep,    setPetSleep]    = useState("");
  const [hoursAlone,  setHoursAlone]  = useState("");
  const [fencedYard,  setFencedYard]  = useState<boolean | null>(null);
  const [vetInfo,     setVetInfo]     = useState("");

  // §6 Agreement
  const [agreeAdoption, setAgreeAdoption] = useState(false);

  // §7 Fees
  const [adoptionFee,  setAdoptionFee]  = useState("");
  const [deposit,      setDeposit]      = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptNum,   setReceiptNum]   = useState("");

  // §9 Signatures
  const [adopterSig, setAdopterSig] = useState<string | null>(null);
  const [staffSig,   setStaffSig]   = useState<string | null>(null);

  const handleAdopterSig = useCallback((d: string | null) => setAdopterSig(d), []);
  const handleStaffSig   = useCallback((d: string | null) => setStaffSig(d), []);

  const canSubmit = adopterName.trim() && adopterPhone.trim() && adopterEmail.trim() &&
    adopterAddr.trim() && adopterCity.trim() && agreeAdoption && adopterSig;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!adopterName.trim()) { setError("Adopter full name is required."); return; }
    if (!adopterPhone.trim() || !adopterEmail.trim() || !adopterAddr.trim() || !adopterCity.trim()) {
      setError("Contact information (phone, email, address, city) is required."); return;
    }
    if (!agreeAdoption) { setError("You must agree to the Adoption Agreement before submitting."); return; }
    if (!adopterSig)    { setError("Adopter signature is required."); return; }

    setSaving(true);
    try {
      await createAdoptionApplication({
        status: "pending",
        date: todayStr(),
        event_location: eventLocation.trim() || undefined,
        animal_name:      animalName.trim() || undefined,
        animal_id_number: animalIdNum.trim() || undefined,
        species:          species || undefined,
        breed:            breed.trim() || undefined,
        color_markings:   colorMarkings.trim() || undefined,
        age:              animalAge.trim() || undefined,
        sex:              animalSex || undefined,
        weight:           weight.trim() || undefined,
        spayed_neutered:  spayedNeutered || undefined,
        microchipped:     microchipped || undefined,
        vaccinated:       vaccinated || undefined,
        heartworm_tested: heartwormTested || undefined,
        microchip_number: microchipNum.trim() || undefined,
        animal_notes:     animalNotes.trim() || undefined,
        adopter_name:     adopterName.trim(),
        adopter_dob:      adopterDob || undefined,
        adopter_address:  adopterAddr.trim() || undefined,
        adopter_city:     adopterCity.trim() || undefined,
        adopter_state:    adopterState || undefined,
        adopter_zip:      adopterZip.trim() || undefined,
        adopter_phone:    adopterPhone.trim() || undefined,
        adopter_email:    adopterEmail.trim() || undefined,
        drivers_license:  dlNum.trim() || undefined,
        dl_state:         dlState || undefined,
        housing:          housing || undefined,
        landlord_info:    landlordInfo.trim() || undefined,
        dwelling_type:    dwellingType || undefined,
        num_adults:       numAdults.trim() || undefined,
        children_ages:    childrenAges.trim() || undefined,
        pet_allergies:    petAllergies ?? undefined,
        current_pets:     currentPets.trim() || undefined,
        surrendered_pet:  surrenderedPet ?? undefined,
        surrendered_explain: surrenderedExpl.trim() || undefined,
        pet_kept_day:     petKeptDay.trim() || undefined,
        pet_sleep:        petSleep.trim() || undefined,
        hours_alone:      hoursAlone.trim() || undefined,
        fenced_yard:      fencedYard ?? undefined,
        vet_info:         vetInfo.trim() || undefined,
        adoption_fee:     adoptionFee ? Number(adoptionFee) : undefined,
        deposit:          deposit ? Number(deposit) : undefined,
        payment_method:   paymentMethod || undefined,
        receipt_number:   receiptNum.trim() || undefined,
        adopter_signature: adopterSig || undefined,
        staff_signature:  staffSig || undefined,
      });
      setStep("submitted");
    } catch (err) {
      setError("Failed to submit application. Please try again or contact us at (706) 752-1195.");
      console.error("[adopt-apply]", err);
    } finally {
      setSaving(false);
    }
  }

  if (step === "submitted") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", flexDirection: "column" }}>
        <Header onPrintBlank={printBlankAdoptionForm} submitted />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ maxWidth: 540, width: "100%", background: "#fff", borderRadius: 14, padding: "48px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0f2942", margin: "0 0 12px" }}>Application Submitted!</h2>
            <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: "0 0 24px" }}>
              Thank you for submitting your adoption application! Our team will review it and contact you.
              If you have questions, call us at <strong>(706) 752-1195</strong>.
            </p>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px", textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d", marginBottom: 6 }}>What happens next?</div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#374151", lineHeight: 2 }}>
                <li>Our staff will review your application within 1–3 business days</li>
                <li>We will contact you by phone or email to discuss the next steps</li>
                <li>If approved, you will schedule a time to come in and meet your pet</li>
              </ul>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", flexDirection: "column" }}>
      <Header onPrintBlank={printBlankAdoptionForm} />

      <div style={{ flex: 1, maxWidth: 860, width: "100%", margin: "0 auto", padding: "28px 16px" }}>

        <form onSubmit={handleSubmit}>

          {/* ── §1: Top Info ── */}
          <Section title="1. General Information">
            <div style={g3}>
              <FRow label="Date"><input style={{ ...inp, background: "#f9fafb" }} value={todayDisplay()} readOnly /></FRow>
              <FRow label="Event / Location (optional)"><input style={inp} value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="e.g. Adoption Event" /></FRow>
            </div>
          </Section>

          {/* ── §2: Animal Info ── */}
          <Section title="2. Animal Information">
            <div style={g3}>
              <FRow label="Animal Name"><input style={inp} value={animalName} onChange={(e) => setAnimalName(e.target.value)} /></FRow>
              <FRow label="Animal ID #"><input style={inp} value={animalIdNum} onChange={(e) => setAnimalIdNum(e.target.value)} placeholder="If known" /></FRow>
              <FRow label="Species">
                <select style={inp} value={species} onChange={(e) => setSpecies(e.target.value)}>
                  <option value="">— Select —</option>
                  <option>Dog</option><option>Cat</option><option>Rabbit</option><option>Other</option>
                </select>
              </FRow>
            </div>
            <div style={g3}>
              <FRow label="Breed"><input style={inp} value={breed} onChange={(e) => setBreed(e.target.value)} /></FRow>
              <FRow label="Color / Markings"><input style={inp} value={colorMarkings} onChange={(e) => setColorMarkings(e.target.value)} /></FRow>
              <FRow label="Age"><input style={inp} value={animalAge} onChange={(e) => setAnimalAge(e.target.value)} placeholder="e.g. 2 years" /></FRow>
            </div>
            <div style={g3}>
              <FRow label="Sex">
                <select style={inp} value={animalSex} onChange={(e) => setAnimalSex(e.target.value)}>
                  <option value="">— Select —</option><option>Male</option><option>Female</option>
                </select>
              </FRow>
              <FRow label="Weight"><input style={inp} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="lbs" /></FRow>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                {[["Spayed / Neutered", spayedNeutered, setSpayedNeutered] as const,
                  ["Microchipped",       microchipped,   setMicrochipped]   as const,
                  ["Vaccinated",         vaccinated,     setVaccinated]     as const,
                  ["Heartworm Tested",   heartwormTested, setHeartwormTested] as const,
                ].map(([label, val, setter]) => (
                  <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#1a8a8a" }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <FRow label="Microchip #"><input style={inp} value={microchipNum} onChange={(e) => setMicrochipNum(e.target.value)} /></FRow>
            <FRow label="Notes (medical, behavioral, etc.)">
              <textarea style={{ ...inp, height: 70, resize: "vertical" }} value={animalNotes} onChange={(e) => setAnimalNotes(e.target.value)} />
            </FRow>
          </Section>

          {/* ── §3: Adopter Info ── */}
          <Section title="3. Adopter Information">
            <div style={g2}>
              <FRow label="Full Name *"><input style={inp} value={adopterName} onChange={(e) => setAdopterName(e.target.value)} required placeholder="First Middle Last" /></FRow>
              <FRow label="Date of Birth"><DateInput style={inp} value={adopterDob} onChange={(e) => setAdopterDob(e.target.value)} /></FRow>
            </div>
            <FRow label="Street Address *"><input style={inp} value={adopterAddr} onChange={(e) => setAdopterAddr(e.target.value)} required /></FRow>
            <div style={g3}>
              <FRow label="City *"><input style={inp} value={adopterCity} onChange={(e) => setAdopterCity(e.target.value)} required /></FRow>
              <FRow label="State">
                <select style={inp} value={adopterState} onChange={(e) => setAdopterState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FRow>
              <FRow label="ZIP"><input style={inp} value={adopterZip} onChange={(e) => setAdopterZip(e.target.value)} maxLength={10} /></FRow>
            </div>
            <div style={g2}>
              <FRow label="Phone *"><input type="tel" style={inp} value={adopterPhone} onChange={(e) => setAdopterPhone(e.target.value)} required /></FRow>
              <FRow label="Email *"><input type="email" style={inp} value={adopterEmail} onChange={(e) => setAdopterEmail(e.target.value)} required /></FRow>
            </div>
            <div style={g2}>
              <FRow label="Driver's License #"><input style={inp} value={dlNum} onChange={(e) => setDlNum(e.target.value)} /></FRow>
              <FRow label="DL State of Issue">
                <select style={inp} value={dlState} onChange={(e) => setDlState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FRow>
            </div>
            <div>
              <label style={lbl}>Do you own or rent your home?</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                {["Own", "Rent"].map((v) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="housing" checked={housing === v} onChange={() => setHousing(v)} style={{ accentColor: "#1a8a8a" }} />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            {housing === "Rent" && (
              <FRow label="Landlord Name & Phone">
                <input style={inp} value={landlordInfo} onChange={(e) => setLandlordInfo(e.target.value)} placeholder="Name, (xxx) xxx-xxxx" />
              </FRow>
            )}
            <div>
              <label style={lbl}>Dwelling Type</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                {["House", "Apartment", "Mobile Home", "Other"].map((v) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="dwelling" checked={dwellingType === v} onChange={() => setDwellingType(v)} style={{ accentColor: "#1a8a8a" }} />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* ── §4: Household ── */}
          <Section title="4. Household Information">
            <div style={g2}>
              <FRow label="Number of adults in household"><input style={inp} value={numAdults} onChange={(e) => setNumAdults(e.target.value)} type="number" min="1" /></FRow>
              <FRow label="Number & ages of children"><input style={inp} value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 2 children: ages 5 and 9" /></FRow>
            </div>
            <YesNoField label="Does anyone in the household have pet allergies?" value={petAllergies} onChange={setPetAllergies} />
            <FRow label="Current pets (species, breed, spayed/neutered, vaccinated)">
              <textarea style={{ ...inp, height: 70, resize: "vertical" }} value={currentPets} onChange={(e) => setCurrentPets(e.target.value)} placeholder="List each pet on a separate line" />
            </FRow>
            <YesNoField label="Have you ever surrendered or rehomed a pet?" value={surrenderedPet} onChange={setSurrenderedPet} />
            {surrenderedPet && (
              <FRow label="Please explain">
                <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={surrenderedExpl} onChange={(e) => setSurrenderedExpl(e.target.value)} />
              </FRow>
            )}
          </Section>

          {/* ── §5: Pet Care ── */}
          <Section title="5. Pet Care Plan">
            <div style={g2}>
              <FRow label="Where will the pet be kept during the day?"><input style={inp} value={petKeptDay} onChange={(e) => setPetKeptDay(e.target.value)} /></FRow>
              <FRow label="Where will the pet sleep at night?"><input style={inp} value={petSleep} onChange={(e) => setPetSleep(e.target.value)} /></FRow>
            </div>
            <div style={g2}>
              <FRow label="Average hours per day the pet will be alone">
                <select style={inp} value={hoursAlone} onChange={(e) => setHoursAlone(e.target.value)}>
                  <option value="">— Select —</option>
                  {["0–2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "8–10 hours", "10+ hours"].map((h) => <option key={h}>{h}</option>)}
                </select>
              </FRow>
              <YesNoField label="Do you have a fenced yard?" value={fencedYard} onChange={setFencedYard} />
            </div>
            <FRow label="Veterinarian name & phone (if applicable)"><input style={inp} value={vetInfo} onChange={(e) => setVetInfo(e.target.value)} placeholder="Dr. Smith, (706) 555-0000" /></FRow>
          </Section>

          {/* ── §6: Agreement ── */}
          <div style={{ ...card, border: agreeAdoption ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <div style={secHead}>6. Adoption Agreement &amp; Acknowledgments</div>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
              ⚠ Please read the full agreement before checking the box below.
            </div>
            <div style={{ height: 260, overflowY: "scroll", border: "1px solid #d1d5db", borderRadius: 8, padding: "14px 16px", background: "#f9fafb", fontSize: 13, lineHeight: 1.8, color: "#1f2937", marginBottom: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>By signing below, I certify that all information provided is true and accurate. I have read and agree to the terms of the Adoption Agreement above.</p>
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                <li style={{ marginBottom: 6 }}>I am at least 18 years of age and legally able to enter into a binding agreement.</li>
                <li style={{ marginBottom: 6 }}>I agree to provide proper food, clean water, shelter, and veterinary care for this animal at all times.</li>
                <li style={{ marginBottom: 6 }}>I agree to comply with all Morgan County and State of Georgia ordinances regarding animal ownership, including licensing and leash laws.</li>
                <li style={{ marginBottom: 6 }}>I understand that if the animal has not yet been spayed/neutered, I agree to have the procedure completed within 30 days of adoption or as directed by a veterinarian, and to provide proof to Animal Services.</li>
                <li style={{ marginBottom: 6 }}>I agree to keep current identification (tag, microchip) on the animal at all times.</li>
                <li style={{ marginBottom: 6 }}>I will not sell, give away, or transfer ownership of this animal without first contacting Morgan County Animal Services.</li>
                <li style={{ marginBottom: 6 }}>If I can no longer care for this animal, I agree to return it to Morgan County Animal Services.</li>
                <li style={{ marginBottom: 6 }}>I understand that Morgan County Animal Services makes no guarantees regarding the health, temperament, or breed of the animal.</li>
                <li style={{ marginBottom: 6 }}>I understand that an adjustment period is normal and I will allow adequate time for the animal to settle into my home.</li>
                <li style={{ marginBottom: 6 }}>I understand that providing false information on this application may result in the animal being reclaimed by Morgan County Animal Services.</li>
              </ol>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={agreeAdoption} onChange={(e) => setAgreeAdoption(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }} />
              <span><strong>I have read and agree to the Adoption Agreement &amp; Acknowledgments</strong> listed above.</span>
            </label>
          </div>

          {/* ── §7: Fees (optional) ── */}
          <Section title="7. Adoption Fees (if known)">
            <div style={g2}>
              <FRow label="Adoption Fee $"><input type="number" style={inp} value={adoptionFee} onChange={(e) => setAdoptionFee(e.target.value)} min="0" placeholder="0.00" /></FRow>
              <FRow label="Deposit $ (if applicable)"><input type="number" style={inp} value={deposit} onChange={(e) => setDeposit(e.target.value)} min="0" placeholder="0.00" /></FRow>
            </div>
            <div>
              <label style={lbl}>Payment Method</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                {["Cash", "Check", "Card", "Other"].map((m) => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="payment" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} style={{ accentColor: "#1a8a8a" }} />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <FRow label="Receipt / Transaction #"><input style={inp} value={receiptNum} onChange={(e) => setReceiptNum(e.target.value)} /></FRow>
          </Section>

          {/* ── §9: Signatures ── */}
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={secHead}>8. Signatures</div>
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 16, lineHeight: 1.7 }}>
              By signing below, I certify that all information provided is true and accurate. I have read and agree to the terms of the Adoption Agreement above.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <FRow label="Adopter Printed Name">
                <input style={{ ...inp, background: "#f9fafb" }} value={adopterName} readOnly placeholder="Auto-filled from name above" />
              </FRow>
              <FRow label="Date">
                <input style={{ ...inp, background: "#f9fafb" }} value={todayDisplay()} readOnly />
              </FRow>
            </div>
            <SignaturePad label="Adopter Signature *" onSign={handleAdopterSig} />
            {adopterSig && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 6 }}>✓ Signature captured</div>}

            <div style={{ borderTop: "1px dashed #d1d5db", margin: "20px 0 16px" }} />
            <SignaturePad
              label="Staff / Volunteer Signature"
              subLabel="Optional — may be completed by staff at the shelter"
              onSign={handleStaffSig}
            />
          </div>

          {/* Checklist */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f2942" }}>Before you submit:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                { done: !!adopterName.trim(), label: "Adopter name provided" },
                { done: !!(adopterPhone.trim() && adopterEmail.trim()), label: "Contact information (phone & email) provided" },
                { done: !!(adopterAddr.trim() && adopterCity.trim()), label: "Address provided" },
                { done: agreeAdoption, label: "Adoption Agreement acknowledged" },
                { done: !!adopterSig, label: "Signature captured" },
              ].map(({ done, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ color: done ? "#16a34a" : "#9ca3af", fontWeight: 700 }}>{done ? "✓" : "○"}</span>
                  <span style={{ color: done ? "#1f2937" : "#9ca3af" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingBottom: 40 }}>
            <button type="button" onClick={printBlankAdoptionForm}
              style={{ background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              🖨 Print Blank Form
            </button>
            <button type="submit" disabled={saving || !canSubmit}
              style={{ background: canSubmit ? "#1a8a8a" : "#9ca3af", color: "#fff", border: "none", borderRadius: 8, padding: "11px 32px", fontSize: 15, fontWeight: 800, cursor: canSubmit ? "pointer" : "not-allowed" }}>
              {saving ? "Submitting…" : "Submit Application →"}
            </button>
          </div>

        </form>
      </div>
      <Footer />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Header({ onPrintBlank, submitted }: { onPrintBlank: () => void; submitted?: boolean }) {
  return (
    <div style={{ background: "#0f2942" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, background: "#ececec", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🐾</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: 0.3 }}>Morgan County Animal Services</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginTop: 1 }}>Pet Adoption Application</div>
          </div>
        </div>
        {!submitted && (
          <button onClick={onPrintBlank}
            style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, padding: "8px 16px", fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
            🖨 Print Blank Form
          </button>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ background: "#1f2937", padding: "16px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.8 }}>
        Morgan County Animal Services &nbsp;·&nbsp; Morgan County, Georgia<br />
        Phone: (706) 752-1195 &nbsp;·&nbsp; ShelterTrace v1.0 · Shelter Data Systems
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={secHead}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

function FRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ marginTop: 5 }}>{children}</div>
    </div>
  );
}

function YesNoField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        {[["Yes", true], ["No", false]].map(([text, val]) => (
          <label key={String(val)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input type="radio" name={label} checked={value === val} onChange={() => onChange(val as boolean)} style={{ accentColor: "#1a8a8a" }} />
            {text as string}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151" };
const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, color: "#111827", background: "#fff", boxSizing: "border-box" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 12, padding: "20px 22px", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.07)" };
const secHead: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0f2942", marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" };
const g2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const g3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 };
