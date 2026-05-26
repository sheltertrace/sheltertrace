"use client";
import { useState } from "react";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase-public";

const SPECIES_OPTIONS = ["Dog","Cat","Other"];
const SIZE_OPTIONS    = ["Small","Medium","Large","Extra Large"];
const SEX_OPTIONS     = ["Male","Female","Unknown"];
const CURRENT_LOCS    = ["With me (fostering temporarily)","Loose / still in the area","Brought to MCAS shelter","Neighbor / friend is holding","Other"];
const HOLD_DURATIONS  = ["A few hours","Overnight","A few days","Indefinitely"];

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

export default function ReportFoundPage() {
  const [step, setStep]     = useState<"form"|"submitted">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [reportId, setReportId] = useState("");

  // Pet
  const [species, setSpecies]         = useState("Dog");
  const [breed, setBreed]             = useState("");
  const [color, setColor]             = useState("");
  const [size, setSize]               = useState("");
  const [sex, setSex]                 = useState("Unknown");
  const [age, setAge]                 = useState("");
  const [microchip, setMicrochip]     = useState("");
  const [collar, setCollar]           = useState("");
  const [features, setFeatures]       = useState("");
  const [photos, setPhotos]           = useState<File[]>([]);

  // Where found
  const [dateLostFound, setDateLostFound] = useState("");
  const [timeLostFound, setTimeLostFound] = useState("");
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("Madison");
  const [zip, setZip]                 = useState("");
  const [currentLocation, setCurrentLocation] = useState("");

  // Finder
  const [finderName, setFinderName]   = useState("");
  const [finderPhone, setFinderPhone] = useState("");
  const [finderEmail, setFinderEmail] = useState("");
  const [canHold, setCanHold]         = useState<boolean | null>(null);
  const [holdDuration, setHoldDuration] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!finderName.trim() || !finderPhone.trim() || !finderEmail.trim() || !address.trim() || !dateLostFound) {
      setError("Please fill in all required fields (name, phone, email, location, date)."); return;
    }
    setSaving(true); setError("");
    try {
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
        type: "found",
        status: "active",
        species, breed: breed||null, color: color||null, size: size||null, sex,
        age: age||null,
        microchip: microchip.trim()||null,
        collar_description: collar||null,
        distinguishing_features: features||null,
        photo_urls: photoUrls,
        date_lost_found: dateLostFound,
        time_lost_found: timeLostFound||null,
        location_address: address,
        location_city: city||"Madison",
        location_zip: zip||null,
        current_location: currentLocation||null,
        can_hold: canHold ?? null,
        hold_duration: canHold && holdDuration ? holdDuration : null,
        reporter_name: finderName.trim(),
        reporter_phone: finderPhone.trim(),
        reporter_email: finderEmail.trim(),
      };
      console.log("[lost-found] found report submit:", JSON.stringify(payload, null, 2));
      const { data, error: dbErr } = await supabasePublic.from("lost_found_reports").insert(payload).select().single();
      if (dbErr) { console.error("[lost-found] error:", dbErr); throw dbErr; }
      const id = (data as { id: string }).id;
      setReportId(id);
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
          <div style={{ fontSize:56, marginBottom:16 }}>🏠</div>
          <h2 style={{ fontSize:24, fontWeight:900, color:"#0f2942", marginBottom:8 }}>Report Submitted!</h2>
          <p style={{ fontSize:14, color:"#64748b", lineHeight:1.7, marginBottom:20 }}>
            Thank you for helping a lost pet. Your report has been posted. If the pet has a microchip, please also call us at (706) 752-1195 so we can scan it.
          </p>
          <p style={{ fontSize:13, color:"#94a3b8", marginBottom:24 }}>Report ID: <code style={{ fontFamily:"monospace" }}>{reportId.slice(0,8).toUpperCase()}</code></p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <Link href="/lost-found" style={{ padding:"12px 24px", background:"#0f2942", color:"#fff", borderRadius:10, fontWeight:700, textDecoration:"none" }}>View Board</Link>
            <a href="tel:+17067521195" style={{ padding:"12px 24px", background:"#1a8a8a", color:"#fff", borderRadius:10, fontWeight:700, textDecoration:"none" }}>📞 Call MCAS</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f0f7ff", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`*{box-sizing:border-box} select,textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px 14px;font-size:14px;background:#fff} .yesno{display:flex;gap:8px} .yesno button{flex:1;padding:10px 0;border:2px solid #d1d5db;border-radius:8px;background:#fff;font-size:13px;font-weight:700;cursor:pointer;color:#374151} .yesno button.sel{border-color:#2563eb;background:#eff6ff;color:#2563eb}`}</style>
      <header style={{ background:"#2563eb", padding:"0 24px" }}>
        <div style={{ maxWidth:720, margin:"0 auto", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <img src="/mcas_logo.png" alt="MCAS" style={{ height:36, width:36, objectFit:"contain", background:"#fff", borderRadius:7, padding:2 }}/>
            <div style={{ color:"#fff", fontWeight:800, fontSize:14 }}>Report a Found Pet — Morgan County Animal Services</div>
          </div>
          <Link href="/lost-found" style={{ color:"rgba(255,255,255,0.75)", fontSize:12, textDecoration:"none" }}>← Back to Board</Link>
        </div>
      </header>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"28px 16px 60px" }}>
        <h1 style={{ fontSize:26, fontWeight:900, color:"#0f2942", marginBottom:6 }}>🔵 Report a Found Pet</h1>
        <p style={{ fontSize:14, color:"#64748b", marginBottom:24 }}>Thank you for helping a lost animal! Post your found pet report here. We&apos;ll check for matching lost pet reports and notify the owner through MCAS.</p>

        <form onSubmit={handleSubmit}>
          {/* Pet */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>1. About the Animal</h3>
            <G2>
              <F label="Species" req>
                <select value={species} onChange={(e)=>setSpecies(e.target.value)}>
                  {SPECIES_OPTIONS.map((s)=><option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Breed (best guess)"><input style={inp} value={breed} onChange={(e)=>setBreed(e.target.value)} placeholder="e.g. Beagle mix"/></F>
              <F label="Color / Markings" req><input style={inp} value={color} onChange={(e)=>setColor(e.target.value)} placeholder="e.g. Brown with white chest"/></F>
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
              <F label="Age (estimate)"><input style={inp} value={age} onChange={(e)=>setAge(e.target.value)} placeholder="e.g. Young adult"/></F>
              <F label="Microchip # (if scanned)"><input style={inp} value={microchip} onChange={(e)=>setMicrochip(e.target.value)} placeholder="Scan or type"/></F>
              <F label="Collar Info"><input style={inp} value={collar} onChange={(e)=>setCollar(e.target.value)} placeholder="Color, tags, any ID found"/></F>
            </G2>
            <F label="Distinguishing Features">
              <textarea value={features} onChange={(e)=>setFeatures(e.target.value)} rows={3} placeholder="Scars, markings, unusual features…"/>
            </F>
            <F label="Photos (up to 5 — very helpful!)">
              <input type="file" accept="image/*" capture="environment" multiple onChange={(e)=>setPhotos(Array.from(e.target.files??[]).slice(0,5))} style={{ fontSize:13 }}/>
              {photos.length>0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:12, color:"#16a34a", marginBottom:6, fontWeight:700 }}>✓ {photos.length} photo{photos.length>1?"s":""} selected</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {photos.map((f,i)=>(
                      <div key={i} style={{ width:60, height:60, borderRadius:8, overflow:"hidden", border:"2px solid #86efac", flexShrink:0 }}>
                        <img src={URL.createObjectURL(f)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </F>
          </div>

          {/* Where found */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>2. Where &amp; When Found</h3>
            <G2>
              <F label="Date Found" req><input style={inp} type="date" value={dateLostFound} onChange={(e)=>setDateLostFound(e.target.value)}/></F>
              <F label="Time Found"><input style={inp} type="time" value={timeLostFound} onChange={(e)=>setTimeLostFound(e.target.value)}/></F>
            </G2>
            <F label="Address or Cross Streets" req><input style={inp} value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="e.g. 123 Oak St or Oak St & Pine Ave"/></F>
            <G2>
              <F label="City"><input style={inp} value={city} onChange={(e)=>setCity(e.target.value)}/></F>
              <F label="Zip Code"><input style={inp} value={zip} onChange={(e)=>setZip(e.target.value)} maxLength={10}/></F>
            </G2>
            <F label="Where is the animal now?">
              <select value={currentLocation} onChange={(e)=>setCurrentLocation(e.target.value)}>
                <option value="">— Select —</option>
                {CURRENT_LOCS.map((c)=><option key={c}>{c}</option>)}
              </select>
            </F>
          </div>

          {/* Finder */}
          <div style={sect}>
            <h3 style={{ fontSize:15, fontWeight:800, color:"#0f2942", marginBottom:14 }}>3. Your Contact Information</h3>
            <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#1d4ed8" }}>
              🔒 Your information is private. We&apos;ll contact you directly if we find a match.
            </div>
            <G2>
              <F label="Full Name" req><input style={inp} value={finderName} onChange={(e)=>setFinderName(e.target.value)}/></F>
              <F label="Phone" req><input style={inp} type="tel" value={finderPhone} onChange={(e)=>setFinderPhone(e.target.value)}/></F>
              <F label="Email" req><input style={inp} type="email" value={finderEmail} onChange={(e)=>setFinderEmail(e.target.value)}/></F>
            </G2>
            <F label="Can you hold the animal temporarily?">
              <div className="yesno">
                <button type="button" className={canHold===true?"sel":""} onClick={()=>setCanHold(true)}>Yes</button>
                <button type="button" className={canHold===false?"sel":""} onClick={()=>setCanHold(false)}>No</button>
              </div>
            </F>
            {canHold && (
              <F label="How long can you hold them?">
                <select value={holdDuration} onChange={(e)=>setHoldDuration(e.target.value)}>
                  <option value="">— Select —</option>
                  {HOLD_DURATIONS.map((d)=><option key={d}>{d}</option>)}
                </select>
              </F>
            )}
          </div>

          {error && <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"12px 16px", color:"#dc2626", fontSize:14, marginBottom:16 }}>{error}</div>}

          <button type="submit" disabled={saving} style={{ width:"100%", padding:"15px 0", background:saving?"#9ca3af":"#2563eb", color:"#fff", border:"none", borderRadius:12, fontWeight:800, fontSize:16, cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Submitting…":"Post Found Pet Report 🏠"}
          </button>
        </form>
      </div>
    </div>
  );
}
