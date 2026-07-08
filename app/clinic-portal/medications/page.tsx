"use client";
import { useState, useEffect, useMemo } from "react";
import { fetchMedications, createMedication, updateMedication, invalidateMedCache, MED_CATEGORIES, MED_UNITS, DEA_SCHEDULES, type Medication } from "@/lib/medicationData";
import { getCurrentUserName } from "@/lib/auth";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const EMPTY: Partial<Medication> = { name: "", category: "Antibiotic", unit: "tablets", concentration: "", default_cost: 0, species: ["Dog", "Cat"], dea_schedule: "None", notes: "", active: true };

export default function ClinicMedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState<Partial<Medication>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invalidateMedCache();
    fetchMedications({ active: true }).then(setMeds).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = meds;
    if (filterCat !== "all") list = list.filter((m) => m.category === filterCat);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q)); }
    return list;
  }, [meds, search, filterCat]);

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateMedication(editing.id, form);
        setMeds((prev) => prev.map((m) => m.id === editing.id ? { ...m, ...form } as Medication : m));
      } else {
        const created = await createMedication({ ...form, active: true, created_by: getCurrentUserName() } as Omit<Medication, "id" | "created_at" | "updated_at">);
        setMeds((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const toggleSpecies = (sp: string) => {
    const cur = form.species || [];
    setForm((f) => ({ ...f, species: cur.includes(sp) ? cur.filter((s) => s !== sp) : [...cur, sp] }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>💊 Medication Library</h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{meds.length} active medications · shared across all ShelterTrace accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }}>+ Add Medication</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="form-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All Categories</option>
          {MED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} shown</span>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Concentration</th><th>Unit</th><th>DEA</th><th></th></tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>
                    {m.name}
                    {m.dea_schedule && m.dea_schedule !== "None" && <span style={{ marginLeft: 6, fontSize: 10, color: "#dc2626", fontWeight: 700 }}>⚠️</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{m.category || "—"}</td>
                  <td style={{ fontSize: 12, fontFamily: "monospace" }}>{m.concentration || "—"}</td>
                  <td style={{ fontSize: 12 }}>{m.unit || "—"}</td>
                  <td style={{ fontSize: 12 }}>{m.dea_schedule && m.dea_schedule !== "None" ? <span style={{ fontWeight: 700, color: "#dc2626" }}>Sch {m.dea_schedule}</span> : "—"}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditing(m); setForm({ ...m }); setShowForm(true); }}>Edit</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No medications found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editing ? "Edit Medication" : "Add Medication"}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Name *</label><input className="form-input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <F label="Category"><select className="form-select" value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{MED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
                <F label="Unit"><select className="form-select" value={form.unit || ""} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}><option value="">— None —</option>{MED_UNITS.map((u) => <option key={u}>{u}</option>)}</select></F>
                <F label="Concentration"><input className="form-input" value={form.concentration || ""} onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.value }))} placeholder="e.g. 250mg" /></F>
                <F label="DEA Schedule"><select className="form-select" value={form.dea_schedule || "None"} onChange={(e) => setForm((f) => ({ ...f, dea_schedule: e.target.value }))}>{DEA_SCHEDULES.map((s) => <option key={s}>{s}</option>)}</select></F>
              </div>
              <F label="Species">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["Dog","Cat","Rabbit","Bird","Reptile","All"].map((sp) => (
                    <label key={sp} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={(form.species || []).includes(sp)} onChange={() => toggleSpecies(sp)} /> {sp}
                    </label>
                  ))}
                </div>
              </F>
              <F label="Notes"><textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name?.trim()}>{saving ? "Saving…" : editing ? "Save" : "Add"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
