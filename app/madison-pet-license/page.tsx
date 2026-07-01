"use client";
import { useState } from "react";
import { createApplication } from "@/lib/cityLicenseData";
import { calcApplicationFee, isLate, LICENSE_FEE_STERILIZED, LICENSE_FEE_UNSTERILIZED, LATE_FEE } from "@/lib/cityLicenseTypes";
import type { LicenseAnimal } from "@/lib/cityLicenseTypes";
import DragDropUpload from "@/components/ui/DragDropUpload";
import { supabase } from "@/lib/supabase";

const BLANK_ANIMAL: LicenseAnimal = { name: "", breed: "", color: "", markings: "", sex: "", sterilized: null, veterinarian: "", rabies_tag: "", rabies_expiration: "" };

export default function MadisonPetLicensePage() {
  const [ownerFirst, setOwnerFirst] = useState("");
  const [ownerLast, setOwnerLast] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [ownerCity, setOwnerCity] = useState("Madison");
  const [ownerState, setOwnerState] = useState("GA");
  const [ownerZip, setOwnerZip] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [animals, setAnimals] = useState<LicenseAnimal[]>([{ ...BLANK_ANIMAL }]);
  const [docs, setDocs] = useState<Array<{ name: string; file: File }>>([]);
  const [certified, setCertified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ appNumber: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const late = isLate();

  const setAnimal = <K extends keyof LicenseAnimal>(i: number, key: K, val: LicenseAnimal[K]) =>
    setAnimals((prev) => prev.map((a, idx) => idx === i ? { ...a, [key]: val } : a));

  const fee = calcApplicationFee(animals, late);

  const validate = (): string[] => {
    const e: string[] = [];
    if (!ownerFirst.trim()) e.push("First name is required");
    if (!ownerLast.trim()) e.push("Last name is required");
    if (!ownerAddr.trim()) e.push("Address is required");
    if (!ownerPhone.trim()) e.push("Phone number is required");
    animals.forEach((a, i) => {
      if (!a.name.trim()) e.push(`Dog #${i + 1}: name is required`);
      if (!a.rabies_tag.trim()) e.push(`Dog #${i + 1}: rabies tag number is required`);
    });
    if (!certified) e.push("Please check the certification checkbox");
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSubmitting(true);
    try {
      const uploadedDocs: Array<{ name: string; url: string; type: string; uploaded_at: string }> = [];
      for (const doc of docs) {
        const path = `license-docs/${Date.now()}-${doc.file.name}`;
        const { error } = await supabase.storage.from("documents").upload(path, doc.file, { upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
          uploadedDocs.push({ name: doc.name, url: urlData.publicUrl, type: doc.file.type, uploaded_at: new Date().toISOString() });
        }
      }

      const result = await createApplication({
        year: new Date().getFullYear(),
        status: "Pending",
        owner_first_name: ownerFirst.trim(),
        owner_last_name: ownerLast.trim(),
        owner_address: ownerAddr.trim(),
        owner_city: ownerCity.trim(),
        owner_state: ownerState.trim(),
        owner_zip: ownerZip.trim() || undefined,
        owner_phone: ownerPhone.trim(),
        owner_email: ownerEmail.trim() || undefined,
        animals,
        submission_type: "online",
        payment_status: "Unpaid",
        payment_amount: fee,
        late_fee: late,
        documents: uploadedDocs,
      });

      setSubmitted({ appNumber: result.application_number || result.id });
    } catch (e: unknown) {
      setErrors([`Submission failed: ${(e as { message?: string }).message || "Unknown error"}`]);
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, background: "#fff", borderRadius: 12, padding: 32, textAlign: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1B3A5C", marginBottom: 8 }}>Application Submitted!</h2>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Application Number:</div>
            <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 900, color: "#1B3A5C" }}>{submitted.appNumber}</div>
          </div>
          <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
            You will be contacted when your license is ready for pickup.<br />
            Questions? Call City Hall at <strong>(706) 342-1251</strong>.
          </p>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>City of Madison, Georgia · Dog Licensing</div>
        </div>
      </div>
    );
  }

  const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" as const };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 };
  const fgStyle = { marginBottom: 12 };
  const sectionStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 20 };
  const sh = (title: string, icon: string) => (
    <div style={{ background: "#1B3A5C", color: "#fff", padding: "8px 16px", borderRadius: 6, marginBottom: 14, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
      <span>{icon}</span> {title}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1B3A5C", color: "#fff", padding: "16px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.7, marginBottom: 2 }}>City of Madison, Georgia</div>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 2 }}>Annual Dog License Application</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Online Application · {new Date().getFullYear()}</div>
      </div>

      {/* Info banner */}
      <div style={{ background: "#fffbeb", borderBottom: "1px solid #fde68a", padding: "14px 24px", fontSize: 12, lineHeight: 1.6 }}>
        <strong>License fees:</strong> $5.00 per sterilized dog · $15.00 per unsterilized dog.{" "}
        Failure to license will result in a <strong>$77.00 fine</strong>. The deadline is July 1st. After this date, a <strong>$5.00 penalty fee per dog</strong> applies.
        Proof of rabies vaccination is required.
        {late && <span style={{ color: "#dc2626", fontWeight: 700, marginLeft: 8 }}>⚠️ Late fee applies — applications received after July 1st.</span>}
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>

        {/* Owner Info */}
        <div style={sectionStyle}>
          {sh("Owner Information", "👤")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div style={fgStyle}><label style={labelStyle}>First Name *</label><input style={inputStyle} value={ownerFirst} onChange={(e) => setOwnerFirst(e.target.value)} /></div>
            <div style={fgStyle}><label style={labelStyle}>Last Name *</label><input style={inputStyle} value={ownerLast} onChange={(e) => setOwnerLast(e.target.value)} /></div>
            <div style={{ ...fgStyle, gridColumn: "1 / -1" }}><label style={labelStyle}>Address *</label><input style={inputStyle} value={ownerAddr} onChange={(e) => setOwnerAddr(e.target.value)} /></div>
            <div style={fgStyle}><label style={labelStyle}>City</label><input style={inputStyle} value={ownerCity} onChange={(e) => setOwnerCity(e.target.value)} /></div>
            <div style={fgStyle}><label style={labelStyle}>State</label><input style={{ ...inputStyle, maxWidth: 80 }} value={ownerState} onChange={(e) => setOwnerState(e.target.value)} /></div>
            <div style={fgStyle}><label style={labelStyle}>Phone Number *</label><input style={inputStyle} type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} /></div>
            <div style={fgStyle}><label style={labelStyle}>Email Address</label><input style={inputStyle} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} /></div>
          </div>
        </div>

        {/* Animals */}
        {animals.map((a, i) => (
          <div key={i} style={sectionStyle}>
            {sh(`Dog #${i + 1} Information`, "🐕")}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div style={fgStyle}><label style={labelStyle}>Name of Animal *</label><input style={inputStyle} value={a.name} onChange={(e) => setAnimal(i, "name", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Rabies Tag # *</label><input style={inputStyle} value={a.rabies_tag} onChange={(e) => setAnimal(i, "rabies_tag", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Breed</label><input style={inputStyle} value={a.breed} onChange={(e) => setAnimal(i, "breed", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Color</label><input style={inputStyle} value={a.color} onChange={(e) => setAnimal(i, "color", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Markings</label><input style={inputStyle} value={a.markings} onChange={(e) => setAnimal(i, "markings", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Veterinarian</label><input style={inputStyle} value={a.veterinarian} onChange={(e) => setAnimal(i, "veterinarian", e.target.value)} /></div>
              <div style={fgStyle}><label style={labelStyle}>Rabies Expiration</label><input style={inputStyle} type="date" value={a.rabies_expiration} onChange={(e) => setAnimal(i, "rabies_expiration", e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <label style={labelStyle}>Sex</label>
                <div style={{ display: "flex", gap: 16 }}>
                  {["M", "F"].map((s) => (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" checked={a.sex === s} onChange={() => setAnimal(i, "sex", s as "M" | "F")} /> {s === "M" ? "Male" : "Female"}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Sterilized (spayed/neutered)?</label>
                <div style={{ display: "flex", gap: 16 }}>
                  {[true, false].map((v) => (
                    <label key={String(v)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" checked={a.sterilized === v} onChange={() => setAnimal(i, "sterilized", v)} /> {v ? `Yes — $${LICENSE_FEE_STERILIZED}` : `No — $${LICENSE_FEE_UNSTERILIZED}`}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {i > 0 && (
              <button style={{ marginTop: 10, fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }} onClick={() => setAnimals((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove this dog
              </button>
            )}
          </div>
        ))}

        {animals.length < 5 && (
          <button style={{ width: "100%", padding: "10px", border: "2px dashed #cbd5e1", borderRadius: 8, background: "transparent", cursor: "pointer", fontSize: 13, color: "#475569", marginBottom: 20 }} onClick={() => setAnimals((prev) => [...prev, { ...BLANK_ANIMAL }])}>
            + Add Another Dog
          </button>
        )}

        {/* Documents */}
        <div style={sectionStyle}>
          {sh("Documents Upload", "📎")}
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.6 }}>
            Please upload your <strong>rabies vaccination certificate</strong>. Without this document your application cannot be processed.
            If claiming the sterilized rate, also upload proof of sterilization.
          </div>
          <DragDropUpload
            onFiles={(files) => setDocs((prev) => [...prev, ...files.map((f) => ({ name: f.name, file: f }))])}
            accept="image/jpeg,image/png,application/pdf"
            multiple
            label="Drop rabies certificate and supporting docs here"
          />
          {docs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {docs.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#f8fafc", borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                  <span>📄 {d.name}</span>
                  <button style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer" }} onClick={() => setDocs((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fee summary */}
        <div style={{ ...sectionStyle, background: "#f0f9ff" }}>
          {sh("Fee Summary", "💰")}
          {animals.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>{a.name || `Dog #${i + 1}`} ({a.sterilized ? "Sterilized" : "Unsterilized"})</span>
              <span>${a.sterilized ? LICENSE_FEE_STERILIZED : LICENSE_FEE_UNSTERILIZED}.00</span>
            </div>
          ))}
          {late && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#dc2626", marginBottom: 4 }}><span>Late Fee ({animals.length} dog{animals.length !== 1 ? "s" : ""})</span><span>${animals.length * LATE_FEE}.00</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, borderTop: "1px solid #bae6fd", paddingTop: 8, marginTop: 4 }}>
            <span>Total Due</span><span>${fee}.00</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Note: Fees are collected by the City of Madison. Do not submit payment with this form.</div>
        </div>

        {/* Certification */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>I certify that the information provided is accurate and complete, and that all dogs listed have current rabies vaccinations.</span>
        </label>

        {errors.length > 0 && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>• {e}</div>)}
          </div>
        )}

        <button
          style={{ width: "100%", padding: "14px", background: submitting ? "#64748b" : "#1B3A5C", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting…" : `Submit Application — ${animals.length} Dog${animals.length !== 1 ? "s" : ""} · $${fee}.00`}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
          City of Madison, Georgia · City Hall: (706) 342-1251<br />
          Powered by ShelterTrace
        </div>
      </div>
    </div>
  );
}
