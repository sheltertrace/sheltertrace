"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicProcedures, createClinicProcedure, fetchClinicAnimals, updateClinicAnimal } from "@/lib/clinicData";
import type { ClinicProcedure, ClinicAnimal } from "@/lib/clinicTypes";
import { PROCEDURE_TYPES } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";
import { getCurrentUserName } from "@/lib/auth";
import { today } from "@/lib/utils";

const OUTCOMES = [
  "Successful — no complications","Successful — minor complications",
  "Referred to specialist","Animal did not survive","Other",
];

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

function ProcPageContent() {
  const { user } = useAuth();
  const { selectedClientId, clients } = useClinic();
  const params = useSearchParams();
  const [procs, setProcs] = useState<ClinicProcedure[]>([]);
  const [animals, setAnimals] = useState<ClinicAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!params.get("add"));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partial<ClinicProcedure>>({
    procedure_date: today(), procedure_type: "Spay (OHE)",
    performed_by: getCurrentUserName(),
    animal_name: params.get("animal") || "",
    client_id: params.get("client") || selectedClientId || undefined,
  });

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicProcedures(user.id, selectedClientId || undefined),
      fetchClinicAnimals(user.id, selectedClientId || undefined),
    ]).then(([p, a]) => { setProcs(p); setAnimals(a); }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const filtered = useMemo(() => {
    let list = procs;
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((p) => (p.animal_name || "").toLowerCase().includes(q)); }
    return list;
  }, [procs, search]);

  const handleSave = async () => {
    if (!form.animal_name || !form.procedure_date || !form.client_id || !user?.id) return;
    setSaving(true);
    try {
      const created = await createClinicProcedure({ ...form, clinic_account_id: user.id } as Omit<ClinicProcedure, "id" | "created_at">);
      // Auto-update animal fixed status for spay/neuter
      if (form.procedure_type === "Spay (OHE)" || form.procedure_type === "Neuter (Castration)") {
        const linkedAnimal = animals.find((a) => a.name === form.animal_name && a.client_id === form.client_id);
        if (linkedAnimal) await updateClinicAnimal(linkedAnimal.id, { status: "Active" } as Partial<ClinicAnimal>);
      }
      setProcs((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ procedure_date: today(), procedure_type: "Spay (OHE)", performed_by: getCurrentUserName() });
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.county_name || "—";
  const isSnip = form.procedure_type === "Spay (OHE)" || form.procedure_type === "Neuter (Castration)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🔬 Procedures & Surgeries</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Procedure</button>
      </div>

      <input className="form-input" placeholder="Search animal…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260, marginBottom: 16 }} />

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Animal</th><th>Client</th><th>Type</th><th>Outcome</th><th>Cost</th><th>By</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No procedures recorded yet.</td></tr> :
                filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12 }}>{p.procedure_date}</td>
                    <td style={{ fontWeight: 600 }}>{p.animal_name || "—"}</td>
                    <td style={{ fontSize: 12 }}>{clientName(p.client_id)}</td>
                    <td style={{ fontSize: 12 }}>{p.procedure_type}</td>
                    <td style={{ fontSize: 12 }}>{p.outcome || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.cost ? `$${p.cost}` : "—"}</td>
                    <td style={{ fontSize: 11 }}>{p.performed_by || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 600, maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add Procedure</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              {isSnip && <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 7, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#0d9488" }}>✓ Spay/Neuter — will auto-update animal record when saved</div>}
              <div className="grid-2">
                <F label="County Client *">
                  <select className="form-select" value={form.client_id || ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
                  </select>
                </F>
                <F label="Animal Name *">
                  <input className="form-input" value={form.animal_name || ""} onChange={(e) => setForm((f) => ({ ...f, animal_name: e.target.value }))} list="al3" placeholder="Type or select…" />
                  <datalist id="al3">{animals.map((a) => <option key={a.id} value={a.name || ""} />)}</datalist>
                </F>
                <F label="Procedure Type *">
                  <select className="form-select" value={form.procedure_type || ""} onChange={(e) => setForm((f) => ({ ...f, procedure_type: e.target.value }))}>
                    {PROCEDURE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Date *"><DateInput className="form-input" value={form.procedure_date || today()} onChange={(e) => setForm((f) => ({ ...f, procedure_date: e.target.value }))} /></F>
                <F label="Pre-op Weight"><input className="form-input" value={form.pre_op_weight || ""} onChange={(e) => setForm((f) => ({ ...f, pre_op_weight: e.target.value }))} placeholder="e.g. 28.5 lbs" /></F>
                <F label="Anesthesia Used"><input className="form-input" value={form.anesthesia_used || ""} onChange={(e) => setForm((f) => ({ ...f, anesthesia_used: e.target.value }))} /></F>
                <F label="Anesthesia Dose"><input className="form-input" value={form.anesthesia_dose || ""} onChange={(e) => setForm((f) => ({ ...f, anesthesia_dose: e.target.value }))} /></F>
                <F label="Outcome">
                  <select className="form-select" value={form.outcome || ""} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}>
                    <option value="">— Select —</option>
                    {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </F>
                <F label="Follow-up Date"><DateInput className="form-input" value={form.follow_up_date || ""} onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))} /></F>
                <F label="Cost ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.cost ?? ""} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value ? parseFloat(e.target.value) : undefined }))} /></F>
                <F label="Performed By"><input className="form-input" value={form.performed_by || ""} onChange={(e) => setForm((f) => ({ ...f, performed_by: e.target.value }))} /></F>
              </div>
              <F label="Complications"><textarea className="form-textarea" rows={2} value={form.complications || ""} onChange={(e) => setForm((f) => ({ ...f, complications: e.target.value }))} /></F>
              <F label="Recovery Notes"><textarea className="form-textarea" rows={2} value={form.recovery_notes || ""} onChange={(e) => setForm((f) => ({ ...f, recovery_notes: e.target.value }))} /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.animal_name || !form.client_id}>{saving ? "Saving…" : "Save Procedure"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProceduresPage() { return <Suspense><ProcPageContent /></Suspense>; }
