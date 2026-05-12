"use client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createVolunteerApplication } from "@/lib/data";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const INTEREST_OPTIONS = [
  "Dog Walking",
  "Cat Socialization",
  "Kennel Cleaning",
  "Administrative / Office Support",
  "Photography",
  "Transport",
  "Animal Training",
  "Events & Fundraising",
  "Laundry / Dishes",
  "Foster Care",
  "Other",
];

function todayStr() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function isUnder18(dob: string): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  const now   = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age < 18;
}

// ── Signature Pad ──────────────────────────────────────────────────────────────

interface SigPadProps {
  label: string;
  onSign: (dataUrl: string | null) => void;
}

function SignaturePad({ label, onSign }: SigPadProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const lastPos    = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty,  setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function getPos(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width  / rect.width),
      y: (clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function beginStroke(x: number, y: number) {
    drawing.current = true;
    lastPos.current = { x, y };
  }

  function continueStroke(x: number, y: number) {
    if (!drawing.current || !lastPos.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.strokeStyle = "#0f2942";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPos.current = { x, y };
    setIsEmpty(false);
    onSign(canvasRef.current.toDataURL());
  }

  function endStroke() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clearPad() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onSign(null);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ ...labelStyle, color: "#0f2942" }}>{label}</label>
        {!isEmpty && (
          <button type="button" onClick={clearPad} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
            ✕ Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={740}
        height={120}
        style={{
          border: "2px solid #d1d5db",
          borderRadius: 6,
          touchAction: "none",
          background: "#fafafa",
          display: "block",
          width: "100%",
          height: 120,
          cursor: "crosshair",
        }}
        onMouseDown={(e) => { const p = getPos(e.clientX, e.clientY); beginStroke(p.x, p.y); }}
        onMouseMove={(e) => { const p = getPos(e.clientX, e.clientY); continueStroke(p.x, p.y); }}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); beginStroke(p.x, p.y); }}
        onTouchMove={(e)  => { e.preventDefault(); const t = e.touches[0]; const p = getPos(t.clientX, t.clientY); continueStroke(p.x, p.y); }}
        onTouchEnd={endStroke}
      />
      {isEmpty && (
        <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 5, fontStyle: "italic" }}>
          Draw your signature above using your mouse or finger
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function VolunteerApplyPage() {
  const [step,   setStep]   = useState<"form" | "submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // Personal info
  const [firstName,  setFirstName]  = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName,   setLastName]   = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [address,    setAddress]    = useState("");
  const [city,       setCity]       = useState("");
  const [state,      setState]      = useState("GA");
  const [zip,        setZip]        = useState("");
  const [dob,        setDob]        = useState("");
  const [sex,        setSex]        = useState("");

  // Emergency contact
  const [ecName,  setEcName]  = useState("");
  const [ecPhone, setEcPhone] = useState("");

  // Application details
  const [interests,    setInterests]    = useState<string[]>([]);
  const [availability, setAvailability] = useState("");
  const [hasAnimals,   setHasAnimals]   = useState<boolean | null>(null);
  const [priorExp,     setPriorExp]     = useState("");
  const [whyVolunteer, setWhyVolunteer] = useState("");

  // Agreement checkboxes
  const [agreeRelease, setAgreeRelease] = useState(false);
  const [agreeConf,    setAgreeConf]    = useState(false);

  // Signatures
  const [agreeSig,   setAgreeSig]   = useState<string | null>(null);
  const [confidSig,  setConfidSig]  = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [parentSig,  setParentSig]  = useState<string | null>(null);

  const isMinor = useMemo(() => isUnder18(dob), [dob]);
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

  const handleAgreeSig  = useCallback((d: string | null) => setAgreeSig(d),  []);
  const handleConfidSig = useCallback((d: string | null) => setConfidSig(d), []);
  const handleParentSig = useCallback((d: string | null) => setParentSig(d), []);

  function toggleInterest(item: string) {
    setInterests((prev) => prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]);
  }

  const canSubmit =
    firstName.trim() && lastName.trim() &&
    agreeRelease && agreeSig &&
    agreeConf && confidSig &&
    (!isMinor || (parentSig && parentName.trim()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    if (!agreeRelease || !agreeSig) { setError("Please sign the Volunteer Agreement & Release."); return; }
    if (!agreeConf || !confidSig)   { setError("Please sign the Volunteer Confidentiality Agreement."); return; }
    if (isMinor && (!parentSig || !parentName.trim())) {
      setError("Parent/guardian signature and name are required for applicants under 18.");
      return;
    }

    setSaving(true);
    try {
      await createVolunteerApplication({
        status: "pending",
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state || undefined,
        zip: zip.trim() || undefined,
        dob: dob || undefined,
        sex: sex || undefined,
        emergency_contact_name: ecName.trim() || undefined,
        emergency_contact_phone: ecPhone.trim() || undefined,
        interests,
        availability: availability || undefined,
        has_animals: hasAnimals ?? undefined,
        prior_experience: priorExp.trim() || undefined,
        why_volunteer: whyVolunteer.trim() || undefined,
        agree_to_terms: agreeRelease,
        agree_to_conduct: agreeConf,
        signature_name: fullName || undefined,
        agreement_signature: agreeSig || undefined,
        confidentiality_signature: confidSig || undefined,
        parent_guardian_name: parentName.trim() || undefined,
        parent_guardian_signature: parentSig || undefined,
      });
      setStep("submitted");
    } catch (err) {
      setError("Failed to submit application. Please try again or contact us directly.");
      console.error("[volunteer-apply]", err);
    } finally {
      setSaving(false);
    }
  }

  if (step === "submitted") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
          <div style={{ maxWidth: 520, width: "100%", background: "#fff", borderRadius: 14, padding: "48px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,.10)" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f2942", margin: "0 0 12px" }}>Application Submitted!</h2>
            <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: "0 0 24px" }}>
              Thank you for applying to volunteer with <strong>Morgan County Animal Services</strong>.
              Our team will review your application and reach out to you at the contact information you provided.
            </p>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#15803d", marginBottom: 6 }}>What happens next?</div>
              <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#374151", lineHeight: 2 }}>
                <li>Staff will review your application within 3–5 business days</li>
                <li>You will receive an email with next steps or a welcome message</li>
                <li>Approved volunteers receive a Volunteer ID (PID) and orientation instructions</li>
              </ul>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              Questions? Call us at <strong>(706) 752-1195</strong> or visit us at<br />
              2392 Athens Hwy, Madison, GA 30650
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ flex: 1, maxWidth: 820, width: "100%", margin: "0 auto", padding: "32px 16px" }}>

        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1d4ed8", marginBottom: 4 }}>Join Our Volunteer Team</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            Morgan County Animal Services depends on dedicated volunteers to care for animals in our shelter.
            Complete this application — including reading and signing both legal agreements — and our team will reach out to get you started.
            Volunteering is open to individuals 16 years and older (minors require a parent/guardian co-signature below).
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Personal Info ── */}
          <Section title="1. Personal Information">
            <div style={grid3}>
              <Field label="First Name *"><input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First" /></Field>
              <Field label="Middle Name"><input style={input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle" /></Field>
              <Field label="Last Name *"><input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last" /></Field>
            </div>
            <div style={grid2}>
              <Field label="Email Address"><input type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
              <Field label="Phone Number"><input type="tel" style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(706) 555-0000" /></Field>
            </div>
            <Field label="Street Address"><input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" /></Field>
            <div style={grid3}>
              <Field label="City"><input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madison" /></Field>
              <Field label="State">
                <select style={input} value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP"><input style={input} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="30650" maxLength={10} /></Field>
            </div>
            <div style={grid2}>
              <Field label="Date of Birth">
                <input type="date" style={input} value={dob} onChange={(e) => setDob(e.target.value)} />
                {isMinor && dob && <div style={{ fontSize: 12, color: "#d97706", marginTop: 4, fontWeight: 600 }}>⚠ Under 18 — parent/guardian signature required below</div>}
              </Field>
              <Field label="Sex">
                <select style={input} value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">— Select —</option>
                  <option>Male</option><option>Female</option><option>Prefer not to say</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Section 2: Emergency Contact ── */}
          <Section title="2. Emergency Contact">
            <div style={grid2}>
              <Field label="Emergency Contact Name"><input style={input} value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Full name" /></Field>
              <Field label="Emergency Contact Phone"><input type="tel" style={input} value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="(706) 555-0000" /></Field>
            </div>
          </Section>

          {/* ── Section 3: Interests & Availability ── */}
          <Section title="3. Volunteer Interests & Availability">
            <div>
              <label style={labelStyle}>Areas of Interest (check all that apply)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px 16px", marginTop: 8 }}>
                {INTEREST_OPTIONS.map((item) => (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={interests.includes(item)} onChange={() => toggleInterest(item)} style={{ width: 16, height: 16, accentColor: "#1a8a8a" }} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Availability">
              <select style={input} value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option value="">— Select —</option>
                <option>Weekdays</option><option>Weekends</option><option>Both Weekdays & Weekends</option><option>Flexible</option>
              </select>
            </Field>
            <div>
              <label style={labelStyle}>Do you currently own or care for pets?</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                {["Yes", "No"].map((val) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input type="radio" name="hasAnimals" checked={hasAnimals === (val === "Yes")} onChange={() => setHasAnimals(val === "Yes")} style={{ accentColor: "#1a8a8a" }} />
                    {val}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Section 4: Experience & Motivation ── */}
          <Section title="4. Experience & Motivation">
            <Field label="Prior animal care or volunteer experience (optional)">
              <textarea style={{ ...input, height: 90, resize: "vertical" }} value={priorExp} onChange={(e) => setPriorExp(e.target.value)} placeholder="Describe any relevant experience…" />
            </Field>
            <Field label="Why do you want to volunteer with Morgan County Animal Services?">
              <textarea style={{ ...input, height: 90, resize: "vertical" }} value={whyVolunteer} onChange={(e) => setWhyVolunteer(e.target.value)} placeholder="Tell us what motivates you to volunteer…" />
            </Field>
          </Section>

          {/* ── Agreement 1: Volunteer Agreement & Release ── */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)", border: agreeRelease && agreeSig ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 6, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              5. Volunteer Agreement &amp; Release of All Claims
            </div>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
              ⚠ You must scroll through and read the full agreement before signing.
            </div>

            {/* Scrollable agreement text */}
            <div style={{ height: 300, overflowY: "scroll", border: "1px solid #d1d5db", borderRadius: 8, padding: "16px 18px", background: "#f9fafb", fontSize: 13, lineHeight: 1.8, color: "#1f2937", marginBottom: 18 }}>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Volunteer Agreement &amp; Release of All Claims
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Volunteer Information</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px", fontSize: 13 }}>
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
                  I understand that I may be handling or may be exposed to animals while providing my volunteer services for MCAS and therefore there exists a risk for personal injury. On behalf of myself, my heirs, personal representatives, and executor, I release, discharge, indemnify and hold harmless Morgan County, MCAS, their agents, servants, and employees from any and all claims, cause of action or demands of any nature or cause connected with my volunteer services at Morgan County Animal Services or elsewhere. This includes any costs, attorney's fees, and court costs in connection with my volunteer services based on damages or injuries which I may incur in any way while volunteering at the shelter or at another location. Such damages are not limited to but may include animal bites, accidents, injuries, and personal property.
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

            {/* Checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 18 }}>
              <input type="checkbox" checked={agreeRelease} onChange={(e) => setAgreeRelease(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }} />
              <span><strong>I have read and agree to the Volunteer Agreement &amp; Release of All Claims</strong> as stated above.</span>
            </label>

            {/* Printed name + signature + date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Printed Name">
                <input style={{ ...input, background: "#f9fafb" }} value={fullName} readOnly placeholder="Auto-filled from name above" />
              </Field>
              <Field label="Date">
                <input style={{ ...input, background: "#f9fafb" }} value={todayStr()} readOnly />
              </Field>
            </div>

            <SignaturePad
              label="Volunteer Signature *"
              onSign={handleAgreeSig}
            />

            {agreeRelease && agreeSig && (
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ Agreement signed</div>
            )}

            {/* Minor / Parent section */}
            {isMinor && dob && (
              <div style={{ marginTop: 22, borderTop: "2px dashed #fcd34d", paddingTop: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 10 }}>
                  ⚠ Parent / Legal Guardian Release
                </div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                  As the parent or legal guardian of <strong>{fullName || "the above-named volunteer"}</strong>, the above-named volunteer, I give my full consent to allow my child or ward to volunteer for Morgan County Animal Services and its agents described in the above volunteer contract. I have read and fully understand the terms and conditions in this volunteer contract. On behalf of myself and my child or ward, I agree to all the terms and conditions outlined in this volunteer contract. I understand that a parent or legal guardian must accompany the above-named individual at all times while volunteering and I am responsible at all times for the actions of my child or ward while volunteering.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <Field label="Parent/Guardian Printed Name *">
                    <input style={input} value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Full legal name" />
                  </Field>
                  <Field label="Date">
                    <input style={{ ...input, background: "#f9fafb" }} value={todayStr()} readOnly />
                  </Field>
                </div>
                <SignaturePad
                  label="Parent/Guardian Signature *"
                  onSign={handleParentSig}
                />
                {parentSig && parentName.trim() && (
                  <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ Parent/Guardian signature provided</div>
                )}
              </div>
            )}
          </div>

          {/* ── Agreement 2: Confidentiality Agreement ── */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)", border: agreeConf && confidSig ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 6, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              6. Volunteer Confidentiality Agreement
            </div>
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, marginBottom: 12 }}>
              ⚠ You must scroll through and read the full agreement before signing.
            </div>

            {/* Scrollable agreement text */}
            <div style={{ height: 300, overflowY: "scroll", border: "1px solid #d1d5db", borderRadius: 8, padding: "16px 18px", background: "#f9fafb", fontSize: 13, lineHeight: 1.8, color: "#1f2937", marginBottom: 18 }}>
              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 14, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Volunteer Confidentiality Agreement
              </div>

              <p style={{ margin: "0 0 12px" }}>
                For the mutual benefit of Morgan County Animal Services and the volunteer, and in consideration of the volunteer's execution of this agreement, the volunteer shall have access to and receive, in part or in whole, information and data considered as confidential information. Wherever "Morgan County Animal Services" as used in this Agreement is understood to mean Morgan County, a political subdivision of the State of Georgia.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                Confidential information is defined herein and shall be construed as and applied as to include, without limitation, documents, case information, any data in the shelter database, customer and prospective customer information, programs, specifications, and any and all information in relation to marketing, sales, financials, and forecasts, and other intellectual property, collectively referred hereunder as confidential information, and that shall be accessed, received and used exclusively for the furtherance of Morgan County Animal Services and in connection with the performance of the job duties of the volunteer.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                The volunteer will hold confidential information of Morgan County Animal Services that is indirectly or directly accessed, received, and used in strict confidence up to the extent permissible by local, state, and federal law and public policy, regarding the disclosure of confidential information. Volunteer shall exercise a reasonable degree of care to prevent unauthorized disclosure of confidential information to others including, but not limited to, other volunteers of Morgan County Animal Services, non-affiliated individuals of Morgan County Animal Services, or any other individual, collectively referred hereunder as "others" that does not have express privileges to such confidential information.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                The volunteer will not disclose or divulge, either directly or indirectly, the confidential information to others unless express written authorization to do so is received in advance by the Director or Manager or other authorized representative of Morgan County Animal Services. The volunteer will not reproduce the confidential information nor use the confidential information commercially or for any purpose other than for the performance of the job duties that are for the furtherance of Morgan County Animal Services. The volunteer will, immediately upon the request or upon the voluntary or involuntary termination of the volunteer's active position and status with Morgan County Animal Services, return to Morgan County Animal Services any and all confidential information in the volunteer's possession, as well as return to Morgan County Animal Services any property or other items, information, and data in the volunteer's possession that is the property of Morgan County Animal Services or is considered confidential information and for the furtherance of Morgan County Animal Services.
              </p>

              <p style={{ margin: "0 0 12px" }}>
                Morgan County Animal Services shall have and retain the sole right to determine the treatment of any information that is in connection, in part or in whole, with Morgan County Animal Services processes, services, and business operations received from the volunteer, or to follow any other procedure as Morgan County Animal Services may deem appropriate.
              </p>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                <div style={{ marginBottom: 8 }}><span style={{ color: "#6b7280" }}>Volunteer Name: </span><span style={{ fontWeight: 600 }}>{fullName || "_________________________"}</span></div>
              </div>
            </div>

            {/* Checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 18 }}>
              <input type="checkbox" checked={agreeConf} onChange={(e) => setAgreeConf(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }} />
              <span><strong>I have read and agree to the Volunteer Confidentiality Agreement</strong> as stated above.</span>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Volunteer Name">
                <input style={{ ...input, background: "#f9fafb" }} value={fullName} readOnly placeholder="Auto-filled from name above" />
              </Field>
              <Field label="Date">
                <input style={{ ...input, background: "#f9fafb" }} value={todayStr()} readOnly />
              </Field>
            </div>

            <SignaturePad
              label="Volunteer Signature *"
              onSign={handleConfidSig}
            />

            {agreeConf && confidSig && (
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 8 }}>✓ Confidentiality agreement signed</div>
            )}
          </div>

          {/* Readiness summary */}
          <div style={{ background: "#fff", borderRadius: 10, padding: "16px 20px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#0f2942" }}>Checklist before submitting:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { done: !!(firstName.trim() && lastName.trim()), label: "Personal information completed" },
                { done: agreeRelease && !!agreeSig, label: "Volunteer Agreement & Release signed" },
                { done: agreeConf && !!confidSig, label: "Confidentiality Agreement signed" },
                ...(isMinor && dob ? [{ done: !!(parentSig && parentName.trim()), label: "Parent/Guardian signature provided" }] : []),
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

          <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 40 }}>
            <button
              type="submit"
              disabled={saving || !canSubmit}
              style={{
                background: canSubmit ? "#1a8a8a" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 36px",
                fontSize: 16,
                fontWeight: 800,
                cursor: canSubmit ? "pointer" : "not-allowed",
                letterSpacing: 0.3,
                opacity: saving ? 0.8 : 1,
              }}
            >
              {saving ? "Submitting…" : "Submit Application →"}
            </button>
          </div>

        </form>
      </div>

      <Footer />
    </div>
  );
}

// ── Layout sub-components ─────────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ background: "#0f2942" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, background: "#ececec", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🐾</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.3 }}>Morgan County Animal Services</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginTop: 1 }}>Volunteer Application</div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ background: "#1f2937", padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.8 }}>
        Morgan County Animal Services &nbsp;·&nbsp; 2392 Athens Hwy, Madison, GA 30650<br />
        Phone: (706) 752-1195 &nbsp;·&nbsp; ShelterTrace v1.0 · Shelter Data Systems
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151" };
const input: React.CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, color: "#111827", background: "#fff", boxSizing: "border-box", outline: "none" };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 };
