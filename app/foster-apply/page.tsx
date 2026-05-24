"use client";
import { useState, useRef } from "react";
import { createFosterApplication } from "@/lib/data";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const ANIMAL_PREFS = ["Dogs","Cats","Both — Dogs and Cats","Puppies / Kittens","Any / No Preference"];
const DURATIONS = ["A few days","1–2 weeks","Several weeks","1–2 months","As long as needed"];
const HOUSING = ["Own","Rent"];
const DWELLING = ["House","Townhouse / Condo","Apartment","Mobile Home","Other"];

// ── Signature Pad ─────────────────────────────────────────────────────────────
function SignaturePad({ onSign }: { onSign: (d: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Signature *</label>
        {!isEmpty && <button type="button" onClick={clear} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>✕ Clear</button>}
      </div>
      <canvas
        ref={canvasRef} width={680} height={100}
        style={{ border: "2px solid #d1d5db", borderRadius: 6, touchAction: "none", background: "#fafafa", display: "block", width: "100%", height: 100, cursor: "crosshair" }}
        onMouseDown={(e) => { const p = xy(e.clientX, e.clientY); begin(p.x, p.y); }}
        onMouseMove={(e) => { const p = xy(e.clientX, e.clientY); move(p.x, p.y); }}
        onMouseUp={end} onMouseLeave={end}
        onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; const p = xy(t.clientX, t.clientY); begin(p.x, p.y); }}
        onTouchMove={(e) => { e.preventDefault(); const t = e.touches[0]; const p = xy(t.clientX, t.clientY); move(p.x, p.y); }}
        onTouchEnd={end}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = { width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "9px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff" };
const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 };
const sect: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 22px", marginBottom: 18 };

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}{req && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>{children}</div>;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FosterApplyPage() {
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("GA");
  const [zip, setZip] = useState("");

  // Housing
  const [housing, setHousing] = useState("");
  const [dwellingType, setDwellingType] = useState("");
  const [landlordPermission, setLandlordPermission] = useState<boolean | null>(null);
  const [fencedYard, setFencedYard] = useState<boolean | null>(null);
  const [fenceDetails, setFenceDetails] = useState("");

  // Household
  const [otherPets, setOtherPets] = useState("");
  const [children, setChildren] = useState("");

  // Foster preferences
  const [animalPref, setAnimalPref] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState<boolean | null>(null);
  const [bottleFeed, setBottleFeed] = useState<boolean | null>(null);
  const [maxAnimals, setMaxAnimals] = useState("");
  const [fosterDuration, setFosterDuration] = useState("");

  // Experience & motivation
  const [prevExperience, setPrevExperience] = useState("");
  const [whyFoster, setWhyFoster] = useState("");
  const [vetInfo, setVetInfo] = useState("");

  // Emergency contact
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");

  // Agreement
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    if (!agreed || !signature) { setError("Please read and sign the agreement before submitting."); return; }
    setSaving(true);
    try {
      await createFosterApplication({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        dob: dob || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state || undefined,
        zip: zip.trim() || undefined,
        housing: housing || undefined,
        dwelling_type: dwellingType || undefined,
        landlord_permission: landlordPermission ?? undefined,
        fenced_yard: fencedYard ?? undefined,
        fence_details: fenceDetails.trim() || undefined,
        other_pets: otherPets.trim() || undefined,
        children: children.trim() || undefined,
        previous_experience: prevExperience.trim() || undefined,
        animal_preference: animalPref || undefined,
        special_needs: specialNeeds ?? undefined,
        bottle_feed: bottleFeed ?? undefined,
        max_animals: maxAnimals ? parseInt(maxAnimals) : undefined,
        foster_duration: fosterDuration || undefined,
        vet_info: vetInfo.trim() || undefined,
        emergency_contact_name: ecName.trim() || undefined,
        emergency_contact_phone: ecPhone.trim() || undefined,
        why_foster: whyFoster.trim() || undefined,
        signature: signature || undefined,
        status: "pending",
      });
      setStep("submitted");
    } catch (err) {
      setError("Failed to submit application. Please try again or call (706) 752-1195.");
      console.error("[foster-apply]", err);
    } finally {
      setSaving(false);
    }
  }

  if (step === "submitted") {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#0f2942", padding: "0 24px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/logo.jpg" alt="MCAS" style={{ height: 40, width: 40, objectFit: "contain", background: "#ececec", borderRadius: 8, padding: 3 }} />
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Morgan County Animal Services</div>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ maxWidth: 520, width: "100%", background: "#fff", borderRadius: 14, padding: "48px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>❤️</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f2942", marginBottom: 8 }}>Application Submitted!</h2>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 20 }}>
              Thank you for wanting to foster with Morgan County Animal Services! Your application will be reviewed and we&rsquo;ll be in touch soon.
            </p>
            <p style={{ fontSize: 13, color: "#94a3b8" }}>
              Questions? Call us at <a href="tel:+17067521195" style={{ color: "#0d9488", fontWeight: 700 }}>(706) 752-1195</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`*{box-sizing:border-box} select,textarea{width:100%;border:1px solid #d1d5db;border-radius:6px;padding:9px 12px;font-size:14px;background:#fff} .yesno{display:flex;gap:8px} .yesno button{flex:1;padding:9px 0;border:2px solid #d1d5db;border-radius:6px;background:#fff;font-size:13px;font-weight:700;cursor:pointer;color:#374151} .yesno button.sel{border-color:#0d9488;background:#f0fdfa;color:#0d9488}`}</style>

      <header style={{ background: "#0f2942", padding: "0 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.jpg" alt="MCAS" style={{ height: 40, width: 40, objectFit: "contain", background: "#ececec", borderRadius: 8, padding: 3 }} />
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>Morgan County Animal Services</div>
              <div style={{ color: "#94a3b8", fontSize: 11 }}>Madison, Georgia</div>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px 60px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f2942", marginBottom: 8 }}>Foster Care Application</h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            Thank you for your interest in fostering! Foster parents are a vital part of our lifesaving mission. Please fill out this application completely — our team will review it and contact you soon.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Personal Info */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>1. Personal Information</h3>
            <Grid2>
              <Field label="First Name" req><input style={inp} value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></Field>
              <Field label="Last Name" req><input style={inp} value={lastName} onChange={(e) => setLastName(e.target.value)} required /></Field>
              <Field label="Date of Birth"><input style={inp} type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
              <Field label="Phone"><input style={inp} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Email"><input style={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            </Grid2>
            <Field label="Street Address"><input style={inp} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Grid2>
              <Field label="City"><input style={inp} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="State">
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP"><input style={inp} value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} /></Field>
            </Grid2>
          </div>

          {/* Housing */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>2. Housing</h3>
            <Grid2>
              <Field label="Do you own or rent?">
                <select value={housing} onChange={(e) => setHousing(e.target.value)}>
                  <option value="">— Select —</option>
                  {HOUSING.map((h) => <option key={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Dwelling type">
                <select value={dwellingType} onChange={(e) => setDwellingType(e.target.value)}>
                  <option value="">— Select —</option>
                  {DWELLING.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </Grid2>
            {housing === "Rent" && (
              <Field label="Does your landlord allow pets / fostering?">
                <div className="yesno">
                  <button type="button" className={landlordPermission === true ? "sel" : ""} onClick={() => setLandlordPermission(true)}>Yes</button>
                  <button type="button" className={landlordPermission === false ? "sel" : ""} onClick={() => setLandlordPermission(false)}>No</button>
                </div>
              </Field>
            )}
            <Field label="Do you have a fenced yard?">
              <div className="yesno">
                <button type="button" className={fencedYard === true ? "sel" : ""} onClick={() => setFencedYard(true)}>Yes</button>
                <button type="button" className={fencedYard === false ? "sel" : ""} onClick={() => setFencedYard(false)}>No</button>
              </div>
            </Field>
            {fencedYard && (
              <Field label="Fence type and height"><input style={inp} value={fenceDetails} onChange={(e) => setFenceDetails(e.target.value)} placeholder="e.g. 6-ft wood privacy fence" /></Field>
            )}
          </div>

          {/* Household */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>3. Your Household</h3>
            <Field label="Other pets in your home (species, breed, age, spay/neuter status)">
              <textarea value={otherPets} onChange={(e) => setOtherPets(e.target.value)} rows={3} placeholder="e.g. 3-year-old male neutered Lab mix, 2-year-old female spayed DSH cat — or 'None'" />
            </Field>
            <Field label="Children in your home (number and ages)">
              <input style={inp} value={children} onChange={(e) => setChildren(e.target.value)} placeholder="e.g. 2 children ages 6 and 10 — or 'None'" />
            </Field>
          </div>

          {/* Foster Preferences */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>4. Foster Preferences</h3>
            <Field label="Animal preference">
              <select value={animalPref} onChange={(e) => setAnimalPref(e.target.value)}>
                <option value="">— Select —</option>
                {ANIMAL_PREFS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Grid2>
              <Field label="Willing to foster special needs animals?">
                <div className="yesno">
                  <button type="button" className={specialNeeds === true ? "sel" : ""} onClick={() => setSpecialNeeds(true)}>Yes</button>
                  <button type="button" className={specialNeeds === false ? "sel" : ""} onClick={() => setSpecialNeeds(false)}>No</button>
                </div>
              </Field>
              <Field label="Willing to bottle-feed neonatal animals?">
                <div className="yesno">
                  <button type="button" className={bottleFeed === true ? "sel" : ""} onClick={() => setBottleFeed(true)}>Yes</button>
                  <button type="button" className={bottleFeed === false ? "sel" : ""} onClick={() => setBottleFeed(false)}>No</button>
                </div>
              </Field>
              <Field label="Maximum animals you can foster at once">
                <select value={maxAnimals} onChange={(e) => setMaxAnimals(e.target.value)}>
                  <option value="">— Select —</option>
                  {["1","2","3","4","5+"].map((n) => <option key={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="How long are you willing to foster?">
                <select value={fosterDuration} onChange={(e) => setFosterDuration(e.target.value)}>
                  <option value="">— Select —</option>
                  {DURATIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
            </Grid2>
          </div>

          {/* Experience */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>5. Experience & Motivation</h3>
            <Field label="Previous foster or rescue experience">
              <textarea value={prevExperience} onChange={(e) => setPrevExperience(e.target.value)} rows={3} placeholder="Describe any experience fostering, volunteering, or working with animals…" />
            </Field>
            <Field label="Why do you want to foster?" req>
              <textarea value={whyFoster} onChange={(e) => setWhyFoster(e.target.value)} rows={4} placeholder="Tell us a bit about yourself and why you'd like to become a foster parent…" />
            </Field>
            <Field label="Veterinarian name and phone">
              <input style={inp} value={vetInfo} onChange={(e) => setVetInfo(e.target.value)} placeholder="e.g. Dr. Smith — Madison Veterinary Clinic (706) 555-0000" />
            </Field>
          </div>

          {/* Emergency Contact */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>6. Emergency Contact</h3>
            <Grid2>
              <Field label="Emergency contact name"><input style={inp} value={ecName} onChange={(e) => setEcName(e.target.value)} /></Field>
              <Field label="Emergency contact phone"><input style={inp} type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} /></Field>
            </Grid2>
          </div>

          {/* Agreement */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 12 }}>7. Foster Agreement</h3>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", fontSize: 13, lineHeight: 1.8, marginBottom: 16, color: "#374151" }}>
              By signing this application, I understand and agree that:
              <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                <li>I will provide proper food, water, shelter, and humane treatment to all foster animals.</li>
                <li>I will not adopt out, sell, give away, or transfer any foster animal to another person.</li>
                <li>I will return the animal to MCAS upon request or at the end of the foster period.</li>
                <li>I will contact MCAS immediately if a foster animal becomes sick, injured, or escapes.</li>
                <li>Morgan County Animal Services retains ownership of all foster animals at all times.</li>
                <li>I will allow MCAS staff to conduct welfare checks of foster animals.</li>
              </ul>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "#0d9488", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#374151" }}>I have read and agree to the foster care agreement above.</span>
            </label>
            <SignaturePad onSign={setSignature} />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !agreed || !signature}
            style={{ width: "100%", padding: "14px 0", background: saving || !agreed || !signature ? "#9ca3af" : "#0d9488", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 16, cursor: saving || !agreed || !signature ? "not-allowed" : "pointer" }}
          >
            {saving ? "Submitting…" : "Submit Foster Application ❤️"}
          </button>
        </form>
      </div>
    </div>
  );
}
