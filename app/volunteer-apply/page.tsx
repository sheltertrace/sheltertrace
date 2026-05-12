"use client";
import { useState } from "react";
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

export default function VolunteerApplyPage() {
  const [step,      setStep]      = useState<"form" | "submitted">("form");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

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
  const [interests,     setInterests]     = useState<string[]>([]);
  const [availability,  setAvailability]  = useState("");
  const [hasAnimals,    setHasAnimals]    = useState<boolean | null>(null);
  const [priorExp,      setPriorExp]      = useState("");
  const [whyVolunteer,  setWhyVolunteer]  = useState("");

  // Agreements
  const [agreeTerms,   setAgreeTerms]   = useState(false);
  const [agreeConduct, setAgreeConduct] = useState(false);
  const [sigName,      setSigName]      = useState("");

  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!agreeTerms || !agreeConduct) {
      setError("You must agree to all terms before submitting.");
      return;
    }
    if (!sigName.trim()) {
      setError("Please type your full name as your digital signature.");
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
        agree_to_terms: agreeTerms,
        agree_to_conduct: agreeConduct,
        signature_name: sigName.trim(),
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
            <h2 style={{ fontSize: 26, fontWeight: 900, color: "#0f2942", margin: "0 0 12px" }}>
              Application Submitted!
            </h2>
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

      <div style={{ flex: 1, maxWidth: 780, width: "100%", margin: "0 auto", padding: "32px 16px" }}>

        {/* Intro card */}
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1d4ed8", marginBottom: 4 }}>
            Join Our Volunteer Team
          </div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            Morgan County Animal Services depends on dedicated volunteers to care for animals in our shelter.
            Complete this application and our team will reach out to get you started.
            Volunteering is open to individuals 16 years and older (minors require a parent/guardian signature on orientation day).
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Personal Info ── */}
          <Section title="1. Personal Information">
            <div style={grid3}>
              <Field label="First Name *">
                <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First" />
              </Field>
              <Field label="Middle Name">
                <input style={input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle" />
              </Field>
              <Field label="Last Name *">
                <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last" />
              </Field>
            </div>
            <div style={grid2}>
              <Field label="Email Address">
                <input type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label="Phone Number">
                <input type="tel" style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(706) 555-0000" />
              </Field>
            </div>
            <Field label="Street Address">
              <input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
            </Field>
            <div style={grid3}>
              <Field label="City">
                <input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madison" />
              </Field>
              <Field label="State">
                <select style={input} value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP">
                <input style={input} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="30650" maxLength={10} />
              </Field>
            </div>
            <div style={grid2}>
              <Field label="Date of Birth">
                <input type="date" style={input} value={dob} onChange={(e) => setDob(e.target.value)} />
              </Field>
              <Field label="Sex">
                <select style={input} value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">— Select —</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── Section 2: Emergency Contact ── */}
          <Section title="2. Emergency Contact">
            <div style={grid2}>
              <Field label="Emergency Contact Name">
                <input style={input} value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Emergency Contact Phone">
                <input type="tel" style={input} value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="(706) 555-0000" />
              </Field>
            </div>
          </Section>

          {/* ── Section 3: Volunteer Interests ── */}
          <Section title="3. Volunteer Interests & Availability">
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Areas of Interest (check all that apply)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px 16px", marginTop: 8 }}>
                {INTEREST_OPTIONS.map((item) => (
                  <label key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={interests.includes(item)}
                      onChange={() => toggleInterest(item)}
                      style={{ width: 16, height: 16, accentColor: "#1a8a8a" }}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Availability">
              <select style={input} value={availability} onChange={(e) => setAvailability(e.target.value)}>
                <option value="">— Select —</option>
                <option>Weekdays</option>
                <option>Weekends</option>
                <option>Both Weekdays & Weekends</option>
                <option>Flexible</option>
              </select>
            </Field>
            <div>
              <label style={labelStyle}>Do you currently own or care for pets?</label>
              <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
                {["Yes", "No"].map((val) => (
                  <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="hasAnimals"
                      checked={hasAnimals === (val === "Yes")}
                      onChange={() => setHasAnimals(val === "Yes")}
                      style={{ accentColor: "#1a8a8a" }}
                    />
                    {val}
                  </label>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Section 4: Experience & Motivation ── */}
          <Section title="4. Experience & Motivation">
            <Field label="Prior animal care or volunteer experience (optional)">
              <textarea
                style={{ ...input, height: 90, resize: "vertical" }}
                value={priorExp}
                onChange={(e) => setPriorExp(e.target.value)}
                placeholder="Describe any relevant experience working with animals, volunteering, or related skills…"
              />
            </Field>
            <Field label="Why do you want to volunteer with Morgan County Animal Services?">
              <textarea
                style={{ ...input, height: 90, resize: "vertical" }}
                value={whyVolunteer}
                onChange={(e) => setWhyVolunteer(e.target.value)}
                placeholder="Tell us what motivates you to volunteer…"
              />
            </Field>
          </Section>

          {/* ── Section 5: Agreements ── */}
          <Section title="5. Agreements & Signature">
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 14, fontSize: 13, color: "#374151", lineHeight: 1.7, maxHeight: 180, overflowY: "auto" }}>
              <strong>Volunteer Terms & Conditions:</strong> I understand that volunteering with Morgan County Animal Services is a privilege and that I am subject to the rules and guidelines established by the shelter. I agree to treat all animals humanely and with respect. I understand that animal handling involves inherent risks and I accept responsibility for following all safety protocols. I agree to maintain the confidentiality of shelter operations, donor information, and any personally identifiable information I may encounter. I understand that failure to comply with shelter policies may result in removal from the volunteer program. I agree to provide accurate information on this application.
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }}
              />
              <span>I have read and agree to the <strong>Volunteer Terms & Conditions</strong> stated above.</span>
            </label>

            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 14, fontSize: 13, color: "#374151", lineHeight: 1.7, maxHeight: 160, overflowY: "auto" }}>
              <strong>Code of Conduct:</strong> As a volunteer I agree to: arrive on time and notify staff if I cannot make a scheduled shift; follow all staff instructions; never remove animals from the shelter without authorization; report any animal health concerns or injuries to staff immediately; refrain from using personal social media to post photos or information about animals without written permission; treat staff, other volunteers, and members of the public with courtesy and respect; never administer medications or perform medical procedures unless specifically authorized and trained.
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 20 }}>
              <input
                type="checkbox"
                checked={agreeConduct}
                onChange={(e) => setAgreeConduct(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }}
              />
              <span>I have read and agree to the <strong>Volunteer Code of Conduct</strong> stated above.</span>
            </label>

            <Field label="Digital Signature — Type your full legal name to sign *">
              <input
                style={{ ...input, fontStyle: "italic", fontSize: 16 }}
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                placeholder="Your full legal name"
              />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                By typing your name above, you are providing a legally binding digital signature.
              </div>
            </Field>
          </Section>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: "#dc2626", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 40 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: saving ? "#9ca3af" : "#1a8a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 36px",
                fontSize: 16,
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                letterSpacing: 0.3,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ background: "#0f2942", padding: "0" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, background: "#ececec", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          🐾
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.3 }}>
            Morgan County Animal Services
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginTop: 1 }}>
            Volunteer Application
          </div>
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
      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 14,
  color: "#111827",
  background: "#fff",
  boxSizing: "border-box",
  outline: "none",
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 14,
};
