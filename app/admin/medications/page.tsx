"use client";
import { useState, useEffect, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchMedications, createMedication, updateMedication, invalidateMedCache, MED_CATEGORIES, MED_UNITS, DEA_SCHEDULES, type Medication } from "@/lib/medicationData";
import { getCurrentUserName } from "@/lib/auth";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const EMPTY: Partial<Medication> = { name: "", category: "Antibiotic", unit: "tablets", concentration: "", default_cost: 0, species: ["Dog", "Cat"], dea_schedule: "None", notes: "", active: true };

export default function MedicationsAdminPage() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [form, setForm] = useState<Partial<Medication>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invalidateMedCache();
    fetchMedications().then(setMeds).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = meds;
    if (filterActive === "active") list = list.filter((m) => m.active);
    else if (filterActive === "inactive") list = list.filter((m) => !m.active);
    if (filterCat !== "all") list = list.filter((m) => m.category === filterCat);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((m) => m.name.toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q)); }
    return list;
  }, [meds, search, filterCat, filterActive]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit = (m: Medication) => { setEditing(m); setForm({ ...m }); setShowForm(true); };

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

  const handleToggle = async (m: Medication) => {
    await updateMedication(m.id, { active: !m.active });
    setMeds((prev) => prev.map((x) => x.id === m.id ? { ...x, active: !x.active } : x));
  };

  const toggleSpecies = (sp: string) => {
    const cur = form.species || [];
    setForm((f) => ({ ...f, species: cur.includes(sp) ? cur.filter((s) => s !== sp) : [...cur, sp] }));
  };

  const isDea = (m: Partial<Medication>) => m.dea_schedule && m.dea_schedule !== "None";

  return (
    <AppShell title="Medication Library"
      action={<button className="btn btn-primary" onClick={openAdd}>+ Add Medication</button>}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
        {meds.filter((m) => m.active).length} active medications in library
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search by name or category…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="form-select" value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="all">All Categories</option>
          {MED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="form-select" value={filterActive} onChange={(e) => setFilterActive(e.target.value as typeof filterActive)} style={{ maxWidth: 120 }}>
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Category</th><th>Concentration</th><th>Unit</th><th>Species</th><th>DEA</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.45 }}>
                  <td style={{ fontWeight: 600 }}>
                    {m.name}
                    {isDea(m) && <span style={{ marginLeft: 6, fontSize: 10, color: "#dc2626", fontWeight: 700 }}>⚠️</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{m.category || "—"}</td>
                  <td style={{ fontSize: 12, fontFamily: "monospace" }}>{m.concentration || "—"}</td>
                  <td style={{ fontSize: 12 }}>{m.unit || "—"}</td>
                  <td style={{ fontSize: 11 }}>{m.species?.join(", ") || "All"}</td>
                  <td style={{ fontSize: 12 }}>{m.dea_schedule && m.dea_schedule !== "None" ? <span style={{ fontWeight: 700, color: "#dc2626" }}>Sch {m.dea_schedule}</span> : "—"}</td>
                  <td><span style={{ width: 10, height: 10, borderRadius: "50%", display: "inline-block", background: m.active ? "#22c55e" : "#d1d5db" }} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(m)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: m.active ? "#dc2626" : "#15803d" }} onClick={() => handleToggle(m)}>{m.active ? "Deactivate" : "Activate"}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No medications found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editing ? "Edit Medication" : "Add Medication"}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Amoxicillin 250mg" />
                </div>
                <F label="Category">
                  <select className="form-select" value={form.category || ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {MED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Unit">
                  <select className="form-select" value={form.unit || ""} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                    <option value="">— None —</option>
                    {MED_UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </F>
                <F label="Concentration"><input className="form-input" value={form.concentration || ""} onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.value }))} placeholder="e.g. 250mg, 10mg/mL" /></F>
                <F label="Default Cost ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.default_cost ?? ""} onChange={(e) => setForm((f) => ({ ...f, default_cost: e.target.value ? parseFloat(e.target.value) : 0 }))} /></F>
                <F label="DEA Schedule">
                  <select className="form-select" value={form.dea_schedule || "None"} onChange={(e) => setForm((f) => ({ ...f, dea_schedule: e.target.value }))}>
                    {DEA_SCHEDULES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </F>
              </div>
              <F label="Species">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["Dog", "Cat", "Rabbit", "Bird", "Reptile", "All"].map((sp) => (
                    <label key={sp} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={(form.species || []).includes(sp)} onChange={() => toggleSpecies(sp)} /> {sp}
                    </label>
                  ))}
                </div>
              </F>
              <F label="Notes"><textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F>
              {isDea(form) && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠️ DEA Schedule {form.dea_schedule} Controlled Substance — requires drug log entries</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name?.trim()}>{saving ? "Saving…" : editing ? "Save" : "Add Medication"}</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
