"use client";
import { useState } from "react";
import { createWitnessStatement } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import DragDropUpload, { FilePreview } from "@/components/ui/DragDropUpload";
import DateInput from "@/components/ui/DateInput";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE, COUNTY_NAME } from "@/lib/shelterInfo";

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Images/HEIC/PDF cap at 10MB, video (mp4/mov) gets more room at 25MB.
const ATTACHMENT_ACCEPT = "image/*,application/pdf,video/mp4,video/quicktime,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.mp4,.mov";
const ATTACHMENT_ACCEPT_LABEL = "JPG, PNG, HEIC, GIF, PDF, MP4, MOV";
function attachmentMaxMB(file: File): number {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isVideo = file.type.toLowerCase().startsWith("video/") || ext === "mp4" || ext === "mov";
  return isVideo ? 25 : 10;
}

const MIN_STATEMENT_LENGTH = 50;

function todayStr() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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

export default function WitnessStatementPage() {
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refNumber, setRefNumber] = useState("");

  // Witness information
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [email, setEmail]         = useState("");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [state, setState]         = useState("GA");
  const [zip, setZip]             = useState("");
  const [preferredContact, setPreferredContact] = useState("Phone");

  // Incident information
  const [incidentDate, setIncidentDate]         = useState("");
  const [incidentTime, setIncidentTime]         = useState("");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [caseNumber, setCaseNumber]             = useState("");

  // Statement
  const [statement, setStatement] = useState("");
  const [files, setFiles]         = useState<File[]>([]);

  // Certification
  const [certified, setCertified]         = useState(false);
  const [typedSignature, setTypedSignature] = useState("");

  const addFiles = (newFiles: File[]) => setFiles((prev) => [...prev, ...newFiles]);
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim()) { setError("First and last name are required."); return; }
    if (!phone.trim()) { setError("Phone number is required."); return; }
    if (!incidentDate) { setError("Date of incident is required."); return; }
    if (!incidentLocation.trim()) { setError("Location/address of the incident is required."); return; }
    if (statement.trim().length < MIN_STATEMENT_LENGTH) {
      setError(`Statement must be at least ${MIN_STATEMENT_LENGTH} characters (currently ${statement.trim().length}).`);
      return;
    }
    if (!certified) { setError("Please check the certification box before submitting."); return; }
    if (!typedSignature.trim()) { setError("Please type your full legal name as your signature."); return; }

    setSaving(true);
    try {
      const folder = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const attachments = [];
      for (const file of files) {
        const path = `${folder}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("witness-attachments").upload(path, file, { upsert: false });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("witness-attachments").getPublicUrl(path);
          attachments.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size });
        }
      }

      const created = await createWitnessStatement({
        witness_first_name: firstName.trim(),
        witness_last_name: lastName.trim(),
        witness_phone: phone.trim(),
        witness_email: email.trim() || undefined,
        witness_address: address.trim() || undefined,
        witness_city: city.trim() || undefined,
        witness_state: state || undefined,
        witness_zip: zip.trim() || undefined,
        preferred_contact: preferredContact || undefined,
        incident_date: incidentDate || undefined,
        incident_time: incidentTime.trim() || undefined,
        incident_location: incidentLocation.trim(),
        provided_case_number: caseNumber.trim() || undefined,
        statement: statement.trim(),
        attachments,
        certified,
        typed_signature: typedSignature.trim(),
      });

      setRefNumber(created.reference_number);
      setStep("submitted");
    } catch (err) {
      console.error("[witness-statement] submission failed:", err);
      const message =
        err instanceof Error ? err.message :
        typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) :
        String(err);
      setError(`Submission failed: ${message}`);
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
            <div style={{ fontSize: 56, marginBottom: 16 }}>📝</div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#0f2942", margin: "0 0 12px" }}>Statement Submitted</h2>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#166534", marginBottom: 16, fontFamily: "monospace", background: "#dcfce7", display: "inline-block", padding: "8px 18px", borderRadius: 8 }}>
              {refNumber}
            </div>
            <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.7, margin: "0 0 8px" }}>
              Your witness statement has been submitted. Reference #: <strong>{refNumber}</strong>.
            </p>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: 0 }}>
              {AGENCY_NAME} will contact you if additional information is needed.
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
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1d4ed8", marginBottom: 4 }}>Submit a Witness Statement</div>
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
            If you witnessed an animal-related incident in {COUNTY_NAME}, you may submit a written statement below.
            Your statement will be reviewed by {AGENCY_NAME} and attached to the related case.
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* ── Witness Information ── */}
          <Section title="Witness Information">
            <div style={grid3}>
              <Field label="First Name *"><input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First" /></Field>
              <Field label="Last Name *"><input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last" /></Field>
              <Field label="Phone *"><input type="tel" style={input} value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(706) 555-0000" /></Field>
            </div>
            <div style={grid2}>
              <Field label="Email"><input type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
              <Field label="Preferred Contact Method">
                <select style={input} value={preferredContact} onChange={(e) => setPreferredContact(e.target.value)}>
                  <option>Phone</option><option>Email</option>
                </select>
              </Field>
            </div>
            <Field label="Address"><input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" /></Field>
            <div style={grid3}>
              <Field label="City"><input style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madison" /></Field>
              <Field label="State">
                <select style={input} value={state} onChange={(e) => setState(e.target.value)}>
                  {STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="ZIP"><input style={input} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="30650" maxLength={10} /></Field>
            </div>
          </Section>

          {/* ── Incident Information ── */}
          <Section title="Incident Information">
            <div style={grid2}>
              <Field label="Date of Incident *">
                <DateInput style={input} value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
              </Field>
              <Field label="Approximate Time">
                <input style={input} value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} placeholder="e.g., around 3:00 PM" />
              </Field>
            </div>
            <Field label="Location/Address of Incident *">
              <input style={input} value={incidentLocation} onChange={(e) => setIncidentLocation(e.target.value)} required placeholder="123 Main St, Madison, GA" />
            </Field>
            <Field label="Case or Reference Number if known">
              <input style={input} value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="If an officer gave you a case number, enter it here" />
            </Field>
          </Section>

          {/* ── Statement ── */}
          <Section title="Statement">
            <Field label="In your own words, describe what you witnessed. Include as much detail as possible. *">
              <textarea
                style={{ ...input, height: 160, resize: "vertical" }}
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Describe what you saw, heard, or experienced…"
              />
              <div style={{ fontSize: 12, color: statement.trim().length < MIN_STATEMENT_LENGTH ? "#dc2626" : "#6b7280", marginTop: 4 }}>
                {statement.trim().length} characters {statement.trim().length < MIN_STATEMENT_LENGTH ? `(minimum ${MIN_STATEMENT_LENGTH})` : ""}
              </div>
            </Field>
            <Field label="Attach any photos or videos related to the incident">
              <DragDropUpload
                onFiles={addFiles}
                accept={ATTACHMENT_ACCEPT}
                acceptLabel={ATTACHMENT_ACCEPT_LABEL}
                maxSizeMB={attachmentMaxMB}
                multiple
                label="Drop photos, videos, or documents here or click to browse"
              />
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {files.map((f, i) => (
                    <FilePreview key={i} file={f} url={URL.createObjectURL(f)} onRemove={() => removeFile(i)} />
                  ))}
                </div>
              )}
            </Field>
          </Section>

          {/* ── Certification ── */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,.07)", border: certified && typedSignature.trim() ? "2px solid #86efac" : "2px solid #e5e7eb" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e5e7eb" }}>
              Certification
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer", marginBottom: 18 }}>
              <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: "#1a8a8a", flexShrink: 0 }} />
              <span><strong>I certify that the above statement is true and accurate to the best of my knowledge.</strong></span>
            </label>

            <div style={grid2}>
              <Field label="Type your full legal name as your signature *">
                <input style={input} value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} placeholder="Full legal name" />
              </Field>
              <Field label="Date">
                <input style={{ ...input, background: "#f9fafb" }} value={todayStr()} readOnly />
              </Field>
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
              disabled={saving}
              style={{
                background: "#1a8a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "12px 36px",
                fontSize: 16,
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
                letterSpacing: 0.3,
                opacity: saving ? 0.8 : 1,
              }}
            >
              {saving ? "Submitting…" : "Submit Statement →"}
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
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.3 }}>{AGENCY_NAME}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginTop: 1 }}>Submit a Witness Statement</div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ background: "#1f2937", padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", lineHeight: 1.8 }}>
        {AGENCY_NAME} &nbsp;·&nbsp; {AGENCY_ADDRESS}<br />
        Phone: {AGENCY_PHONE} &nbsp;·&nbsp; ShelterTrace v1.0 · Shelter Data Systems
      </div>
    </div>
  );
}
