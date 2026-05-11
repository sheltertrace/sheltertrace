"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchCall, updateCall, fetchPeople, fetchOfficers, fetchCitations, createPerson, addPersonNote, fetchFormsByLinked, fetchAnimals } from "@/lib/data";
import { fetchOfficerFieldStatuses } from "@/lib/fieldOps";
import type { DispatchCall, Person, Officer, Animal, InvolvedParty, EvidenceItem, NarrativeEntry, Citation, ShelterForm, FormPreFill, FormType, OfficerFieldProfile, FieldStatus } from "@/lib/types";
import dynamic from "next/dynamic";
const QuickIntakeModal = dynamic(() => import("@/components/dispatch/QuickIntakeModal"), { ssr: false });
import { CALL_STATUSES, CALL_STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";
import { today, nowTime, genId } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/providers";
import PhotoIdThumb from "@/components/ui/PhotoIdThumb";
import GenerateFormButton from "@/components/forms/GenerateFormButton";
import ReprintFormButton from "@/components/forms/ReprintFormButton";
import { formatDate } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = [
  "Call Review", "Victim (Person)", "Victim (Animal)",
  "Suspect (Person)", "Suspect (Animal)", "Narrative",
  "Evidence", "Citations", "Officer Actions", "Finalize",
];

// ── Module-level sub-components ───────────────────────────────────────────────
function F({ label, req, span, children }: { label: string; req?: boolean; span?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group" style={span ? { gridColumn: "1/-1" } : undefined}>
      <label className="form-label">{label}{req && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function PersonSearchRow({ people, selectedId, onSelect, onClear }: {
  people: Person[]; selectedId: string; onSelect: (p: Person) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (q.trim().length < 2) return [];
    const lo = q.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(lo) || (p.phone || "").includes(q)).slice(0, 6);
  }, [people, q]);

  const sel = selectedId ? people.find((p) => p.id === selectedId) : null;
  if (sel) return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {sel.photo_id_url && <PhotoIdThumb url={sel.photo_id_url} name={`${sel.first_name} ${sel.last_name}`} size={36} />}
        <span>✓ <strong>{sel.first_name} {sel.last_name}</strong> · {sel.phone || "no phone"} · <span style={{ color: "var(--text-muted)" }}>{sel.pid} · {sel.role}</span>
          {sel.photo_id_url && <span style={{ marginLeft: 8, fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>🪪 ID on file</span>}
        </span>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onClear}>Change</button>
    </div>
  );
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <input className="form-input" placeholder="Search contacts by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
          {matches.map((p) => (
            <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => { onSelect(p); setQ(""); }}>
              <div style={{ flex: 1 }}>
                <strong>{p.first_name} {p.last_name}</strong>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.role} · {p.pid}</span>
              </div>
              {p.photo_id_url && <PhotoIdThumb url={p.photo_id_url} name={`${p.first_name} ${p.last_name}`} size={28} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepNavItem({ n, name, current, done, onClick }: { n: number; name: string; current: boolean; done: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, cursor: "pointer", marginBottom: 3, background: current ? "#0f2942" : done ? "#f0fdf4" : "#f8fafc", color: current ? "#fff" : done ? "#15803d" : "var(--text-secondary)", transition: "background .15s" }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: current ? "rgba(255,255,255,.18)" : done ? "#16a34a" : "#e2e8f0", color: current ? "#fff" : done ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
        {done && !current ? "✓" : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: current ? 700 : 400 }}>{name}</span>
    </div>
  );
}

// ── Report data interface ─────────────────────────────────────────────────────
interface ReportData {
  status: string;
  arrival_time: string;
  departure_time: string;
  disposition_notes: string;
  victim_skip: boolean; victim_person_id: string; victim_name: string; victim_first: string; victim_middle: string; victim_last: string; victim_phone: string;
  victim_address: string; victim_dl: string; victim_dob: string; victim_sex: string;
  victim_injuries: string; victim_save: boolean;
  victim_animal_skip: boolean; victim_animal_species: string; victim_animal_breed: string;
  victim_animal_color: string; victim_animal_sex: string; victim_animal_size: string;
  victim_animal_desc: string; victim_animal_condition: string; victim_animal_injuries: string;
  suspect_skip: boolean; suspect_person_id: string; suspect_name: string; suspect_first: string; suspect_middle: string; suspect_last: string; suspect_phone: string;
  suspect_address: string; suspect_dl: string; suspect_dob: string; suspect_sex: string;
  suspect_hair: string; suspect_eyes: string; suspect_weight: string; suspect_height: string; suspect_save: boolean;
  suspect_animal_skip: boolean; suspect_animal_species: string; suspect_animal_breed: string;
  suspect_animal_color: string; suspect_animal_sex: string; suspect_animal_size: string;
  suspect_animal_desc: string; suspect_animal_behavior: string; suspect_animal_dangerous: boolean;
  assigned_officers: Array<{ id: string; name: string; badge: string; vehicle: string }>;
  primary_officer_id: string;
  transfer_to_id: string;
  backup_id: string;
}

// ── Deserialize DispatchCall → ReportData ─────────────────────────────────────
function callToReportData(call: DispatchCall): ReportData {
  type P = Record<string, unknown>;
  const parties = (call.involved_parties || []) as P[];
  const victim = parties.find((p) => p.role === "Victim");
  const suspect = parties.find((p) => p.role === "Suspect");
  const aVic = parties.find((p) => p.role === "AnimalVictim");
  const aSus = parties.find((p) => p.role === "AnimalSuspect");
  const s = (v: unknown) => (v as string) || "";
  return {
    status: call.status || "Dispatched",
    arrival_time: "", departure_time: "", disposition_notes: "",
    victim_skip: !victim, victim_person_id: s(victim?.person_id), victim_name: s(victim?.name), victim_first: s(victim?.first), victim_middle: s(victim?.middle), victim_last: s(victim?.last),
    victim_phone: s(victim?.phone), victim_address: s(victim?.address), victim_dl: s(victim?.dl),
    victim_dob: s(victim?.dob), victim_sex: s(victim?.sex), victim_injuries: s(victim?.injuries), victim_save: false,
    victim_animal_skip: !aVic, victim_animal_species: s(aVic?.species) || "Dog", victim_animal_breed: s(aVic?.breed),
    victim_animal_color: s(aVic?.color), victim_animal_sex: s(aVic?.sex), victim_animal_size: s(aVic?.size),
    victim_animal_desc: s(aVic?.desc), victim_animal_condition: s(aVic?.condition) || "Unknown", victim_animal_injuries: s(aVic?.injuries),
    suspect_skip: !suspect, suspect_person_id: s(suspect?.person_id), suspect_name: s(suspect?.name), suspect_first: s(suspect?.first), suspect_middle: s(suspect?.middle), suspect_last: s(suspect?.last),
    suspect_phone: s(suspect?.phone), suspect_address: s(suspect?.address), suspect_dl: s(suspect?.dl),
    suspect_dob: s(suspect?.dob), suspect_sex: s(suspect?.sex), suspect_hair: s(suspect?.hair),
    suspect_eyes: s(suspect?.eyes), suspect_weight: s(suspect?.weight), suspect_height: s(suspect?.height), suspect_save: false,
    suspect_animal_skip: !aSus, suspect_animal_species: s(aSus?.species) || "Dog", suspect_animal_breed: s(aSus?.breed),
    suspect_animal_color: s(aSus?.color), suspect_animal_sex: s(aSus?.sex), suspect_animal_size: s(aSus?.size),
    suspect_animal_desc: s(aSus?.desc), suspect_animal_behavior: s(aSus?.behavior) || "Unknown",
    suspect_animal_dangerous: (aSus?.dangerous as boolean) || false,
    assigned_officers: (call.assigned_officers || []) as ReportData["assigned_officers"],
    primary_officer_id: "", transfer_to_id: "", backup_id: "",
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
function CallDetailPageInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const initialStep = parseInt(searchParams.get("step") || "1", 10);

  const [call, setCall] = useState<DispatchCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [callCitations, setCallCitations] = useState<Citation[]>([]);
  const [step, setStep] = useState(() => (initialStep >= 1 && initialStep <= 10 ? initialStep : 1));
  const [data, setData] = useState<ReportData>({
    status: "Dispatched", arrival_time: "", departure_time: "", disposition_notes: "",
    victim_skip: true, victim_person_id: "", victim_name: "", victim_first: "", victim_middle: "", victim_last: "", victim_phone: "", victim_address: "",
    victim_dl: "", victim_dob: "", victim_sex: "", victim_injuries: "", victim_save: false,
    victim_animal_skip: true, victim_animal_species: "Dog", victim_animal_breed: "", victim_animal_color: "",
    victim_animal_sex: "", victim_animal_size: "", victim_animal_desc: "", victim_animal_condition: "Unknown", victim_animal_injuries: "",
    suspect_skip: true, suspect_person_id: "", suspect_name: "", suspect_first: "", suspect_middle: "", suspect_last: "", suspect_phone: "", suspect_address: "",
    suspect_dl: "", suspect_dob: "", suspect_sex: "", suspect_hair: "", suspect_eyes: "",
    suspect_weight: "", suspect_height: "", suspect_save: false,
    suspect_animal_skip: true, suspect_animal_species: "Dog", suspect_animal_breed: "", suspect_animal_color: "",
    suspect_animal_sex: "", suspect_animal_size: "", suspect_animal_desc: "", suspect_animal_behavior: "Unknown", suspect_animal_dangerous: false,
    assigned_officers: [], primary_officer_id: "", transfer_to_id: "", backup_id: "",
  });
  const [liveNarrative, setLiveNarrative] = useState<NarrativeEntry[]>([]);
  const [newNarrText, setNewNarrText] = useState("");
  const [editingNarrId, setEditingNarrId] = useState<string | null>(null);
  const [editNarrText, setEditNarrText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<Array<{ id: string; file: File; notes: string }>>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [callForms, setCallForms] = useState<ShelterForm[]>([]);
  const [showCallForms, setShowCallForms] = useState(false);
  const [linkedAnimals, setLinkedAnimals] = useState<Animal[]>([]);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [officerStatuses, setOfficerStatuses] = useState<OfficerFieldProfile[]>([]);

  useEffect(() => {
    fetchOfficerFieldStatuses().then(setOfficerStatuses);
    Promise.all([fetchCall(id), fetchPeople(), fetchOfficers(), fetchCitations(), fetchFormsByLinked({ callId: id })]).then(([c, p, o, cits, forms]) => {
      if (c) {
        console.log("[evidence load] from database:", c.evidence);
        setCall(c);
        setData(callToReportData(c));
        setLiveNarrative((c.narrative || []) as NarrativeEntry[]);
        // Load animals linked to this call
        const animalIds = (c.animal_ids || []) as string[];
        if (animalIds.length > 0) {
          fetchAnimals().then((all) => {
            setLinkedAnimals(all.filter((a) => animalIds.includes(a.id)));
          });
        }
      }
      setPeople(p);
      setOfficers(o);
      setCallCitations(cits.filter((ct) => ct.call_id === id));
      setCallForms(forms);
      setLoading(false);
    });
  }, [id]);

  const upd = (patch: Partial<ReportData>) => setData((d) => ({ ...d, ...patch }));

  // Apply fresh call data from Supabase to all local state at once
  const applyFreshCall = (fresh: DispatchCall) => {
    setCall(fresh);
    setData((prev) => ({
      ...callToReportData(fresh),
      // Preserve transient UI fields that aren't round-tripped through the DB
      arrival_time: prev.arrival_time,
      departure_time: prev.departure_time,
      disposition_notes: prev.disposition_notes,
    }));
    setLiveNarrative((fresh.narrative || []) as NarrativeEntry[]);
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // ── Build involved parties ────────────────────────────────────────────────
  const buildInvolved = useCallback((): InvolvedParty[] => {
    const involved: InvolvedParty[] = [];
    // Preserve Caller from Phase 1 (read-only in Phase 2)
    type P = Record<string, unknown>;
    const callerParty = ((call?.involved_parties || []) as P[]).find((p) => p.role === "Caller");
    if (callerParty) involved.push(callerParty as InvolvedParty);
    const victimFullName = [data.victim_first, data.victim_middle, data.victim_last].filter(Boolean).join(" ") || data.victim_name;
    if (!data.victim_skip && victimFullName) {
      involved.push({ role: "Victim", name: victimFullName, first: data.victim_first, middle: data.victim_middle, last: data.victim_last, phone: data.victim_phone, address: data.victim_address, dl: data.victim_dl, dob: data.victim_dob, sex: data.victim_sex, injuries: data.victim_injuries, person_id: data.victim_person_id || null });
    }
    const suspectFullName = [data.suspect_first, data.suspect_middle, data.suspect_last].filter(Boolean).join(" ") || data.suspect_name;
    if (!data.suspect_skip && suspectFullName) {
      involved.push({ role: "Suspect", name: suspectFullName, first: data.suspect_first, middle: data.suspect_middle, last: data.suspect_last, phone: data.suspect_phone, address: data.suspect_address, dl: data.suspect_dl, dob: data.suspect_dob, sex: data.suspect_sex, hair: data.suspect_hair, eyes: data.suspect_eyes, weight: data.suspect_weight, height: data.suspect_height, person_id: data.suspect_person_id || null });
    }
    if (!data.victim_animal_skip && data.victim_animal_desc) {
      involved.push({ role: "AnimalVictim", species: data.victim_animal_species, breed: data.victim_animal_breed, color: data.victim_animal_color, sex: data.victim_animal_sex, size: data.victim_animal_size, desc: data.victim_animal_desc, condition: data.victim_animal_condition, injuries: data.victim_animal_injuries });
    }
    if (!data.suspect_animal_skip && data.suspect_animal_desc) {
      involved.push({ role: "AnimalSuspect", species: data.suspect_animal_species, breed: data.suspect_animal_breed, color: data.suspect_animal_color, sex: data.suspect_animal_sex, size: data.suspect_animal_size, desc: data.suspect_animal_desc, behavior: data.suspect_animal_behavior, dangerous: data.suspect_animal_dangerous });
    }
    return involved;
  }, [call, data]);

  // ── Build save payload ────────────────────────────────────────────────────
  const buildPayload = useCallback((overrideStatus?: string): Partial<DispatchCall> => ({
    status: overrideStatus ?? data.status,
    assigned_officers: data.assigned_officers,
    narrative: liveNarrative,
    involved_parties: buildInvolved(),
    animal_ids: (call?.animal_ids || []) as string[],
    response_notes: [
      call?.response_notes,
      data.arrival_time ? `Arrival: ${data.arrival_time}` : "",
      data.departure_time ? `Departure: ${data.departure_time}` : "",
      data.disposition_notes ? `Disposition: ${data.disposition_notes}` : "",
    ].filter(Boolean).join("\n") || undefined,
  }), [data, liveNarrative, buildInvolved, call]);

  // ── Link animal to call ───────────────────────────────────────────────────
  const handleAnimalAdded = async (animal: Animal) => {
    if (!call) return;
    // Avoid duplicates
    const existing = (call.animal_ids || []) as string[];
    if (existing.includes(animal.id)) {
      setLinkedAnimals((prev) => prev.some((a) => a.id === animal.id) ? prev : [...prev, animal]);
      setShowIntakeModal(false);
      return;
    }
    const updated = [...existing, animal.id];
    try {
      const saved = await updateCall(call.id, { animal_ids: updated });
      setCall(saved);
      setLinkedAnimals((prev) => [...prev, animal]);
    } catch (e: unknown) {
      console.error("[handleAnimalAdded]", (e as { message?: string }).message);
    }
    setShowIntakeModal(false);
  };

  // ── Save progress ──────────────────────────────────────────────────────────
  const handleSaveProgress = async () => {
    if (!call) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const evidence = await uploadNewEvidence();
      const payload = { ...buildPayload(), evidence };
      console.log("[evidence save] saving to database:", evidence);
      const updated = await updateCall(call.id, payload);
      console.log("[evidence save] database result:", updated.evidence);
      applyFreshCall(updated);
      setEvidenceFiles([]);
      setSaveState("saved");
      showToast("Call saved successfully");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e: unknown) {
      setSaveState("idle");
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      const msg = [err.message, err.details, err.hint].filter(Boolean).join(" — ");
      setSaveError(msg || "Save failed — unknown error");
    }
  };

  // ── Add narrative entry ───────────────────────────────────────────────────
  const handleAddNarrative = async () => {
    const text = newNarrText.trim();
    if (!text || !call) return;
    const entry: NarrativeEntry = { id: genId(), time: nowTime(), officer: "Officer", text };
    const updated = [...liveNarrative, entry];
    setLiveNarrative(updated);  // Optimistic — shows immediately
    setNewNarrText("");
    const saved = await updateCall(call.id, { narrative: updated });
    setCall(saved);  // Sync call object so buildPayload stays accurate
  };

  // ── Edit narrative entry ──────────────────────────────────────────────────
  const handleSaveNarrEdit = async (entryId: string) => {
    const text = editNarrText.trim();
    if (!text || !call) return;
    const editorName = user ? `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username : "Staff";
    const updated = liveNarrative.map((n) =>
      n.id === entryId
        ? { ...n, text, edited: true, edited_by: editorName, edited_at: new Date().toISOString() }
        : n
    );
    setLiveNarrative(updated);
    setEditingNarrId(null);
    const saved = await updateCall(call.id, { narrative: updated });
    setCall(saved);
    showToast("Narrative entry updated");
  };

  // ── Delete narrative entry ────────────────────────────────────────────────
  const handleDeleteNarrative = async (entryId: string) => {
    if (!call) return;
    const updated = liveNarrative.filter((n) => n.id !== entryId);
    setLiveNarrative(updated);
    setDeleteConfirmId(null);
    const saved = await updateCall(call.id, { narrative: updated });
    setCall(saved);
    showToast("Narrative entry deleted");
  };

  // ── Permission check for narrative edit/delete ────────────────────────────
  const canEditNarrative = (entry: NarrativeEntry): boolean => {
    if (!user) return false;
    if (user.role === "Admin" || user.role === "Administrator") return true;
    const myName = `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username;
    return entry.officer === myName;
  };

  // ── Status change (auto-logs narrative) ──────────────────────────────────
  const handleStatusChange = async (newStatus: string) => {
    if (!call) return;
    const logEntry: NarrativeEntry = { id: genId(), time: nowTime(), officer: "System", text: `Status changed to ${newStatus}` };
    const updated = [...liveNarrative, logEntry];
    setLiveNarrative(updated);
    upd({ status: newStatus });  // Optimistic — updates selector immediately
    const saved = await updateCall(call.id, { status: newStatus, narrative: updated });
    applyFreshCall(saved);
    showToast(`Status updated to ${newStatus}`);
  };

  // ── Upload evidence files ─────────────────────────────────────────────────
  const uploadNewEvidence = async (): Promise<EvidenceItem[]> => {
    if (evidenceFiles.length === 0 || !call) return (call?.evidence || []) as EvidenceItem[];
    const existing = (call.evidence || []) as EvidenceItem[];
    const uploaded: EvidenceItem[] = [...existing];
    await Promise.all(evidenceFiles.map(async (item) => {
      console.log("[evidence upload] file:", item.file.name, item.file.size);
      const path = `${call.id}/${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data: storageData, error: storageError } = await supabase.storage.from("evidence").upload(path, item.file, { upsert: false });
      console.log("[evidence upload] storage result:", storageData, storageError);
      if (!storageError) {
        const { data: urlData } = supabase.storage.from("evidence").getPublicUrl(path);
        console.log("[evidence upload] public URL:", urlData.publicUrl);
        uploaded.push({ id: genId(), file_name: item.file.name, file_url: urlData.publicUrl, file_type: item.file.type, notes: item.notes, type: item.file.type.startsWith("image") ? "Photo" : "Document", description: item.notes || item.file.name, date: today(), url: urlData.publicUrl });
      }
    }));
    return uploaded;
  };

  // ── Auto-create people ────────────────────────────────────────────────────
  const autoCreatePeople = async () => {
    if (!call) return;
    const autoCreate = async (first: string, middle: string, last: string, fallbackName: string, role: string, phone: string, address: string, note: string) => {
      const parts = fallbackName.trim().split(" ");
      const p = await createPerson({ first_name: first || parts[0], middle_name: middle || undefined, last_name: last || parts.slice(1).join(" ") || undefined, role, phone, address });
      await addPersonNote(p.id, `Auto-added from call ${call.id}: ${note}`, "Dispatch");
    };
    const victimFull = [data.victim_first, data.victim_middle, data.victim_last].filter(Boolean).join(" ") || data.victim_name;
    if (!data.victim_skip && data.victim_save && victimFull && !data.victim_person_id) {
      await autoCreate(data.victim_first, data.victim_middle, data.victim_last, victimFull, "Victim", data.victim_phone, data.victim_address, `Victim in ${call.type} call`);
    }
    const suspectFull = [data.suspect_first, data.suspect_middle, data.suspect_last].filter(Boolean).join(" ") || data.suspect_name;
    if (!data.suspect_skip && data.suspect_save && suspectFull && !data.suspect_person_id) {
      await autoCreate(data.suspect_first, data.suspect_middle, data.suspect_last, suspectFull, "Suspect", data.suspect_phone, data.suspect_address, `Suspect in ${call.type} call`);
    }
  };

  // ── Issue citation (auto-save then navigate) ──────────────────────────────
  const handleIssueCitation = async () => {
    if (!call) return;
    try { await updateCall(call.id, buildPayload()); } catch { /* proceed even if save fails */ }
    router.push(`/citations/new?callId=${call.id}`);
  };

  // ── Finalize & close call ─────────────────────────────────────────────────
  const handleFinalize = async () => {
    if (!call) return;
    setSaving(true);
    try {
      const closeEntry: NarrativeEntry = { id: genId(), time: nowTime(), officer: "System", text: `Call finalized and closed at ${nowTime()}${data.departure_time ? ` · Departed ${data.departure_time}` : ""}` };
      const narrative = [...liveNarrative, closeEntry];
      const evidence = await uploadNewEvidence();
      const payload = { ...buildPayload("Resolved"), narrative, evidence };
      const finalized = await updateCall(call.id, payload);
      applyFreshCall(finalized);
      await autoCreatePeople();
      setEvidenceFiles([]);
      showToast("Call finalized and closed");
      setTimeout(() => router.push("/dispatch"), 1200);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Finalize failed: ${err?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  // ── Step completion ───────────────────────────────────────────────────────
  const stepComplete = (n: number): boolean => {
    switch (n) {
      case 1: return true;
      case 2: return data.victim_skip || !!(data.victim_first || data.victim_last || data.victim_name);
      case 3: return data.victim_animal_skip || !!data.victim_animal_desc;
      case 4: return data.suspect_skip || !!(data.suspect_first || data.suspect_last || data.suspect_name);
      case 5: return data.suspect_animal_skip || !!data.suspect_animal_desc;
      case 6: return liveNarrative.length > 0;
      case 7: return (call?.evidence || []).length > 0 || evidenceFiles.length > 0;
      case 8: return callCitations.length > 0;
      case 9: return !!data.arrival_time || data.status !== "Dispatched";
      case 10: return false;
      default: return false;
    }
  };

  // ── Step renderers ────────────────────────────────────────────────────────
  const renderStep = () => {
    if (!call) return null;
    const g2 = "dispatch-g2";
    const g3 = "dispatch-g3";
    const skipBanner = (label: string, skipped: boolean, onSkip: () => void, onRestore: () => void) => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: skipped ? "#f1f5f9" : "#fff7ed", border: `1px solid ${skipped ? "#e2e8f0" : "#fed7aa"}`, borderRadius: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: skipped ? "var(--text-muted)" : "#92400e" }}>{skipped ? `✓ ${label} — skipped` : `${label} — fill in details or skip`}</span>
        {skipped ? <button className="btn btn-ghost btn-sm" onClick={onRestore}>Restore</button> : <button className="btn btn-secondary btn-sm" onClick={onSkip}>Skip This Step →</button>}
      </div>
    );
    const InfoRow = ({ label, value }: { label: string; value: string | undefined }) => value ? (
      <div style={{ display: "flex", gap: 10, padding: "4px 0", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}>
        <span style={{ color: "var(--text-muted)", width: 130, flexShrink: 0 }}>{label}</span>
        <strong style={{ wordBreak: "break-word" }}>{value}</strong>
      </div>
    ) : null;

    switch (step) {
      // ── 1: Call Review ───────────────────────────────────────────────────
      case 1: {
        const officers_assigned = call.assigned_officers || [];
        const callerParty = ((call.involved_parties || []) as Record<string, unknown>[]).find((p) => p.role === "Caller");
        let cross_street = "", location_notes_val = "";
        for (const line of (call.response_notes || "").split("\n")) {
          if (line.startsWith("Cross St: ")) cross_street = line.slice(10);
          if (line.startsWith("Location Notes: ")) location_notes_val = line.slice(16);
        }
        return (
          <div>
            {/* Status control */}
            <div className="dispatch-status-banner" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: `${CALL_STATUS_COLORS[data.status] || "#6b7280"}12`, border: `1px solid ${CALL_STATUS_COLORS[data.status] || "#6b7280"}30`, borderRadius: 8, marginBottom: 20 }}>
              <div style={{ fontSize: 24 }}>📡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{call.type}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{call.date_reported} at {call.time_reported}</div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 11, marginBottom: 3 }}>Status</label>
                <select className="form-select" style={{ fontSize: 13, fontWeight: 700, color: CALL_STATUS_COLORS[data.status] || "#374151" }} value={data.status} onChange={(e) => handleStatusChange(e.target.value)}>
                  {CALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className={g2}>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Dispatch Info</div>
                <InfoRow label="Priority" value={call.priority} />
                <InfoRow label="Call ID" value={call.id} />
                <InfoRow label="Description" value={call.description} />
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Location</div>
                <InfoRow label="Address" value={`${call.address || ""}${call.city ? `, ${call.city}` : ""}`} />
                {cross_street && <InfoRow label="Cross Street" value={cross_street} />}
                {location_notes_val && <InfoRow label="Notes" value={location_notes_val} />}
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Caller</div>
                <InfoRow label="Name" value={call.caller || "Anonymous"} />
                <InfoRow label="Phone" value={call.caller_phone} />
                {callerParty && <InfoRow label="Address" value={(callerParty.address as string)} />}
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Assigned Officers</div>
                {officers_assigned.length === 0
                  ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No officers assigned</div>
                  : officers_assigned.map((o) => {
                    const profile = officerStatuses.find(
                      (p) => `${p.first_name} ${p.last_name}`.toLowerCase() === (o.name || "").toLowerCase()
                    );
                    const fs = profile?.current_field_status as FieldStatus | undefined;
                    const FS_COLOR: Record<FieldStatus, string> = { "On Duty": "#28a745", "En Route": "#ffc107", "On Scene": "#0d6efd", "Available": "#17a2b8", "Break": "#dc3545", "Off Duty": "#adb5bd" };
                    const FS_BG: Record<FieldStatus, string> = { "On Duty": "#e6f4ea", "En Route": "#fff3cd", "On Scene": "#cce5ff", "Available": "#d1ecf1", "Break": "#f8d7da", "Off Duty": "#f0f0f0" };
                    return (
                      <div key={o.id} style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span>
                          <strong>{o.name}</strong>{o.badge ? ` · #${o.badge}` : ""}{o.vehicle ? ` · ${o.vehicle}` : ""}
                        </span>
                        {fs && (
                          <span style={{ background: FS_BG[fs], color: FS_COLOR[fs], borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                            {fs}
                          </span>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            </div>

            <div className={g2}>
              <F label="Arrival Time">
                <input className="form-input" type="time" value={data.arrival_time} onChange={(e) => upd({ arrival_time: e.target.value })} />
              </F>
              <F label="Departure Time">
                <input className="form-input" type="time" value={data.departure_time} onChange={(e) => upd({ departure_time: e.target.value })} />
              </F>
            </div>
          </div>
        );
      }

      // ── 2: Victim (Person) ───────────────────────────────────────────────
      case 2: return (
        <div>
          {skipBanner("Victim (Person)", data.victim_skip, () => upd({ victim_skip: true }), () => upd({ victim_skip: false }))}
          {!data.victim_skip && (
            <>
              <PersonSearchRow people={people} selectedId={data.victim_person_id}
                onSelect={(p) => upd({ victim_person_id: p.id, victim_first: p.first_name, victim_middle: p.middle_name || "", victim_last: p.last_name, victim_name: `${p.first_name} ${p.last_name}`, victim_phone: p.phone || "", victim_address: p.address || "" })}
                onClear={() => upd({ victim_person_id: "", victim_first: "", victim_middle: "", victim_last: "", victim_name: "", victim_phone: "", victim_address: "" })} />
              <div className={g2}>
                <F label="First Name"><input className="form-input" value={data.victim_first} onChange={(e) => upd({ victim_first: e.target.value })} /></F>
                <F label="Middle Name"><input className="form-input" value={data.victim_middle} onChange={(e) => upd({ victim_middle: e.target.value })} /></F>
                <F label="Last Name"><input className="form-input" value={data.victim_last} onChange={(e) => upd({ victim_last: e.target.value })} /></F>
                <F label="Phone"><input className="form-input" value={data.victim_phone} onChange={(e) => upd({ victim_phone: e.target.value })} /></F>
                <F label="Address"><input className="form-input" value={data.victim_address} onChange={(e) => upd({ victim_address: e.target.value })} /></F>
                <F label="Driver's License #"><input className="form-input" value={data.victim_dl} onChange={(e) => upd({ victim_dl: e.target.value })} /></F>
                <F label="Date of Birth"><input className="form-input" type="date" value={data.victim_dob} onChange={(e) => upd({ victim_dob: e.target.value })} /></F>
                <F label="Sex"><select className="form-select" value={data.victim_sex} onChange={(e) => upd({ victim_sex: e.target.value })}><option value="">—</option>{["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}</select></F>
                <F label="Injuries / Complaint" span><textarea className="form-textarea" rows={2} value={data.victim_injuries} onChange={(e) => upd({ victim_injuries: e.target.value })} placeholder="Describe any injuries or complaint…" /></F>
              </div>
              {!data.victim_person_id && (data.victim_first || data.victim_last) && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "6px 0" }}>
                  <input type="checkbox" checked={data.victim_save} onChange={(e) => upd({ victim_save: e.target.checked })} />
                  Save victim to Contacts database
                </label>
              )}
            </>
          )}
        </div>
      );

      // ── 3: Victim (Animal) ───────────────────────────────────────────────
      case 3: return (
        <div>
          {skipBanner("Victim (Animal)", data.victim_animal_skip, () => upd({ victim_animal_skip: true }), () => upd({ victim_animal_skip: false }))}
          {!data.victim_animal_skip && (
            <div className={g2}>
              <F label="Species"><select className="form-select" value={data.victim_animal_species} onChange={(e) => upd({ victim_animal_species: e.target.value })}>{["Dog","Cat","Bird","Livestock","Wildlife","Other"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Breed"><input className="form-input" value={data.victim_animal_breed} onChange={(e) => upd({ victim_animal_breed: e.target.value })} /></F>
              <F label="Color"><input className="form-input" value={data.victim_animal_color} onChange={(e) => upd({ victim_animal_color: e.target.value })} /></F>
              <F label="Sex"><select className="form-select" value={data.victim_animal_sex} onChange={(e) => upd({ victim_animal_sex: e.target.value })}><option value="">—</option>{["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Size"><select className="form-select" value={data.victim_animal_size} onChange={(e) => upd({ victim_animal_size: e.target.value })}><option value="">—</option>{["Small","Medium","Large","X-Large"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Condition">
                <select className="form-select" value={data.victim_animal_condition} onChange={(e) => upd({ victim_animal_condition: e.target.value })}>
                  {["Unknown","Healthy","Injured","Critical","Deceased","Aggressive"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Description" span><textarea className="form-textarea" rows={2} value={data.victim_animal_desc} onChange={(e) => upd({ victim_animal_desc: e.target.value })} placeholder="Markings, collar, tags, microchip…" /></F>
              {(data.victim_animal_condition === "Injured" || data.victim_animal_condition === "Critical") && (
                <F label="Injury Description" span><textarea className="form-textarea" rows={2} value={data.victim_animal_injuries} onChange={(e) => upd({ victim_animal_injuries: e.target.value })} /></F>
              )}
            </div>
          )}
        </div>
      );

      // ── 4: Suspect (Person) ──────────────────────────────────────────────
      case 4: return (
        <div>
          {skipBanner("Suspect (Person)", data.suspect_skip, () => upd({ suspect_skip: true }), () => upd({ suspect_skip: false }))}
          {!data.suspect_skip && (
            <>
              <PersonSearchRow people={people} selectedId={data.suspect_person_id}
                onSelect={(p) => upd({ suspect_person_id: p.id, suspect_first: p.first_name, suspect_middle: p.middle_name || "", suspect_last: p.last_name, suspect_name: `${p.first_name} ${p.last_name}`, suspect_phone: p.phone || "", suspect_address: p.address || "" })}
                onClear={() => upd({ suspect_person_id: "", suspect_first: "", suspect_middle: "", suspect_last: "", suspect_name: "", suspect_phone: "", suspect_address: "" })} />
              <div className={g2}>
                <F label="First Name"><input className="form-input" value={data.suspect_first} onChange={(e) => upd({ suspect_first: e.target.value })} /></F>
                <F label="Middle Name"><input className="form-input" value={data.suspect_middle} onChange={(e) => upd({ suspect_middle: e.target.value })} /></F>
                <F label="Last Name"><input className="form-input" value={data.suspect_last} onChange={(e) => upd({ suspect_last: e.target.value })} /></F>
                <F label="Phone"><input className="form-input" value={data.suspect_phone} onChange={(e) => upd({ suspect_phone: e.target.value })} /></F>
                <F label="Address"><input className="form-input" value={data.suspect_address} onChange={(e) => upd({ suspect_address: e.target.value })} /></F>
                <F label="Driver's License #"><input className="form-input" value={data.suspect_dl} onChange={(e) => upd({ suspect_dl: e.target.value })} /></F>
                <F label="Date of Birth"><input className="form-input" type="date" value={data.suspect_dob} onChange={(e) => upd({ suspect_dob: e.target.value })} /></F>
                <F label="Sex"><select className="form-select" value={data.suspect_sex} onChange={(e) => upd({ suspect_sex: e.target.value })}><option value="">—</option>{["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}</select></F>
              </div>
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", margin: "8px 0 4px" }}>Physical Description</div>
              <div className={g3}>
                <F label="Hair"><input className="form-input" value={data.suspect_hair} onChange={(e) => upd({ suspect_hair: e.target.value })} /></F>
                <F label="Eyes"><input className="form-input" value={data.suspect_eyes} onChange={(e) => upd({ suspect_eyes: e.target.value })} /></F>
                <F label="Weight (lbs)"><input className="form-input" value={data.suspect_weight} onChange={(e) => upd({ suspect_weight: e.target.value })} /></F>
                <F label={'Height'}><input className="form-input" value={data.suspect_height} onChange={(e) => upd({ suspect_height: e.target.value })} placeholder={'5\'10"'} /></F>
              </div>
              {!data.suspect_person_id && (data.suspect_first || data.suspect_last) && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "6px 0" }}>
                  <input type="checkbox" checked={data.suspect_save} onChange={(e) => upd({ suspect_save: e.target.checked })} />
                  Save suspect to Contacts database (role: Suspect)
                </label>
              )}
            </>
          )}
        </div>
      );

      // ── 5: Suspect (Animal) ──────────────────────────────────────────────
      case 5: return (
        <div>
          {skipBanner("Suspect (Animal)", data.suspect_animal_skip, () => upd({ suspect_animal_skip: true }), () => upd({ suspect_animal_skip: false }))}
          {!data.suspect_animal_skip && (
            <div className={g2}>
              <F label="Species"><select className="form-select" value={data.suspect_animal_species} onChange={(e) => upd({ suspect_animal_species: e.target.value })}>{["Dog","Cat","Bird","Livestock","Wildlife","Other"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Breed"><input className="form-input" value={data.suspect_animal_breed} onChange={(e) => upd({ suspect_animal_breed: e.target.value })} /></F>
              <F label="Color"><input className="form-input" value={data.suspect_animal_color} onChange={(e) => upd({ suspect_animal_color: e.target.value })} /></F>
              <F label="Sex"><select className="form-select" value={data.suspect_animal_sex} onChange={(e) => upd({ suspect_animal_sex: e.target.value })}><option value="">—</option>{["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Size"><select className="form-select" value={data.suspect_animal_size} onChange={(e) => upd({ suspect_animal_size: e.target.value })}><option value="">—</option>{["Small","Medium","Large","X-Large"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Behavior"><select className="form-select" value={data.suspect_animal_behavior} onChange={(e) => upd({ suspect_animal_behavior: e.target.value })}>{["Unknown","Aggressive","Threatening","Friendly","Fearful","Feral"].map((s) => <option key={s}>{s}</option>)}</select></F>
              <F label="Description" span><textarea className="form-textarea" rows={2} value={data.suspect_animal_desc} onChange={(e) => upd({ suspect_animal_desc: e.target.value })} placeholder="Collar, tags, owner info…" /></F>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "6px 0", gridColumn: "1/-1" }}>
                <input type="checkbox" checked={data.suspect_animal_dangerous} onChange={(e) => upd({ suspect_animal_dangerous: e.target.checked })} />
                <span style={{ fontWeight: 700, color: "#dc2626" }}>🚨 Flag as Dangerous Animal</span>
              </label>
            </div>
          )}
        </div>
      );

      // ── 6: Narrative ─────────────────────────────────────────────────────
      case 6: return (
        <div>
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "#0369a1", marginBottom: 8 }}>Add Narrative Entry</div>
            <div className="dispatch-narrative-input" style={{ display: "flex", gap: 8 }}>
              <textarea className="form-textarea" rows={3} style={{ flex: 1 }} value={newNarrText} onChange={(e) => setNewNarrText(e.target.value)} placeholder="Officer observations, actions taken, details gathered on scene…" />
              <button className="btn btn-primary" style={{ alignSelf: "flex-end", whiteSpace: "nowrap" }} onClick={handleAddNarrative} disabled={!newNarrText.trim()}>+ Add Entry</button>
            </div>
          </div>
          {liveNarrative.length === 0
            ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0", textAlign: "center" }}>No narrative entries yet</div>
            : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 10 }}>Timeline ({liveNarrative.length} entries)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[...liveNarrative].reverse().map((n, i) => (
                    <div key={n.id} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < liveNarrative.length - 1 ? "1px solid var(--border-light)" : "none" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: n.officer === "System" ? "#cbd5e1" : "var(--teal)", flexShrink: 0 }} />
                        {i < liveNarrative.length - 1 && <div style={{ width: 2, flex: 1, background: "#e2e8f0", marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 6 }}>
                        <div style={{ display: "flex", gap: 10, marginBottom: 3, alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: n.officer === "System" ? "var(--text-muted)" : "#0f2942" }}>{n.officer}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{n.time}</span>
                          {n.edited && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }} title={`Edited by ${n.edited_by} at ${n.edited_at ? new Date(n.edited_at).toLocaleString() : ""}`}>(edited)</span>
                          )}
                          {n.officer !== "System" && canEditNarrative(n) && editingNarrId !== n.id && (
                            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Edit entry"
                                style={{ fontSize: 11, padding: "1px 7px", color: "var(--text-secondary)" }}
                                onClick={() => { setEditingNarrId(n.id); setEditNarrText(n.text); }}
                              >✏️</button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Delete entry"
                                style={{ fontSize: 11, padding: "1px 7px", color: "#dc2626" }}
                                onClick={() => setDeleteConfirmId(n.id)}
                              >🗑</button>
                            </div>
                          )}
                        </div>
                        {editingNarrId === n.id ? (
                          <div style={{ marginTop: 4 }}>
                            <textarea
                              className="form-textarea"
                              rows={3}
                              style={{ width: "100%", fontSize: 13 }}
                              value={editNarrText}
                              onChange={(e) => setEditNarrText(e.target.value)}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={!editNarrText.trim()}
                                onClick={() => handleSaveNarrEdit(n.id)}
                              >Save</button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setEditingNarrId(null); setEditNarrText(""); }}
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 13, color: n.officer === "System" ? "var(--text-muted)" : "inherit", fontStyle: n.officer === "System" ? "italic" : "normal" }}>{n.text}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          {/* Delete confirmation dialog */}
          {deleteConfirmId && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setDeleteConfirmId(null)}>
              <div style={{ background: "var(--surface)", borderRadius: 10, padding: "24px 28px", maxWidth: 380, boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}
                onClick={(e) => e.stopPropagation()}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete Narrative Entry?</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                  Are you sure you want to delete this narrative entry? This cannot be undone.
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                  <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", border: "none" }}
                    onClick={() => handleDeleteNarrative(deleteConfirmId)}>Delete</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );

      // ── 7: Evidence ──────────────────────────────────────────────────────
      case 7: {
        const existingEvidence = (call.evidence || []) as EvidenceItem[];
        return (
          <div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14 }}>
              <span className="btn btn-secondary">📎 Attach Evidence Files</span>
              <input type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: "none" }}
                onChange={(e) => { Array.from(e.target.files || []).forEach((f) => setEvidenceFiles((prev) => [...prev, { id: genId(), file: f, notes: "" }])); e.target.value = ""; }} />
            </label>

            {existingEvidence.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>Uploaded Evidence ({existingEvidence.length})</div>
                {existingEvidence.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", gap: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                    <span style={{ fontSize: 16 }}>{ev.type === "Photo" ? "🖼" : "📄"}</span>
                    <div style={{ flex: 1 }}>
                      <a href={ev.url || ev.file_url} target="_blank" rel="noreferrer" style={{ color: "var(--teal)", fontWeight: 600 }}>{ev.file_name || ev.description}</a>
                      {ev.notes && <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{ev.notes}</div>}
                    </div>
                    <span style={{ color: "var(--text-muted)" }}>{ev.date}</span>
                  </div>
                ))}
              </div>
            )}

            {evidenceFiles.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>New Files (will upload on Save)</div>
                {evidenceFiles.map((item) => (
                  <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{item.file.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(item.file.size / 1024).toFixed(0)}KB</span>
                    <input className="form-input" style={{ width: 220, fontSize: 12 }} placeholder="Description…" value={item.notes}
                      onChange={(e) => setEvidenceFiles((prev) => prev.map((x) => x.id === item.id ? { ...x, notes: e.target.value } : x))} />
                    <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => setEvidenceFiles((prev) => prev.filter((x) => x.id !== item.id))}>🗑</button>
                  </div>
                ))}
              </div>
            )}

            {existingEvidence.length === 0 && evidenceFiles.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No evidence uploaded yet</div>
            )}
          </div>
        );
      }

      // ── 8: Citations ─────────────────────────────────────────────────────
      case 8: return (
        <div>
          <div style={{ marginBottom: 20 }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", fontSize: 15, padding: "14px 20px", fontWeight: 800, letterSpacing: 0.3 }}
              onClick={handleIssueCitation}
            >
              📋 Issue Citation for This Call
            </button>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 6 }}>
              Opens the citation form pre-filled with suspect, location, and officer info from this call. Progress is saved first.
            </div>
          </div>

          {callCitations.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0", textAlign: "center" }}>
              No citations have been issued for this call yet.
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>
                Issued Citations ({callCitations.length})
              </div>
              {callCitations.map((cit) => (
                <div key={cit.id} style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 800, fontFamily: "monospace" }}>{cit.citation_number || cit.id}</span>
                    <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>{cit.status}</span>
                  </div>
                  <div style={{ color: "var(--text-secondary)", marginTop: 3 }}>
                    <strong>{cit.violator_name || "Unknown violator"}</strong>
                    {cit.violation_type ? ` · ${cit.violation_type}` : ""}
                    {(cit.violations || []).length > 0 ? ` · ${(cit.violations || []).length} violation${(cit.violations || []).length !== 1 ? "s" : ""}` : ""}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
                    Issued {cit.date} {cit.time} · Officer {cit.issuing_officer}{cit.badge_number ? ` #${cit.badge_number}` : ""}
                    {cit.fine_amount ? ` · Fine: $${cit.fine_amount}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      // ── 9: Officer Actions ───────────────────────────────────────────────
      case 9: return (
        <div>
          {/* Status */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Call Status</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CALL_STATUSES.map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  style={{ padding: "8px 14px", borderRadius: 6, border: `2px solid ${data.status === s ? CALL_STATUS_COLORS[s] || "#0f2942" : "var(--border)"}`, background: data.status === s ? `${CALL_STATUS_COLORS[s] || "#0f2942"}15` : "#fff", color: data.status === s ? CALL_STATUS_COLORS[s] || "#0f2942" : "var(--text-secondary)", fontWeight: data.status === s ? 800 : 400, fontSize: 13, cursor: "pointer" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned officers */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Assigned Officers</label>
            {data.assigned_officers.length === 0
              ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No officers assigned</div>
              : data.assigned_officers.map((o) => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
                  <span><strong>{o.name}</strong>{o.badge ? ` · #${o.badge}` : ""}{o.vehicle ? ` · ${o.vehicle}` : ""}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", fontSize: 11 }}
                    onClick={() => upd({ assigned_officers: data.assigned_officers.filter((a) => a.id !== o.id) })}>Remove</button>
                </div>
              ))
            }
          </div>

          {/* Add backup / Transfer */}
          <div className={g2}>
            <div>
              <label className="form-label">Add Backup Officer</label>
              <select className="form-select" value={data.backup_id} onChange={(e) => {
                const o = officers.find((x) => x.id === e.target.value);
                if (!o) return;
                if (!data.assigned_officers.find((a) => a.id === o.id)) {
                  upd({ assigned_officers: [...data.assigned_officers, { id: o.id, name: o.name, badge: o.badge || "", vehicle: o.vehicle || "" }], backup_id: "" });
                }
              }}>
                <option value="">— Select officer to add —</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.badge ? ` #${o.badge}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Transfer Call To</label>
              <select className="form-select" value={data.transfer_to_id} onChange={(e) => {
                const o = officers.find((x) => x.id === e.target.value);
                if (!o) return;
                upd({ assigned_officers: [{ id: o.id, name: o.name, badge: o.badge || "", vehicle: o.vehicle || "" }], transfer_to_id: "" });
                handleStatusChange("Dispatched");
              }}>
                <option value="">— Transfer to officer —</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.badge ? ` #${o.badge}` : ""}</option>)}
              </select>
            </div>
          </div>

          {/* Times & disposition */}
          <div className={g2} style={{ marginTop: 16 }}>
            <F label="Arrival Time"><input className="form-input" type="time" value={data.arrival_time} onChange={(e) => upd({ arrival_time: e.target.value })} /></F>
            <F label="Departure Time"><input className="form-input" type="time" value={data.departure_time} onChange={(e) => upd({ departure_time: e.target.value })} /></F>
          </div>
          <F label="Disposition / Outcome Notes">
            <textarea className="form-textarea" rows={3} value={data.disposition_notes} onChange={(e) => upd({ disposition_notes: e.target.value })} placeholder="Outcome of the call, actions taken, referrals made…" />
          </F>
        </div>
      );

      // ── 10: Finalize ─────────────────────────────────────────────────────
      case 10: {
        const Sect = ({ title, items }: { title: string; items: [string, string][] }) => (
          <div style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "6px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)" }}>{title}</div>
            <div className="dispatch-sect-grid">
              {items.map(([label, value]) => (
                <div key={label} style={{ fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>{label}: </span><strong>{value || "—"}</strong></div>
              ))}
            </div>
          </div>
        );
        return (
          <div>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>✓ Review the complete call record before finalizing.</span>
              <button className="btn btn-sm" style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a", fontWeight: 800, minWidth: 180 }} onClick={handleFinalize} disabled={saving}>
                {saving ? "Finalizing…" : "✓ Finalize & Close Call"}
              </button>
            </div>

            <Sect title="Call Info" items={[["ID", call.id], ["Type", call.type], ["Priority", call.priority], ["Status", data.status], ["Date", `${call.date_reported} ${call.time_reported}`], ["Arrival", data.arrival_time], ["Departure", data.departure_time]]} />
            <Sect title="Location" items={[["Address", `${call.address || ""}${call.city ? `, ${call.city}` : ""}`], ["Officers", data.assigned_officers.map((o) => o.name).join(", ") || "None"]]} />

            {!data.victim_skip && (data.victim_first || data.victim_last || data.victim_name) && <Sect title="Victim (Person)" items={[["Name", [data.victim_first, data.victim_middle, data.victim_last].filter(Boolean).join(" ") || data.victim_name], ["Phone", data.victim_phone], ["DL", data.victim_dl], ["DOB", data.victim_dob]]} />}
            {!data.victim_animal_skip && data.victim_animal_desc && <Sect title="Victim (Animal)" items={[["Species", data.victim_animal_species], ["Description", data.victim_animal_desc], ["Condition", data.victim_animal_condition], ["Breed", data.victim_animal_breed]]} />}
            {!data.suspect_skip && (data.suspect_first || data.suspect_last || data.suspect_name) && <Sect title="Suspect (Person)" items={[["Name", [data.suspect_first, data.suspect_middle, data.suspect_last].filter(Boolean).join(" ") || data.suspect_name], ["Phone", data.suspect_phone], ["DL", data.suspect_dl], ["Physical", [data.suspect_hair, data.suspect_eyes].filter(Boolean).join(" / ")]]} />}
            {!data.suspect_animal_skip && data.suspect_animal_desc && <Sect title="Suspect (Animal)" items={[["Species", data.suspect_animal_species], ["Behavior", data.suspect_animal_behavior], ["Dangerous", data.suspect_animal_dangerous ? "YES 🚨" : "No"], ["Description", data.suspect_animal_desc]]} />}

            <Sect title="Narrative & Evidence" items={[["Narrative entries", String(liveNarrative.length)], ["Evidence files", String((call.evidence || []).length + evidenceFiles.length)], ["Citations", String(callCitations.length)], ["Disposition", data.disposition_notes]]} />

            {data.disposition_notes && (
              <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 10, fontSize: 13 }}>
                <strong>Disposition:</strong> {data.disposition_notes}
              </div>
            )}
          </div>
        );
      }

      default: return null;
    }
  };

  // ── Print Call Review ─────────────────────────────────────────────────────
  const printCallReview = () => {
    if (!call) return;
    const w = window.open("", "_blank", "width=860,height=1100");
    if (!w) return;

    const fld = (label: string, val?: string | null) =>
      val ? `<div style="display:flex;gap:12px;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;"><span style="width:140px;flex-shrink:0;color:#64748b;font-weight:600;">${label}</span><span style="color:#0f172a;">${val}</span></div>` : "";

    const narrative = [...liveNarrative].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    const assignedOfficers = (call.assigned_officers || []) as Array<{ name: string; badge?: string; vehicle?: string }>;

    const narrativeRows = narrative.length === 0
      ? `<div style="color:#94a3b8;font-style:italic;font-size:12px;padding:10px 0;">No narrative entries recorded.</div>`
      : narrative.map((n) => `
        <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <div style="width:60px;flex-shrink:0;font-size:11px;color:#64748b;font-family:monospace;padding-top:2px;">${n.time || ""}</div>
          <div style="flex-shrink:0;width:110px;">
            <span style="font-size:11px;font-weight:700;color:${n.officer === "System" ? "#94a3b8" : "#0f2942"};">${n.officer || "—"}</span>
          </div>
          <div style="flex:1;font-size:12px;color:${n.officer === "System" ? "#94a3b8" : "#1e293b"};font-style:${n.officer === "System" ? "italic" : "normal"};">
            ${n.text}
          </div>
        </div>`).join("");

    // Pull disposition from response_notes
    const dispositionLine = (call.response_notes || "").split("\n").find((l) => l.startsWith("Disposition:"));
    const dispositionText = dispositionLine ? dispositionLine.slice(12).trim() : "";

    const officerList = assignedOfficers.length === 0
      ? "<div style='color:#94a3b8;font-style:italic;font-size:12px;'>No officers assigned</div>"
      : assignedOfficers.map((o) =>
          `<div style="font-size:12px;padding:5px 0;border-bottom:1px solid #f1f5f9;">
            <strong>${o.name}</strong>${o.badge ? ` &nbsp;·&nbsp; Badge #${o.badge}` : ""}${o.vehicle ? ` &nbsp;·&nbsp; ${o.vehicle}` : ""}
          </div>`
        ).join("");

    w.document.write(`<!DOCTYPE html><html><head>
<title>Call Review — ${call.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #0f172a; }
  @page {
    size: letter;
    margin: 18mm 16mm 18mm 16mm;
    @top-left   { content: "MORGAN COUNTY ANIMAL SERVICES · Call Review"; font-size: 8pt; color: #64748b; font-family: Arial, sans-serif; }
    @top-right  { content: "Call ${call.id} · Page " counter(page) " of " counter(pages); font-size: 8pt; color: #64748b; font-family: Arial, sans-serif; }
    @bottom-center { content: "CONFIDENTIAL — FOR OFFICIAL USE ONLY"; font-size: 7pt; color: #94a3b8; font-family: Arial, sans-serif; }
  }
  @media print { .no-print { display: none !important; } }
  section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 5px; margin-bottom: 10px; }
</style>
</head><body style="padding:0.5in;">

  <!-- Print button (screen only) -->
  <div class="no-print" style="margin-bottom:16px;">
    <button onclick="window.print()" style="background:#0f2942;color:#fff;border:none;padding:8px 20px;border-radius:5px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save as PDF</button>
  </div>

  <!-- Document header -->
  <div style="border-bottom:3px solid #0f2942;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:18px;font-weight:900;letter-spacing:0.3px;color:#0f2942;">MORGAN COUNTY ANIMAL SERVICES</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px;">ShelterTrace · Shelter Data Systems</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:800;text-transform:uppercase;color:#1e3a5f;letter-spacing:0.5px;">Call Review Report</div>
      <div style="font-size:11px;color:#64748b;margin-top:3px;">Printed: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  </div>

  <!-- Call information -->
  <section>
    <div class="section-title">Call Information</div>
    ${fld("Call ID", call.id)}
    ${fld("Call Type", call.type)}
    ${fld("Priority", call.priority)}
    ${fld("Status", data.status)}
    ${fld("Date Reported", `${call.date_reported || ""}${call.time_reported ? " at " + call.time_reported : ""}`)}
    ${fld("Location", [call.address, call.city].filter(Boolean).join(", "))}
    ${fld("Caller", call.caller || "Anonymous")}
    ${fld("Caller Phone", call.caller_phone)}
    ${fld("Description", call.description)}
  </section>

  <!-- Assigned officers -->
  <section>
    <div class="section-title">Assigned Officers (${assignedOfficers.length})</div>
    ${officerList}
  </section>

  <!-- Narrative -->
  <section>
    <div class="section-title">Narrative / Timeline (${narrative.length} entr${narrative.length === 1 ? "y" : "ies"})</div>
    <div style="display:flex;gap:0;padding:5px 0;border-bottom:2px solid #e2e8f0;margin-bottom:2px;">
      <div style="width:60px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">Time</div>
      <div style="width:110px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;padding-left:16px;">Officer</div>
      <div style="flex:1;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;padding-left:16px;">Entry</div>
    </div>
    ${narrativeRows}
  </section>

  ${dispositionText ? `
  <!-- Disposition -->
  <section>
    <div class="section-title">Disposition / Resolution</div>
    <div style="font-size:13px;padding:10px 14px;background:#f8fafc;border-left:4px solid #1e3a5f;border-radius:0 6px 6px 0;line-height:1.6;">${dispositionText}</div>
  </section>` : ""}

  <!-- Signature block -->
  <div style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:40px;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:28px;">Reviewing Officer</div>
      <div style="border-bottom:1px solid #000;height:24px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Signature</div>
      <div style="margin-top:14px;border-bottom:1px solid #000;height:20px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Print Name / Badge #</div>
      <div style="margin-top:14px;border-bottom:1px solid #000;width:130px;height:20px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Date</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:28px;">Supervisor Review</div>
      <div style="border-bottom:1px solid #000;height:24px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Signature</div>
      <div style="margin-top:14px;border-bottom:1px solid #000;height:20px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Print Name / Title</div>
      <div style="margin-top:14px;border-bottom:1px solid #000;width:130px;height:20px;margin-bottom:4px;"></div>
      <div style="font-size:10px;color:#475569;">Date</div>
    </div>
  </div>

</body></html>`);
    w.document.close();
  };

  if (loading) return (
    <AppShell title="Officer Field Report">
      <div className="empty-state" style={{ padding: "60px 0" }}>Loading call…</div>
    </AppShell>
  );

  if (!call) return (
    <AppShell title="Officer Field Report">
      <div style={{ padding: 32 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dispatch")} style={{ marginBottom: 16 }}>← Back to Dispatch Board</button>
        <div className="empty-state">Call not found.</div>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="">
      {/* Page header */}
      <div className="dispatch-page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dispatch")} style={{ color: "var(--text-secondary)" }}>
          ← Back
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{call.id}</div>
          <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0, color: "#0f2942", wordBreak: "break-word" }}>{call.type}</h1>
        </div>
        <span className="badge" style={{ background: `${CALL_STATUS_COLORS[data.status] || "#6b7280"}20`, color: CALL_STATUS_COLORS[data.status] || "#6b7280", fontWeight: 700, flexShrink: 0 }}>
          {data.status}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: PRIORITY_COLORS[call.priority] || "var(--text-secondary)", padding: "2px 10px", background: `${PRIORITY_COLORS[call.priority] || "#6b7280"}15`, borderRadius: 10, flexShrink: 0 }}>
          {call.priority}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", wordBreak: "break-word", minWidth: 0 }}>
          {call.address}{call.city ? `, ${call.city}` : ""}
        </span>
        <div className="dispatch-page-header-actions" style={{ marginLeft: "auto" }}>
          {saveState === "saved" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Saved</span>}
          {saveState === "saving" && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Saving…</span>}
          <button className="btn btn-secondary btn-sm" onClick={printCallReview} title="Print narrative and call review">
            🖨 Print
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleSaveProgress} disabled={saveState === "saving"}>
            💾 Save
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", margin: "0 0 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <span style={{ fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>Save failed: </span>
            <span style={{ color: "#b91c1c", fontSize: 13 }}>{saveError}</span>
          </div>
          <button onClick={() => setSaveError(null)} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {saveToast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#16a34a", color: "#fff", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.18)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8 }}>
          ✓ {saveToast}
        </div>
      )}

      {/* Two-column layout */}
      <div className="dispatch-detail-layout">
        {/* Left: Step navigation */}
        <div className="dispatch-step-nav">
          {STEPS.map((name, i) => (
            <StepNavItem key={i} n={i + 1} name={name} current={step === i + 1} done={stepComplete(i + 1)} onClick={() => setStep(i + 1)} />
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 7 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Call #{call.id.slice(-4)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Reported {call.date_reported} {call.time_reported}</div>
            {call.assigned_officers && call.assigned_officers.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {call.assigned_officers.map((o) => o.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* Right: Step content */}
        <div className="dispatch-step-content">
          {/* Mobile step indicator */}
          <div className="dispatch-mobile-step-header">
            <span>Step {step} of {STEPS.length} — {STEPS[step - 1]}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>{call?.type}</span>
          </div>
          <div className="dispatch-step-card">
            <h2 className="dispatch-step-title" style={{ fontSize: 18, fontWeight: 800, margin: "0 0 20px", color: "#0f2942" }}>
              Step {step} — {STEPS[step - 1]}
            </h2>
            {renderStep()}
          </div>

          {/* Navigation bar */}
          <div className="dispatch-nav-bar" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>← Prev</button>
            <button className="btn btn-secondary" onClick={handleSaveProgress} disabled={saveState === "saving"} style={{ gap: 6 }}>
              {saveState === "saving" ? "Saving…" : "💾 Save Progress"}
            </button>
            {saveState === "saved" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Saved</span>}
            <div style={{ flex: 1 }} />
            {step === 10 && (
              <button className="btn btn-primary" style={{ background: "#16a34a", borderColor: "#16a34a", minWidth: 200, fontWeight: 800 }} onClick={handleFinalize} disabled={saving}>
                {saving ? "Finalizing…" : "✓ Finalize & Close Call"}
              </button>
            )}
            {step < 10 && (
              <button className="btn btn-primary" onClick={() => setStep((s) => Math.min(10, s + 1))}>Next →</button>
            )}
          </div>
        </div>
      </div>

      {/* Impounded Animals section */}
      <div className="card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>🐾 Impounded Animals ({linkedAnimals.length})</span>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowIntakeModal(true)}
          >
            + Intake Animal
          </button>
        </div>
        {linkedAnimals.length === 0 ? (
          <div style={{ padding: "18px 16px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
            No animals impounded on this call yet.{" "}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowIntakeModal(true)}>Create intake record →</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Animal ID</th>
                <th>Name</th>
                <th>Species / Breed</th>
                <th>Color / Sex</th>
                <th>Status</th>
                <th>Kennel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linkedAnimals.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--teal)", fontSize: 13 }}>{a.id}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td style={{ fontSize: 12 }}>{a.species}{a.breed && a.breed !== "Unknown" ? ` — ${a.breed}` : ""}</td>
                  <td style={{ fontSize: 12 }}>{a.color || "—"} · {a.sex || "—"}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 10 }}>{a.status}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                  <td>
                    <a href={`/animals/${a.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>View →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Forms section */}
      <div className="card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div
          style={{ padding: "10px 16px", background: "var(--surface-alt)", borderBottom: showCallForms ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => setShowCallForms((v) => !v)}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>📝 Forms ({callForms.length})</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{showCallForms ? "▲" : "▼"}</span>
          <div style={{ marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
            <GenerateFormButton
              size="sm"
              label="Generate Form"
              prefill={{
                call_id: call.id,
                call_address: call.address,
                call_city: call.city,
                call_date: call.date_reported,
                call_officer: data.assigned_officers[0]?.name,
              } as FormPreFill}
              onSaved={(form) => setCallForms((prev) => [form, ...prev])}
            />
          </div>
        </div>
        {showCallForms && (
          <div>
            {callForms.length === 0 ? (
              <div className="empty-state" style={{ padding: "20px 0" }}>No forms linked to this call yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Type</th><th>Summary</th><th>Officer</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {callForms.map((f) => (
                    <tr key={f.id}>
                      <td><span className="badge" style={{ background: "#f0fdf4", color: "#047857" }}>{f.form_type.replace(/_/g, " ")}</span></td>
                      <td style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(f.form_data as Record<string,unknown>).foster_name as string ||
                          (f.form_data as Record<string,unknown>).printed_name as string ||
                          [((f.form_data as Record<string,unknown>).name_first), ((f.form_data as Record<string,unknown>).name_last)].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td style={{ fontSize: 12 }}>{f.officer || f.created_by || "—"}</td>
                      <td style={{ fontSize: 12 }}>{f.created_at ? formatDate(f.created_at) : "—"}</td>
                      <td><ReprintFormButton form={f} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {showIntakeModal && call && (
        <QuickIntakeModal
          callId={call.id}
          callType={call.type}
          onAdded={handleAnimalAdded}
          onClose={() => setShowIntakeModal(false)}
        />
      )}
    </AppShell>
  );
}

export default function CallDetailPage() {
  return (
    <Suspense fallback={
      <AppShell title="Officer Field Report">
        <div className="empty-state" style={{ padding: "60px 0" }}>Loading call…</div>
      </AppShell>
    }>
      <CallDetailPageInner />
    </Suspense>
  );
}
