"use client";
import { useState, useEffect, useCallback, useRef } from "react";
// All DB calls use supabasePublic — this is a public page with no staff auth.
import { supabasePublic } from "@/lib/supabase-public";
import type { Person, FosterPlacement, FosterUpdate, Animal } from "@/lib/types";
import { today } from "@/lib/utils";
import { AGENCY_NAME, AGENCY_SHORT, AGENCY_ADDRESS, AGENCY_PHONE } from "@/lib/shelterInfo";

// ── Tiny helper matching lib/data's safeArray (no DB call) ────────────────────
function safeArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { const p = JSON.parse(v); if (Array.isArray(p)) return p as string[]; } catch { /* fall through */ }
  }
  return [];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const UPDATE_STATUSES = ["Great", "Good", "Concerns", "Emergency"] as const;
const SUPPLY_ITEMS = ["Food", "Water bowl", "Crate", "Leash", "Medication refill", "Litter", "Litter box", "Carrier", "Toys", "Blanket", "Other"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr?: string | null): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type StatusColor = { bg: string; color: string };
const UPDATE_COLORS: Record<string, StatusColor> = {
  Great:     { bg: "#dcfce7", color: "#15803d" },
  Good:      { bg: "#dbeafe", color: "#1d4ed8" },
  Concerns:  { bg: "#fef3c7", color: "#92400e" },
  Emergency: { bg: "#fee2e2", color: "#b91c1c" },
};

// ── Portal session ─────────────────────────────────────────────────────────────
interface PortalSession { personId: string; pid: string; firstName: string; lastName: string; }

// ── Animal card ───────────────────────────────────────────────────────────────
function AnimalCard({
  placement, animal, onUpdate,
}: {
  placement: FosterPlacement;
  animal?: Animal;
  onUpdate: () => void;
}) {
  const [updates, setUpdates] = useState<FosterUpdate[]>([]);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<typeof UPDATE_STATUSES[number]>("Good");
  const [eatingWell, setEatingWell] = useState<boolean | null>(null);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (placement.id) {
      supabasePublic
        .from("foster_updates")
        .select("*")
        .eq("placement_id", placement.id)
        .order("created_at", { ascending: false })
        .then((res: { data: unknown }) => { if (res.data) setUpdates(res.data as FosterUpdate[]); });
    }
  }, [placement.id, saved]);

  const dLeft = daysUntil(placement.expected_return_date);
  const emoji = animal?.species === "Dog" ? "🐕" : animal?.species === "Cat" ? "🐈" : "🐾";
  const photo = animal?.featured_photo_url || animal?.photo_url || null;

  async function handleUpdate() {
    setSaving(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile && placement.animal_id) {
        const path = `public/${placement.animal_id}/${Date.now()}-${photoFile.name}`;
        const { error } = await supabasePublic.storage.from("animal-photos").upload(path, photoFile, { upsert: true });
        if (!error) {
          const { data: urlData } = supabasePublic.storage.from("animal-photos").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }
      const { error: updateErr } = await supabasePublic.from("foster_updates").insert({
        placement_id: placement.id,
        foster_parent_id: placement.foster_parent_id,
        animal_id: placement.animal_id,
        date: today(),
        status: updateStatus,
        eating_well: eatingWell ?? null,
        weight: weight.trim() || null,
        photo_url: photoUrl ?? null,
        notes: notes.trim() || null,
      });
      if (updateErr) throw updateErr;
      setSaved(true);
      setShowUpdateForm(false);
      setNotes(""); setWeight(""); setEatingWell(null); setPhotoFile(null);
      setTimeout(() => setSaved(false), 3000);
      onUpdate();
    } catch (e) { console.error("[update]", e); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      {/* Animal photo / header */}
      <div style={{ background: "#f0f7ff", height: 180, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {photo ? (
          <img src={photo} alt={placement.animal_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 72 }}>{emoji}</div>
        )}
        {updateStatus === "Emergency" && (
          <div style={{ position: "absolute", top: 10, right: 10, background: "#dc2626", color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>🚨 EMERGENCY</div>
        )}
      </div>

      <div style={{ padding: "16px 18px" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "#0f2942", marginBottom: 2 }}>
          {placement.animal_name ?? "Animal"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          {[animal?.species, animal?.breed, animal?.sex].filter(Boolean).join(" · ")}
        </div>

        {/* Foster period */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginBottom: 14, fontSize: 12 }}>
          <div><span style={{ color: "#94a3b8" }}>Foster start</span><br /><strong>{fmtDate(placement.start_date)}</strong></div>
          <div><span style={{ color: "#94a3b8" }}>Expected return</span><br />
            <strong style={{ color: dLeft < 0 ? "#dc2626" : dLeft <= 7 ? "#d97706" : "inherit" }}>
              {placement.expected_return_date ? fmtDate(placement.expected_return_date) : "Open-ended"}
              {dLeft < 0 && ` (${Math.abs(dLeft)}d overdue)`}
              {dLeft >= 0 && dLeft <= 7 && ` (in ${dLeft}d)`}
            </strong>
          </div>
        </div>

        {/* Care instructions */}
        {placement.care_instructions && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Care Instructions</div>
            {placement.care_instructions}
          </div>
        )}

        {/* Medication */}
        {placement.medication_schedule && (
          <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13, lineHeight: 1.7 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>💊 Medication Schedule</div>
            {placement.medication_schedule}
          </div>
        )}

        {/* Recent updates */}
        {updates.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Recent Updates</div>
            {updates.slice(0, 2).map((u) => {
              const sc = UPDATE_COLORS[u.status ?? "Good"] ?? UPDATE_COLORS["Good"];
              return (
                <div key={u.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ padding: "1px 7px", borderRadius: 10, fontWeight: 700, fontSize: 10, background: sc.bg, color: sc.color, whiteSpace: "nowrap", flexShrink: 0 }}>{u.status}</span>
                  <span style={{ color: "#475569" }}>{u.notes || "No notes"}</span>
                  <span style={{ color: "#94a3b8", whiteSpace: "nowrap", marginLeft: "auto" }}>{fmtDate(u.date)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit update form */}
        {showUpdateForm ? (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Submit Update</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {UPDATE_STATUSES.map((s) => {
                const sc = UPDATE_COLORS[s];
                return (
                  <button key={s} onClick={() => setUpdateStatus(s)} style={{ flex: "1 1 auto", padding: "8px 0", border: `2px solid ${updateStatus === s ? sc.color : "#e2e8f0"}`, borderRadius: 8, background: updateStatus === s ? sc.bg : "#fff", color: updateStatus === s ? sc.color : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    {s}
                  </button>
                );
              })}
            </div>

            {updateStatus === "Emergency" && (
              <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>
                🚨 For emergencies, please also call ${AGENCY_SHORT} immediately at <a href="tel:+15550009999" style={{ color: "#b91c1c" }}>${AGENCY_PHONE}</a>
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Eating well?</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["Yes", true], ["No", false]].map(([l, v]) => (
                  <button key={String(l)} onClick={() => setEatingWell(v as boolean)} style={{ flex: 1, padding: "7px 0", border: "2px solid", borderColor: eatingWell === v ? "#0d9488" : "#e2e8f0", borderRadius: 6, background: eatingWell === v ? "#f0fdfa" : "#fff", color: eatingWell === v ? "#0d9488" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{String(l)}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Weight (lbs)</label>
                <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Optional" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Add a photo</label>
                <input type="file" accept="image/*,image/heic,image/heif" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} style={{ width: "100%", fontSize: 12 }} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Notes / Observations</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="How is the animal doing? Any concerns?" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowUpdateForm(false)} style={{ flex: 1, padding: "10px 0", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={handleUpdate} disabled={saving} style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 8, background: saving ? "#9ca3af" : "#0d9488", color: "#fff", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
                {saving ? "Submitting…" : "Submit Update"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowUpdateForm(true)} style={{ width: "100%", padding: "10px 0", border: "2px solid #0d9488", borderRadius: 8, background: "#f0fdfa", color: "#0d9488", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
            + Submit Update
          </button>
        )}
        {saved && <div style={{ textAlign: "center", color: "#16a34a", fontWeight: 700, fontSize: 13, marginTop: 8 }}>✓ Update submitted!</div>}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FosterPortalPage() {
  const [authState, setAuthState] = useState<"login" | "portal">("login");
  const [pidInput, setPidInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState<PortalSession | null>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [activePlacements, setActivePlacements] = useState<FosterPlacement[]>([]);
  const [pastPlacements, setPastPlacements] = useState<FosterPlacement[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [tab, setTab] = useState<"current" | "history" | "supplies">("current");

  // Supply request
  const [supplyItems, setSupplyItems] = useState<string[]>([]);
  const [supplyNotes, setSupplyNotes] = useState("");
  const [supplySubmitting, setSupplySubmitting] = useState(false);
  const [supplySubmitted, setSupplySubmitted] = useState(false);

  // Restore session
  useEffect(() => {
    try {
      const raw = localStorage.getItem("foster_portal_session");
      if (raw) {
        const s: PortalSession = JSON.parse(raw);
        setSession(s);
        setAuthState("portal");
      }
    } catch { /* ignore */ }
  }, []);

  const loadPortalData = useCallback(async (personId: string) => {
    try {
      const [placementsRes, animalsRes] = await Promise.all([
        supabasePublic
          .from("foster_placements")
          .select("*")
          .eq("foster_parent_id", personId)
          .order("start_date", { ascending: false }),
        supabasePublic
          .from("animals")
          .select("*")
          .neq("intake_type", "Clinic")
          .order("created_at", { ascending: false }),
      ]);
      const allPlacements = (placementsRes.data as FosterPlacement[]) ?? [];
      const allAnimals    = (animalsRes.data    as Animal[])          ?? [];
      setActivePlacements(allPlacements.filter((p) => p.status === "Active"));
      setPastPlacements(allPlacements.filter((p) => p.status !== "Active"));
      setAnimals(allAnimals);
    } catch (e) { console.error("[portal load]", e); }
  }, []);

  useEffect(() => {
    if (authState === "portal" && session) {
      loadPortalData(session.personId);
    }
  }, [authState, session, loadPortalData]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const pidRaw = pidInput.trim().toUpperCase();
      const normalized = /^\d+$/.test(pidRaw) ? `PID-${pidRaw.padStart(5, "0")}` : pidRaw;
      const { data: rows } = await supabasePublic
        .from("people")
        .select("*")
        .eq("pid", normalized)
        .eq("active", true)
        .limit(1);
      const found = (rows as Person[] | null)?.[0] ?? null;
      if (!found) { setAuthError("ID not found. Check your PID card and try again."); return; }
      if (found.role !== "Foster Parent") { setAuthError("This ID is not registered as a foster parent account. Contact ${AGENCY_SHORT} if this is an error."); return; }
      if (found.last_name.toLowerCase() !== lastNameInput.trim().toLowerCase()) { setAuthError("Last name does not match. Please try again."); return; }
      const s: PortalSession = { personId: found.id, pid: normalized, firstName: found.first_name, lastName: found.last_name };
      localStorage.setItem("foster_portal_session", JSON.stringify(s));
      setPerson(found);
      setSession(s);
      setAuthState("portal");
    } catch { setAuthError("Login failed. Please try again."); }
    finally { setAuthLoading(false); }
  }

  function handleSignOut() {
    localStorage.removeItem("foster_portal_session");
    setAuthState("login"); setSession(null); setPerson(null);
    setPidInput(""); setLastNameInput(""); setAuthError("");
    setActivePlacements([]); setPastPlacements([]);
  }

  async function handleSupplyRequest() {
    if (!session || supplyItems.length === 0) return;
    setSupplySubmitting(true);
    try {
      const { error: supplyErr } = await supabasePublic.from("foster_supply_requests").insert({
        foster_parent_id: session.personId,
        foster_parent_name: `${session.firstName} ${session.lastName}`,
        items: supplyItems,
        notes: supplyNotes.trim() || null,
        status: "pending",
      });
      if (supplyErr) throw supplyErr;
      setSupplySubmitted(true);
      setSupplyItems([]); setSupplyNotes("");
      setTimeout(() => setSupplySubmitted(false), 5000);
    } catch (e) { console.error("[supply]", e); }
    finally { setSupplySubmitting(false); }
  }

  // ── Login screen ─────────────────────────────────────────────────────────
  if (authState === "login") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#0f2942", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <img src="/logo.jpg" alt="${AGENCY_SHORT}" style={{ height: 60, width: 60, objectFit: "contain", background: "#ececec", borderRadius: 12, padding: 4, marginBottom: 16 }} />
        <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Foster Parent Portal</div>
        <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 28 }}>${AGENCY_NAME}</div>
        <form onSubmit={handleLogin} style={{ background: "#fff", borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Foster Parent ID (PID)</label>
            <input autoFocus value={pidInput} onChange={(e) => setPidInput(e.target.value)} placeholder="e.g. PID-01001 or 01001" autoCapitalize="none" autoCorrect="off" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "11px 14px", fontSize: 15, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Last Name</label>
            <input value={lastNameInput} onChange={(e) => setLastNameInput(e.target.value)} placeholder="Your last name" autoCapitalize="words" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "11px 14px", fontSize: 15, boxSizing: "border-box" }} />
          </div>
          {authError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{authError}</div>}
          <button type="submit" disabled={authLoading || !pidInput.trim() || !lastNameInput.trim()} style={{ width: "100%", padding: "13px 0", background: authLoading ? "#9ca3af" : "#0d9488", color: "#fff", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: authLoading ? "not-allowed" : "pointer" }}>
            {authLoading ? "Signing in…" : "Sign In"}
          </button>
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#94a3b8" }}>
            Your PID is on your approval letter. Questions? Call <a href="tel:+15550009999" style={{ color: "#0d9488" }}>${AGENCY_PHONE}</a>
          </div>
        </form>
        <div style={{ marginTop: 20, fontSize: 13, color: "#64748b" }}>
          Want to foster? <a href="/foster-apply" style={{ color: "#7fc6c6", fontWeight: 700 }}>Apply here →</a>
        </div>
      </div>
    );
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  const animalMap = Object.fromEntries(animals.map((a) => [a.id, a]));

  return (
    <div style={{ minHeight: "100dvh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#0f2942", padding: "0 16px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.jpg" alt="${AGENCY_SHORT}" style={{ height: 36, width: 36, objectFit: "contain", background: "#ececec", borderRadius: 7, padding: 2 }} />
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>Foster Portal</div>
              <div style={{ color: "#7fc6c6", fontSize: 11 }}>Welcome, {session?.firstName}!</div>
            </div>
          </div>
          <button onClick={handleSignOut} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#fff", fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>Sign Out</button>
        </div>
      </header>

      {/* Emergency banner */}
      <div style={{ background: "#dc2626", color: "#fff", textAlign: "center", padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>
        🚨 Foster animal emergency? Call ${AGENCY_SHORT} immediately: <a href="tel:+15550009999" style={{ color: "#fca5a5", fontWeight: 800 }}>${AGENCY_PHONE}</a>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: 20, gap: 0 }}>
          {([
            ["current",  `My Animals (${activePlacements.length})`],
            ["history",  `History (${pastPlacements.length})`],
            ["supplies", "Request Supplies"],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", color: tab === key ? "#0f2942" : "#64748b", borderBottom: `2px solid ${tab === key ? "#0f2942" : "transparent"}`, marginBottom: -2 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Current Animals ── */}
        {tab === "current" && (
          activePlacements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🐾</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No animals in your care right now</div>
              <div style={{ fontSize: 14 }}>When ${AGENCY_SHORT} places an animal with you, it will appear here.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {activePlacements.map((pl) => (
                <AnimalCard
                  key={pl.id}
                  placement={pl}
                  animal={animalMap[pl.animal_id]}
                  onUpdate={() => loadPortalData(session!.personId)}
                />
              ))}
            </div>
          )
        )}

        {/* ── History ── */}
        {tab === "history" && (
          pastPlacements.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>No foster history yet</div>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              {pastPlacements.map((pl) => {
                const a = animalMap[pl.animal_id];
                return (
                  <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 28 }}>{a?.species === "Dog" ? "🐕" : a?.species === "Cat" ? "🐈" : "🐾"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{pl.animal_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{[a?.species, a?.breed].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
                      <div>{fmtDate(pl.start_date)} – {fmtDate(pl.actual_return_date)}</div>
                      <div style={{ fontWeight: 600, color: "#374151" }}>{pl.status}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Supply Requests ── */}
        {tab === "supplies" && (
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "20px 22px" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f2942", marginBottom: 4 }}>Request Supplies</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Select any supplies you need for your foster animals. ${AGENCY_SHORT} will prepare them for pickup or drop-off.</div>

              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>What do you need?</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {SUPPLY_ITEMS.map((s) => {
                  const checked = supplyItems.includes(s);
                  return (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", border: `2px solid ${checked ? "#0d9488" : "#e2e8f0"}`, borderRadius: 8, cursor: "pointer", background: checked ? "#f0fdfa" : "#fff", fontSize: 13, fontWeight: checked ? 700 : 400 }}>
                      <input type="checkbox" checked={checked} onChange={() => setSupplyItems((p) => checked ? p.filter((x) => x !== s) : [...p, s])} style={{ accentColor: "#0d9488" }} />
                      {s}
                    </label>
                  );
                })}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Notes (optional)</label>
                <textarea value={supplyNotes} onChange={(e) => setSupplyNotes(e.target.value)} rows={2} placeholder="Specific brand, quantity, or other details…" style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              </div>

              <button onClick={handleSupplyRequest} disabled={supplySubmitting || supplyItems.length === 0} style={{ width: "100%", padding: "12px 0", border: "none", borderRadius: 8, background: supplySubmitting || supplyItems.length === 0 ? "#9ca3af" : "#0d9488", color: "#fff", fontWeight: 800, fontSize: 15, cursor: supplySubmitting || supplyItems.length === 0 ? "not-allowed" : "pointer" }}>
                {supplySubmitting ? "Submitting…" : "Submit Request"}
              </button>
              {supplySubmitted && <div style={{ textAlign: "center", color: "#16a34a", fontWeight: 700, fontSize: 14, marginTop: 12 }}>✓ Request submitted! ${AGENCY_SHORT} will be in touch.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
