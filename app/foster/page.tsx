"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import {
  fetchAnimals, fetchFosterParents, fetchActiveFosterPlacements,
  createFosterPlacement, updateFosterPlacement, createFosterCheckin,
  updateAnimal, createPerson, genNextPid,
  fetchFosterApplications, updateFosterApplication,
  fetchFosterSupplyRequests, updateFosterSupplyRequest,
  safeArray,
} from "@/lib/data";
import type { Animal, Person, FosterPlacement, FosterCheckin, FosterApplication, FosterSupplyRequest } from "@/lib/types";
import { today, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

// ── Constants ─────────────────────────────────────────────────────────────────
const FOSTER_REASONS = ["Medical recovery","Behavioral","Underage / Bottle baby","Space","Socialization","Other"];
const CHECKIN_METHODS = ["Phone","Text","Visit","Email"];
const SUPPLIES = ["Food","Water bowl","Crate","Leash","Collar","Medication","Litter box","Litter","Carrier","Toys","Blanket","Other"];
const RETURN_CONDITIONS = ["Good","Fair","Poor","Needs Medical Attention"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr?: string | null): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function printFosterAgreement(placement: FosterPlacement, animal?: Animal, parent?: Person) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Foster Agreement</title>
<style>
  body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;font-size:11pt;color:#111}
  h1{font-size:16pt;text-align:center;margin-bottom:4px}
  .sub{font-size:9pt;color:#555;text-align:center;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:14px 0}
  td,th{padding:5px 8px;border:1px solid #ccc;font-size:10pt}
  th{background:#f0f4f8;font-size:9pt;font-weight:700;text-align:left}
  .terms{font-size:9.5pt;line-height:1.7;margin:14px 0}
  .terms li{margin-bottom:6px}
  .sig{margin-top:30px;display:flex;gap:60px}
  .sig-block{flex:1}
  .sig-line{border-bottom:1px solid #333;margin-bottom:4px;height:40px}
  .sig-label{font-size:9pt;color:#555}
</style></head><body>
<h1>Morgan County Animal Services</h1>
<div class="sub">2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195 · Foster Care Agreement</div>
<table>
  <tr><th colspan="2">Foster Parent Information</th></tr>
  <tr><td>Name</td><td><strong>${placement.foster_parent_name ?? "—"}</strong></td></tr>
  <tr><td>Phone</td><td>${parent?.phone ?? "—"}</td></tr>
  <tr><td>Email</td><td>${parent?.email ?? "—"}</td></tr>
  <tr><td>Address</td><td>${[parent?.address,parent?.city,parent?.state,parent?.zip].filter(Boolean).join(", ") || "—"}</td></tr>
</table>
<table>
  <tr><th colspan="2">Animal Information</th></tr>
  <tr><td>Name</td><td><strong>${placement.animal_name ?? "—"}</strong></td></tr>
  <tr><td>Animal ID</td><td>${animal?.id ?? placement.animal_id}</td></tr>
  <tr><td>Species / Breed</td><td>${[animal?.species,animal?.breed].filter(Boolean).join(" / ") || "—"}</td></tr>
  <tr><td>Color / Sex</td><td>${[animal?.color,animal?.sex].filter(Boolean).join(" / ") || "—"}</td></tr>
  <tr><td>Microchip</td><td>${animal?.microchip || "None"}</td></tr>
</table>
<table>
  <tr><th colspan="2">Foster Period</th></tr>
  <tr><td>Start Date</td><td>${placement.start_date ?? "—"}</td></tr>
  <tr><td>Expected Return</td><td>${placement.expected_return_date ?? "Not specified"}</td></tr>
  <tr><td>Reason</td><td>${placement.reason ?? "—"}</td></tr>
</table>
${placement.care_instructions ? `<table><tr><th>Care Instructions</th></tr><tr><td>${placement.care_instructions.replace(/\n/g,"<br>")}</td></tr></table>` : ""}
${placement.medication_schedule ? `<table><tr><th>Medication Schedule</th></tr><tr><td>${placement.medication_schedule.replace(/\n/g,"<br>")}</td></tr></table>` : ""}
<div class="terms">
  <strong>FOSTER CARE AGREEMENT — By signing below, the foster parent agrees to:</strong>
  <ol>
    <li>Provide proper food, water, shelter, veterinary care, and humane treatment at all times.</li>
    <li>Keep the animal safe and secured; not allow the animal to roam freely outdoors unsupervised.</li>
    <li>Not adopt out, sell, give away, trade, or transfer the animal to any other person or entity.</li>
    <li>Return the animal to MCAS immediately upon request or at the end of the foster period.</li>
    <li>Contact MCAS immediately at (706) 752-1195 if the animal becomes sick, injured, escapes, or dies.</li>
    <li>Allow MCAS staff to conduct welfare checks and home visits.</li>
    <li>Morgan County Animal Services retains full legal ownership throughout the foster period.</li>
    <li>The foster parent accepts responsibility for any damage caused by the animal to people or property.</li>
  </ol>
</div>
<div class="sig">
  <div class="sig-block"><div class="sig-line"></div><div class="sig-label">Foster Parent Signature &amp; Date</div></div>
  <div class="sig-block"><div class="sig-line"></div><div class="sig-label">MCAS Representative Signature &amp; Date</div></div>
</div>
<div style="margin-top:24px;font-size:9pt;color:#555;text-align:center">Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "active" | "roster" | "applications" | "supplies";

export default function FosterPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [fosterParents, setFosterParents] = useState<Person[]>([]);
  const [placements, setPlacements] = useState<FosterPlacement[]>([]);
  const [applications, setApplications] = useState<FosterApplication[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<FosterSupplyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Place modal
  const [showPlace, setShowPlace] = useState(false);
  const [placeStep, setPlaceStep] = useState(1);
  const [placeAnimalQ, setPlaceAnimalQ] = useState("");
  const [placeAnimal, setPlaceAnimal] = useState<Animal | null>(null);
  const [placeParent, setPlaceParent] = useState<Person | null>(null);
  const [placeStartDate, setPlaceStartDate] = useState(today());
  const [placeReturnDate, setPlaceReturnDate] = useState("");
  const [placeReason, setPlaceReason] = useState(FOSTER_REASONS[0]);
  const [placeCareInstr, setPlaceCareInstr] = useState("");
  const [placeMedSched, setPlaceMedSched] = useState("");
  const [placeSupplies, setPlaceSupplies] = useState<string[]>([]);
  const [placeSaving, setPlaceSaving] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);

  // Return modal
  const [returnPlacement, setReturnPlacement] = useState<FosterPlacement | null>(null);
  const [returnCondition, setReturnCondition] = useState(RETURN_CONDITIONS[0]);
  const [returnNotes, setReturnNotes] = useState("");
  const [returnStatus, setReturnStatus] = useState("Available");
  const [returnSaving, setReturnSaving] = useState(false);

  // Check-in modal
  const [checkinPlacement, setCheckinPlacement] = useState<FosterPlacement | null>(null);
  const [checkinMethod, setCheckinMethod] = useState(CHECKIN_METHODS[0]);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [checkinSaving, setCheckinSaving] = useState(false);

  // Roster search
  const [rosterSearch, setRosterSearch] = useState("");

  // Application review
  const [reviewApp, setReviewApp] = useState<FosterApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  // Capacity map
  const [parentCapacity, setParentCapacity] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const [a, fp, pl, apps, sr] = await Promise.all([
      fetchAnimals(), fetchFosterParents(), fetchActiveFosterPlacements(),
      fetchFosterApplications(), fetchFosterSupplyRequests(),
    ]);
    setAnimals(a);
    setFosterParents(fp);
    setPlacements(pl);
    setApplications(apps);
    setSupplyRequests(sr);
    const cap: Record<string, number> = {};
    pl.forEach((p) => { cap[p.foster_parent_id] = (cap[p.foster_parent_id] || 0) + 1; });
    setParentCapacity(cap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stats
  const fosterAnimals   = animals.filter((a) => a.status === "Foster");
  const expiringWeek    = placements.filter((p) => { const d = daysUntil(p.expected_return_date); return d >= 0 && d <= 7; });
  const pendingApps     = applications.filter((a) => a.status === "pending");
  const pendingSupplies = supplyRequests.filter((r) => r.status === "pending");

  // Animal search for place wizard
  const placeAnimalMatches = useMemo(() => {
    const q = placeAnimalQ.toLowerCase();
    if (q.length < 2) return [];
    return animals
      .filter((a) => !["Adopted","Euthanized","Transferred","Redeemed"].includes(a.status))
      .filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [placeAnimalQ, animals]);

  // Place handler
  async function handlePlace() {
    if (!placeAnimal || !placeParent) return;
    setPlaceSaving(true);
    try {
      const pl = await createFosterPlacement({
        animal_id: placeAnimal.id,
        animal_name: placeAnimal.name,
        foster_parent_id: placeParent.id,
        foster_parent_name: `${placeParent.first_name} ${placeParent.last_name}`,
        start_date: placeStartDate,
        expected_return_date: placeReturnDate || undefined,
        reason: placeReason,
        care_instructions: placeCareInstr || undefined,
        medication_schedule: placeMedSched || undefined,
        supplies_provided: placeSupplies,
        status: "Active",
      });
      await updateAnimal(placeAnimal.id, { status: "Foster" });
      setPlacedId(pl.id ?? null);
      await load();
    } catch (e) { console.error("[handlePlace]", e); }
    finally { setPlaceSaving(false); }
  }

  function resetPlace() {
    setShowPlace(false); setPlaceStep(1); setPlaceAnimalQ(""); setPlaceAnimal(null);
    setPlaceParent(null); setPlaceStartDate(today()); setPlaceReturnDate("");
    setPlaceReason(FOSTER_REASONS[0]); setPlaceCareInstr(""); setPlaceMedSched("");
    setPlaceSupplies([]); setPlacedId(null);
  }

  // Return handler
  async function handleReturn() {
    if (!returnPlacement) return;
    setReturnSaving(true);
    try {
      await updateFosterPlacement(returnPlacement.id!, {
        status: "Returned",
        actual_return_date: today(),
        condition_at_return: returnCondition,
        return_notes: returnNotes,
      });
      await updateAnimal(returnPlacement.animal_id, { status: returnStatus });
      setReturnPlacement(null); setReturnCondition(RETURN_CONDITIONS[0]); setReturnNotes("");
      await load();
    } catch (e) { console.error("[handleReturn]", e); }
    finally { setReturnSaving(false); }
  }

  // Check-in handler
  async function handleCheckin() {
    if (!checkinPlacement) return;
    setCheckinSaving(true);
    const user = getCurrentUser();
    try {
      await createFosterCheckin({
        placement_id: checkinPlacement.id,
        staff_id: user?.id,
        staff_name: user ? (`${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username) : "Staff",
        method: checkinMethod,
        notes: checkinNotes,
        checked_at: new Date().toISOString(),
      } as FosterCheckin);
      setCheckinPlacement(null); setCheckinNotes("");
    } catch (e) { console.error("[handleCheckin]", e); }
    finally { setCheckinSaving(false); }
  }

  // Application review handler
  async function handleAppAction(action: "approved" | "rejected" | "more_info") {
    if (!reviewApp) return;
    setReviewSaving(true);
    try {
      let pid = reviewApp.assigned_pid;
      if (action === "approved" && !reviewApp.assigned_pid) {
        pid = await genNextPid();
        await createPerson({
          first_name: reviewApp.first_name,
          last_name: reviewApp.last_name,
          phone: reviewApp.phone,
          email: reviewApp.email,
          address: reviewApp.address,
          city: reviewApp.city,
          state: reviewApp.state,
          zip: reviewApp.zip,
          role: "Foster Parent",
          pid,
          date_added: today(),
        });
      }
      await updateFosterApplication(reviewApp.id!, {
        status: action,
        admin_notes: reviewNotes || undefined,
        reviewed_at: new Date().toISOString(),
        ...(action === "approved" && pid ? { assigned_pid: pid } : {}),
      });
      setReviewApp(null); setReviewNotes("");
      await load();
    } catch (e) { console.error("[handleAppAction]", e); }
    finally { setReviewSaving(false); }
  }

  const filteredRoster = fosterParents.filter((p) => {
    const q = rosterSearch.toLowerCase();
    return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q);
  });

  return (
    <AppShell
      title="Foster Care"
      action={
        <div style={{ display: "flex", gap: 10 }}>
          <a href="/foster-apply" target="_blank" className="btn btn-secondary btn-sm">📝 Apply Page</a>
          <button className="btn btn-primary btn-sm" style={{ background: "#f59e0b", borderColor: "#f59e0b" }} onClick={() => setShowPlace(true)}>
            + Place Animal in Foster
          </button>
        </div>
      }
    >
      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: "Animals in Foster",   value: fosterAnimals.length,    color: "#f59e0b", icon: "🐾" },
            { label: "Active Placements",   value: placements.length,       color: "#0d9488", icon: "❤️" },
            { label: "Expiring This Week",  value: expiringWeek.length,     color: "#dc2626", icon: "📅" },
            { label: "Foster Parents",      value: fosterParents.length,    color: "#6366f1", icon: "👨‍👩‍👧" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 22 }}>{icon}</span></div>
              <div>
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {([
            ["active","Active Fosters",placements.length],
            ["roster","Foster Roster",fosterParents.length],
            ["applications","Applications",pendingApps.length],
            ["supplies","Supply Requests",pendingSupplies.length],
          ] as [Tab,string,number][]).map(([key,label,badge]) => (
            <div key={key} className={`tab ${tab===key?"active":""}`} onClick={()=>setTab(key)} style={{position:"relative"}}>
              {label}
              {badge>0&&<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#dc2626",color:"#fff",fontSize:10,fontWeight:800,borderRadius:999,minWidth:18,height:18,padding:"0 5px",marginLeft:6,lineHeight:1}}>{badge}</span>}
            </div>
          ))}
        </div>

        {/* ── ACTIVE FOSTERS ── */}
        {tab==="active"&&(
          loading ? <p style={{color:"#888"}}>Loading…</p> : placements.length===0 ? (
            <div style={{textAlign:"center",padding:"60px 0",color:"var(--text-muted)"}}>
              <div style={{fontSize:40,marginBottom:12}}>❤️</div>
              <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>No active foster placements</div>
              <button className="btn btn-primary" style={{background:"#f59e0b",borderColor:"#f59e0b"}} onClick={()=>setShowPlace(true)}>+ Place Animal in Foster</button>
            </div>
          ) : (
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <table className="data-table">
                <thead><tr><th>Animal</th><th>Foster Parent</th><th>Start</th><th>Expected Return</th><th>Days</th><th>Reason</th><th style={{textAlign:"center"}}>Actions</th></tr></thead>
                <tbody>
                  {placements.map((pl)=>{
                    const days = pl.start_date ? Math.floor((Date.now()-new Date(`${pl.start_date}T00:00:00`).getTime())/86400000) : 0;
                    const dLeft = daysUntil(pl.expected_return_date);
                    const overdue = pl.expected_return_date && dLeft<0;
                    const soonDue = pl.expected_return_date && dLeft<=7 && dLeft>=0;
                    return (
                      <tr key={pl.id}>
                        <td><Link href={`/animals/${pl.animal_id}`} style={{fontWeight:700,color:"var(--teal)",textDecoration:"none"}}>{pl.animal_name??pl.animal_id}</Link></td>
                        <td style={{fontWeight:600}}>{pl.foster_parent_name??"—"}</td>
                        <td style={{fontSize:12}}>{formatDate(pl.start_date)}</td>
                        <td style={{fontSize:12}}>
                          {pl.expected_return_date ? (
                            <span style={{color:overdue?"#dc2626":soonDue?"#d97706":"inherit",fontWeight:overdue||soonDue?700:400}}>
                              {formatDate(pl.expected_return_date)}
                              {overdue&&` (${Math.abs(dLeft)}d overdue)`}
                              {soonDue&&!overdue&&` (in ${dLeft}d)`}
                            </span>
                          ):"—"}
                        </td>
                        <td style={{fontSize:12,fontWeight:600}}>{days}d</td>
                        <td style={{fontSize:12,color:"var(--text-secondary)"}}>{pl.reason??"—"}</td>
                        <td>
                          <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setCheckinPlacement(pl)}>📋 Check-In</button>
                            <button className="btn btn-ghost btn-sm" onClick={()=>{setReturnPlacement(pl);setReturnCondition(RETURN_CONDITIONS[0]);setReturnNotes("");}}>↩ Return</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── FOSTER ROSTER ── */}
        {tab==="roster"&&(
          <div>
            <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center"}}>
              <input className="form-input" placeholder="Search by name or phone…" value={rosterSearch} onChange={(e)=>setRosterSearch(e.target.value)} style={{maxWidth:280}}/>
              <span style={{fontSize:13,color:"var(--text-secondary)"}}>{fosterParents.length} foster parent{fosterParents.length!==1?"s":""}</span>
              <Link href="/people" style={{marginLeft:"auto",fontSize:13,color:"var(--teal)",textDecoration:"none",fontWeight:600}}>+ Add Foster Parent</Link>
            </div>
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th>Currently Fostering</th><th>Profile</th></tr></thead>
                <tbody>
                  {filteredRoster.length===0 ? <tr><td colSpan={6} className="empty-state">{rosterSearch?"No matches":"No foster parents on file"}</td></tr>
                  : filteredRoster.map((p)=>{
                    const active=parentCapacity[p.id]||0;
                    return (
                      <tr key={p.id}>
                        <td style={{fontWeight:700}}>{p.first_name} {p.last_name}</td>
                        <td style={{fontSize:12}}>{p.phone||"—"}</td>
                        <td style={{fontSize:12}}>{p.email||"—"}</td>
                        <td style={{fontSize:12}}>{p.city||"—"}</td>
                        <td>{active>0?<span style={{background:"#fef3c7",color:"#92400e",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:700}}>{active} animal{active!==1?"s":""}</span>:<span style={{color:"var(--text-muted)",fontSize:12}}>Available</span>}</td>
                        <td><Link href={`/people/${p.id}`} className="btn btn-ghost btn-sm" style={{fontSize:12}}>Profile →</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── APPLICATIONS ── */}
        {tab==="applications"&&(
          <div>
            <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"12px 18px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
              <div style={{fontSize:13}}><strong>Public application link:</strong> <span style={{fontFamily:"monospace",color:"#0f2942"}}>{typeof window!=="undefined"?window.location.origin:""}/foster-apply</span></div>
              <a href="/foster-apply" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View Form →</a>
            </div>
            <div className="card" style={{padding:0,overflow:"hidden"}}>
              <table className="data-table">
                <thead><tr><th>Applicant</th><th>Email</th><th>Phone</th><th>Preference</th><th>Submitted</th><th>Status</th><th style={{textAlign:"center"}}>Action</th></tr></thead>
                <tbody>
                  {applications.length===0 ? <tr><td colSpan={7} className="empty-state">No foster applications on file</td></tr>
                  : applications.map((app)=>{
                    const sc:Record<string,string>={pending:"#f59e0b",approved:"#16a34a",rejected:"#dc2626",more_info:"#2563eb"};
                    return (
                      <tr key={app.id} style={{cursor:"pointer"}} onClick={()=>{setReviewApp(app);setReviewNotes(app.admin_notes||"");}}>
                        <td style={{fontWeight:700}}>{app.first_name} {app.last_name}</td>
                        <td style={{fontSize:12}}>{app.email||"—"}</td>
                        <td style={{fontSize:12}}>{app.phone||"—"}</td>
                        <td style={{fontSize:12}}>{app.animal_preference||"—"}</td>
                        <td style={{fontSize:12,color:"var(--text-secondary)"}}>{app.created_at?new Date(app.created_at).toLocaleDateString():"—"}</td>
                        <td><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:`${sc[app.status??"pending"]||"#6b7280"}20`,color:sc[app.status??"pending"]||"#6b7280"}}>{(app.status??"pending").replace("_"," ").toUpperCase()}</span></td>
                        <td style={{textAlign:"center"}}><button className="btn btn-ghost btn-sm" onClick={(e)=>{e.stopPropagation();setReviewApp(app);setReviewNotes(app.admin_notes||"");}}>Review →</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SUPPLY REQUESTS ── */}
        {tab==="supplies"&&(
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <table className="data-table">
              <thead><tr><th>Foster Parent</th><th>Items</th><th>Notes</th><th>Submitted</th><th>Status</th><th style={{textAlign:"center"}}>Action</th></tr></thead>
              <tbody>
                {supplyRequests.length===0 ? <tr><td colSpan={6} className="empty-state">No supply requests</td></tr>
                : supplyRequests.map((r)=>(
                  <tr key={r.id}>
                    <td style={{fontWeight:600}}>{r.foster_parent_name||"—"}</td>
                    <td style={{fontSize:12}}>{safeArray(r.items).join(", ")||"—"}</td>
                    <td style={{fontSize:12,color:"var(--text-secondary)"}}>{r.notes||"—"}</td>
                    <td style={{fontSize:12,color:"var(--text-secondary)"}}>{r.created_at?new Date(r.created_at).toLocaleDateString():"—"}</td>
                    <td><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:r.status==="pending"?"#fef3c720":"#dcfce7",color:r.status==="pending"?"#92400e":"#15803d"}}>{(r.status||"pending").toUpperCase()}</span></td>
                    <td style={{textAlign:"center"}}>
                      {r.status==="pending"&&(
                        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
                          <button className="btn btn-ghost btn-sm" style={{color:"#16a34a",fontSize:12}} onClick={async()=>{await updateFosterSupplyRequest(r.id!,{status:"fulfilled",fulfilled_at:new Date().toISOString()});load();}}>✓ Fulfill</button>
                          <button className="btn btn-ghost btn-sm" style={{color:"#dc2626",fontSize:12}} onClick={async()=>{await updateFosterSupplyRequest(r.id!,{status:"denied"});load();}}>✗ Deny</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PLACE IN FOSTER MODAL ── */}
      {showPlace&&(
        <div className="modal-overlay" onClick={resetPlace}>
          <div className="modal" onClick={(e)=>e.stopPropagation()} style={{maxWidth:580,maxHeight:"90dvh",display:"flex",flexDirection:"column"}}>
            <div className="modal-header">
              <span className="modal-title">❤️ Place Animal in Foster{!placedId?` — Step ${placeStep} of 3`:""}</span>
              <button className="btn btn-ghost btn-sm" onClick={resetPlace}>✕</button>
            </div>
            <div className="modal-body" style={{flex:1,overflowY:"auto"}}>
              {placedId ? (
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>Foster placement created!</div>
                  <div style={{fontSize:13,color:"var(--text-secondary)",marginBottom:20}}>{placeAnimal?.name} is now in foster care with {placeParent?.first_name} {placeParent?.last_name}.</div>
                  <button className="btn btn-secondary" onClick={()=>{
                    const pl={animal_id:placeAnimal?.id??"",foster_parent_id:placeParent?.id??"",animal_name:placeAnimal?.name,foster_parent_name:`${placeParent?.first_name} ${placeParent?.last_name}`,start_date:placeStartDate,expected_return_date:placeReturnDate||undefined,reason:placeReason,care_instructions:placeCareInstr||undefined,medication_schedule:placeMedSched||undefined};
                    printFosterAgreement(pl as FosterPlacement,placeAnimal??undefined,placeParent??undefined);
                  }}>🖨 Print Foster Agreement</button>
                </div>
              ) : placeStep===1 ? (
                <div>
                  <div className="form-group">
                    <label className="form-label">Search Animal <span style={{color:"#dc2626"}}>*</span></label>
                    <input className="form-input" placeholder="Name or ID…" value={placeAnimalQ} autoFocus onChange={(e)=>{setPlaceAnimalQ(e.target.value);setPlaceAnimal(null);}}/>
                    {placeAnimalMatches.length>0&&!placeAnimal&&(
                      <div style={{border:"1px solid var(--border)",borderRadius:6,marginTop:4,overflow:"hidden"}}>
                        {placeAnimalMatches.map((a)=>(
                          <div key={a.id} onClick={()=>{setPlaceAnimal(a);setPlaceAnimalQ(`${a.name} (${a.id})`);}} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid var(--border-light)",fontSize:13}}>
                            <strong>{a.name}</strong> · {a.species} · {a.breed} · <span style={{color:"var(--text-secondary)"}}>{a.id} · {a.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {placeAnimal&&(
                      <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:6,padding:"8px 12px",marginTop:6,fontSize:13,display:"flex",justifyContent:"space-between"}}>
                        <span>✓ <strong>{placeAnimal.name}</strong> · {placeAnimal.species} · {placeAnimal.id}</span>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setPlaceAnimal(null);setPlaceAnimalQ("");}}>Change</button>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Foster Parent <span style={{color:"#dc2626"}}>*</span></label>
                    <select className="form-select" value={placeParent?.id||""} onChange={(e)=>setPlaceParent(fosterParents.find((p)=>p.id===e.target.value)||null)}>
                      <option value="">— Select foster parent —</option>
                      {fosterParents.map((p)=>{
                        const active=parentCapacity[p.id]||0;
                        return <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.city?` (${p.city})`:""} · {active} currently fostering</option>;
                      })}
                    </select>
                  </div>
                </div>
              ) : placeStep===2 ? (
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={placeStartDate} onChange={(e)=>setPlaceStartDate(e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Expected Return</label><input className="form-input" type="date" value={placeReturnDate} onChange={(e)=>setPlaceReturnDate(e.target.value)}/></div>
                  <div className="form-group" style={{gridColumn:"1/-1"}}>
                    <label className="form-label">Reason</label>
                    <select className="form-select" value={placeReason} onChange={(e)=>setPlaceReason(e.target.value)}>{FOSTER_REASONS.map((r)=><option key={r}>{r}</option>)}</select>
                  </div>
                  <div className="form-group" style={{gridColumn:"1/-1"}}>
                    <label className="form-label">Care Instructions</label>
                    <textarea className="form-textarea" rows={3} value={placeCareInstr} onChange={(e)=>setPlaceCareInstr(e.target.value)} placeholder="Feeding, behavior, special requirements…"/>
                  </div>
                  <div className="form-group" style={{gridColumn:"1/-1"}}>
                    <label className="form-label">Medication Schedule</label>
                    <textarea className="form-textarea" rows={2} value={placeMedSched} onChange={(e)=>setPlaceMedSched(e.target.value)} placeholder="Drug, dose, frequency, times…"/>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>Supplies Provided</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
                    {SUPPLIES.map((s)=>{
                      const checked=placeSupplies.includes(s);
                      return (
                        <label key={s} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",border:`2px solid ${checked?"var(--teal)":"var(--border)"}`,borderRadius:8,cursor:"pointer",background:checked?"#f0fdfa":"var(--bg)",fontSize:13,fontWeight:checked?700:400}}>
                          <input type="checkbox" checked={checked} onChange={()=>setPlaceSupplies((p)=>checked?p.filter((x)=>x!==s):[...p,s])} style={{accentColor:"var(--teal)"}}/>
                          {s}
                        </label>
                      );
                    })}
                  </div>
                  <div style={{background:"#f8fafc",border:"1px solid var(--border)",borderRadius:10,padding:"14px 16px"}}>
                    <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>Review</div>
                    {[["Animal",placeAnimal?`${placeAnimal.name} (${placeAnimal.id})`:""],["Foster Parent",placeParent?`${placeParent.first_name} ${placeParent.last_name}`:""],["Start",placeStartDate],["Return",placeReturnDate||"Not specified"],["Reason",placeReason]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",gap:12,fontSize:13,padding:"4px 0",borderBottom:"1px solid var(--border-light)"}}>
                        <span style={{width:120,color:"var(--text-secondary)",flexShrink:0}}>{l}</span><strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!placedId&&(
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={placeStep===1?resetPlace:()=>setPlaceStep((s)=>s-1)}>{placeStep===1?"Cancel":"← Back"}</button>
                {placeStep<3 ? (
                  <button className="btn btn-primary btn-sm" style={{background:"#f59e0b",borderColor:"#f59e0b"}} disabled={placeStep===1&&(!placeAnimal||!placeParent)} onClick={()=>setPlaceStep((s)=>s+1)}>Next →</button>
                ) : (
                  <button className="btn btn-primary btn-sm" style={{background:"#f59e0b",borderColor:"#f59e0b"}} onClick={handlePlace} disabled={placeSaving||!placeAnimal||!placeParent}>{placeSaving?"Saving…":"✓ Confirm Placement"}</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RETURN MODAL ── */}
      {returnPlacement&&(
        <div className="modal-overlay" onClick={()=>setReturnPlacement(null)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()} style={{maxWidth:460}}>
            <div className="modal-header"><span className="modal-title">↩ Return from Foster — {returnPlacement.animal_name}</span><button className="btn btn-ghost btn-sm" onClick={()=>setReturnPlacement(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Condition at Return</label><select className="form-select" value={returnCondition} onChange={(e)=>setReturnCondition(e.target.value)}>{RETURN_CONDITIONS.map((c)=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Set Animal Status To</label><select className="form-select" value={returnStatus} onChange={(e)=>setReturnStatus(e.target.value)}><option value="Available">Available</option><option value="Medical Hold">Medical Hold</option><option value="Pending">Pending</option><option value="Quarantine">Quarantine</option></select></div>
              <div className="form-group"><label className="form-label">Return Notes</label><textarea className="form-textarea" rows={3} value={returnNotes} onChange={(e)=>setReturnNotes(e.target.value)} placeholder="Health, behavior, any issues during foster…"/></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary btn-sm" onClick={()=>setReturnPlacement(null)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleReturn} disabled={returnSaving}>{returnSaving?"Saving…":"↩ Confirm Return"}</button></div>
          </div>
        </div>
      )}

      {/* ── CHECK-IN MODAL ── */}
      {checkinPlacement&&(
        <div className="modal-overlay" onClick={()=>setCheckinPlacement(null)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()} style={{maxWidth:420}}>
            <div className="modal-header"><span className="modal-title">📋 Log Check-In — {checkinPlacement.animal_name}</span><button className="btn btn-ghost btn-sm" onClick={()=>setCheckinPlacement(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Contact Method</label>
                <div style={{display:"flex",gap:6}}>
                  {CHECKIN_METHODS.map((m)=><button key={m} onClick={()=>setCheckinMethod(m)} style={{flex:1,padding:"8px 0",border:"2px solid",borderColor:checkinMethod===m?"var(--teal)":"var(--border)",borderRadius:6,background:checkinMethod===m?"#f0fdfa":"var(--bg)",color:checkinMethod===m?"var(--teal)":"var(--text)",fontWeight:700,cursor:"pointer",fontSize:13}}>{m}</button>)}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" rows={3} value={checkinNotes} onChange={(e)=>setCheckinNotes(e.target.value)} placeholder="Animal doing well, concerns, foster parent feedback…" autoFocus/></div>
            </div>
            <div className="modal-footer"><button className="btn btn-secondary btn-sm" onClick={()=>setCheckinPlacement(null)}>Cancel</button><button className="btn btn-primary btn-sm" onClick={handleCheckin} disabled={checkinSaving}>{checkinSaving?"Saving…":"✓ Save Check-In"}</button></div>
          </div>
        </div>
      )}

      {/* ── APPLICATION REVIEW MODAL ── */}
      {reviewApp&&(
        <div className="modal-overlay" onClick={()=>setReviewApp(null)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()} style={{maxWidth:640}}>
            <div className="modal-header"><span className="modal-title">Foster Application — {reviewApp.first_name} {reviewApp.last_name}</span><button className="btn btn-ghost btn-sm" onClick={()=>setReviewApp(null)}>✕</button></div>
            <div className="modal-body" style={{maxHeight:"65vh",overflowY:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 24px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:8,padding:"14px 16px",marginBottom:14}}>
                {([
                  ["Name",`${reviewApp.first_name} ${reviewApp.last_name}`],
                  ["Email",reviewApp.email],["Phone",reviewApp.phone],
                  ["Address",[reviewApp.address,reviewApp.city,reviewApp.state,reviewApp.zip].filter(Boolean).join(", ")],
                  ["Housing",reviewApp.housing],["Dwelling",reviewApp.dwelling_type],
                  ["Fenced Yard",reviewApp.fenced_yard?"Yes":"No"],["Fence Details",reviewApp.fence_details],
                  ["Preference",reviewApp.animal_preference],["Max Animals",reviewApp.max_animals?.toString()],
                  ["Duration",reviewApp.foster_duration],["Special Needs",reviewApp.special_needs?"Yes":"No"],
                  ["Bottle Feed",reviewApp.bottle_feed?"Yes":"No"],["Vet",reviewApp.vet_info],
                  ["EC Name",reviewApp.emergency_contact_name],["EC Phone",reviewApp.emergency_contact_phone],
                ] as [string,string|undefined][]).map(([l,v])=>v?(
                  <div key={l} style={{padding:"3px 0"}}>
                    <span style={{fontSize:10,fontWeight:700,color:"#6b7280",display:"block",textTransform:"uppercase",letterSpacing:"0.4px"}}>{l}</span>
                    <span style={{fontSize:13}}>{v}</span>
                  </div>
                ):null)}
              </div>
              {reviewApp.why_foster&&<div className="form-group"><label className="form-label">Why They Want to Foster</label><div style={{fontSize:13,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:6,padding:"10px 12px",lineHeight:1.7}}>{reviewApp.why_foster}</div></div>}
              {reviewApp.previous_experience&&<div className="form-group"><label className="form-label">Previous Experience</label><div style={{fontSize:13,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:6,padding:"10px 12px",lineHeight:1.7}}>{reviewApp.previous_experience}</div></div>}
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">Reviewer Notes</label><textarea className="form-textarea" rows={3} value={reviewNotes} onChange={(e)=>setReviewNotes(e.target.value)} placeholder="Internal notes or feedback for the applicant…"/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setReviewApp(null)} disabled={reviewSaving}>Close</button>
              <div style={{flex:1}}/>
              {reviewApp.status!=="more_info"&&<button className="btn btn-sm" style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe"}} disabled={reviewSaving} onClick={()=>handleAppAction("more_info")}>{reviewSaving?"Saving…":"📋 More Info"}</button>}
              {reviewApp.status!=="rejected"&&<button className="btn btn-sm" style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fca5a5"}} disabled={reviewSaving} onClick={()=>handleAppAction("rejected")}>{reviewSaving?"Saving…":"✗ Reject"}</button>}
              {reviewApp.status!=="approved"&&<button className="btn btn-primary btn-sm" disabled={reviewSaving} onClick={()=>handleAppAction("approved")}>{reviewSaving?"Saving…":"✓ Approve — Create Foster Parent"}</button>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
