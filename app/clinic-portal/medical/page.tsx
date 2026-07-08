"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicMedical, createClinicMedical, fetchClinicAnimals } from "@/lib/clinicData";
import type { ClinicMedicalRecord, ClinicAnimal } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";
import MedicationSearch from "@/components/ui/MedicationSearch";
import { getCurrentUserName } from "@/lib/auth";
import { today } from "@/lib/utils";

const RECORD_TYPES = [
  "Rabies Vaccine","DHPP Vaccine","Bordetella Vaccine","Feline FVRCP Vaccine","FeLV Vaccine",
  "Heartworm Test","FIV/FeLV Combo Test","Parvo Test","Fecal Test","Urinalysis",
  "Medication","Other Vaccine","Other Test","Other Treatment",
];
const TEST_TYPES = new Set(["Heartworm Test","FIV/FeLV Combo Test","Parvo Test","Fecal Test","Urinalysis","Other Test"]);
const RESULT_COLORS: Record<string, { bg: string; color: string }> = {
  Negative:     { bg: "#dcfce7", color: "#15803d" },
  Positive:     { bg: "#fee2e2", color: "#dc2626" },
  Inconclusive: { bg: "#fef3c7", color: "#b45309" },
  Pending:      { bg: "#f1f5f9", color: "#64748b" },
};

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

function MedPageContent() {
  const { user } = useAuth();
  const { selectedClientId, clients } = useClinic();
  const params = useSearchParams();
  const [records, setRecords] = useState<ClinicMedicalRecord[]>([]);
  const [animals, setAnimals] = useState<ClinicAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!params.get("add"));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState(selectedClientId || "all");
  const [form, setForm] = useState<Partial<ClinicMedicalRecord>>({
    date: today(), type: "Rabies Vaccine", status: "Administered",
    administered_by: getCurrentUserName(),
    animal_name: params.get("animal") || "",
    client_id: params.get("client") || selectedClientId || undefined,
  });

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicMedical(user.id, selectedClientId || undefined),
      fetchClinicAnimals(user.id, selectedClientId || undefined),
    ]).then(([r, a]) => { setRecords(r); setAnimals(a); }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const filtered = useMemo(() => {
    let list = records;
    if (filterClient !== "all") list = list.filter((r) => r.client_id === filterClient);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((r) => (r.animal_name || "").toLowerCase().includes(q)); }
    return list;
  }, [records, filterClient, search]);

  const handleSave = async () => {
    if (!form.animal_name || !form.date || !form.client_id || !user?.id) return;
    setSaving(true);
    try {
      const created = await createClinicMedical({ ...form, clinic_account_id: user.id } as Omit<ClinicMedicalRecord, "id" | "created_at">);
      setRecords((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ date: today(), type: "Rabies Vaccine", status: "Administered", administered_by: getCurrentUserName() });
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const isTest = TEST_TYPES.has(form.type || "");
  const clientName = (id?: string) => clients.find((c) => c.id === id)?.county_name || "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>💊 Medical Records</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Record</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search animal…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
        <select className="form-select" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All Clients</option>
          {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
        </select>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Animal</th><th>Client</th><th>Type</th><th>Description</th><th>Result</th><th>By</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No records found.</td></tr> :
                filtered.map((r) => {
                  const isT2 = TEST_TYPES.has(r.type || "");
                  const rc = r.test_result ? RESULT_COLORS[r.test_result] || RESULT_COLORS.Pending : null;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12 }}>{r.date}</td>
                      <td style={{ fontWeight: 600 }}>{r.animal_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{clientName(r.client_id)}</td>
                      <td><span className="badge" style={{ background: isT2 ? "#f3e8ff" : "#e0f2fe", color: isT2 ? "#7c3aed" : "#0369a1", fontSize: 10 }}>{r.type}</span></td>
                      <td style={{ fontSize: 12 }}>{r.description || "—"}</td>
                      <td>{rc ? <span className="badge" style={{ background: rc.bg, color: rc.color, fontSize: 10, fontWeight: 700 }}>{r.test_result}</span> : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>}</td>
                      <td style={{ fontSize: 11 }}>{r.administered_by || "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add Medical Record</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="County Client *">
                  <select className="form-select" value={form.client_id || ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
                  </select>
                </F>
                <F label="Animal Name *">
                  <input className="form-input" value={form.animal_name || ""} onChange={(e) => setForm((f) => ({ ...f, animal_name: e.target.value }))} list="al2" placeholder="Type or select…" />
                  <datalist id="al2">{animals.map((a) => <option key={a.id} value={a.name || ""} />)}</datalist>
                </F>
                <F label="Record Type *">
                  <select className="form-select" value={form.type || ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, test_result: undefined }))}>
                    {RECORD_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Date *"><DateInput className="form-input" value={form.date || today()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></F>
                <F label="Medication / Description">
                  <MedicationSearch
                    value={form.description || ""}
                    onChange={(name, med) => setForm((f) => ({ ...f, description: name, dosage: med?.unit ? `${f.dosage || ""} ${med.unit}`.trim() : f.dosage }))}
                    placeholder="Search medication library…"
                  />
                </F>
                {isTest && (
                  <F label="Result">
                    <select className="form-select" value={form.test_result || "Pending"} onChange={(e) => setForm((f) => ({ ...f, test_result: e.target.value }))}>
                      {["Pending","Negative","Positive","Inconclusive"].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </F>
                )}
                <F label="Lot Number"><input className="form-input" value={form.lot_number || ""} onChange={(e) => setForm((f) => ({ ...f, lot_number: e.target.value }))} /></F>
                <F label="Dosage"><input className="form-input" value={form.dosage || ""} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} /></F>
                <F label="Next Due"><DateInput className="form-input" value={form.next_due || ""} onChange={(e) => setForm((f) => ({ ...f, next_due: e.target.value }))} /></F>
                <F label="Cost ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.cost ?? ""} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value ? parseFloat(e.target.value) : undefined }))} /></F>
                <F label="Administered By"><input className="form-input" value={form.administered_by || ""} onChange={(e) => setForm((f) => ({ ...f, administered_by: e.target.value }))} /></F>
              </div>
              <F label="Vet Notes"><textarea className="form-textarea" rows={2} value={form.vet_notes || ""} onChange={(e) => setForm((f) => ({ ...f, vet_notes: e.target.value }))} /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.animal_name || !form.client_id}>{saving ? "Saving…" : "Save Record"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MedicalPage() { return <Suspense><MedPageContent /></Suspense>; }
