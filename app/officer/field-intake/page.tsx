"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { login } from "@/lib/auth";
import { fetchPeople, fetchCalls } from "@/lib/data";
import type { StaffAccount, Person, DispatchCall } from "@/lib/types";
import {
  TAIL_TYPES, INTAKE_EAR_TYPES, INTAKE_COAT_TYPES, BODY_CONDITION_SCORES,
  INTAKE_METHODS, STATES, ALL_BREEDS_DOG, ALL_BREEDS_CAT, ALL_COLORS,
} from "@/lib/constants";
import { STATEMENT_OF_SURRENDER_TEXT, AGENCY_NAME } from "@/lib/shelterInfo";
import { today } from "@/lib/utils";
import { isFileTypeAccepted } from "@/lib/fileValidation";
import {
  saveDraft, loadDraft, clearDraft, queueFieldIntake, processFieldIntakeQueue,
  getQueuedIntakes, submitFieldIntake, type FieldIntakeSubmission,
} from "@/lib/fieldIntake";
import { printIntakeForm } from "@/lib/intakeFormPrint";
import type { Animal } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";

const SESSION_KEY = "officer_app_session";
const PHOTO_ACCEPT = "image/*,.jpg,.jpeg,.png,.heic,.heif";

type IntakeChoice = "surrender" | "stray" | "field" | null;

function stepsFor(choice: IntakeChoice): string[] {
  const steps = ["type"];
  if (choice === "surrender") steps.push("owner");
  if (choice === "stray") steps.push("finder");
  steps.push("details", "description", "condition", "review");
  return steps;
}

const STEP_LABELS: Record<string, string> = {
  type: "Intake Type",
  owner: "Owner Surrender",
  finder: "Finder",
  details: "Intake Details",
  description: "Animal Description",
  condition: "Condition & Behavior",
  review: "Review & Submit",
};

// ── Shared UI atoms (dark, mobile-first — matches the officer PWA) ─────────────

function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 16px 120px" }}>{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#7fc6c6", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#f87171" }}> *</span>}
      </div>
      {children}
    </div>
  );
}
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 14px", borderRadius: 10, border: "1px solid #334155",
  background: "#0f2942", color: "#e2e8f0", fontSize: 16, boxSizing: "border-box", minHeight: 48,
};
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical" as const };

function ChoiceGrid<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            display: "flex", alignItems: "center", gap: 14, padding: "18px 16px", borderRadius: 14, minHeight: 64,
            border: `2px solid ${value === o.value ? "#1a8a8a" : "#334155"}`,
            background: value === o.value ? "rgba(26,138,138,0.15)" : "#1a3a5c",
            color: "#e2e8f0", fontSize: 16, fontWeight: 700, cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ fontSize: 26 }}>{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiCheck({ options, value, onToggle }: { options: string[]; value: Record<string, boolean>; onToggle: (opt: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o) => (
        <label key={o} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, background: value[o] ? "rgba(26,138,138,0.15)" : "#1a3a5c", border: `1px solid ${value[o] ? "#1a8a8a" : "#334155"}`, minHeight: 48, cursor: "pointer" }}>
          <input type="checkbox" checked={!!value[o]} onChange={() => onToggle(o)} style={{ width: 22, height: 22, flexShrink: 0 }} />
          <span style={{ fontSize: 15, color: "#e2e8f0" }}>{o}</span>
        </label>
      ))}
    </div>
  );
}

function RadioRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          style={{ padding: "12px 16px", borderRadius: 10, minHeight: 48, border: `2px solid ${value === o ? "#1a8a8a" : "#334155"}`, background: value === o ? "rgba(26,138,138,0.15)" : "#1a3a5c", color: "#e2e8f0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ── Person search (owner/finder autofill) ─────────────────────────────────────

function PersonSearch({ people, selected, onSelect, onClear }: { people: Person[]; selected: Person | null; onSelect: (p: Person) => void; onClear: () => void }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (q.trim().length < 2) return [];
    const lo = q.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(lo) || (p.phone || "").includes(q)).slice(0, 6);
  }, [people, q]);

  if (selected) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 10, background: "rgba(34,197,94,0.12)", border: "1px solid #22c55e" }}>
        <div>
          <div style={{ fontWeight: 700, color: "#86efac" }}>✓ {selected.first_name} {selected.last_name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{selected.phone || "No phone on file"}</div>
        </div>
        <button onClick={onClear} style={{ background: "none", border: "1px solid #475569", color: "#94a3b8", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>Change</button>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <input style={inputStyle} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search existing contacts by name or phone…" />
      {matches.length > 0 && (
        <div style={{ marginTop: 6, borderRadius: 10, overflow: "hidden", border: "1px solid #334155" }}>
          {matches.map((p) => (
            <div key={p.id} onClick={() => { onSelect(p); setQ(""); }} style={{ padding: "12px 14px", background: "#1a3a5c", borderBottom: "1px solid #334155", cursor: "pointer" }}>
              <div style={{ fontWeight: 700, color: "#e2e8f0" }}>{p.first_name} {p.last_name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.phone || "No phone"} · {p.role}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FieldIntakePage() {
  const [officer, setOfficer] = useState<StaffAccount | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  if (!authChecked || !officer) {
    return <FieldIntakeGate officer={officer} onLogin={setOfficer} onChecked={() => setAuthChecked(true)} />;
  }
  return <FieldIntakeWizard officer={officer} />;
}

// ── Auth gate ───────────────────────────────────────────────────────────────────

function FieldIntakeGate({ officer, onLogin, onChecked }: { officer: StaffAccount | null; onLogin: (o: StaffAccount) => void; onChecked: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) onLogin(JSON.parse(raw) as StaffAccount);
    } catch { /* ignore */ }
    setRestoring(false);
    onChecked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (restoring) {
    return <div style={{ minHeight: "100dvh", background: "#0f2942" }} />;
  }
  if (officer) return null; // parent re-renders into the wizard once authChecked flips

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const account = await login(username.trim(), password);
      if (!account) { setError("Invalid username or password."); return; }
      localStorage.setItem(SESSION_KEY, JSON.stringify(account));
      onLogin(account);
    } catch { setError("Login failed. Check your connection."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0f2942", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Field Intake</div>
      <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 32 }}>Officer sign-in required</div>
      <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
        <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoCapitalize="none" autoCorrect="off" style={{ ...inputStyle, marginBottom: 12 }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={{ ...inputStyle, marginBottom: 16 }} />
        {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}
        <button type="submit" disabled={loading || !username || !password} style={{ width: "100%", padding: "16px 0", borderRadius: 12, border: "none", background: loading ? "#334155" : "#1a8a8a", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

// ── Draft shape ─────────────────────────────────────────────────────────────────

interface DraftState {
  intakeChoice: IntakeChoice;
  stepIdx: number;
  npFirst: string; npLast: string; npPhone: string; npEmail: string; npAddress: string; npCity: string; npState: string; npZip: string;
  personSelectedId: string;
  statementAcknowledged: boolean;
  officerNotesOwner: string;
  foundAddress: string; foundCity: string;
  finderWantsIfUnclaimed: boolean; finderWantsAdoptionContact: boolean;
  caseNumber: string; processedByEmployee: string; acoRecord: string; intakeDate: string; pen: string;
  species: string; microchip: string; intakeMethod: string; linkedCallId: string;
  breed: string; color: string; collarTag: string; ownerVet: string; ownerVetPhone: string; rabiesTag: string;
  tailType: string; earsType: string; coatTypeDetail: string; distinguishingFeatures: string;
  sex: string; alteration: string;
  bodyConditionScore: string; weight: string; notWeighed: boolean; ageEstimate: string;
  conditionFlags: Record<string, boolean>; behaviorFlags: Record<string, boolean>;
  staffNotes: string; assessedByInitials: string; assessmentDate: string;
  surrenderSignature: string | null; finderSignature: string | null;
  photoDataUrls: string[];
}

const CONDITION_OPTIONS = ["Visible Injury", "Signs of Illness", "Parasites Observed", "Pregnant / Nursing"];
// Matches the exact strings the desktop intake wizard and the print module
// check for (no spaces around the slash) so intake_behavior stays consistent
// however the record was created.
const BEHAVIOR_OPTIONS = ["Friendly/Approachable", "Fearful/Skittish", "Aggressive", "Feral/Unhandleable"];
const ALTERATION_OPTIONS = ["Intact", "Spayed", "Neutered", "Unknown"];

function FieldIntakeWizard({ officer }: { officer: StaffAccount }) {
  const officerName = `${officer.first_name ?? officer.firstName ?? ""} ${officer.last_name ?? officer.lastName ?? ""}`.trim() || officer.username;
  const officerInitials = `${(officer.first_name ?? officer.firstName ?? "").slice(0, 1)}${(officer.last_name ?? officer.lastName ?? "").slice(0, 1)}`.toUpperCase() || officer.username.slice(0, 2).toUpperCase();

  const [people, setPeople] = useState<Person[]>([]);
  const [openCalls, setOpenCalls] = useState<DispatchCall[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [restored, setRestored] = useState(false);

  const [intakeChoice, setIntakeChoice] = useState<IntakeChoice>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const [personSelected, setPersonSelected] = useState<Person | null>(null);
  const [npFirst, setNpFirst] = useState("");
  const [npLast, setNpLast] = useState("");
  const [npPhone, setNpPhone] = useState("");
  const [npEmail, setNpEmail] = useState("");
  const [npAddress, setNpAddress] = useState("");
  const [npCity, setNpCity] = useState("");
  const [npState, setNpState] = useState("GA");
  const [npZip, setNpZip] = useState("");

  const [statementAcknowledged, setStatementAcknowledged] = useState(false);
  const [officerNotesOwner, setOfficerNotesOwner] = useState("");
  const [surrenderSignature, setSurrenderSignature] = useState<string | null>(null);
  const [surrenderSignedAt, setSurrenderSignedAt] = useState<string | null>(null);

  const [foundAddress, setFoundAddress] = useState("");
  const [foundCity, setFoundCity] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [finderWantsIfUnclaimed, setFinderWantsIfUnclaimed] = useState(false);
  const [finderWantsAdoptionContact, setFinderWantsAdoptionContact] = useState(false);
  const [finderSignature, setFinderSignature] = useState<string | null>(null);
  const [finderSignedAt, setFinderSignedAt] = useState<string | null>(null);

  const [caseNumber, setCaseNumber] = useState("");
  const [processedByEmployee, setProcessedByEmployee] = useState(officerName);
  const [acoRecord, setAcoRecord] = useState(officer.badge || "");
  const [intakeDate, setIntakeDate] = useState(today());
  const [pen, setPen] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [microchip, setMicrochip] = useState("");
  const [intakeMethod, setIntakeMethod] = useState("Field Intake");
  const [linkedCallId, setLinkedCallId] = useState("");

  const [breed, setBreed] = useState("");
  const [color, setColor] = useState("");
  const [collarTag, setCollarTag] = useState("");
  const [ownerVet, setOwnerVet] = useState("");
  const [ownerVetPhone, setOwnerVetPhone] = useState("");
  const [rabiesTag, setRabiesTag] = useState("");
  const [tailType, setTailType] = useState("");
  const [earsType, setEarsType] = useState("");
  const [coatTypeDetail, setCoatTypeDetail] = useState("");
  const [distinguishingFeatures, setDistinguishingFeatures] = useState("");
  const [sex, setSex] = useState("");
  const [alteration, setAlteration] = useState("");
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bodyConditionScore, setBodyConditionScore] = useState("");
  const [weight, setWeight] = useState("");
  const [notWeighed, setNotWeighed] = useState(false);
  const [ageEstimate, setAgeEstimate] = useState("");
  const [conditionFlags, setConditionFlags] = useState<Record<string, boolean>>({});
  const [behaviorFlags, setBehaviorFlags] = useState<Record<string, boolean>>({});
  const [staffNotes, setStaffNotes] = useState("");
  const [assessedByInitials, setAssessedByInitials] = useState(officerInitials);
  const [assessmentDate, setAssessmentDate] = useState(today());

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ animal: Animal; queued: boolean } | null>(null);

  const flow = useMemo(() => stepsFor(intakeChoice), [intakeChoice]);
  const currentStepId = flow[Math.min(stepIdx, flow.length - 1)];

  // ── Load reference data + restore draft + wire online/offline ────────────────
  useEffect(() => {
    fetchPeople().then((p) => {
      setPeople(p);
      const draft = loadDraft() as unknown as DraftState | null;
      if (draft?.personSelectedId) {
        const match = p.find((x) => x.id === draft.personSelectedId);
        if (match) setPersonSelected(match);
      }
    }).catch(() => {});
    fetchCalls().then((calls) => setOpenCalls(calls.filter((c) => !["Resolved", "Cancelled"].includes(c.status || "")))).catch(() => {});

    const draft = loadDraft() as unknown as DraftState | null;
    if (draft) {
      setIntakeChoice(draft.intakeChoice ?? null);
      setStepIdx(draft.stepIdx ?? 0);
      setNpFirst(draft.npFirst ?? ""); setNpLast(draft.npLast ?? ""); setNpPhone(draft.npPhone ?? ""); setNpEmail(draft.npEmail ?? "");
      setNpAddress(draft.npAddress ?? ""); setNpCity(draft.npCity ?? ""); setNpState(draft.npState ?? "GA"); setNpZip(draft.npZip ?? "");
      setStatementAcknowledged(!!draft.statementAcknowledged);
      setOfficerNotesOwner(draft.officerNotesOwner ?? "");
      setFoundAddress(draft.foundAddress ?? ""); setFoundCity(draft.foundCity ?? "");
      setFinderWantsIfUnclaimed(!!draft.finderWantsIfUnclaimed);
      setFinderWantsAdoptionContact(!!draft.finderWantsAdoptionContact);
      setCaseNumber(draft.caseNumber ?? "");
      setProcessedByEmployee(draft.processedByEmployee || officerName);
      setAcoRecord(draft.acoRecord || officer.badge || "");
      setIntakeDate(draft.intakeDate || today());
      setPen(draft.pen ?? "");
      setSpecies(draft.species || "Dog");
      setMicrochip(draft.microchip ?? "");
      setIntakeMethod(draft.intakeMethod || "Field Intake");
      setLinkedCallId(draft.linkedCallId ?? "");
      setBreed(draft.breed ?? ""); setColor(draft.color ?? ""); setCollarTag(draft.collarTag ?? "");
      setOwnerVet(draft.ownerVet ?? ""); setOwnerVetPhone(draft.ownerVetPhone ?? ""); setRabiesTag(draft.rabiesTag ?? "");
      setTailType(draft.tailType ?? ""); setEarsType(draft.earsType ?? ""); setCoatTypeDetail(draft.coatTypeDetail ?? "");
      setDistinguishingFeatures(draft.distinguishingFeatures ?? "");
      setSex(draft.sex ?? ""); setAlteration(draft.alteration ?? "");
      setBodyConditionScore(draft.bodyConditionScore ?? "");
      setWeight(draft.weight ?? ""); setNotWeighed(!!draft.notWeighed); setAgeEstimate(draft.ageEstimate ?? "");
      setConditionFlags(draft.conditionFlags ?? {}); setBehaviorFlags(draft.behaviorFlags ?? {});
      setStaffNotes(draft.staffNotes ?? "");
      setAssessedByInitials(draft.assessedByInitials || officerInitials);
      setAssessmentDate(draft.assessmentDate || today());
      setSurrenderSignature(draft.surrenderSignature ?? null);
      setFinderSignature(draft.finderSignature ?? null);
      setPhotoDataUrls(draft.photoDataUrls ?? []);
    }
    setRestored(true);

    const goOnline = () => { setIsOnline(true); processFieldIntakeQueue(setQueueCount); };
    const goOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    setQueueCount(getQueuedIntakes().length);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    processFieldIntakeQueue(setQueueCount);
    const interval = setInterval(() => processFieldIntakeQueue(setQueueCount), 60_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Autosave draft on every change ────────────────────────────────────────────
  useEffect(() => {
    if (!restored || submitted) return;
    const draft: DraftState = {
      intakeChoice, stepIdx, npFirst, npLast, npPhone, npEmail, npAddress, npCity, npState, npZip,
      personSelectedId: personSelected?.id || "",
      statementAcknowledged, officerNotesOwner, foundAddress, foundCity,
      finderWantsIfUnclaimed, finderWantsAdoptionContact,
      caseNumber, processedByEmployee, acoRecord, intakeDate, pen, species, microchip, intakeMethod, linkedCallId,
      breed, color, collarTag, ownerVet, ownerVetPhone, rabiesTag, tailType, earsType, coatTypeDetail,
      distinguishingFeatures, sex, alteration, bodyConditionScore, weight, notWeighed, ageEstimate,
      conditionFlags, behaviorFlags, staffNotes, assessedByInitials, assessmentDate,
      surrenderSignature, finderSignature, photoDataUrls,
    };
    saveDraft(draft as unknown as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restored, submitted, intakeChoice, stepIdx, npFirst, npLast, npPhone, npEmail, npAddress, npCity, npState, npZip,
    personSelected, statementAcknowledged, officerNotesOwner, foundAddress, foundCity,
    finderWantsIfUnclaimed, finderWantsAdoptionContact, caseNumber, processedByEmployee, acoRecord, intakeDate,
    pen, species, microchip, intakeMethod, linkedCallId, breed, color, collarTag, ownerVet, ownerVetPhone,
    rabiesTag, tailType, earsType, coatTypeDetail, distinguishingFeatures, sex, alteration, bodyConditionScore,
    weight, notWeighed, ageEstimate, conditionFlags, behaviorFlags, staffNotes, assessedByInitials,
    assessmentDate, surrenderSignature, finderSignature, photoDataUrls,
  ]);

  // ── Photo capture ─────────────────────────────────────────────────────────────
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const f of files) {
      if (!isFileTypeAccepted(f, PHOTO_ACCEPT)) { alert(`${f.name}: file type not allowed. Accepted: JPG, PNG, HEIC`); continue; }
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoDataUrls((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    }
  };
  const removePhoto = (idx: number) => setPhotoDataUrls((prev) => prev.filter((_, i) => i !== idx));

  // ── GPS ────────────────────────────────────────────────────────────────────────
  const handleUseGPS = () => {
    if (!navigator.geolocation) { alert("GPS is not available on this device/browser."); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setFoundAddress(`GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setGpsLoading(false);
      },
      () => { alert("Unable to get GPS location. Enter the address manually."); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const toggleFlag = (setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, key: string) =>
    setter((prev) => ({ ...prev, [key]: !prev[key] }));

  // Owner/Finder share the same person fields — clear them when the officer
  // changes their mind about intake type so stale data can't leak across.
  const handleChooseIntakeType = (choice: IntakeChoice) => {
    if (choice !== intakeChoice) {
      setPersonSelected(null);
      setNpFirst(""); setNpLast(""); setNpPhone(""); setNpEmail("");
      setNpAddress(""); setNpCity(""); setNpZip("");
    }
    setIntakeChoice(choice);
    setStepIdx(0);
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const stepError = useMemo((): string => {
    if (currentStepId === "type" && !intakeChoice) return "Choose an intake type to continue.";
    if (currentStepId === "owner") {
      if (!statementAcknowledged) return "The owner must acknowledge the Statement of Surrender.";
      if (!surrenderSignature) return "Owner signature is required.";
    }
    if (currentStepId === "finder" && !finderSignature) return "Finder signature is required.";
    return "";
  }, [currentStepId, intakeChoice, statementAcknowledged, surrenderSignature, finderSignature]);

  const goNext = () => {
    if (stepError) { alert(stepError); return; }
    setStepIdx((i) => Math.min(flow.length - 1, i + 1));
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setStepIdx((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  };

  // ── Build submission payload ──────────────────────────────────────────────────
  const buildSubmission = (): FieldIntakeSubmission<string[]> => {
    const personRole: "Previous Owner" | "Finder" | null =
      intakeChoice === "surrender" ? "Previous Owner" : intakeChoice === "stray" ? "Finder" : null;
    const behaviorText = BEHAVIOR_OPTIONS.filter((o) => behaviorFlags[o]).join(", ");
    const animal: FieldIntakeSubmission["animal"] = {
      name: "Unknown",
      species, breed: breed || "Unknown", color: color || "Unknown",
      sex: sex || "Unknown", age: ageEstimate || undefined,
      weight: notWeighed ? "Not weighed" : weight || undefined,
      fixed: alteration === "Spayed" || alteration === "Neutered",
      status: "Available",
      intake_type: intakeChoice === "surrender" ? "Surrender" : "Stray",
      intake_date: intakeDate,
      circumstance: intakeChoice === "surrender" ? "Owner Surrender" : intakeChoice === "stray" ? "Stray (No ID)" : "Other",
      microchip: microchip || undefined,
      rabies_tag: rabiesTag || undefined,
      aco_record: acoRecord || undefined,
      case_number: caseNumber || undefined,
      intake_method: intakeMethod,
      processed_by_employee: processedByEmployee || undefined,
      collar_tag: collarTag || undefined,
      owner_vet: ownerVet || undefined,
      owner_vet_phone: ownerVetPhone || undefined,
      tail_type: tailType || undefined,
      ears_type: earsType || undefined,
      coat_type_detail: coatTypeDetail || undefined,
      distinguishing_features: distinguishingFeatures || undefined,
      body_condition_score: bodyConditionScore ? Number(bodyConditionScore) : undefined,
      condition_visible_injury: !!conditionFlags["Visible Injury"],
      condition_signs_of_illness: !!conditionFlags["Signs of Illness"],
      condition_parasites_observed: !!conditionFlags["Parasites Observed"],
      condition_pregnant_nursing: !!conditionFlags["Pregnant / Nursing"],
      intake_behavior: behaviorText || undefined,
      behavior_friendly: !!behaviorFlags["Friendly/Approachable"],
      behavior_fearful_skittish: !!behaviorFlags["Fearful/Skittish"],
      behavior_aggressive: !!behaviorFlags["Aggressive"],
      behavior_feral_unhandleable: !!behaviorFlags["Feral/Unhandleable"],
      injuries: staffNotes || undefined,
      assessed_by_initials: assessedByInitials || undefined,
      assessment_date: assessmentDate || undefined,
      found_address: intakeChoice === "stray" ? foundAddress || undefined : undefined,
      found_city: intakeChoice === "stray" ? foundCity || undefined : undefined,
      finder_wants_if_unclaimed: intakeChoice === "stray" ? finderWantsIfUnclaimed : undefined,
      finder_wants_adoption_contact: intakeChoice === "stray" ? finderWantsAdoptionContact : undefined,
      finder_signature: intakeChoice === "stray" ? finderSignature || undefined : undefined,
      statement_of_surrender_acknowledged: intakeChoice === "surrender" ? statementAcknowledged : undefined,
      surrender_signature: intakeChoice === "surrender" ? surrenderSignature || undefined : undefined,
    };
    return {
      officerId: officer.id,
      officerName,
      animal,
      personRole,
      personId: personSelected?.id,
      personDraft: !personSelected && (npFirst || npLast) ? {
        first_name: npFirst, last_name: npLast, phone: npPhone, email: npEmail || undefined,
        address: npAddress || undefined, city: npCity || undefined, state: npState || undefined, zip: npZip || undefined,
      } : undefined,
      officerNotes: officerNotesOwner || undefined,
      linkedCallId: linkedCallId || undefined,
      signatures: { surrender: surrenderSignature, finder: finderSignature },
      photos: photoDataUrls,
    };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const submission = buildSubmission();
    try {
      if (!navigator.onLine) throw new Error("offline");
      const result = await submitFieldIntake(submission);
      clearDraft();
      setSubmitted({ animal: result.animal, queued: false });
    } catch (err) {
      // Offline or the live attempt failed — queue it locally for automatic retry/sync.
      queueFieldIntake(submission);
      setQueueCount(getQueuedIntakes().length);
      clearDraft();
      const placeholderAnimal = { ...submission.animal, id: "PENDING SYNC" } as Animal;
      setSubmitted({ animal: placeholderAnimal, queued: true });
      console.error("[field-intake] live submit failed, queued for sync:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const recipientEmail = personSelected?.email || npEmail;

  const handlePrintShare = () => {
    if (!submitted) return;
    // Opens the browser print dialog with the filled intake form — on mobile
    // this is where "Share"/"Save to Files" lives in the native print sheet.
    printIntakeForm(submitted.animal);
  };

  // ── Confirmation screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0f2942", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <Screen>
          <div style={{ textAlign: "center", paddingTop: 30 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{submitted.queued ? "📶" : "✅"}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
              {submitted.queued ? "Saved — Will Sync Automatically" : "Intake Complete"}
            </div>
            {submitted.queued ? (
              <div style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                No connection right now. This intake is saved on this device and will be submitted automatically
                as soon as you&apos;re back in range. Do not close the app until it syncs.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>Animal ID</div>
                <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 800, color: "#7fc6c6", marginBottom: 24 }}>{submitted.animal.id}</div>
              </>
            )}

            {!submitted.queued && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={handlePrintShare} style={{ padding: "16px 0", borderRadius: 12, border: "none", background: "#1a8a8a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                  🖨 Print / Share Intake Form
                </button>
                {recipientEmail && (
                  <a
                    href={`mailto:${recipientEmail}?subject=${encodeURIComponent(`Your ${AGENCY_NAME} Intake Confirmation`)}&body=${encodeURIComponent(`Thank you. Your animal's ID is ${submitted.animal.id}. An officer can provide a printed or PDF copy of the signed intake form on request.`)}`}
                    style={{ padding: "16px 0", borderRadius: 12, border: "1px solid #334155", background: "#1a3a5c", color: "#e2e8f0", fontSize: 15, fontWeight: 800, textAlign: "center", textDecoration: "none" }}
                  >
                    📧 Email Confirmation to {recipientEmail}
                  </a>
                )}
              </div>
            )}

            <a href="/officer-app" style={{ display: "block", marginTop: 24, padding: "16px 0", borderRadius: 12, background: "#0f2942", border: "1px solid #334155", color: "#94a3b8", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              ← Back to Officer Dashboard
            </a>
          </div>
        </Screen>
      </div>
    );
  }

  // ── Main wizard ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0f2942", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`* { box-sizing: border-box; } input, select, textarea { font-family: inherit; }`}</style>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#071e33", padding: "12px 16px", borderBottom: "1px solid #1a3a5c", display: "flex", alignItems: "center", gap: 10 }}>
        <a href="/officer-app" style={{ color: "#7fc6c6", textDecoration: "none", fontSize: 20 }}>←</a>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Field Intake</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Step {stepIdx + 1} of {flow.length} — {STEP_LABELS[currentStepId]}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#22c55e" : "#ef4444", display: "inline-block" }} />
          <span style={{ color: isOnline ? "#22c55e" : "#ef4444" }}>{isOnline ? "Online" : "Offline"}</span>
        </div>
      </div>
      {queueCount > 0 && (
        <div style={{ background: "#78350f", color: "#fde68a", padding: "6px 16px", fontSize: 12, textAlign: "center", fontWeight: 700 }}>
          ⏳ {queueCount} intake{queueCount === 1 ? "" : "s"} waiting to sync
        </div>
      )}
      {/* Progress bar */}
      <div style={{ display: "flex", gap: 3, padding: "8px 16px 0" }}>
        {flow.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stepIdx ? "#1a8a8a" : "#1a3a5c" }} />
        ))}
      </div>

      <Screen>
        {currentStepId === "type" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Is this an owner surrender or found stray?</h2>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 18 }}>Choose the option that matches this intake.</p>
            <ChoiceGrid
              value={intakeChoice}
              onChange={handleChooseIntakeType}
              options={[
                { value: "surrender", label: "Owner Surrender", icon: "🖊️" },
                { value: "stray", label: "Found Stray", icon: "🐾" },
                { value: "field", label: "Field Impound (no person present)", icon: "🚐" },
              ]}
            />
          </div>
        )}

        {currentStepId === "owner" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Owner Surrender</h2>
            <Field label="Owner">
              <PersonSearch people={people} selected={personSelected} onSelect={setPersonSelected} onClear={() => setPersonSelected(null)} />
            </Field>
            {!personSelected && (
              <>
                <Field label="Owner First Name" required><input style={inputStyle} value={npFirst} onChange={(e) => setNpFirst(e.target.value)} /></Field>
                <Field label="Owner Last Name" required><input style={inputStyle} value={npLast} onChange={(e) => setNpLast(e.target.value)} /></Field>
                <Field label="Phone" required><input style={inputStyle} type="tel" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} /></Field>
                <Field label="Email (optional)"><input style={inputStyle} type="email" value={npEmail} onChange={(e) => setNpEmail(e.target.value)} /></Field>
                <Field label="Address"><input style={inputStyle} value={npAddress} onChange={(e) => setNpAddress(e.target.value)} /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="City"><input style={inputStyle} value={npCity} onChange={(e) => setNpCity(e.target.value)} /></Field>
                  <Field label="State">
                    <select style={inputStyle} value={npState} onChange={(e) => setNpState(e.target.value)}>
                      {STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Zip"><input style={inputStyle} value={npZip} onChange={(e) => setNpZip(e.target.value)} /></Field>
              </>
            )}

            <div style={{ marginTop: 10, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>Statement of Surrender</div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", background: "#0f2942", fontSize: 12.5, lineHeight: 1.7, color: "#cbd5e1" }}>
                {STATEMENT_OF_SURRENDER_TEXT}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={statementAcknowledged} onChange={(e) => setStatementAcknowledged(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 14 }}><strong>I have read and agree</strong> to the Statement of Surrender above.</span>
            </label>

            <Field label="Owner Signature" required>
              <SignaturePad
                label="Owner Signature"
                value={surrenderSignature}
                timestamp={surrenderSignedAt}
                onAccept={(data, ts) => { setSurrenderSignature(data); setSurrenderSignedAt(ts); }}
                onClear={() => { setSurrenderSignature(null); setSurrenderSignedAt(null); }}
              />
            </Field>
            <Field label="Officer Notes (optional)">
              <textarea style={textareaStyle} rows={3} value={officerNotesOwner} onChange={(e) => setOfficerNotesOwner(e.target.value)} placeholder="Notes about the surrender…" />
            </Field>
          </div>
        )}

        {currentStepId === "finder" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Finder</h2>
            <Field label="Finder">
              <PersonSearch people={people} selected={personSelected} onSelect={setPersonSelected} onClear={() => setPersonSelected(null)} />
            </Field>
            {!personSelected && (
              <>
                <Field label="Finder First Name"><input style={inputStyle} value={npFirst} onChange={(e) => setNpFirst(e.target.value)} /></Field>
                <Field label="Finder Last Name"><input style={inputStyle} value={npLast} onChange={(e) => setNpLast(e.target.value)} /></Field>
                <Field label="Phone"><input style={inputStyle} type="tel" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} /></Field>
                <Field label="Email (optional)"><input style={inputStyle} type="email" value={npEmail} onChange={(e) => setNpEmail(e.target.value)} /></Field>
                <Field label="Address"><input style={inputStyle} value={npAddress} onChange={(e) => setNpAddress(e.target.value)} /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="City"><input style={inputStyle} value={npCity} onChange={(e) => setNpCity(e.target.value)} /></Field>
                  <Field label="State">
                    <select style={inputStyle} value={npState} onChange={(e) => setNpState(e.target.value)}>
                      {STATES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Zip"><input style={inputStyle} value={npZip} onChange={(e) => setNpZip(e.target.value)} /></Field>
              </>
            )}

            <Field label="Location Found">
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={foundAddress} onChange={(e) => setFoundAddress(e.target.value)} placeholder="Address or cross streets" />
              </div>
              <button onClick={handleUseGPS} disabled={gpsLoading} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #334155", background: "#1a3a5c", color: "#7fc6c6", fontWeight: 700, fontSize: 13, minHeight: 48 }}>
                {gpsLoading ? "Getting location…" : "📍 Use Current GPS Location"}
              </button>
            </Field>
            <Field label="Found City"><input style={inputStyle} value={foundCity} onChange={(e) => setFoundCity(e.target.value)} /></Field>

            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 10, background: "#1a3a5c", border: "1px solid #334155", marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={finderWantsIfUnclaimed} onChange={(e) => setFinderWantsIfUnclaimed(e.target.checked)} style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 14 }}>Wants to keep animal if unclaimed</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 10, background: "#1a3a5c", border: "1px solid #334155", marginBottom: 18, cursor: "pointer" }}>
              <input type="checkbox" checked={finderWantsAdoptionContact} onChange={(e) => setFinderWantsAdoptionContact(e.target.checked)} style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 14 }}>Wants to be contacted re: adoption</span>
            </label>

            <Field label="Finder Signature" required>
              <SignaturePad
                label="Finder Signature"
                value={finderSignature}
                timestamp={finderSignedAt}
                onAccept={(data, ts) => { setFinderSignature(data); setFinderSignedAt(ts); }}
                onClear={() => { setFinderSignature(null); setFinderSignedAt(null); }}
              />
            </Field>
          </div>
        )}

        {currentStepId === "details" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Intake Details</h2>
            <Field label="Employee"><input style={inputStyle} value={processedByEmployee} onChange={(e) => setProcessedByEmployee(e.target.value)} /></Field>
            <Field label="AC#"><input style={inputStyle} value={acoRecord} onChange={(e) => setAcoRecord(e.target.value)} /></Field>
            <Field label="Date of Impound"><input style={inputStyle} type="date" value={intakeDate} onChange={(e) => setIntakeDate(e.target.value)} /></Field>
            <Field label="Pen # (leave blank if not yet assigned)"><input style={inputStyle} value={pen} onChange={(e) => setPen(e.target.value)} /></Field>
            <Field label="Species" required>
              <RadioRow options={["Dog", "Cat", "Other"]} value={species} onChange={setSpecies} />
            </Field>
            <Field label="Microchip #"><input style={inputStyle} value={microchip} onChange={(e) => setMicrochip(e.target.value)} placeholder="Enter chip number manually" /></Field>
            <Field label="Intake Method">
              <RadioRow options={INTAKE_METHODS} value={intakeMethod} onChange={setIntakeMethod} />
            </Field>
            <Field label="Case # — link to an open dispatch call (optional)">
              <select style={inputStyle} value={linkedCallId} onChange={(e) => setLinkedCallId(e.target.value)}>
                <option value="">— None —</option>
                {openCalls.map((c) => <option key={c.id} value={c.id}>#{c.id.slice(-4)} — {c.type} — {c.address}</option>)}
              </select>
            </Field>
          </div>
        )}

        {currentStepId === "description" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Animal Description</h2>
            <Field label="Breed">
              <input style={inputStyle} list="breed-options" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Start typing…" />
              <datalist id="breed-options">
                {(species === "Cat" ? ALL_BREEDS_CAT : ALL_BREEDS_DOG).filter(Boolean).map((b) => <option key={b} value={b} />)}
              </datalist>
            </Field>
            <Field label="Color">
              <input style={inputStyle} list="color-options" value={color} onChange={(e) => setColor(e.target.value)} />
              <datalist id="color-options">
                {ALL_COLORS.filter(Boolean).map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Collar / Tag"><input style={inputStyle} value={collarTag} onChange={(e) => setCollarTag(e.target.value)} /></Field>
            <Field label="Vet Name (if known)"><input style={inputStyle} value={ownerVet} onChange={(e) => setOwnerVet(e.target.value)} /></Field>
            <Field label="Vet Phone"><input style={inputStyle} type="tel" value={ownerVetPhone} onChange={(e) => setOwnerVetPhone(e.target.value)} /></Field>
            <Field label="Rabies Tag #"><input style={inputStyle} value={rabiesTag} onChange={(e) => setRabiesTag(e.target.value)} /></Field>
            <Field label="Tail"><RadioRow options={TAIL_TYPES.filter(Boolean)} value={tailType} onChange={setTailType} /></Field>
            <Field label="Ears"><RadioRow options={INTAKE_EAR_TYPES.filter(Boolean)} value={earsType} onChange={setEarsType} /></Field>
            <Field label="Coat"><RadioRow options={INTAKE_COAT_TYPES.filter(Boolean)} value={coatTypeDetail} onChange={setCoatTypeDetail} /></Field>
            <Field label="Distinguishing Features">
              <textarea style={textareaStyle} rows={3} value={distinguishingFeatures} onChange={(e) => setDistinguishingFeatures(e.target.value)} />
            </Field>
            <Field label="Sex"><RadioRow options={["Male", "Female"]} value={sex} onChange={setSex} /></Field>
            <Field label="Alteration"><RadioRow options={ALTERATION_OPTIONS} value={alteration} onChange={setAlteration} /></Field>

            <Field label={`Photos (${photoDataUrls.length})`}>
              <input ref={fileInputRef} type="file" accept={PHOTO_ACCEPT} capture="environment" multiple style={{ display: "none" }} onChange={handlePhotoCapture} />
              <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "16px 0", borderRadius: 10, border: "2px dashed #334155", background: "#1a3a5c", color: "#7fc6c6", fontWeight: 700, fontSize: 15, minHeight: 56 }}>
                📷 Take / Add Photo
              </button>
              {photoDataUrls.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {photoDataUrls.map((src, i) => (
                    <div key={i} style={{ position: "relative", width: 84, height: 84 }}>
                      <img src={src} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid #334155" }} />
                      <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: -6, right: -6, width: 24, height: 24, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", fontSize: 12 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
        )}

        {currentStepId === "condition" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Condition &amp; Behavior Assessment</h2>
            <Field label="Body Condition Score (1 = emaciated, 9 = obese)">
              <RadioRow options={BODY_CONDITION_SCORES.map(String)} value={bodyConditionScore} onChange={setBodyConditionScore} />
            </Field>
            <Field label="Weight (lbs)">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input style={{ ...inputStyle, opacity: notWeighed ? 0.4 : 1 }} value={weight} disabled={notWeighed} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={notWeighed} onChange={(e) => setNotWeighed(e.target.checked)} style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Not weighed</span>
              </label>
            </Field>
            <Field label="Estimated Age"><input style={inputStyle} value={ageEstimate} onChange={(e) => setAgeEstimate(e.target.value)} placeholder="e.g. 2 years" /></Field>
            <Field label="Condition (select all that apply)">
              <MultiCheck options={CONDITION_OPTIONS} value={conditionFlags} onToggle={(o) => toggleFlag(setConditionFlags, o)} />
            </Field>
            <Field label="Behavior (select all that apply)">
              <MultiCheck options={BEHAVIOR_OPTIONS} value={behaviorFlags} onToggle={(o) => toggleFlag(setBehaviorFlags, o)} />
            </Field>
            <Field label="Staff Notes / Observations">
              <textarea style={textareaStyle} rows={3} value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} />
            </Field>
            <Field label="Assessed By (Initials)"><input style={inputStyle} value={assessedByInitials} onChange={(e) => setAssessedByInitials(e.target.value)} maxLength={6} /></Field>
            <Field label="Assessment Date"><input style={inputStyle} type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} /></Field>
          </div>
        )}

        {currentStepId === "review" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Review &amp; Submit</h2>
            {[
              ["Intake Type", intakeChoice === "surrender" ? "Owner Surrender" : intakeChoice === "stray" ? "Found Stray" : "Field Impound"],
              [intakeChoice === "surrender" ? "Owner" : "Finder", personSelected ? `${personSelected.first_name} ${personSelected.last_name}` : [npFirst, npLast].filter(Boolean).join(" ") || "—"],
              ["Species / Breed", `${species} · ${breed || "Unknown"}`],
              ["Color", color || "Unknown"],
              ["Sex / Alteration", `${sex || "Unknown"} · ${alteration || "Unknown"}`],
              ["Microchip", microchip || "None"],
              ["Intake Method", intakeMethod],
              ["Body Condition Score", bodyConditionScore || "—"],
              ["Weight", notWeighed ? "Not weighed" : weight || "—"],
              ["Employee", processedByEmployee],
              ["AC#", acoRecord || "—"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1a3a5c", fontSize: 14 }}>
                <span style={{ color: "#94a3b8" }}>{label}</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{value}</span>
              </div>
            ))}

            {intakeChoice === "surrender" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Owner Signature</div>
                {surrenderSignature ? <img src={surrenderSignature} alt="Owner signature" style={{ height: 60, background: "#fff", borderRadius: 6, padding: 4 }} /> : <div style={{ color: "#f87171" }}>Not signed</div>}
              </div>
            )}
            {intakeChoice === "stray" && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Finder Signature</div>
                {finderSignature ? <img src={finderSignature} alt="Finder signature" style={{ height: 60, background: "#fff", borderRadius: 6, padding: 4 }} /> : <div style={{ color: "#f87171" }}>Not signed</div>}
              </div>
            )}

            {photoDataUrls.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>Photos ({photoDataUrls.length})</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {photoDataUrls.map((src, i) => <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />)}
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: "100%", marginTop: 20, padding: "18px 0", borderRadius: 12, border: "none", background: submitting ? "#334155" : "#16a34a", color: "#fff", fontSize: 17, fontWeight: 800, minHeight: 56 }}
            >
              {submitting ? "Submitting…" : isOnline ? "✓ Submit Intake" : "✓ Submit Intake (will sync when online)"}
            </button>
          </div>
        )}
      </Screen>

      {/* Sticky bottom nav */}
      {currentStepId !== "review" && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#071e33", borderTop: "1px solid #1a3a5c", padding: "12px 16px", display: "flex", gap: 10, zIndex: 50 }}>
          <button onClick={goBack} disabled={stepIdx === 0} style={{ flex: 1, padding: "16px 0", borderRadius: 12, border: "1px solid #334155", background: "#1a3a5c", color: stepIdx === 0 ? "#475569" : "#e2e8f0", fontWeight: 700, fontSize: 15, minHeight: 52 }}>
            ← Back
          </button>
          <button onClick={goNext} style={{ flex: 2, padding: "16px 0", borderRadius: 12, border: "none", background: "#1a8a8a", color: "#fff", fontWeight: 800, fontSize: 15, minHeight: 52 }}>
            Next →
          </button>
        </div>
      )}
      {currentStepId === "review" && stepIdx > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#071e33", borderTop: "1px solid #1a3a5c", padding: "12px 16px", zIndex: 50 }}>
          <button onClick={goBack} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "1px solid #334155", background: "#1a3a5c", color: "#e2e8f0", fontWeight: 700, fontSize: 14 }}>
            ← Back to edit
          </button>
        </div>
      )}
    </div>
  );
}
