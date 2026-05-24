"use client";
import { useState, useRef } from "react";
import { createFosterApplication } from "@/lib/data";
import { today } from "@/lib/utils";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const ANIMAL_PREFS = ["Dogs","Cats","Both — Dogs and Cats","Puppies / Kittens","Any / No Preference"];
const DURATIONS = ["A few days","1–2 weeks","Several weeks","1–2 months","As long as needed"];
const HOUSING = ["Own","Rent"];
const DWELLING = ["House","Townhouse / Condo","Apartment","Mobile Home","Other"];

function todayDisplay(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ── Signature Pad ─────────────────────────────────────────────────────────────
function SignaturePad({ label, onSign }: { label: string; onSign: (d: string | null) => void }) {
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</label>
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

  // Agreement 1 — Volunteer Agreement & Release
  const [agreeRelease, setAgreeRelease] = useState(false);
  const [agreeSig, setAgreeSig] = useState<string | null>(null);

  // Agreement 2 — Confidentiality Agreement
  const [agreeConf, setAgreeConf] = useState(false);
  const [confidSig, setConfidSig] = useState<string | null>(null);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const fullAddress = [address.trim(), city.trim(), state, zip.trim()].filter(Boolean).join(", ");

  const canSubmit = firstName.trim() && lastName.trim() && agreeRelease && agreeSig && agreeConf && confidSig;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    if (!agreeRelease || !agreeSig)  { setError("Please read and sign the Volunteer Agreement & Release."); return; }
    if (!agreeConf    || !confidSig) { setError("Please read and sign the Confidentiality Agreement."); return; }
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
        agree_to_agreement: agreeRelease,
        agreement_signature: agreeSig || undefined,
        agree_to_confidentiality: agreeConf,
        confidentiality_signature: confidSig || undefined,
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
          <div style={{ maxWidth: 720, margin: "0 auto", height: 64, display: "flex", alignItems: "center" }}>
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
          {/* 1. Personal Info */}
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
              <Field label="State"><select value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="ZIP"><input style={inp} value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} /></Field>
            </Grid2>
          </div>

          {/* 2. Housing */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>2. Housing</h3>
            <Grid2>
              <Field label="Do you own or rent?">
                <select value={housing} onChange={(e) => setHousing(e.target.value)}><option value="">— Select —</option>{HOUSING.map((h) => <option key={h}>{h}</option>)}</select>
              </Field>
              <Field label="Dwelling type">
                <select value={dwellingType} onChange={(e) => setDwellingType(e.target.value)}><option value="">— Select —</option>{DWELLING.map((d) => <option key={d}>{d}</option>)}</select>
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
            {fencedYard && <Field label="Fence type and height"><input style={inp} value={fenceDetails} onChange={(e) => setFenceDetails(e.target.value)} placeholder="e.g. 6-ft wood privacy fence" /></Field>}
          </div>

          {/* 3. Household */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>3. Your Household</h3>
            <Field label="Other pets in your home (species, breed, age, spay/neuter status)">
              <textarea value={otherPets} onChange={(e) => setOtherPets(e.target.value)} rows={3} placeholder="e.g. 3-year-old male neutered Lab mix, 2-year-old female spayed DSH cat — or 'None'" />
            </Field>
            <Field label="Children in your home (number and ages)">
              <input style={inp} value={children} onChange={(e) => setChildren(e.target.value)} placeholder="e.g. 2 children ages 6 and 10 — or 'None'" />
            </Field>
          </div>

          {/* 4. Foster Preferences */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>4. Foster Preferences</h3>
            <Field label="Animal preference">
              <select value={animalPref} onChange={(e) => setAnimalPref(e.target.value)}><option value="">— Select —</option>{ANIMAL_PREFS.map((a) => <option key={a}>{a}</option>)}</select>
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
              <Field label="Maximum animals at once">
                <select value={maxAnimals} onChange={(e) => setMaxAnimals(e.target.value)}><option value="">— Select —</option>{["1","2","3","4","5+"].map((n) => <option key={n}>{n}</option>)}</select>
              </Field>
              <Field label="How long are you willing to foster?">
                <select value={fosterDuration} onChange={(e) => setFosterDuration(e.target.value)}><option value="">— Select —</option>{DURATIONS.map((d) => <option key={d}>{d}</option>)}</select>
              </Field>
            </Grid2>
          </div>

          {/* 5. Experience */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>5. Experience &amp; Motivation</h3>
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

          {/* 6. Emergency Contact */}
          <div style={sect}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 16 }}>6. Emergency Contact</h3>
            <Grid2>
              <Field label="Emergency contact name"><input style={inp} value={ecName} onChange={(e) => setEcName(e.target.value)} /></Field>
              <Field label="Emergency contact phone"><input style={inp} type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} /></Field>
            </Grid2>
          </div>

          {/* 7. Volunteer Agreement & Release */}
          <div style={{ ...sect, border: agreeRelease && agreeSig ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 6, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              7. Volunteer Agreement &amp; Release of All Claims
            </h3>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
              ⚠ You must scroll through and read the full agreement before signing.
            </div>

            <div style={{ height: 300, overflowY: "scroll", border: "1px solid #d1d5db", borderRadius: 8, padding: "16px 18px", background: "#f9fafb", fontSize: 13, lineHeight: 1.8, color: "#1f2937", marginBottom: 18 }}>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Volunteer Agreement &amp; Release of All Claims
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Volunteer Information</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
                  <div><span style={{ color: "#6b7280" }}>Name of Volunteer: </span><span style={{ fontWeight: 600 }}>{fullName || "_________________________"}</span></div>
                  <div><span style={{ color: "#6b7280" }}>Date of Birth: </span><span style={{ fontWeight: 600 }}>{dob || "_________________________"}</span></div>
                  <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#6b7280" }}>Address: </span><span style={{ fontWeight: 600 }}>{fullAddress || "_________________________"}</span></div>
                  <div><span style={{ color: "#6b7280" }}>Phone Number: </span><span style={{ fontWeight: 600 }}>{phone || "_________________________"}</span></div>
                  <div><span style={{ color: "#6b7280" }}>E-mail: </span><span style={{ fontWeight: 600 }}>{email || "_________________________"}</span></div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>Terms and Conditions</div>

                <p style={{ margin: "0 0 12px" }}>
                  I have received a copy of Morgan County Animal Services Volunteer Handbook and Reference Manual and agree to abide by all guidelines, policies, and procedures. I agree to be supervised by the Volunteer Coordinator or their superiors and will directly report to the Volunteer Coordinator. If I fail to abide by the terms of this agreement or am otherwise unable to meet the program requirements. I may be terminated from the volunteer program. I understand that I may at any time with or without cause be removed from my position as a volunteer at the sole discretion of Morgan County Animal Services (MCAS).
                </p>

                <p style={{ margin: "0 0 12px" }}>
                  I understand that I may be handling or may be exposed to animals while providing my volunteer services for MCAS and therefore there exists a risk for personal injury. On behalf of myself, my heirs, personal representatives, and executor, I release, discharge, indemnify and hold harmless Morgan County, MCAS, their agents, servants, and employees from any and all claims, cause of action or demands of any nature or cause connected with my volunteer services at Morgan County Animal Services or elsewhere. This includes any costs, attorney&apos;s fees, and court costs in connection with my volunteer services based on damages or injuries which I may incur in any way while volunteering at the shelter or at another location. Such damages are not limited to but may include animal bites, accidents, injuries, and personal property.
                </p>

                <p style={{ margin: "0 0 12px" }}>
                  I agree to release, discharge, indemnify and hold Morgan County, harmless for any and all damage to my personal property while providing my volunteer services to MCAS, its agents, servants, and employees.
                </p>

                <p style={{ margin: "0 0 12px" }}>
                  In connections with my activities as a MCAS volunteer, I further agree to release, hold harmless, and indemnify Morgan County, their offices, superiors, employees, and agents from any and all claims, damages, and liability arising from my driving or riding while volunteering or while in any motor vehicle owned, operated or leased by MCAS, their officers, superiors, volunteers and agents.
                </p>

                <p style={{ margin: "0 0 12px" }}>
                  I understand that public relations are an important aspect of volunteer work at MCAS. I, therefore, agree on behalf of myself, my heirs, personal representatives, and executors to allow MCAS and its agents to use any photographs, video or film taken of me for use in any public relations efforts including brochures, newspaper articles, newsletters, Facebook, website, etc.
                </p>

                <p style={{ margin: "0 0 0", fontWeight: 700, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                  I (print name) <span style={{ fontStyle: "italic", textDecoration: "underline" }}>{fullName || "________________________________"}</span> HAVE READ AND FULLY UNDERSTAND THE TERMS AND CONDITIONS OF THIS VOLUNTEER AGREEMENT AND I WILLINGLY COMPLY WITH ALL OF ITS CONDITIONS.
                </p>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 18 }}>
              <input type="checkbox" checked={agreeRelease} onChange={(e) => setAgreeRelease(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "#0d9488", flexShrink: 0 }} />
              <span><strong>I have read and agree to the Volunteer Agreement &amp; Release of All Claims</strong> as stated above.</span>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Printed Name">
                <input style={{ ...inp, background: "#f9fafb" }} value={fullName} readOnly placeholder="Auto-filled from name above" />
              </Field>
              <Field label="Date">
                <input style={{ ...inp, background: "#f9fafb" }} value={todayDisplay()} readOnly />
              </Field>
            </div>

            <SignaturePad label="Signature *" onSign={setAgreeSig} />

            {agreeRelease && agreeSig && (
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ Agreement signed</div>
            )}
          </div>

          {/* 8. Confidentiality Agreement */}
          <div style={{ ...sect, border: agreeConf && confidSig ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 6, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              8. Volunteer Confidentiality Agreement
            </h3>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
              ⚠ You must scroll through and read the full agreement before signing.
            </div>

            <div style={{ height: 300, overflowY: "scroll", border: "1px solid #d1d5db", borderRadius: 8, padding: "16px 18px", background: "#f9fafb", fontSize: 13, lineHeight: 1.8, color: "#1f2937", marginBottom: 18 }}>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Volunteer Confidentiality Agreement
              </div>

              <p style={{ margin: "0 0 12px" }}>
                For the mutual benefit of Morgan County Animal Services and the volunteer, and in consideration of the volunteer&apos;s execution of this agreement, the volunteer shall have access to and receive, in part or in whole, information and data considered as confidential information. Wherever &ldquo;Morgan County Animal Services&rdquo; as used in this Agreement is understood to mean Morgan County, a political subdivision of the State of Georgia.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                Confidential information is defined herein and shall be construed as and applied as to include, without limitation, documents, case information, any data in the shelter database, customer and prospective customer information, programs, specifications, and any and all information in relation to marketing, sales, financials, and forecasts, and other intellectual property, collectively referred hereunder as confidential information, and that shall be accessed, received and used exclusively for the furtherance of Morgan County Animal Services and in connection with the performance of the job duties of the volunteer.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                The volunteer will hold confidential information of Morgan County Animal Services that is indirectly or directly accessed, received, and used in strict confidence up to the extent permissible by local, state, and federal law and public policy, regarding the disclosure of confidential information. Volunteer shall exercise a reasonable degree of care to prevent unauthorized disclosure of confidential information to others including, but not limited to, other volunteers of Morgan County Animal Services, non-affiliated individuals of Morgan County Animal Services, or any other individual, collectively referred hereunder as &ldquo;others&rdquo; that does not have express privileges to such confidential information.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                The volunteer will not disclose or divulge, either directly or indirectly, the confidential information to others unless express written authorization to do so is received in advance by the Director or Manager or other authorized representative of Morgan County Animal Services. The volunteer will not reproduce the confidential information nor use the confidential information commercially or for any purpose other than for the performance of the job duties that are for the furtherance of Morgan County Animal Services. The volunteer will, immediately upon the request or upon the voluntary or involuntary termination of the volunteer&apos;s active position and status with Morgan County Animal Services, return to Morgan County Animal Services any and all confidential information in the volunteer&apos;s possession, as well as return to Morgan County Animal Services any property or other items, information, and data in the volunteer&apos;s possession that is the property of Morgan County Animal Services or is considered confidential information and for the furtherance of Morgan County Animal Services.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                Morgan County Animal Services shall have and retain the sole right to determine the treatment of any information that is in connection, in part or in whole, with Morgan County Animal Services processes, services, and business operations received from the volunteer, or to follow any other procedure as Morgan County Animal Services may deem appropriate.
              </p>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                <div style={{ marginBottom: 8 }}><span style={{ color: "#6b7280" }}>Volunteer Name: </span><span style={{ fontWeight: 600 }}>{fullName || "_________________________"}</span></div>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 18 }}>
              <input type="checkbox" checked={agreeConf} onChange={(e) => setAgreeConf(e.target.checked)} style={{ marginTop: 2, width: 16, height: 16, accentColor: "#0d9488", flexShrink: 0 }} />
              <span><strong>I have read and agree to the Volunteer Confidentiality Agreement</strong> as stated above.</span>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Printed Name">
                <input style={{ ...inp, background: "#f9fafb" }} value={fullName} readOnly placeholder="Auto-filled from name above" />
              </Field>
              <Field label="Date">
                <input style={{ ...inp, background: "#f9fafb" }} value={todayDisplay()} readOnly />
              </Field>
            </div>

            <SignaturePad label="Signature *" onSign={setConfidSig} />

            {agreeConf && confidSig && (
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ Confidentiality agreement signed</div>
            )}
          </div>

          {/* Checklist summary */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f2942" }}>Before submitting, confirm:</div>
            {[
              [!!(firstName.trim() && lastName.trim()), "Name completed"],
              [!!agreeRelease, "Volunteer Agreement & Release read"],
              [!!agreeSig, "Volunteer Agreement signed"],
              [!!agreeConf, "Confidentiality Agreement read"],
              [!!confidSig, "Confidentiality Agreement signed"],
            ].map(([done, label]) => (
              <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 13, color: done ? "#16a34a" : "#94a3b8" }}>
                <span style={{ fontSize: 16 }}>{done ? "✓" : "○"}</span>
                {String(label)}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !canSubmit}
            style={{ width: "100%", padding: "14px 0", background: saving || !canSubmit ? "#9ca3af" : "#0d9488", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 16, cursor: saving || !canSubmit ? "not-allowed" : "pointer" }}
          >
            {saving ? "Submitting…" : "Submit Foster Application ❤️"}
          </button>
          <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 12 }}>
            Both agreements must be checked and signed before submitting.
          </p>
        </form>
      </div>
    </div>
  );
}
