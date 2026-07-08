"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import {
  fetchClinicAnimals, updateClinicAnimal, fetchClinicMedical, createClinicMedical,
  fetchClinicProcedures, fetchClinicAppointments, fetchClinicSettings,
} from "@/lib/clinicData";
import { fetchShelterAnimal, fetchShelterAnimalMedical, addShelterAnimalMedical } from "@/lib/clinicShelterLink";
import type { ClinicAnimal, ClinicMedicalRecord, ClinicProcedure, ClinicAppointment, ClinicSettings } from "@/lib/clinicTypes";
import type { Animal, MedicalRecord } from "@/lib/types";
import { printClinicAnimalRecord, type PrintOptions } from "@/lib/clinicAnimalPrint";
import { displayAge, today } from "@/lib/utils";
import { getCurrentUserName } from "@/lib/auth";
import DateInput from "@/components/ui/DateInput";
import MedicationSearch from "@/components/ui/MedicationSearch";

const RECORD_TYPES = ["Rabies Vaccine","DHPP Vaccine","Bordetella Vaccine","Feline FVRCP Vaccine","FeLV Vaccine","Heartworm Test","FIV/FeLV Combo Test","Parvo Test","Medication","Other Vaccine","Other Test","Other Treatment"];
const TEST_TYPES = new Set(["Heartworm Test","FIV/FeLV Combo Test","Parvo Test","Other Test"]);
const RESULT_COLORS: Record<string, { bg: string; color: string }> = {
  Negative: { bg: "#dcfce7", color: "#15803d" }, Positive: { bg: "#fee2e2", color: "#dc2626" },
  Inconclusive: { bg: "#fef3c7", color: "#b45309" }, Pending: { bg: "#f1f5f9", color: "#64748b" },
};

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

export default function ClinicAnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { clients } = useClinic();

  const isShelterAnimal = id.startsWith("shelter_");
  const realId = isShelterAnimal ? id.slice("shelter_".length) : id;

  const [animal, setAnimal] = useState<ClinicAnimal | Animal | null>(null);
  const [shelterMed, setShelterMed] = useState<MedicalRecord[]>([]);
  const [clinicMed, setClinicMed] = useState<ClinicMedicalRecord[]>([]);
  const [procedures, setProcedures] = useState<ClinicProcedure[]>([]);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview"|"medical"|"procedures"|"appointments">("overview");
  const [showPrint, setShowPrint] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [medSaving, setMedSaving] = useState(false);
  const [medForm, setMedForm] = useState<Partial<ClinicMedicalRecord>>({ date: today(), type: "Heartworm Test", status: "Administered", administered_by: getCurrentUserName() });
  const [printOpts, setPrintOpts] = useState<PrintOptions>({ includeVaccines: true, includeTests: true, includeMedications: true, includeProcedures: true, includeNotes: true });

  const clientId = (animal as ClinicAnimal)?.client_id;
  const clientName = clients.find((c) => c.id === clientId)?.county_name || (isShelterAnimal ? "Linked Shelter" : "—");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (isShelterAnimal) {
        const [a, med, s] = await Promise.all([
          fetchShelterAnimal(realId),
          fetchShelterAnimalMedical(realId),
          fetchClinicSettings(user.id),
        ]);
        if (!a) { router.replace("/clinic-portal/animals"); return; }
        setAnimal(a);
        setShelterMed(med);
        setSettings(s);
      } else {
        const [animals, med, procs, appts, s] = await Promise.all([
          fetchClinicAnimals(user.id),
          fetchClinicMedical(user.id, undefined, realId),
          fetchClinicProcedures(user.id, undefined, realId),
          fetchClinicAppointments(user.id),
          fetchClinicSettings(user.id),
        ]);
        const found = animals.find((a) => a.id === realId);
        if (!found) { router.replace("/clinic-portal/animals"); return; }
        setAnimal(found);
        setClinicMed(med);
        setProcedures(procs);
        setAppointments(appts.filter((a) => a.animal_name === found.name));
        setSettings(s);
      }
    } finally { setLoading(false); }
  }, [user?.id, realId, isShelterAnimal, router]);

  useEffect(() => { load(); }, [load]);

  const allMed = [...shelterMed, ...clinicMed].sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);

  const handleAddMed = async () => {
    if (!animal || !medForm.type || !user?.id) return;
    setMedSaving(true);
    try {
      if (isShelterAnimal) {
        const saved = await addShelterAnimalMedical({
          animal_id: realId, animal_name: animal.name || "",
          type: medForm.type, description: medForm.description,
          test_result: medForm.test_result, date: medForm.date || today(),
          vet: medForm.administered_by, status: "Administered",
          lot_number: medForm.lot_number, dosage: medForm.dosage,
          next_due: medForm.next_due,
        } as Partial<MedicalRecord>);
        setShelterMed((prev) => [saved, ...prev]);
      } else {
        const saved = await createClinicMedical({
          ...medForm, clinic_account_id: user.id,
          animal_id: realId, animal_name: animal.name || "",
          client_id: clientId,
        } as Omit<ClinicMedicalRecord, "id" | "created_at">);
        setClinicMed((prev) => [saved, ...prev]);
      }
      setShowMedForm(false);
      setMedForm({ date: today(), type: "Heartworm Test", status: "Administered", administered_by: getCurrentUserName() });
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setMedSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>;
  if (!animal) return null;

  const speciesIcon = animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            {animal.photo_url ? (
              <img src={animal.photo_url} alt="" style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover" }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>{speciesIcon}</div>
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{animal.name || "—"}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {[animal.species, animal.breed, animal.color, animal.sex].filter(Boolean).join(" · ")}
                {animal.age && ` · ${displayAge(animal.age)}`}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {clientName && <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: 10 }}>🏛️ {clientName}</span>}
                {animal.microchip && <span className="badge" style={{ background: "#f3f4f6", color: "#374151", fontSize: 10 }}>🔬 {animal.microchip}</span>}
                {isShelterAnimal && <span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontSize: 10 }}>SHELTER</span>}
              </div>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowPrint(true)}>🖨 Print Record</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
        {([["overview","Overview"],["medical","Medical"],["procedures","Procedures"],["appointments","Appointments"]] as const).map(([id2, label]) => (
          <button key={id2} onClick={() => setTab(id2)} style={{ padding: "8px 16px", border: "none", background: "none", fontWeight: tab === id2 ? 700 : 400, color: tab === id2 ? "var(--teal)" : "var(--text-secondary)", borderBottom: tab === id2 ? "2px solid var(--teal)" : "2px solid transparent", cursor: "pointer", fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="card" style={{ padding: 18 }}>
          <div className="grid-2">
            {[
              ["Name", animal.name], ["Species", animal.species], ["Breed", animal.breed],
              ["Color", animal.color], ["Sex", animal.sex], ["Age", displayAge(animal.age)],
              ["Weight", ("weight" in animal ? animal.weight : (animal as ClinicAnimal).weight) || "—"],
              ["Microchip", animal.microchip], ["Status", animal.status],
              ["Sterilized", "fixed" in animal ? (animal.fixed ? "Yes" : "No") : "—"],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{value || "—"}</div>
              </div>
            ))}
          </div>
          {(animal as ClinicAnimal).notes && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, fontSize: 13 }}>
              <strong>Notes:</strong> {(animal as ClinicAnimal).notes}
            </div>
          )}
        </div>
      )}

      {/* Medical Tab */}
      {tab === "medical" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowMedForm(true)}>+ Add Medical Record</button>
          </div>
          {allMed.length === 0 ? (
            <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No medical records yet.</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Result</th><th>By</th><th>Source</th></tr></thead>
                <tbody>
                  {allMed.map((m, i) => {
                    const isS = !("clinic_account_id" in m);
                    const testR = ("test_result" in m ? (m as ClinicMedicalRecord).test_result : undefined);
                    const rc = testR ? RESULT_COLORS[testR] : null;
                    const byField = "vet" in m ? (m as MedicalRecord).vet : (m as ClinicMedicalRecord).administered_by;
                    return (
                      <tr key={i}>
                        <td style={{ fontSize: 12 }}>{m.date}</td>
                        <td><span className="badge" style={{ background: TEST_TYPES.has(m.type || "") ? "#f3e8ff" : "#e0f2fe", color: TEST_TYPES.has(m.type || "") ? "#7c3aed" : "#0369a1", fontSize: 10 }}>{m.type}</span></td>
                        <td style={{ fontSize: 12 }}>{m.description || "—"}</td>
                        <td>{rc ? <span className="badge" style={{ background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 700 }}>{testR}</span> : "—"}</td>
                        <td style={{ fontSize: 11 }}>{byField || "—"}</td>
                        <td><span className="badge" style={{ background: isS ? "#dbeafe" : "#dcfce7", color: isS ? "#1d4ed8" : "#15803d", fontSize: 9 }}>{isS ? "MCAS" : "Clinic"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Procedures Tab */}
      {tab === "procedures" && (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          {procedures.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No procedures recorded.</div> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Outcome</th><th>By</th><th>Cost</th></tr></thead>
              <tbody>
                {procedures.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12 }}>{p.procedure_date}</td>
                    <td style={{ fontWeight: 600 }}>{p.procedure_type}</td>
                    <td style={{ fontSize: 12 }}>{p.outcome || "—"}</td>
                    <td style={{ fontSize: 11 }}>{p.performed_by || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.cost ? `$${p.cost}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Appointments Tab */}
      {tab === "appointments" && (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          {appointments.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No appointments found for this animal.</div> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12 }}>{a.appointment_date}{a.appointment_time ? ` ${a.appointment_time}` : ""}</td>
                    <td style={{ fontSize: 12 }}>{a.appointment_type}</td>
                    <td><span className="badge" style={{ fontSize: 10 }}>{a.status}</span></td>
                    <td style={{ fontSize: 12 }}>{a.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Medical Record Modal */}
      {showMedForm && (
        <div className="modal-overlay" onClick={() => setShowMedForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add Medical Record — {animal.name}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowMedForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="Type">
                  <select className="form-select" value={medForm.type || ""} onChange={(e) => setMedForm((f) => ({ ...f, type: e.target.value }))}>
                    {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Date"><DateInput className="form-input" value={medForm.date || today()} onChange={(e) => setMedForm((f) => ({ ...f, date: e.target.value }))} /></F>
                <F label="Description / Medication">
                  <MedicationSearch value={medForm.description || ""} onChange={(name) => setMedForm((f) => ({ ...f, description: name }))} species={animal.species} placeholder="Search medication library…" />
                </F>
                {TEST_TYPES.has(medForm.type || "") && (
                  <F label="Result">
                    <select className="form-select" value={medForm.test_result || "Pending"} onChange={(e) => setMedForm((f) => ({ ...f, test_result: e.target.value }))}>
                      {["Pending","Negative","Positive","Inconclusive"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </F>
                )}
                <F label="Lot Number"><input className="form-input" value={medForm.lot_number || ""} onChange={(e) => setMedForm((f) => ({ ...f, lot_number: e.target.value }))} /></F>
                <F label="Dosage"><input className="form-input" value={medForm.dosage || ""} onChange={(e) => setMedForm((f) => ({ ...f, dosage: e.target.value }))} /></F>
                <F label="Next Due"><DateInput className="form-input" value={medForm.next_due || ""} onChange={(e) => setMedForm((f) => ({ ...f, next_due: e.target.value }))} /></F>
                <F label="Administered By"><input className="form-input" value={medForm.administered_by || ""} onChange={(e) => setMedForm((f) => ({ ...f, administered_by: e.target.value }))} /></F>
              </div>
              {isShelterAnimal && <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 6, padding: "8px 12px", marginTop: 8, fontSize: 12, color: "#1d4ed8" }}>This record will be saved to the MCAS shelter system and visible to MCAS staff.</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMedForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddMed} disabled={medSaving}>{medSaving ? "Saving…" : "Save Record"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Options Modal */}
      {showPrint && settings && (
        <div className="modal-overlay" onClick={() => setShowPrint(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Print Record — {animal.name}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowPrint(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {([
                  ["includeVaccines", "Vaccination history"],
                  ["includeTests", "Diagnostic test results"],
                  ["includeMedications", "Medications & treatments"],
                  ["includeProcedures", "Procedures & surgeries"],
                  ["includeNotes", "Visit notes"],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={printOpts[key]} onChange={(e) => setPrintOpts((o) => ({ ...o, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: 11 }}>From date (optional)</label><DateInput className="form-input" value={printOpts.dateFrom || ""} onChange={(e) => setPrintOpts((o) => ({ ...o, dateFrom: e.target.value }))} /></div>
                <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: 11 }}>To date (optional)</label><DateInput className="form-input" value={printOpts.dateTo || ""} onChange={(e) => setPrintOpts((o) => ({ ...o, dateTo: e.target.value }))} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPrint(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { printClinicAnimalRecord(animal, settings, allMed, procedures, clientName, printOpts); setShowPrint(false); }}>🖨 Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
