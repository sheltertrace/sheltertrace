"use client";
import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase-public";
import Image from "next/image";

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  "Stray / Loose Animal",
  "Animal Neglect or Abuse",
  "Barking / Noise Complaint",
  "Dangerous / Aggressive Animal",
  "Animal Bite",
  "Tethering Violation",
  "Too Many Animals",
  "Dead Animal Pickup",
  "Wildlife Concern",
  "Licensing Violation",
  "Other",
];

const CITIES = ["Madison", "Rutledge", "Bostwick", "Buckhead", "Unincorporated Morgan County"];
const DURATION_OPTIONS = ["Just noticed", "Days", "Weeks", "Months", "Ongoing"];
const CONTACT_TIMES = ["Morning (8am–12pm)", "Afternoon (12pm–5pm)", "Evening (5pm–8pm)", "Anytime"];

function generateRefNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF-${year}-${rand}`;
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div style={{ background: "#f1f5f9", borderLeft: "4px solid #1a8a8a", padding: "10px 14px", marginBottom: 16, borderRadius: "0 6px 6px 0" }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{icon} {title}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportConcernPage() {
  const [isEmbed, setIsEmbed] = useState(false);
  useEffect(() => {
    setIsEmbed(new URLSearchParams(window.location.search).get("embed") === "true");
  }, []);

  // Form state
  const [reportType, setReportType]           = useState("");
  const [address, setAddress]                 = useState("");
  const [city, setCity]                       = useState("");
  const [zip, setZip]                         = useState("");
  const [locationDetails, setLocationDetails] = useState("");
  const [species, setSpecies]                 = useState("");
  const [breed, setBreed]                     = useState("");
  const [animalColor, setAnimalColor]         = useState("");
  const [animalCount, setAnimalCount]         = useState("");
  const [contained, setContained]             = useState<boolean | null>(null);
  const [injured, setInjured]                 = useState<boolean | null>(null);
  const [aggressive, setAggressive]           = useState<boolean | null>(null);
  const [description, setDescription]         = useState("");
  const [duration, setDuration]               = useState("");
  const [reportedBefore, setReportedBefore]   = useState<boolean | null>(null);
  const [firstName, setFirstName]             = useState("");
  const [lastName, setLastName]               = useState("");
  const [phone, setPhone]                     = useState("");
  const [email, setEmail]                     = useState("");
  const [anonymous, setAnonymous]             = useState(false);
  const [wantsUpdate, setWantsUpdate]         = useState(false);
  const [contactTime, setContactTime]         = useState("");
  const [photos, setPhotos]                   = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews]     = useState<string[]>([]);
  const fileRef                               = useRef<HTMLInputElement>(null);

  // Submission
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [refNumber, setRefNumber]     = useState("");
  const [errors, setErrors]           = useState<string[]>([]);

  // Status lookup
  const [lookupRef, setLookupRef]         = useState("");
  const [lookupResult, setLookupResult]   = useState<{ status: string; type: string; date: string } | null>(null);
  const [lookupError, setLookupError]     = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length);
    if (files.length + photos.length > 5) { alert("Maximum 5 photos allowed."); return; }
    const newPreviews = files.map(f => URL.createObjectURL(f));
    setPhotos(prev => [...prev, ...files]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!reportType) errs.push("Report type is required.");
    if (!address.trim() && !locationDetails.trim()) errs.push("Location address or details is required.");
    if (!description.trim() || description.trim().length < 20) errs.push("Description must be at least 20 characters.");
    if (wantsUpdate && !anonymous && !email.trim() && !phone.trim()) errs.push("Please provide an email or phone number to receive updates.");
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setErrors([]);
    setSubmitting(true);

    try {
      const ref = generateRefNumber();

      // Upload photos
      const photoUrls: string[] = [];
      for (const file of photos) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${ref}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: upErr } = await supabasePublic.storage.from("report-attachments").upload(path, file);
        if (!upErr) {
          const { data: url } = supabasePublic.storage.from("report-attachments").getPublicUrl(path);
          photoUrls.push(url.publicUrl);
        }
      }

      const payload = {
        reference_number: ref,
        report_type: reportType,
        location_address: address.trim() || null,
        location_city: city || null,
        location_zip: zip.trim() || null,
        location_details: locationDetails.trim() || null,
        species: species || null,
        breed: breed.trim() || null,
        animal_color: animalColor.trim() || null,
        animal_count: animalCount ? parseInt(animalCount) : null,
        animal_contained: contained,
        animal_injured: injured,
        animal_aggressive: aggressive,
        description: description.trim(),
        duration: duration || null,
        reported_before: reportedBefore,
        reporter_first_name: anonymous ? null : (firstName.trim() || null),
        reporter_last_name: anonymous ? null : (lastName.trim() || null),
        reporter_phone: anonymous ? null : (phone.trim() || null),
        reporter_email: anonymous ? null : (email.trim() || null),
        anonymous,
        wants_update: wantsUpdate,
        contact_time: contactTime || null,
        photo_urls: photoUrls,
        status: "New",
        priority: "Medium",
      };

      const { error } = await supabasePublic.from("citizen_reports").insert(payload);
      if (error) throw error;

      setRefNumber(ref);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setErrors([`Error: ${msg}`]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async () => {
    setLookupError(""); setLookupResult(null);
    if (!lookupRef.trim()) { setLookupError("Please enter a reference number."); return; }
    setLookupLoading(true);
    try {
      const { data, error } = await supabasePublic
        .from("citizen_reports")
        .select("status, report_type, created_at")
        .eq("reference_number", lookupRef.trim().toUpperCase())
        .single();
      if (error || !data) { setLookupError("Report not found. Please check your reference number."); return; }
      const r = data as { status: string; report_type: string; created_at: string };
      setLookupResult({ status: r.status, type: r.report_type, date: r.created_at.slice(0, 10) });
    } catch {
      setLookupError("Lookup failed. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    New: "#0369a1", "Under Review": "#b45309", Assigned: "#6d28d9",
    Resolved: "#15803d", Dismissed: "#6b7280",
  };

  const yesNoBtn = (val: boolean | null, set: (v: boolean | null) => void) => (
    <div style={{ display: "flex", gap: 8 }}>
      {[true, false].map(v => (
        <button key={String(v)} type="button"
          onClick={() => set(val === v ? null : v)}
          style={{
            padding: "6px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${val === v ? "#1a8a8a" : "#e2e8f0"}`,
            background: val === v ? "#1a8a8a" : "#f8fafc",
            color: val === v ? "#fff" : "#374151", cursor: "pointer",
          }}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );

  if (submitted) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: isEmbed ? "20px 16px" : "40px 16px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#15803d", marginBottom: 8 }}>Report Submitted</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#166534", marginBottom: 16, fontFamily: "monospace", background: "#dcfce7", display: "inline-block", padding: "6px 16px", borderRadius: 6 }}>
            {refNumber}
          </div>
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Thank you for your report. Your reference number is <strong>{refNumber}</strong>. Please save this number — you can use it to check the status of your report below.
          </p>
          {!anonymous && (wantsUpdate || phone.trim() || email.trim()) && (
            <p style={{ color: "#374151", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              If you provided contact information, an officer may follow up with you.
            </p>
          )}
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
            🚨 For emergencies, call <a href="tel:911" style={{ color: "#dc2626" }}>911</a> or Morgan County Animal Services at <a href="tel:7067521195" style={{ color: "#dc2626" }}>(706) 752-1195</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>

      {/* MCAS header (hidden when embedded) */}
      {!isEmbed && (
        <div style={{ background: "#0f2942", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 0.3 }}>MORGAN COUNTY ANIMAL SERVICES</div>
            <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 1 }}>390 Hancock Drive, Madison, GA 30650 · (706) 752-1195</div>
          </div>
        </div>
      )}

      {/* Emergency banner */}
      <div style={{ background: "#dc2626", color: "#fff", padding: "10px 20px", textAlign: "center", fontSize: 14, fontWeight: 700 }}>
        🚨 FOR EMERGENCIES CALL <a href="tel:911" style={{ color: "#fff", textDecoration: "underline" }}>911</a> &nbsp;·&nbsp;
        For urgent animal issues call <a href="tel:7067521195" style={{ color: "#fff", textDecoration: "underline" }}>(706) 752-1195</a>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>

        {/* Page title */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f2942", margin: "0 0 6px" }}>
            Report an Animal Concern or Violation
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
            Use this form to report animal-related concerns in Morgan County. All submissions are reviewed by Animal Services staff.
          </p>
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>Please correct the following:</div>
            {errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: "#991b1b" }}>• {e}</div>)}
          </div>
        )}

        {/* ── Report Type ─────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="📋" title="Type of Concern" sub="Select the option that best describes your report" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {REPORT_TYPES.map(t => (
              <label key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${reportType === t ? "#1a8a8a" : "#e2e8f0"}`, background: reportType === t ? "#f0fdfa" : "#fff", cursor: "pointer", fontSize: 13 }}>
                <input type="radio" name="reportType" value={t} checked={reportType === t} onChange={() => setReportType(t)} style={{ accentColor: "#1a8a8a" }} />
                {t}
              </label>
            ))}
          </div>
        </div>

        {/* ── Location ────────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="📍" title="Location of Concern" sub="Be as specific as possible — address, cross street, or landmark" />
          <div className="grid-2">
            <Row label="Street Address or Cross Streets" required>
              <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St or Oak St & Elm Ave" />
            </Row>
            <Row label="City">
              <select className="form-select" value={city} onChange={e => setCity(e.target.value)}>
                <option value="">— Select city —</option>
                {CITIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Row>
            <Row label="Zip Code">
              <input className="form-input" value={zip} onChange={e => setZip(e.target.value)} placeholder="30650" maxLength={10} />
            </Row>
          </div>
          <Row label="Additional Location Details">
            <textarea className="form-textarea" rows={2} value={locationDetails} onChange={e => setLocationDetails(e.target.value)} placeholder='e.g., "behind the Dollar General", "near the red mailbox on the left"' />
          </Row>
        </div>

        {/* ── Animal Information ───────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="🐾" title="Animal Information" sub="Complete if the concern involves a specific animal (optional)" />
          <div className="grid-2">
            <Row label="Species">
              <select className="form-select" value={species} onChange={e => setSpecies(e.target.value)}>
                <option value="">— Select —</option>
                {["Dog","Cat","Wildlife","Bird","Livestock","Other"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="Breed (if known)">
              <input className="form-input" value={breed} onChange={e => setBreed(e.target.value)} placeholder="e.g., Lab mix, unknown" />
            </Row>
            <Row label="Color / Description">
              <input className="form-input" value={animalColor} onChange={e => setAnimalColor(e.target.value)} placeholder="e.g., brown with white chest" />
            </Row>
            <Row label="Number of Animals">
              <input className="form-input" type="number" min="1" value={animalCount} onChange={e => setAnimalCount(e.target.value)} placeholder="e.g., 1" />
            </Row>
          </div>
          <div className="grid-3">
            <Row label="Is the animal contained or loose?">
              {yesNoBtn(contained, setContained)}
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Yes = contained</div>
            </Row>
            <Row label="Does the animal appear injured?">
              {yesNoBtn(injured, setInjured)}
            </Row>
            <Row label="Does the animal appear aggressive?">
              {yesNoBtn(aggressive, setAggressive)}
            </Row>
          </div>
        </div>

        {/* ── Concern Details ──────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="📝" title="Concern Details" />
          <Row label="Describe the concern in detail" required>
            <textarea className="form-textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe what you saw or are concerned about. Include as many details as possible — this helps officers respond effectively." />
            <div style={{ fontSize: 11, color: description.length < 20 ? "#dc2626" : "#64748b", marginTop: 4 }}>
              {description.trim().length} characters {description.trim().length < 20 ? "(minimum 20)" : ""}
            </div>
          </Row>
          <div className="grid-2">
            <Row label="How long has this been an issue?">
              <select className="form-select" value={duration} onChange={e => setDuration(e.target.value)}>
                <option value="">— Select —</option>
                {DURATION_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Row>
            <Row label="Has this been reported before?">
              {yesNoBtn(reportedBefore, setReportedBefore)}
            </Row>
          </div>
        </div>

        {/* ── Photos ──────────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="📷" title="Photos (optional)" sub="Photos help us investigate. Do NOT approach dangerous animals to take photos." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {photoPreviews.map((src, i) => (
              <div key={i} style={{ position: "relative", width: 90, height: 90 }}>
                <Image src={src} alt={`Photo ${i+1}`} fill style={{ objectFit: "cover", borderRadius: 8, border: "2px solid #e2e8f0" }} />
                <button type="button" onClick={() => removePhoto(i)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ width: 90, height: 90, border: "2px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 24, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                +
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,image/heic,image/heif" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />
          <div style={{ fontSize: 11, color: "#64748b" }}>Up to 5 photos · JPG, PNG, WEBP, HEIC · Max 10MB each</div>
        </div>

        {/* ── Reporter Information ─────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
          <SectionHead icon="👤" title="Your Information" sub="Optional — your contact information is confidential and only used for follow-up." />

          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} style={{ accentColor: "#1a8a8a", width: 16, height: 16 }} />
            <span><strong>I would like to remain anonymous</strong> — my contact info will NOT be recorded</span>
          </label>

          <div className="grid-2" style={{ opacity: anonymous ? 0.4 : 1, pointerEvents: anonymous ? "none" : "auto" }}>
            <Row label="First Name">
              <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" disabled={anonymous} />
            </Row>
            <Row label="Last Name">
              <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" disabled={anonymous} />
            </Row>
            <Row label="Phone Number">
              <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(706) 555-0000" disabled={anonymous} />
            </Row>
            <Row label="Email Address">
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={anonymous} />
            </Row>
          </div>

          {!anonymous && (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={wantsUpdate} onChange={e => setWantsUpdate(e.target.checked)} style={{ accentColor: "#1a8a8a", width: 16, height: 16 }} />
                <span>I would like to receive an update on the outcome of this report</span>
              </label>
              <Row label="Best time to contact">
                <select className="form-select" value={contactTime} onChange={e => setContactTime(e.target.value)}>
                  <option value="">— Select —</option>
                  {CONTACT_TIMES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Row>
            </div>
          )}
        </div>

        {/* ── Submit ──────────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, marginBottom: 32, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
            By submitting this form, you confirm that the information provided is accurate to the best of your knowledge. False reports may be subject to penalties under Georgia law.
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%", padding: "14px 0", fontSize: 16, fontWeight: 800, background: submitting ? "#94a3b8" : "#0f2942", color: "#fff", border: "none", borderRadius: 8, cursor: submitting ? "wait" : "pointer", letterSpacing: 0.3 }}
          >
            {submitting ? "Submitting…" : "Submit Report →"}
          </button>
        </div>

        {/* ── Status Lookup ────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 20, border: "1px solid #e2e8f0" }}>
          <SectionHead icon="🔍" title="Check Report Status" sub="Already submitted a report? Enter your reference number to see its current status." />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              value={lookupRef}
              onChange={e => setLookupRef(e.target.value)}
              placeholder="REF-2026-XXXX"
              style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1 }}
              onKeyDown={e => e.key === "Enter" && handleLookup()}
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading}
              style={{ padding: "0 20px", background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              {lookupLoading ? "…" : "Check"}
            </button>
          </div>
          {lookupError && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>⚠️ {lookupError}</div>}
          {lookupResult && (
            <div style={{ marginTop: 12, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Reference: <strong>{lookupRef.toUpperCase()}</strong></div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Type: {lookupResult.type}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Submitted: {lookupResult.date}</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "#374151" }}>Current Status:</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: STATUS_COLORS[lookupResult.status] || "#374151" }}>
                  {lookupResult.status}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Footer (hidden when embedded) */}
      {!isEmbed && (
        <div style={{ background: "#0f2942", color: "#93c5fd", padding: "16px 20px", textAlign: "center", fontSize: 11 }}>
          Morgan County Animal Services · 390 Hancock Drive, Madison, GA 30650 · (706) 752-1195
          <br />Powered by ShelterTrace — Shelter Data Systems
        </div>
      )}
    </div>
  );
}
