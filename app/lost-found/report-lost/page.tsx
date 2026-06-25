"use client";
import { useState } from "react";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase-public";
import DateInput from "@/components/ui/DateInput";

const SPECIES_OPTIONS  = ["Dog","Cat","Other"];
const SIZE_OPTIONS     = ["Small","Medium","Large","Extra Large"];
const SEX_OPTIONS      = ["Male","Female","Unknown"];
const CIRCUMSTANCES    = ["Got out of yard","Slipped leash","Door left open","Window/screen","Escaped during transport","Escaped during vet visit","Stolen","Other"];

const inp: React.CSSProperties = { width:"100%", border:"1px solid #d1d5db", borderRadius:8, padding:"10px 14px", fontSize:14, boxSizing:"border-box", background:"#fff" };
const lbl: React.CSSProperties = { display:"block", fontSize:13, fontWeight:700, color:"#374151", marginBottom:4 };
const sect: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px 22px", marginBottom:18 };

function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={lbl}>{label}{req && <span style={{ color:"#dc2626", marginLeft:2 }}>*</span>}</label>
      {children}
    </div>
  );
}
function G2({ children }: { children: React.ReactNode }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>{children}</div>;
}

export default function ReportLostPage() {
  const [step, setStep]     = useState<"form"|"submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [reportId, setReportId] = useState("");

  // Pet info
  const [species, setSpecies]         = useState("Dog");
  const [breed, setBreed]             = useState("");
  const [color, setColor]             = useState("");
  const [size, setSize]               = useState("");
  const [sex, setSex]                 = useState("Unknown");
  const [age, setAge]                 = useState("");
  const [petName, setPetName]         = useState("");
  const [microchipped, setMicrochipped] = useState("Unknown");
  const [microchip, setMicrochip]     = useState("");
  const [spayedNeutered, setSpayedNeutered] = useState("Unknown");
  const [collar, setCollar]           = useState("");
  const [features, setFeatures]       = useState("");
  const [photos, setPhotos]           = useState<File[]>([]);

  // Last seen
  const [dateLostFound, setDateLostFound] = useState("");
  const [timeLostFound, setTimeLostFound] = useState("");
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("Madison");
  const [zip, setZip]                 = useState("");
  const [direction, setDirection]     = useState("");
  const [circumstances, setCircumstances] = useState("");

  // Owner
  const [ownerName, setOwnerName]     = useState("");
  const [ownerPhone, setOwnerPhone]   = useState("");
  const [ownerEmail, setOwnerEmail]   = useState("");
  const [altPhone, setAltPhone]       = useState("");
  const [bestTime, setBestTime]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerName.trim() || !ownerPhone.trim() || !ownerEmail.trim() || !address.trim() || !dateLostFound) {
      setError("Please fill in all required fields (name, phone, email, location, date)."); return;
    }
    setSaving(true); setError("");
    try {
      // Upload photos
      const photoUrls: string[] = [];
      for (const file of photos.slice(0,5)) {
        const path = `lost-found/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
        const { data: up, error: upErr } = await supabasePublic.storage.from("animal-photos").upload(path, file, { upsert: true });
        if (!upErr && up) {
          const { data: urlData } = supabasePublic.storage.from("animal-photos").getPublicUrl(path);
          photoUrls.push(urlData.publicUrl);
        }
      }

      const payload = {
        type: "lost",
        status: "active",
        species, breed: breed||null, color: color||null, size: size||null, sex,
        age: age||null, pet_name: petName||null,
        microchip: microchipped === "Yes" ? (microchip||null) : null,
        spayed_neutered: spayedNeutered,
        collar_description: collar||null,
        distinguishing_features: features||null,
        photo_urls: photoUrls,
        date_lost_found: dateLostFound,
        time_lost_found: timeLostFound||null,
        location_address: address,
        location_city: city||"Madison",
        location_zip: zip||null,
        direction_heading: direction||null,
        circumstances: circumstances||null,
        reporter_name: ownerName.trim(),
        reporter_phone: ownerPhone.trim(),
        reporter_email: ownerEmail.trim(),
        reporter_alt_phone: altPhone.trim()||null,
        best_contact_time: bestTime||null,
      };
      console.log("[lost-found] submit:", JSON.stringify(payload, null, 2));
      const { data, error: dbErr } = await supabasePublic.from("lost_found_reports").insert(payload).select().single();
      if (dbErr) { console.error("[lost-found] error:", dbErr); throw dbErr; }
      const id = (data as { id: string }).id;
      setReportId(id);
      // Trigger auto-match in background
      fetch(`/api/lost-found-match?id=${id}`).catch(() => {});
      setStep("submitted");
    } catch (err) {
      setError("Failed to submit. Please try again or call (706) 752-1195.");
      console.error(err);
    } finally { setSaving(false); }
  }

  if (step === "submitted") {
    return (
      <div style={{ minHeight:"100vh", background:"#f0f7ff", fontFamily:"-apple-system, sans-serif" }}>
        <header style={{ background:"#0f2942", padding:"0 24px", height:64, display:"flex", alignItems:"center" }}>
          <img src="/mcas_logo.png" alt="MCAS" style={{ height:40, width:40, objectFit:"contain", background:"#fff", borderRadius:8, padding:3, marginRight:12 }}/>
          <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>Morgan County Animal Services</div>
        </header>
        <div style={{ maxWidth:560, margin:"60px auto", background:"#fff", borderRadius:16, padding:"48px 40px", textAlign:"center", boxShadow:"0 4px 24px rgba(0,0,0,.1)" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🐾</div>
          <h2 style={{ fontSize:24, fontWeight:900, color:"#0f2942", marginBottom:8 }}>Report Submitted</h2>
          <p style={{ fontSize:14, color:"#64748b", lineHeight:1.7, marginBottom:20 }}>
            Your lost pet report has been posted. We&apos;ll notify you if a matching pet is found at our shelter or reported by a citizen.
          </p>
          <p style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Report ID: <code style={{ fontFamily:"monospace" }}>{reportId.slice(0,8).toUpperCase()}</code></p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <Link href="/lost-found" style={{ padding:"12px 24px", background:"#0f2942", color:"#fff", borderRadius:10, fontWeight:700, textDecoration:"none" }}>View Lost &amp; Found Board</Link>
            <a href="tel:+17067521195" style={{ padding:"12px 24px", background:"#1a8a8a", color:"#fff", borderRadius:10, fontWeight:700, textDecoration:"none" }}>📞 Call MCAS</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f7ff", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`*{box-sizing:border-box} select,textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:14px;background:#fff}`}</style>
      <header style={{ background:"#dc2626", padding:"0 24px" }}>
        <div style={{ maxWidth:720, margin:"0 auto", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/mcas_logo.png" alt="MCAS" style={{ height:36, width:36, objectFit:"contain", background:"#fff", borderRadius:7, padding:2 }}/>
            <div style={{ color:"#fff", fontWeight:800, fontSize:14 }}>Report a Lost Pet — Morgan County Animal Services</div>
          </div>
          <Link href="/lost-found" style={{ color:"rgba(255,255,255,0.75)", fontSize:12, textDecoration:"none" }}>← Back to Board</Link>
        </div>
      </header>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"28px 16px 60px" }}>
        <h1 style={{ fontSize:26, fontWeight:900, color:"#0f2942", marginBottom:6 }}>🔴 Report a Lost Pet</h1>
        <p style={{ fontSize:14, color:"#64748b", marginBottom:16 }}>Fill out this form to post your lost pet on the Morgan County Lost &amp; Found board.</p>
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"10px 16px", marginBottom:20, fontSize:13, color:"#15803d" }}>
          🔒 <strong>Privacy notice:</strong> For your privacy, only the general area (street name or cross streets) will be shown publicly — not your full address. Your name, phone, and email are only shared with Morgan County Animal Services staff.
        </div>

        <form onSubmit={handleSubmit}>
          {/* Pet Info */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>1. About Your Pet</h3>
            <G2>
              <F label="Species" req>
                <select value={species} onChange={(e)=>setSpecies(e.target.value)}>
                  {SPECIES_OPTIONS.map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Pet Name"><input style={inp} value={petName} onChange={(e)=>setPetName(e.target.value)} placeholder="If they have one"/></F>
              <F label="Breed"><input style={inp} value={breed} onChange={(e)=>setBreed(e.target.value)} placeholder="e.g. Labrador Mix"/></F>
              <F label="Color / Markings" req><input style={inp} value={color} onChange={(e)=>setColor(e.target.value)} placeholder="e.g. Black and white"/></F>
              <F label="Size">
                <select value={size} onChange={(e)=>setSize(e.target.value)}>
                  <option value="">— Select —</option>
                  {SIZE_OPTIONS.map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Sex">
                <select value={sex} onChange={(e)=>setSex(e.target.value)}>
                  {SEX_OPTIONS.map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Age (estimate)"><input style={inp} value={age} onChange={(e)=>setAge(e.target.value)} placeholder="e.g. 3 years"/></F>
              <F label="Microchipped?">
                <select value={microchipped} onChange={(e)=>setMicrochipped(e.target.value)}>
                  {["Unknown","Yes","No"].map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              {microchipped==="Yes" && (
                <F label="Chip Number"><input style={inp} value={microchip} onChange={(e)=>setMicrochip(e.target.value)} placeholder="Scan or type"/></F>
              )}
              <F label="Spayed / Neutered?">
                <select value={spayedNeutered} onChange={(e)=>setSpayedNeutered(e.target.value)}>
                  {["Unknown","Yes","No"].map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Collar?"><input style={inp} value={collar} onChange={(e)=>setCollar(e.target.value)} placeholder="Color, tags, ID if wearing one"/></F>
            </G2>
            <F label="Distinguishing Features">
              <textarea value={features} onChange={(e)=>setFeatures(e.target.value)} rows={3} placeholder="Scars, unusual markings, missing limb, unique coloring pattern, etc."/>
            </F>
            <F label="Photos (up to 5 — very helpful!)">
              <input
                type="file"
                accept="image/*,image/heic,image/heif"
                multiple
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files ?? []);
                  setPhotos((prev) => [...prev, ...newFiles].slice(0, 5));
                  e.target.value = "";
                }}
                style={{ fontSize:13, display:"block", marginBottom:6 }}
              />
              {photos.length > 0 && (
                <div>
                  <div style={{ fontSize:12, color:"#16a34a", marginBottom:8, fontWeight:700 }}>
                    ✓ {photos.length} photo{photos.length > 1 ? "s" : ""} selected (click ✕ to remove)
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {photos.map((f, i) => (
                      <div key={i} style={{ position:"relative", width:72, height:72, flexShrink:0 }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8, border:"2px solid #86efac", display:"block" }}/>
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#dc2626", border:"2px solid #fff", color:"#fff", fontSize:11, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {photos.length === 0 && <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>No photos selected yet. Good photos greatly improve the chance of a match!</div>}
            </F>
          </div>

          {/* Last Seen */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>2. Where &amp; When Last Seen</h3>
            <G2>
              <F label="Date Last Seen" req><DateInput style={inp} value={dateLostFound} onChange={(e)=>setDateLostFound(e.target.value)}/></F>
              <F label="Time Last Seen"><input style={inp} type="time" value={timeLostFound} onChange={(e)=>setTimeLostFound(e.target.value)}/></F>
            </G2>
            <F label="General Area / Cross Streets" req>
              <input style={inp} value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="e.g. Near Main St & Oak Ave, or In the area of Athens Hwy"/>
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Do not include a house number — only the street name or cross streets will be shown publicly.</div>
            </F>
            <G2>
              <F label="City"><input style={inp} value={city} onChange={(e)=>setCity(e.target.value)}/></F>
              <F label="Zip Code"><input style={inp} value={zip} onChange={(e)=>setZip(e.target.value)} maxLength={10}/></F>
            </G2>
            <G2>
              <F label="Direction Pet Was Heading"><input style={inp} value={direction} onChange={(e)=>setDirection(e.target.value)} placeholder="e.g. North on Main Street"/></F>
              <F label="How Did They Get Lost?">
                <select value={circumstances} onChange={(e)=>setCircumstances(e.target.value)}>
                  <option value="">— Select —</option>
                  {CIRCUMSTANCES.map((c)=><option key={c}>{c}</option>)}
                </select>
              </F>
            </G2>
          </div>

          {/* Owner Info */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>3. Your Contact Information</h3>
            <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#1d4ed8" }}>
              🔒 Your contact info is private — citizens contact MCAS at (706) 752-1195, not you directly.
            </div>
            <G2>
              <F label="Full Name" req><input style={inp} value={ownerName} onChange={(e)=>setOwnerName(e.target.value)}/></F>
              <F label="Phone" req><input style={inp} type="tel" value={ownerPhone} onChange={(e)=>setOwnerPhone(e.target.value)}/></F>
              <F label="Email" req><input style={inp} type="email" value={ownerEmail} onChange={(e)=>setOwnerEmail(e.target.value)}/></F>
              <F label="Alternate Phone"><input style={inp} type="tel" value={altPhone} onChange={(e)=>setAltPhone(e.target.value)}/></F>
              <F label="Best Time to Reach You">
                <select value={bestTime} onChange={(e)=>setBestTime(e.target.value)}>
                  <option value="">— Select —</option>
                  {["Morning (8am–12pm)","Afternoon (12–5pm)","Evening (5–9pm)","Anytime"].map((t)=><option key={t}>{t}</option>)}
                </select>
              </F>
            </G2>
          </div>

          {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"12px 16px", color:"#dc2626", fontSize:14, marginBottom:16 }}>{error}</div>}

          <button type="submit" disabled={saving} style={{ width:"100%", padding:"15px 0", background:saving?"#9ca3af":"#dc2626", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:16, cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Submitting…":"Post Lost Pet Report 🐾"}
          </button>
        </form>
      </div>
    </div>
  );
}
