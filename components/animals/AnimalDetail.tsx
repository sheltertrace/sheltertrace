"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Animal, MedicalRecord, Person, DispatchCall, ShelterForm, FormPreFill, Transfer, RescueGroup, DepartureReceipt, AdoptionRecord } from "@/lib/types";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  STATUSES, SUB_STATUSES, BEHAVIOR_FLAGS, EUTH_DRUGS, EUTH_REASONS,
  CIRCUMSTANCE_TYPES, COAT_TYPES, EAR_TYPES, EYE_COLORS, SIZE_OPTIONS,
  ALL_BREEDS_DOG, ALL_BREEDS_CAT, ALL_COLORS,
  MEDICAL_TYPES, MEDICAL_DESC_MAP,
} from "@/lib/constants";
import StaffSelect from "@/components/ui/StaffSelect";
import { useKennels } from "@/app/providers";
import { calcAge, formatDate, today, nowTime, genId } from "@/lib/utils";
import {
  updateAnimal, addAnimalNote, fetchAnimalNotes, createMedical,
  fetchAnimalDocuments, uploadAnimalDocument, deleteAnimalDocument, fetchFormsByLinked,
  fetchTransfersByAnimal, safeJsonArray, safeJsonObject, safeArray,
  createDepartureReceipt, fetchDepartureReceiptsByAnimal, fetchAdoptionsByAnimal,
  type AnimalDocument,
} from "@/lib/data";
import { isDepartureStatus, departureTypeLabel, buildDepartureReceiptPayload, printDepartureReceipt } from "@/lib/departureReceipt";
import { printTransferReceipt } from "@/components/transfers/TransferWizard";
import MedicalEditModal from "@/components/medical/MedicalEditModal";
import dynamic from "next/dynamic";
const CropPhotoModal = dynamic(() => import("./CropPhotoModal"), { ssr: false });
import GenerateFormButton from "@/components/forms/GenerateFormButton";
import ReprintFormButton from "@/components/forms/ReprintFormButton";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import ReturnAnimalModal from "./ReturnAnimalModal";
import ReceiptPreviewModal from "./ReceiptPreviewModal";
import AdoptionFromDetailModal, { type AdoptionReceiptInfo } from "./AdoptionFromDetailModal";
import { type RedemptionReceiptInfo } from "./RedemptionWizard";
const RedemptionWizard = dynamic(() => import("./RedemptionWizard"), { ssr: false });

interface Props {
  animal: Animal;
  medical: MedicalRecord[];
  people: Person[];
  dispatchCalls: DispatchCall[];
  onUpdate: (updated: Animal) => void;
}

const DEPARTURE_STATUSES_AUTO_REMOVE = ["Adopted", "Euthanized", "Transferred", "Redeemed"];

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

export default function AnimalDetail({ animal: initialAnimal, medical, people, dispatchCalls, onUpdate }: Props) {
  const router = useRouter();
  const { kennelLabels } = useKennels();
  const [animal, setAnimal] = useState<Animal>(initialAnimal);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAdoptionModal, setShowAdoptionModal] = useState(false);
  const [showRedemptionWizard, setShowRedemptionWizard] = useState(false);
  const [notes, setNotes] = useState<Array<{id: string; text: string; type: string; date: string; time: string}>>([]);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [pubPhotoUploading, setPubPhotoUploading] = useState(false);

  // Edit state
  const [editMode, setEditMode] = useState<string | null>(null); // section being edited
  const [editData, setEditData] = useState<Partial<Animal>>({});

  // Note form
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("General");

  // Medical form
  const [showAddMed, setShowAddMed] = useState(false);
  const [medType, setMedType] = useState(MEDICAL_TYPES[0]);
  const [medDesc, setMedDesc] = useState("");
  const [medDate, setMedDate] = useState(today());
  const [medVet, setMedVet] = useState("");
  const [medNextDue, setMedNextDue] = useState("");
  const [medLotNumber, setMedLotNumber] = useState("");
  const [medManufacturer, setMedManufacturer] = useState("");
  const [medRoute, setMedRoute] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medNotes, setMedNotes] = useState("");
  const [medResult, setMedResult] = useState("");
  const [medCost, setMedCost] = useState("");
  const [medStatus, setMedStatus] = useState("");
  const [medSaving, setMedSaving] = useState(false);
  const [medSaved, setMedSaved] = useState(false);
  const [medRecords, setMedRecords] = useState<MedicalRecord[]>(medical);
  const [editMedRecord, setEditMedRecord] = useState<MedicalRecord | null>(null);

  // Euthanasia form
  const [showEuthForm, setShowEuthForm] = useState(false);
  const [euthReason, setEuthReason] = useState(EUTH_REASONS[0]);
  const [euthDrug, setEuthDrug] = useState(EUTH_DRUGS[0]);
  const [euthDose, setEuthDose] = useState("");
  const [euthUnit, setEuthUnit] = useState("ml");
  const [euthVet, setEuthVet] = useState("");
  const [euthDate, setEuthDate] = useState(today());
  const [euthApproved, setEuthApproved] = useState(false);
  const [euthAuthorizedBy, setEuthAuthorizedBy] = useState("");
  const [euthWitness, setEuthWitness] = useState("");
  const [euthNotes, setEuthNotes] = useState("");

  // Documents
  const [docs, setDocs] = useState<AnimalDocument[]>([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState("General");
  const [docNotes, setDocNotes] = useState("");
  const [docUploading, setDocUploading] = useState(false);

  // Forms
  const [animalForms, setAnimalForms] = useState<ShelterForm[]>([]);

  // Transfer history
  const [animalTransfers, setAnimalTransfers] = useState<Transfer[]>([]);

  // Departure receipts
  const [departureReceipts, setDepartureReceipts] = useState<DepartureReceipt[]>([]);
  const [pendingReceipt, setPendingReceipt] = useState<DepartureReceipt | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<DepartureReceipt | null>(null);
  const [adoptionRecords, setAdoptionRecords] = useState<AdoptionRecord[]>([]);

  // People attachment
  const [showAttachPerson, setShowAttachPerson] = useState(false);
  const [personSearch, setPersonSearch] = useState("");

  // Kennel move
  const [showKennelMove, setShowKennelMove] = useState(false);
  const [newKennel, setNewKennel] = useState("");

  useEffect(() => {
    fetchAnimalNotes(animal.id).then((n) => setNotes(n as typeof notes));
    fetchAnimalDocuments(animal.id).then(setDocs);
    fetchFormsByLinked({ animalId: animal.id }).then(setAnimalForms);
    fetchTransfersByAnimal(animal.id).then(setAnimalTransfers);
    fetchDepartureReceiptsByAnimal(animal.id).then(setDepartureReceipts);
    fetchAdoptionsByAnimal(animal.id).then(setAdoptionRecords);
  }, [animal.id]);

  const save = useCallback(async (
    updates: Partial<Animal>,
    receiptOpts?: {
      person?: Person | null;
      personName?: string;
      fees?: Array<{ item: string; amount: number }>;
      totalFees?: number;
      paymentMethod?: string;
      conditions?: string;
      notes?: string;
      officerName?: string;
    }
  ) => {
    setSaving(true);
    if (updates.status && DEPARTURE_STATUSES_AUTO_REMOVE.includes(updates.status) && updates.status !== animal.status) {
      updates = { ...updates, show_on_website: false };
    }
    try {
      const updated = await updateAnimal(animal.id, updates);
      setAnimal(updated);
      onUpdate(updated);

      // Auto-generate departure receipt when status changes to a departure status
      if (updates.status && isDepartureStatus(updates.status) && updates.status !== animal.status) {
        const currentUser = getCurrentUser();
        const officerName = receiptOpts?.officerName
          || (currentUser ? `${currentUser.firstName || currentUser.first_name || ""} ${currentUser.lastName || currentUser.last_name || ""}`.trim() || currentUser.username : "");
        try {
          const payload = buildDepartureReceiptPayload(updated, {
            departureType: departureTypeLabel(updates.status),
            ...(receiptOpts || {}),
            officerName,
            officerId: currentUser?.id,
          });
          const receipt = await createDepartureReceipt(payload);
          setDepartureReceipts((prev) => [receipt, ...prev]);
          setPendingReceipt(receipt);
        } catch (receiptErr) {
          console.error("[DepartureReceipt] failed to create:", receiptErr);
          // Non-blocking — animal status already saved
        }
      }
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string; code?: string };
      console.error("[AnimalDetail save] error:", err?.message, "| code:", err?.code, "| details:", err?.details, "| hint:", err?.hint, "| raw:", JSON.stringify(e), e);
    } finally { setSaving(false); }
  }, [animal.id, animal.status, onUpdate]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const path = `${animal.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from("animal-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("animal-photos").getPublicUrl(path);
      await save({ photo_url: urlData.publicUrl });
    } catch {
      // Fallback to base64 preview for now
      const reader = new FileReader();
      reader.onload = (ev) => { save({ photo_url: ev.target?.result as string }); };
      reader.readAsDataURL(file);
    } finally { setPhotoUploading(false); e.target.value = ""; }
  }, [animal.id, save]);

  const handlePublicPhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPubPhotoUploading(true);
    try {
      const path = `public/${animal.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("animal-photos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("animal-photos").getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      const existing = safeArray(animal.photo_urls);
      const newPhotos = [...existing, newUrl];
      await save({
        photo_urls: newPhotos,
        featured_photo_url: animal.featured_photo_url || newUrl,
      });
    } catch (err) {
      console.error("[PublicPhoto] upload failed:", err);
    } finally { setPubPhotoUploading(false); e.target.value = ""; }
  }, [animal.id, animal.photo_urls, animal.featured_photo_url, save]);

  const toggleFlag = useCallback((flagId: string) => {
    const flags = { ...(animal.behavior_flags || {}) };
    flags[flagId] = !flags[flagId];
    save({ behavior_flags: flags });
  }, [animal.behavior_flags, save]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addAnimalNote(animal.id, newNote.trim(), noteType);
    const n = {
      id: genId(),
      text: newNote.trim(),
      type: noteType,
      date: today(),
      time: nowTime(),
    };
    setNotes((prev) => [n, ...prev]);
    setNewNote("");
  };

  const handleAddMedical = async () => {
    setMedSaving(true);
    try {
      const rec = await createMedical({
        animal_id: animal.id,
        animal_name: animal.name,
        type: medType,
        description: medDesc,
        date: medDate,
        vet: medVet || undefined,
        next_due: medNextDue || undefined,
        lot_number: medLotNumber || undefined,
        manufacturer: medManufacturer || undefined,
        route: medRoute || undefined,
        dosage: medDosage || undefined,
        notes: medNotes || undefined,
        result: medResult || undefined,
        cost: medCost !== "" ? parseFloat(medCost) : null,
        status: medStatus || undefined,
      });
      setMedRecords((prev) => [rec, ...prev]);
      setMedSaved(true);
      setTimeout(() => {
        setShowAddMed(false);
        setMedSaved(false);
        setMedDesc(""); setMedNextDue(""); setMedLotNumber(""); setMedManufacturer("");
        setMedRoute(""); setMedDosage(""); setMedNotes(""); setMedResult(""); setMedCost(""); setMedStatus("");
      }, 800);
    } finally { setMedSaving(false); }
  };

  const handleEuthanize = async () => {
    if (!euthApproved) return;
    const euthRecord = {
      date: euthDate, drug: euthDrug, reason: euthReason,
      dosage: `${euthDose} ${euthUnit}`, performed_by: euthVet,
      witness: euthWitness, authorized_by: euthAuthorizedBy, notes: euthNotes,
    };
    await save({ status: "Euthanized", euthanasia: euthRecord }, {
      officerName: euthVet,
      notes: `Reason: ${euthReason}. Drug: ${euthDrug} ${euthDose} ${euthUnit}. Witness: ${euthWitness}.${euthNotes ? " " + euthNotes : ""}`,
    });
    setShowEuthForm(false);
  };

  const handleKennelMove = async () => {
    if (!newKennel) return;
    await save({ kennel: newKennel === "Unassigned" ? undefined : newKennel });
    setShowKennelMove(false);
  };

  const handleUploadDoc = async () => {
    if (!docFile) return;
    setDocUploading(true);
    try {
      const user = getCurrentUser();
      const doc = await uploadAnimalDocument(
        animal.id, animal.name || "", docFile, docCategory, docNotes,
        user ? `${user.firstName} ${user.lastName}` : "Staff",
      );
      setDocs((prev) => [doc, ...prev]);
      setShowDocUpload(false);
      setDocFile(null); setDocNotes(""); setDocCategory("General");
    } catch (e: unknown) {
      alert(`Upload failed: ${(e as { message?: string })?.message || "Unknown error"}`);
    } finally { setDocUploading(false); }
  };

  const handleDeleteDoc = async (doc: AnimalDocument) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    await deleteAnimalDocument(doc);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const daysInCare = Math.round(Math.abs(Date.now() - new Date(animal.intake_date).getTime()) / 86400000);
  const animalMed = medRecords.filter((m) => m.animal_id === animal.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const attachedPeople = people.filter((p) => false); // Will be loaded via junction table in production
  const flags = animal.behavior_flags || {};

  const printKennelCard = () => {
    const w = window.open("", "_blank", "width=820,height=1060");
    if (!w) return;
    const kennel = animal.kennel || "—";
    const todayStr = new Date().toISOString().split("T")[0];
    const activeFlags = BEHAVIOR_FLAGS.filter((f) => (animal.behavior_flags || {})[f.id as string]);
    const overdue = animalMed.filter((m) => m.next_due && m.next_due < todayStr);
    const upcoming = animalMed.filter((m) => m.next_due && m.next_due >= todayStr);
    const completed = animalMed.filter((m) => !m.next_due);
    const daysInCare = animal.intake_date ? Math.floor((Date.now() - new Date(animal.intake_date).getTime()) / 86400000) : 0;
    const age = animal.dob ? calcAge(animal.dob) : (animal.age || "—");
    const speciesIcon = animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾";
    const fld = (label: string, value: string) =>
      `<div style="margin-bottom:7px;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">${label}</div><div style="font-size:12px;font-weight:600;color:#0f172a;margin-top:1px;">${value || "—"}</div></div>`;
    const medRow = (m: MedicalRecord) =>
      `<tr><td style="padding:3px 6px;border:1px solid #e2e8f0;font-size:10px;">${m.type}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;font-size:10px;">${m.description}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;font-size:10px;">${m.next_due || m.date || "—"}</td><td style="padding:3px 6px;border:1px solid #e2e8f0;font-size:10px;">${m.vet || "—"}</td></tr>`;
    const statusColor = ({ Available: "#15803d", "Medical Hold": "#b45309", Quarantine: "#dc2626" } as Record<string, string>)[animal.status] || "#475569";
    w.document.write(`<html><head><title>Kennel Card — ${animal.name}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;font-family:Arial,Helvetica,sans-serif;}@media print{@page{size:letter;margin:0}}</style>
    </head><body>
    <div style="width:7.5in;padding:0.2in;">
      <div style="background:#0f2942;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="font-size:15px;font-weight:800;">MORGAN COUNTY ANIMAL SERVICES</div><div style="font-size:10px;color:#93c5fd;margin-top:2px;">ShelterTrace · Shelter Data Systems</div></div>
        <div style="background:#1a8a8a;padding:6px 18px;border-radius:5px;text-align:center;"><div style="font-size:9px;color:#99f6e4;font-weight:700;text-transform:uppercase;">Kennel</div><div style="font-size:24px;font-weight:900;">${kennel}</div></div>
      </div>
      ${animal.is_dangerous ? `<div style="background:#fee2e2;border:2px solid #dc2626;padding:5px 10px;font-size:11px;font-weight:700;color:#dc2626;">🚨 DANGEROUS ANIMAL — HANDLE WITH EXTREME CAUTION</div>` : ""}
      ${animal.is_cruelty_case ? `<div style="background:#fef3c7;border:2px solid #f59e0b;padding:5px 10px;font-size:11px;font-weight:700;color:#b45309;">⚠️ CRUELTY CASE — EVIDENCE HOLD — DO NOT RELEASE WITHOUT AUTHORIZATION</div>` : ""}
      <div style="border:2px solid #0f2942;border-top:none;border-radius:0 0 6px 6px;padding:14px;margin-bottom:10px;">
        <div style="display:flex;gap:16px;align-items:flex-start;">
          <div style="flex-shrink:0;width:200px;">
            ${animal.photo_url ? `<img src="${animal.photo_url}" style="width:200px;height:200px;object-fit:cover;border-radius:6px;border:2px solid #e2e8f0;display:block;" />` : `<div style="width:200px;height:200px;border-radius:6px;border:2px dashed #cbd5e1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:72px;">${speciesIcon}</div>`}
            <div style="margin-top:8px;text-align:center;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
              <div style="font-size:20px;font-weight:800;color:#0f2942;">${animal.name}</div>
              <div style="font-family:monospace;font-size:11px;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:3px;">${animal.id}</div>
            </div>
            <div style="margin-top:8px;padding:7px;background:#f0f9ff;border:1px solid ${statusColor}40;border-radius:5px;text-align:center;">
              <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase;">Status</div>
              <div style="font-size:14px;font-weight:800;color:${statusColor};">${animal.status}${animal.sub_status ? ` · ${animal.sub_status}` : ""}</div>
              <div style="font-size:10px;color:#64748b;margin-top:3px;">${daysInCare} days in care</div>
            </div>
            ${animal.microchip ? `<div style="margin-top:6px;padding:4px 6px;background:#eff6ff;border-radius:4px;font-size:10px;color:#1d4ed8;text-align:center;">🔬 Chip: <strong>${animal.microchip}</strong></div>` : ""}
            ${animal.rabies_tag ? `<div style="margin-top:4px;padding:4px 6px;background:#f5f3ff;border-radius:4px;font-size:10px;color:#6d28d9;text-align:center;">💉 Rabies: <strong>${animal.rabies_tag}</strong></div>` : ""}
          </div>
          <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0 20px;">
            ${fld("Species", animal.species || "")}${fld("Breed", animal.breed || "")}
            ${fld("Sex", animal.sex || "")}${fld("Age", age)}
            ${fld("Weight", animal.weight || "")}${fld("Size", animal.size || "")}
            ${fld("Primary Color", animal.color || "")}${fld("Secondary Color", animal.secondary_color || "")}
            ${fld("Coat Type", animal.coat_type || "")}${fld("Fixed", animal.fixed ? "Yes" : "No")}
            ${fld("Intake Date", animal.intake_date || "")}${fld("Intake Type", animal.intake_type || "")}
            ${animal.markings ? `<div style="grid-column:1/-1;margin-bottom:7px;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;">Markings</div><div style="font-size:11px;color:#0f172a;margin-top:2px;font-style:italic;">${animal.markings}</div></div>` : ""}
            ${activeFlags.length > 0 ? `<div style="grid-column:1/-1;"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Behavior Flags</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${activeFlags.map((f) => `<span style="padding:3px 8px;border-radius:12px;font-size:10px;font-weight:700;background:${f.color}18;color:${f.color};border:1px solid ${f.color}50;">${f.icon} ${f.label}</span>`).join("")}</div></div>` : ""}
          </div>
        </div>
      </div>
      <div style="border:1.5px solid #e2e8f0;border-radius:6px;overflow:hidden;">
        <div style="background:#1e3a5f;color:#fff;padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Medical Summary · ${animalMed.length} record${animalMed.length !== 1 ? "s" : ""} on file</div>
        <div style="padding:10px 12px;">
          ${animalMed.length === 0 ? `<div style="color:#94a3b8;font-style:italic;font-size:11px;">No medical records on file</div>` : `
          ${overdue.length > 0 ? `<div style="font-size:10px;font-weight:800;color:#dc2626;margin-bottom:4px;">⚠ Overdue (${overdue.length})</div><table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr style="background:#fee2e2;"><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #fca5a5;color:#991b1b;">Type</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #fca5a5;color:#991b1b;">Description</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #fca5a5;color:#991b1b;">Due</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #fca5a5;color:#991b1b;">Vet</th></tr></thead><tbody>${overdue.map(medRow).join("")}</tbody></table>` : ""}
          ${upcoming.length > 0 ? `<div style="font-size:10px;font-weight:800;color:#0369a1;margin-bottom:4px;">Upcoming (${upcoming.length})</div><table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><thead><tr style="background:#e0f2fe;"><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #bae6fd;color:#0369a1;">Type</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #bae6fd;color:#0369a1;">Description</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #bae6fd;color:#0369a1;">Due</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #bae6fd;color:#0369a1;">Vet</th></tr></thead><tbody>${upcoming.map(medRow).join("")}</tbody></table>` : ""}
          ${completed.length > 0 ? `<div style="font-size:10px;font-weight:800;color:#15803d;margin-bottom:4px;">Completed (${completed.length})</div><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#dcfce7;"><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #86efac;color:#15803d;">Type</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #86efac;color:#15803d;">Description</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #86efac;color:#15803d;">Date</th><th style="padding:3px 6px;text-align:left;font-size:10px;border:1px solid #86efac;color:#15803d;">Vet</th></tr></thead><tbody>${completed.map(medRow).join("")}</tbody></table>` : ""}`}
        </div>
      </div>
      <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;"><span>Printed ${new Date().toLocaleString()}</span><span>ShelterTrace v1.0 · Shelter Data Systems · © ${new Date().getFullYear()}</span></div>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="animal-detail">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push("/animals")}>
          ← Back to Animals
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>{animal.name}</h1>
            <StatusBadge status={animal.status} />
            {animal.sub_status && <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{animal.sub_status}</span>}
            {animal.is_dangerous && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🚨 DANGEROUS</span>}
            {animal.is_cruelty_case && <span style={{ background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⚠️ CRUELTY CASE</span>}
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            {animal.id} · {animal.species} · {animal.breed} · {daysInCare} days in care
          </div>
          {animal.status === "Transferred" && animal.transferred_to && (
            <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 7, padding: "5px 12px", fontSize: 12 }}>
              🚌 Transferred to <strong>{animal.transferred_to}</strong>
              {animal.transfer_date && <span style={{ color: "#7c3aed" }}>on {animal.transfer_date}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={printKennelCard}>🖨 Kennel Card</button>
          {saving && <span style={{ color: "var(--teal)", fontSize: 12, alignSelf: "center" }}>Saving…</span>}
        </div>
      </div>

      {/* Behavior Flags */}
      {Object.keys(flags).filter((k) => flags[k]).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {BEHAVIOR_FLAGS.filter((f) => flags[f.id]).map((f) => (
            <span key={f.id} className="flag-chip" style={{ borderColor: f.color, background: `${f.color}20`, color: f.color }}>
              {f.icon} {f.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, alignItems: "start" }}>
        {/* Left column — photo + quick info */}
        <div>
          <div style={{ marginBottom: 12 }}>
            {animal.photo_url ? (
              <img src={animal.photo_url} alt={animal.name} style={{ width: "100%", aspectRatio: "1/1", borderRadius: 12, objectFit: "cover", border: "2px solid var(--border)" }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: 12, background: "#f1f5f9", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
                {animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾"}
              </div>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <label style={{ flex: 1 }}>
                <span className="btn btn-secondary btn-sm" style={{ cursor: "pointer", display: "flex", justifyContent: "center" }}>
                  {photoUploading ? "Uploading…" : "📷 Change"}
                </span>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
              </label>
              {animal.photo_url && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCropModal(true)}
                  title="Crop the current photo"
                  style={{ flex: 1 }}
                >
                  ✂️ Crop
                </button>
              )}
            </div>
          </div>

          {/* Quick stats */}
          {[
            ["Kennel", animal.kennel || "Unassigned"],
            ["Intake Date", formatDate(animal.intake_date)],
            ["Intake Type", animal.intake_type || "—"],
            ["Weight", animal.weight || "—"],
            ["Fixed", animal.fixed ? "Yes" : "No"],
            ["Microchip", animal.microchip || "None"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>{l}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <select
              className="form-select"
              value={animal.status}
              onChange={(e) => save({ status: e.target.value, sub_status: undefined })}
              style={{ fontSize: 12 }}
            >
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            {SUB_STATUSES[animal.status] && (
              <select
                className="form-select"
                value={animal.sub_status || ""}
                onChange={(e) => save({ sub_status: e.target.value || undefined })}
                style={{ fontSize: 12 }}
              >
                <option value="">— Sub-status —</option>
                {SUB_STATUSES[animal.status].map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setShowKennelMove(true)}>📍 Move Kennel</button>
            {!["Adopted", "Euthanized", "Foster", "Transferred", "Redeemed"].includes(animal.status) && (
              <button className="btn btn-sm" style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a" }} onClick={() => setShowAdoptionModal(true)}>🏡 Process Adoption</button>
            )}
            {!["Adopted", "Euthanized", "Foster", "Transferred", "Redeemed"].includes(animal.status) && (
              <button className="btn btn-sm" style={{ background: "#0891b2", color: "#fff", borderColor: "#0891b2" }} onClick={() => setShowRedemptionWizard(true)}>🔑 Redeem to Owner</button>
            )}
            {animal.status === "Adopted" && (
              <button className="btn btn-sm" style={{ background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" }} onClick={() => setShowReturnModal(true)}>↩ Return Animal</button>
            )}
            {animal.status !== "Euthanized" && (
              <button className="btn btn-danger btn-sm" onClick={() => setShowEuthForm(true)}>☠ Euthanize</button>
            )}
          </div>
        </div>

        {/* Right column — collapsible sections */}
        <div>
          {/* Animal Info */}
          <CollapsibleSection title="Animal Information">
            <div className="grid-3">
              <F label="Name">
                <input className="form-input" defaultValue={animal.name} onBlur={(e) => save({ name: e.target.value })} />
              </F>
              <F label="Species">
                <input className="form-input" value={animal.species} readOnly />
              </F>
              <F label="Breed">
                <select className="form-select" value={animal.breed || ""} onChange={(e) => save({ breed: e.target.value })}>
                  {(animal.species === "Cat" ? ALL_BREEDS_CAT : ALL_BREEDS_DOG).map((b) => <option key={b} value={b}>{b || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Sex">
                <select className="form-select" value={animal.sex || ""} onChange={(e) => save({ sex: e.target.value })}>
                  {["Unknown", "Male", "Female"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Date of Birth">
                <input className="form-input" type="date" value={animal.dob || ""} onChange={(e) => save({ dob: e.target.value })} />
                {animal.dob && <div style={{ fontSize: 10, color: "var(--teal)", marginTop: 3, fontWeight: 700 }}>Age: {calcAge(animal.dob)}</div>}
              </F>
              <F label="Age (read-only)">
                <input className="form-input" value={animal.dob ? calcAge(animal.dob) : animal.age || ""} readOnly />
              </F>
              <F label="Weight">
                <input className="form-input" defaultValue={animal.weight || ""} onBlur={(e) => save({ weight: e.target.value })} />
              </F>
              <F label="Size">
                <select className="form-select" value={animal.size || ""} onChange={(e) => save({ size: e.target.value })}>
                  {SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Fixed">
                <select className="form-select" value={animal.fixed ? "Yes" : "No"} onChange={(e) => save({ fixed: e.target.value === "Yes" })}>
                  {["Yes", "No"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </F>
              <F label="Primary Color">
                <select className="form-select" value={animal.color || ""} onChange={(e) => save({ color: e.target.value })}>
                  {ALL_COLORS.map((c) => <option key={c} value={c}>{c || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Secondary Color">
                <select className="form-select" value={animal.secondary_color || ""} onChange={(e) => save({ secondary_color: e.target.value })}>
                  {ALL_COLORS.map((c) => <option key={c} value={c}>{c || "— None —"}</option>)}
                </select>
              </F>
              <F label="Coat Type">
                <select className="form-select" value={animal.coat_type || ""} onChange={(e) => save({ coat_type: e.target.value })}>
                  {COAT_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Ear Type">
                <select className="form-select" value={animal.ear_type || ""} onChange={(e) => save({ ear_type: e.target.value })}>
                  {EAR_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Eye Color">
                <select className="form-select" value={animal.eye_color || ""} onChange={(e) => save({ eye_color: e.target.value })}>
                  {EYE_COLORS.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
            </div>
            <F label="Markings / Description">
              <textarea className="form-textarea" defaultValue={animal.markings || ""} onBlur={(e) => save({ markings: e.target.value })} rows={2} />
            </F>
          </CollapsibleSection>

          {/* Intake Info */}
          <CollapsibleSection title="Intake Information">
            <div className="grid-3">
              <F label="Intake Type">
                <input className="form-input" value={animal.intake_type || ""} readOnly />
              </F>
              <F label="Intake Date">
                <input className="form-input" type="date" value={animal.intake_date || ""} onChange={(e) => save({ intake_date: e.target.value })} />
              </F>
              <F label="Circumstance">
                <select className="form-select" value={animal.circumstance || ""} onChange={(e) => save({ circumstance: e.target.value })}>
                  {CIRCUMSTANCE_TYPES.map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="ACO Record #">
                <input className="form-input" defaultValue={animal.aco_record || ""} onBlur={(e) => save({ aco_record: e.target.value })} />
              </F>
              <F label="Case Number">
                <input className="form-input" defaultValue={animal.case_number || ""} onBlur={(e) => save({ case_number: e.target.value })} />
              </F>
              <F label="Intake Condition">
                <select className="form-select" value={animal.intake_condition || ""} onChange={(e) => save({ intake_condition: e.target.value })}>
                  {["", "Good", "Fair", "Poor", "Critical", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Intake Behavior">
                <select className="form-select" value={animal.intake_behavior || ""} onChange={(e) => save({ intake_behavior: e.target.value })}>
                  {["", "Friendly", "Fearful", "Aggressive", "Anxious", "Calm", "Unknown"].map((o) => <option key={o} value={o}>{o || "— Select —"}</option>)}
                </select>
              </F>
              <F label="Found Address">
                <input className="form-input" defaultValue={animal.found_address || ""} onBlur={(e) => save({ found_address: e.target.value })} />
              </F>
              <F label="Found City">
                <input className="form-input" defaultValue={animal.found_city || ""} onBlur={(e) => save({ found_city: e.target.value })} />
              </F>
            </div>
            {animal.injuries && (
              <F label="Injuries / Medical Notes at Intake">
                <textarea className="form-textarea" defaultValue={animal.injuries} onBlur={(e) => save({ injuries: e.target.value })} rows={2} />
              </F>
            )}
          </CollapsibleSection>

          {/* Identification */}
          <CollapsibleSection title="Identification">
            <div className="grid-3">
              <F label="Microchip #">
                <input className="form-input" defaultValue={animal.microchip || ""} onBlur={(e) => save({ microchip: e.target.value })} placeholder="Scan or type" />
              </F>
              <F label="Microchip Brand">
                <input className="form-input" defaultValue={animal.microchip_brand || ""} onBlur={(e) => save({ microchip_brand: e.target.value })} />
              </F>
              <F label="Microchip Implant Date">
                <input className="form-input" type="date" value={animal.microchip_date || ""} onChange={(e) => save({ microchip_date: e.target.value })} />
              </F>
              <F label="Rabies Tag #">
                <input className="form-input" defaultValue={animal.rabies_tag || ""} onBlur={(e) => save({ rabies_tag: e.target.value })} />
              </F>
              <F label="Rabies Expiry">
                <input className="form-input" type="date" value={animal.rabies_expiry || ""} onChange={(e) => save({ rabies_expiry: e.target.value })} />
              </F>
              <F label="Shelter Tag #">
                <input className="form-input" defaultValue={animal.shelter_tag || ""} onBlur={(e) => save({ shelter_tag: e.target.value })} />
              </F>
              <F label="Barcode">
                <input className="form-input" defaultValue={animal.bar_code || ""} onBlur={(e) => save({ bar_code: e.target.value })} />
              </F>
            </div>
          </CollapsibleSection>

          {/* Behavior Flags */}
          <CollapsibleSection title="Behavior Flags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BEHAVIOR_FLAGS.map((flag) => (
                <button
                  key={flag.id}
                  onClick={() => toggleFlag(flag.id)}
                  className="flag-chip"
                  style={{
                    borderColor: flags[flag.id] ? flag.color : "#e2e8f0",
                    background: flags[flag.id] ? `${flag.color}20` : "#fff",
                    color: flags[flag.id] ? flag.color : "var(--text-muted)",
                  }}
                >
                  {flag.icon} {flag.label}
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Medical Records */}
          <CollapsibleSection title={`Medical Records (${animalMed.length})`} color="#0ea5e9">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddMed(!showAddMed)}>+ Add Medical Record</button>
            </div>
            {showAddMed && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                {medSaved && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13, color: "#15803d", fontWeight: 600 }}>
                    ✓ Medical record added
                  </div>
                )}
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={medType} onChange={(e) => { setMedType(e.target.value); setMedDesc(""); }}>
                      {MEDICAL_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <select className="form-select" value={medDesc} onChange={(e) => setMedDesc(e.target.value)}>
                      <option value="">— Select —</option>
                      {(MEDICAL_DESC_MAP[medType] || []).map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input className="form-input" type="date" value={medDate} onChange={(e) => setMedDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vet / Staff</label>
                    <StaffSelect value={medVet} onChange={setMedVet} placeholder="— None —" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Due</label>
                    <input className="form-input" type="date" value={medNextDue} onChange={(e) => setMedNextDue(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={medStatus} onChange={(e) => setMedStatus(e.target.value)}>
                      <option value="">— None —</option>
                      {["Pending", "Completed", "Overdue"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #bae6fd", margin: "8px 0 10px", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#0369a1", marginBottom: 8, letterSpacing: 0.5 }}>Additional Details</div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Lot Number</label>
                      <input className="form-input" value={medLotNumber} onChange={(e) => setMedLotNumber(e.target.value)} placeholder="e.g. AB12345" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Manufacturer</label>
                      <input className="form-input" value={medManufacturer} onChange={(e) => setMedManufacturer(e.target.value)} placeholder="e.g. Merck" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Route</label>
                      <select className="form-select" value={medRoute} onChange={(e) => setMedRoute(e.target.value)}>
                        <option value="">— None —</option>
                        {["Oral","Subcutaneous","Intramuscular","Intranasal","Topical","Intravenous","Other"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dosage</label>
                      <input className="form-input" value={medDosage} onChange={(e) => setMedDosage(e.target.value)} placeholder="e.g. 1 ml or 2 tabs" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Result</label>
                      <select className="form-select" value={medResult} onChange={(e) => setMedResult(e.target.value)}>
                        <option value="">— None —</option>
                        {["Positive","Negative","Pending","Inconclusive"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost ($)</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={medCost} onChange={(e) => setMedCost(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" rows={2} value={medNotes} onChange={(e) => setMedNotes(e.target.value)} placeholder="Any additional notes…" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAddMedical} disabled={medSaving || medSaved}>
                    {medSaving ? "Saving…" : medSaved ? "✓ Saved" : "Save Record"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddMed(false)}>Cancel</button>
                </div>
              </div>
            )}
            {animalMed.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No medical records</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Type</th><th>Description</th><th>Date</th><th>Vet / Staff</th><th>Next Due</th><th></th></tr></thead>
                <tbody>
                  {animalMed.map((m) => (
                    <tr key={m.id}>
                      <td><span className="badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>{m.type}</span></td>
                      <td style={{ fontWeight: 600 }}>
                        {m.description}
                        {m.updated_by
                          ? <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>Edited by {m.updated_by}{m.updated_at ? ` · ${formatDate(m.updated_at.slice(0, 10))}` : ""}</div>
                          : m.updated_at
                            ? <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>Updated {formatDate(m.updated_at.slice(0, 10))}</div>
                            : null
                        }
                      </td>
                      <td style={{ fontSize: 12 }}>{formatDate(m.date)}</td>
                      <td style={{ fontSize: 12 }}>{m.vet || "—"}</td>
                      <td style={{ fontSize: 12, color: m.next_due && new Date(m.next_due) < new Date() ? "#dc2626" : "var(--text-secondary)" }}>
                        {m.next_due ? formatDate(m.next_due) : "—"}
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 13, padding: "3px 8px" }}
                          onClick={() => setEditMedRecord(m)}
                          title="Edit record"
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* Notes */}
          <CollapsibleSection title={`Notes (${notes.length})`}>
            <div style={{ marginBottom: 12 }}>
              <textarea
                className="form-textarea"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note…"
                rows={2}
                style={{ marginBottom: 6 }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="form-select" value={noteType} onChange={(e) => setNoteType(e.target.value)} style={{ maxWidth: 160, fontSize: 12 }}>
                  {["General", "Medical", "Behavioral", "Intake", "Adoption", "Administrative"].map((t) => <option key={t}>{t}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleAddNote}>Add Note</button>
              </div>
            </div>
            {notes.map((n) => (
              <div key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>{n.type}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{n.date} {n.time}</span>
                </div>
                <div style={{ fontSize: 13 }}>{n.text}</div>
              </div>
            ))}
          </CollapsibleSection>

          {/* Documents */}
          <CollapsibleSection title={`Documents (${docs.length})`} color="#7c3aed">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowDocUpload(!showDocUpload)}>📎 Attach Document</button>
            </div>
            {showDocUpload && (
              <div style={{ background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div className="grid-2">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">File *</label>
                    <input
                      type="file"
                      className="form-input"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                      {["General","Medical","Legal","Intake","Adoption","Vaccination","Photo","Other"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={docNotes} onChange={(e) => setDocNotes(e.target.value)} placeholder="Optional notes…" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleUploadDoc} disabled={docUploading || !docFile}>
                    {docUploading ? "Uploading…" : "Upload"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowDocUpload(false); setDocFile(null); }}>Cancel</button>
                </div>
              </div>
            )}
            {docs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>No documents attached</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>File</th><th>Category</th><th>Notes</th><th>Uploaded</th><th></th></tr></thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)", fontWeight: 600, fontSize: 13 }}>
                          📄 {d.file_name}
                        </a>
                        {d.file_size && <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>({Math.round(d.file_size / 1024)}KB)</span>}
                      </td>
                      <td><span className="badge" style={{ background: "#ede9fe", color: "#7c3aed" }}>{d.category || "General"}</span></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.notes || "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", fontSize: 11 }} onClick={() => handleDeleteDoc(d)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* Euthanasia record */}
          {animal.euthanasia && (
            <CollapsibleSection title="Euthanasia Record" color="#dc2626">
              <div className="grid-2" style={{ fontSize: 13 }}>
                <div><span style={{ color: "var(--text-secondary)" }}>Date:</span> {(animal.euthanasia as any).date}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Drug:</span> {(animal.euthanasia as any).drug}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Reason:</span> {(animal.euthanasia as any).reason}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Dosage:</span> {(animal.euthanasia as any).dosage}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Performed By:</span> {(animal.euthanasia as any).performed_by}</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Witness:</span> {(animal.euthanasia as any).witness}</div>
              </div>
            </CollapsibleSection>
          )}

          {/* Forms section */}
          <CollapsibleSection title={`Forms (${animalForms.length})`} color="#0f766e">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <GenerateFormButton
                size="sm"
                label="Generate Form"
                prefill={{
                  animal_id: animal.id,
                  animal_name: animal.name,
                  animal_species: animal.species,
                  animal_breed: animal.breed,
                  animal_color: animal.color,
                  animal_sex: animal.sex,
                  animal_age: animal.age,
                  animal_fixed: animal.fixed,
                } as FormPreFill}
                onSaved={(form) => setAnimalForms((prev) => [form, ...prev])}
              />
            </div>
            {animalForms.length === 0 ? (
              <div className="empty-state">No forms linked to this animal yet.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Type</th><th>Summary</th><th>Officer</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {animalForms.map((f) => (
                    <tr key={f.id}>
                      <td><span className="badge" style={{ background: "#f0fdfa", color: "#0f766e" }}>{f.form_type.replace(/_/g, " ")}</span></td>
                      <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(f.form_data as Record<string, unknown>).printed_name as string ||
                          [(f.form_data as Record<string, unknown>).adopter_first, (f.form_data as Record<string, unknown>).adopter_last].filter(Boolean).join(" ") ||
                          (f.form_data as Record<string, unknown>).foster_name as string || "—"}
                      </td>
                      <td style={{ fontSize: 12 }}>{f.officer || f.created_by || "—"}</td>
                      <td style={{ fontSize: 12 }}>{f.created_at ? formatDate(f.created_at) : "—"}</td>
                      <td><ReprintFormButton form={f} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* Departure Receipts */}
          <CollapsibleSection title={`Receipts & Departure Records (${departureReceipts.length + adoptionRecords.length})`} color="#7c3aed">
            {departureReceipts.length === 0 && adoptionRecords.length === 0 ? (
              <div className="empty-state">No receipts yet. Receipts are auto-generated when an animal leaves the shelter.</div>
            ) : (
              <>
                {departureReceipts.length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Receipt #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Person</th>
                        <th style={{ textAlign: "right" }}>Fees</th>
                        <th>Officer</th>
                        <th style={{ width: 100 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departureReceipts.map((r) => (
                        <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setViewingReceipt(r)}>
                          <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{r.receipt_number}</td>
                          <td>
                            <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                              {r.departure_type}
                            </span>
                          </td>
                          <td style={{ fontSize: 12 }}>{r.departure_date ? new Date(r.departure_date).toLocaleDateString() : "—"}</td>
                          <td style={{ fontSize: 12 }}>{r.person_name || "—"}</td>
                          <td style={{ fontSize: 12, textAlign: "right", fontFamily: "monospace" }}>
                            {r.total_fees > 0 ? `$${r.total_fees.toFixed(2)}` : "—"}
                          </td>
                          <td style={{ fontSize: 12 }}>{r.officer_name || "—"}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setViewingReceipt(r)}>
                                👁 View
                              </button>
                              <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: "4px 10px", background: "#7c3aed", borderColor: "#7c3aed" }} onClick={() => printDepartureReceipt(r)}>
                                🖨 Print
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {adoptionRecords.length > 0 && (
                  <div style={{ marginTop: departureReceipts.length > 0 ? 16 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", marginBottom: 6 }}>
                      Adoption Records
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Adopter</th>
                          <th>Date</th>
                          <th>Notes</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adoptionRecords.map((a) => {
                          const linked = departureReceipts.find(
                            (r) => r.departure_type === "Adoption" &&
                              r.departure_date &&
                              new Date(r.departure_date).toDateString() === new Date(a.adoption_date).toDateString()
                          );
                          return (
                            <tr key={a.id}>
                              <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                              <td style={{ fontSize: 12 }}>{a.adopter_name}</td>
                              <td style={{ fontSize: 12 }}>{a.adoption_date ? new Date(a.adoption_date).toLocaleDateString() : "—"}</td>
                              <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.notes || "—"}</td>
                              <td onClick={(e) => e.stopPropagation()}>
                                {linked ? (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setViewingReceipt(linked)}>
                                      👁 View
                                    </button>
                                    <button className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: "4px 10px", background: "#7c3aed", borderColor: "#7c3aed" }} onClick={() => printDepartureReceipt(linked)}>
                                      🖨 Print
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No receipt</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection title={`Transfer History (${animalTransfers.length})`} color="#0f2942">
            {animalTransfers.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>No transfer history for this animal.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Receiving Agency</th>
                      <th>Officer</th>
                      <th style={{ width: 130 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {animalTransfers.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{t.transfer_number}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(t.date)}</td>
                        <td style={{ fontSize: 12 }}>{t.rescue_group_name || "—"}</td>
                        <td style={{ fontSize: 12 }}>{t.officer || "—"}</td>
                        <td>
                          {t.agency_info_snapshot ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                const grp = (safeJsonObject(t.agency_info_snapshot) || t.agency_info_snapshot) as unknown as RescueGroup;
                                type SnapAnimal = Animal & { medical_records?: MedicalRecord[] };
                                const raw = safeJsonArray(t.animal_info_snapshot) as unknown as SnapAnimal[];
                                const snapAnimals: Animal[] = raw.map(({ medical_records: _mr, ...a }) => a as Animal);
                                const medMap: Record<string, MedicalRecord[]> = {};
                                raw.forEach((a) => { if (a.id && a.medical_records) medMap[a.id] = a.medical_records; });
                                printTransferReceipt(t, grp, snapAnimals, medMap);
                              }}
                            >
                              🖨 Print Receipt
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>No receipt data</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* ── Public Website Profile ── */}
          <CollapsibleSection title="🌐 Public Website Profile" color="#1a8a8a" defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Toggle */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderRadius: 10,
                background: animal.show_on_website ? "#dcfce7" : "#f1f5f9",
                border: `1px solid ${animal.show_on_website ? "#86efac" : "#e2e8f0"}`,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: animal.show_on_website ? "#166534" : "#374151" }}>
                    {animal.show_on_website ? "✅ Showing on Public Website" : "⬜ Hidden from Public Website"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    {animal.show_on_website
                      ? "Visible at /available-animals — toggle off to hide"
                      : "Toggle on to list this animal for adoption on the public page"}
                  </div>
                </div>
                <button
                  onClick={() => save({ show_on_website: !animal.show_on_website })}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", flexShrink: 0,
                    background: animal.show_on_website ? "#16a34a" : "#cbd5e1",
                    position: "relative", transition: "background 0.2s",
                  }}
                  aria-label="Toggle public website visibility"
                >
                  <span style={{
                    position: "absolute", top: 3, left: animal.show_on_website ? 27 : 3,
                    width: 22, height: 22, borderRadius: 11, background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                    display: "block",
                  }} />
                </button>
              </div>

              {animal.show_on_website && (
                <div style={{ padding: "8px 12px", background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
                  ⚡ Automatically hidden when status changes to Adopted, Transferred, Euthanized, or Redeemed
                </div>
              )}

              {/* Preview link */}
              <div>
                <a
                  href={`/available-animals/${animal.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#0f2942", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
                >
                  👁 Preview Public Page
                </a>
                <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-secondary)" }}>Opens in new tab</span>
              </div>

              {/* Public Bio */}
              <div className="form-group">
                <label className="form-label">Public Bio / Description</label>
                <textarea
                  className="form-input"
                  rows={4}
                  defaultValue={animal.public_bio || ""}
                  placeholder={`Write a friendly description for potential adopters of ${animal.name}…`}
                  onBlur={(e) => { if (e.target.value !== (animal.public_bio || "")) save({ public_bio: e.target.value || undefined }); }}
                  style={{ resize: "vertical", fontFamily: "inherit" }}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Shown on the public adoption page as &ldquo;About {animal.name}&rdquo;
                </div>
              </div>

              {/* Public Photos */}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
                  Public Photos
                  {safeArray(animal.photo_urls).length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>
                      {safeArray(animal.photo_urls).length} photo{safeArray(animal.photo_urls).length !== 1 ? "s" : ""}
                      {animal.featured_photo_url && " · ⭐ featured set"}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                  {safeArray(animal.photo_urls).map((url, i) => {
                    const isFeatured = animal.featured_photo_url === url;
                    return (
                      <div key={i} style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                        <img
                          src={url}
                          alt=""
                          style={{
                            width: "100%", height: "100%", objectFit: "cover", borderRadius: 8,
                            border: isFeatured ? "3px solid #1a8a8a" : "2px solid var(--border)",
                            display: "block",
                          }}
                        />
                        {isFeatured && (
                          <span style={{ position: "absolute", bottom: 4, left: 4, background: "#1a8a8a", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 4, letterSpacing: "0.04em" }}>
                            FEATURED
                          </span>
                        )}
                        <button
                          title="Set as featured card photo"
                          onClick={() => save({ featured_photo_url: url })}
                          style={{ position: "absolute", top: 3, left: 3, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 4, color: "#fff", fontSize: 11, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          ⭐
                        </button>
                        <button
                          title="Remove photo"
                          onClick={() => {
                            const existing = safeArray(animal.photo_urls);
                            const next = existing.filter((u) => u !== url);
                            const updates: Partial<Animal> = { photo_urls: next };
                            if (animal.featured_photo_url === url) updates.featured_photo_url = next[0] ?? undefined;
                            save(updates);
                          }}
                          style={{ position: "absolute", top: 3, right: 3, background: "rgba(220,38,38,0.8)", border: "none", borderRadius: 4, color: "#fff", fontSize: 11, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}

                  {/* Upload button */}
                  <label style={{
                    width: 90, height: 90, border: "2px dashed var(--border)",
                    borderRadius: 8, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    cursor: pubPhotoUploading ? "wait" : "pointer",
                    background: "var(--bg-alt)", color: "var(--text-secondary)",
                    fontSize: 11, gap: 4, flexShrink: 0,
                    opacity: pubPhotoUploading ? 0.6 : 1,
                    transition: "opacity 0.15s",
                  }}>
                    <span style={{ fontSize: 22 }}>{pubPhotoUploading ? "⏳" : "📷"}</span>
                    <span style={{ fontWeight: 600 }}>{pubPhotoUploading ? "Uploading…" : "Add Photo"}</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePublicPhotoUpload} disabled={pubPhotoUploading} />
                  </label>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Click ⭐ to set as the featured card thumbnail. Multiple photos appear as a gallery on the public detail page.
                </div>
              </div>

            </div>
          </CollapsibleSection>

        </div>
      </div>

      {/* Kennel Move Modal */}
      {showKennelMove && (
        <div className="modal-overlay" onClick={() => setShowKennelMove(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">Move to Kennel</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowKennelMove(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Current: <strong>{animal.kennel || "Unassigned"}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Destination Kennel</label>
                <select className="form-select" value={newKennel} onChange={(e) => setNewKennel(e.target.value)}>
                  <option value="">— Select destination —</option>
                  <option value="Unassigned">Unassigned</option>
                  {kennelLabels.length === 0
                    ? <option value="" disabled>No kennels configured — see Kennel page</option>
                    : kennelLabels.map((k) => <option key={k}>{k}</option>)
                  }
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowKennelMove(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleKennelMove} disabled={!newKennel}>Move</button>
            </div>
          </div>
        </div>
      )}

      {/* Crop Photo Modal */}
      {showCropModal && animal.photo_url && (
        <CropPhotoModal
          photoUrl={animal.photo_url}
          animalId={animal.id}
          animalName={animal.name}
          onSave={(newUrl) => {
            save({ photo_url: newUrl });
            setShowCropModal(false);
          }}
          onClose={() => setShowCropModal(false)}
        />
      )}

      {/* Medical Edit Modal */}
      {editMedRecord && (
        <MedicalEditModal
          record={editMedRecord}
          onSave={(updated) => {
            setMedRecords((prev) => prev.map((m) => m.id === updated.id ? updated : m));
            setEditMedRecord(null);
          }}
          onDelete={(id) => {
            setMedRecords((prev) => prev.filter((m) => m.id !== id));
            setEditMedRecord(null);
          }}
          onClose={() => setEditMedRecord(null)}
        />
      )}

      {/* Return Animal Modal */}
      {showReturnModal && (
        <ReturnAnimalModal
          animal={animal}
          onSuccess={(updated) => { setAnimal(updated); onUpdate(updated); setShowReturnModal(false); }}
          onClose={() => setShowReturnModal(false)}
        />
      )}

      {showAdoptionModal && (
        <AdoptionFromDetailModal
          animal={animal}
          people={people}
          onSuccess={(updated: Animal, _info: AdoptionReceiptInfo, receipt: DepartureReceipt) => {
            setAnimal(updated);
            onUpdate(updated);
            setShowAdoptionModal(false);
            setDepartureReceipts((prev) => [receipt, ...prev]);
            // Receipt window already opened by modal — show View popup as fallback
            setPendingReceipt(receipt);
          }}
          onClose={() => setShowAdoptionModal(false)}
        />
      )}

      {showRedemptionWizard && (
        <RedemptionWizard
          animal={animal}
          onComplete={(updated: Animal, info: RedemptionReceiptInfo) => {
            setAnimal(updated);
            onUpdate(updated);
            setShowRedemptionWizard(false);
            const cu = getCurrentUser();
            const officerName = cu ? `${cu.firstName || cu.first_name || ""} ${cu.lastName || cu.last_name || ""}`.trim() || cu.username : "";
            const payload = buildDepartureReceiptPayload(updated, {
              departureType: "Owner Redemption",
              person: info.ownerPerson,
              personName: info.ownerName,
              fees: info.fees,
              totalFees: info.totalFees,
              paymentMethod: info.paymentMethod,
              conditions: info.conditions,
              officerName,
              officerId: cu?.id,
            });
            createDepartureReceipt(payload).then((r) => {
              setDepartureReceipts((prev) => [r, ...prev]);
              setPendingReceipt(r);
            }).catch(console.error);
          }}
          onClose={() => setShowRedemptionWizard(false)}
        />
      )}

      {/* Receipt Preview Modal */}
      {viewingReceipt && (
        <ReceiptPreviewModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
          onPrint={() => printDepartureReceipt(viewingReceipt)}
        />
      )}

      {/* Departure Receipt — "Print now?" popup */}
      {pendingReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPendingReceipt(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 0, width: 420, boxShadow: "0 12px 40px rgba(0,0,0,.25)", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#7c3aed", color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🧾</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Departure Receipt Generated</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{pendingReceipt.receipt_number} · {pendingReceipt.departure_type}</div>
              </div>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px" }}>
                A departure receipt has been automatically created for <strong>{animal.name}</strong>. Would you like to print it now?
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPendingReceipt(null)}>Close</button>
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { setViewingReceipt(pendingReceipt); setPendingReceipt(null); }}>
                  👁 View Receipt
                </button>
                <button className="btn btn-primary btn-sm" style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                  onClick={() => { printDepartureReceipt(pendingReceipt); setPendingReceipt(null); }}>
                  🖨 Print Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Euthanasia Form Modal */}
      {showEuthForm && (
        <div className="modal-overlay" onClick={() => setShowEuthForm(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderLeft: "4px solid #dc2626" }}>
              <span className="modal-title" style={{ color: "#dc2626" }}>☠ Euthanasia Form</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEuthForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="Reason"><select className="form-select" value={euthReason} onChange={(e) => setEuthReason(e.target.value)}>{EUTH_REASONS.map((r) => <option key={r}>{r}</option>)}</select></F>
                <F label="Drug"><select className="form-select" value={euthDrug} onChange={(e) => setEuthDrug(e.target.value)}>{EUTH_DRUGS.map((d) => <option key={d}>{d}</option>)}</select></F>
                <F label="Dosage"><input className="form-input" value={euthDose} onChange={(e) => setEuthDose(e.target.value)} placeholder="Amount" /></F>
                <F label="Unit"><select className="form-select" value={euthUnit} onChange={(e) => setEuthUnit(e.target.value)}>{["ml","cc","mg"].map((u) => <option key={u}>{u}</option>)}</select></F>
                <F label="Performed By (Vet)"><StaffSelect value={euthVet} onChange={setEuthVet} placeholder="— Select —" /></F>
                <F label="Date"><input className="form-input" type="date" value={euthDate} onChange={(e) => setEuthDate(e.target.value)} /></F>
                <F label="Authorized By"><input className="form-input" value={euthAuthorizedBy} onChange={(e) => setEuthAuthorizedBy(e.target.value)} /></F>
                <F label="Witness"><input className="form-input" value={euthWitness} onChange={(e) => setEuthWitness(e.target.value)} /></F>
              </div>
              <F label="Notes"><textarea className="form-textarea" value={euthNotes} onChange={(e) => setEuthNotes(e.target.value)} rows={2} /></F>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 12, padding: "10px 14px", background: "#fee2e2", borderRadius: 8, border: "1px solid #fca5a5" }}>
                <input type="checkbox" checked={euthApproved} onChange={(e) => setEuthApproved(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>I confirm this euthanasia is authorized and all information is accurate</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEuthForm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleEuthanize} disabled={!euthApproved || !euthVet}>Confirm Euthanasia</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
