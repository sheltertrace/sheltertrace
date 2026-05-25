"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchPetLicenses, createPetLicense, updatePetLicense,
  deletePetLicense, bulkCreatePetLicenses, fetchAnimals, fetchPeople,
} from "@/lib/data";
import type { PetLicense, Animal, Person } from "@/lib/types";
import { today, formatDate } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES     = ["Active","Expired","Revoked","Suspended"];
const AUTHORITIES  = ["City of Madison","Morgan County","Other"];
const SPECIES_OPTS = ["Dog","Cat"];
const YEARS        = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

// ── Helpers ───────────────────────────────────────────────────────────────────

function licenseStatus(lic: PetLicense): { label: string; color: string; bg: string } {
  if (lic.status === "Revoked"   ) return { label: "Revoked",   color: "#b91c1c", bg: "#fee2e2" };
  if (lic.status === "Suspended" ) return { label: "Suspended", color: "#92400e", bg: "#fef3c7" };
  if (!lic.expiration_date)        return { label: lic.status ?? "Active", color: "#15803d", bg: "#dcfce7" };
  const daysLeft = Math.ceil((new Date(`${lic.expiration_date}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0)  return { label: "Expired", color: "#b91c1c", bg: "#fee2e2" };
  if (daysLeft <= 30) return { label: "Expiring", color: "#92400e", bg: "#fef3c7" };
  return { label: "Active", color: "#15803d", bg: "#dcfce7" };
}

function parseCsv(text: string): Record<string, string>[] {
  const lines   = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/ /g, "_").replace(/[^a-z0-9_]/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  });
}

function rowToLicense(row: Record<string, string>): Omit<PetLicense, "id" | "created_at" | "updated_at"> {
  return {
    license_number:  row.license_number ?? row.license_num ?? row.lic_number ?? "",
    issue_date:      row.issue_date      || undefined,
    expiration_date: row.expiration_date ?? row.exp_date ?? row.expires ?? undefined,
    issuing_authority: row.issuing_authority ?? "City of Madison",
    status:          row.status          ?? "Active",
    pet_name:        row.pet_name        ?? row.name     ?? undefined,
    species:         row.species         ?? undefined,
    breed:           row.breed           ?? undefined,
    color:           row.color           ?? undefined,
    sex:             row.sex             ?? undefined,
    age:             row.age             ?? undefined,
    microchip_number:row.microchip_number?? row.microchip ?? undefined,
    rabies_tag:      row.rabies_tag       ?? row.rabies   ?? undefined,
    owner_name:      row.owner_name       ?? row.owner    ?? undefined,
    owner_address:   row.address          ?? row.owner_address ?? undefined,
    owner_city:      row.city             ?? row.owner_city ?? "Madison",
    owner_state:     row.state            ?? "GA",
    owner_zip:       row.zip              ?? undefined,
    owner_phone:     row.phone            ?? row.owner_phone ?? undefined,
    owner_email:     row.email            ?? row.owner_email ?? undefined,
  };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PetLicensesPage() {
  const [licenses, setLicenses] = useState<PetLicense[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState<number | "">("");

  // Add / Edit modal
  const [showForm,  setShowForm]  = useState(false);
  const [editLic,   setEditLic]   = useState<PetLicense | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError,  setFormError]  = useState("");

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importRows,  setImportRows]  = useState<Omit<PetLicense,"id"|"created_at"|"updated_at">[]>([]);
  const [importing,   setImporting]   = useState(false);
  const [importMsg,   setImportMsg]   = useState("");

  // Detail modal
  const [detail, setDetail] = useState<PetLicense | null>(null);

  // Form state
  const [f, setF] = useState<Partial<PetLicense>>({
    status: "Active", issuing_authority: "City of Madison", owner_city: "Madison", owner_state: "GA",
  });

  // Animal / person search for linking
  const [animals,  setAnimals]  = useState<Animal[]>([]);
  const [people,   setPeople]   = useState<Person[]>([]);
  const [animalQ,  setAnimalQ]  = useState("");
  const [personQ,  setPersonQ]  = useState("");

  const load = useCallback(async () => {
    const data = await fetchPetLicenses({ search, status: statusFilter, species: speciesFilter !== "All" ? speciesFilter : undefined, year: yearFilter || undefined });
    setLicenses(data);
    setLoading(false);
  }, [search, statusFilter, speciesFilter, yearFilter]);

  useEffect(() => { load(); }, [load]);

  // Lazy-load animals + people for link search
  useEffect(() => {
    fetchAnimals().then(setAnimals);
    fetchPeople().then(setPeople);
  }, []);

  // Stats
  const stats = useMemo(() => {
    const all   = licenses;
    const active   = all.filter((l) => licenseStatus(l).label === "Active").length;
    const expiring = all.filter((l) => licenseStatus(l).label === "Expiring").length;
    const expired  = all.filter((l) => licenseStatus(l).label === "Expired").length;
    return { active, expiring, expired, total: all.length };
  }, [licenses]);

  function openAdd() {
    setEditLic(null);
    setF({ status: "Active", issuing_authority: "City of Madison", owner_city: "Madison", owner_state: "GA" });
    setAnimalQ(""); setPersonQ(""); setFormError("");
    setShowForm(true);
  }

  function openEdit(lic: PetLicense) {
    setEditLic(lic);
    setF({ ...lic });
    setAnimalQ(lic.animal_id ? `${lic.pet_name ?? ""} (${lic.animal_id})` : "");
    setPersonQ(lic.person_id ? `${lic.owner_name ?? ""} (${lic.person_id})` : "");
    setFormError("");
    setShowForm(true);
    setDetail(null);
  }

  async function handleSave() {
    if (!f.license_number?.trim() || !f.owner_name?.trim()) {
      setFormError("License number and owner name are required."); return;
    }
    setFormSaving(true); setFormError("");
    try {
      if (editLic?.id) {
        const updated = await updatePetLicense(editLic.id, f);
        setLicenses((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      } else {
        const created = await createPetLicense(f as Omit<PetLicense,"id"|"created_at"|"updated_at">);
        setLicenses((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Save failed.";
      setFormError(msg.includes("23505") ? "License number already exists." : msg);
    } finally { setFormSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this license? This cannot be undone.")) return;
    await deletePetLicense(id);
    setLicenses((prev) => prev.filter((l) => l.id !== id));
    setDetail(null);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string ?? "").map(rowToLicense).filter((r) => r.license_number);
      setImportRows(rows);
      setImportMsg("");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const result = await bulkCreatePetLicenses(importRows);
      setImportMsg(`✓ Imported ${result.inserted} license${result.inserted !== 1 ? "s" : ""}. ${result.skipped > 0 ? `${result.skipped} skipped (duplicates or errors).` : ""}`);
      setImportRows([]);
      await load();
    } finally { setImporting(false); }
  }

  // Filtered animal/person matches for link dropdowns
  const animalMatches = useMemo(() => {
    if (animalQ.length < 2) return [];
    const q = animalQ.toLowerCase();
    return animals.filter((a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)).slice(0, 6);
  }, [animals, animalQ]);

  const personMatches = useMemo(() => {
    if (personQ.length < 2) return [];
    const q = personQ.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.pid ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [people, personQ]);

  return (
    <AppShell
      title="Pet License Registry"
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>📂 Import CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add License</button>
        </div>
      }
    >
      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: "Active Licenses",    value: stats.active,   color: "#16a34a", icon: "✅" },
            { label: "Expiring (30 days)", value: stats.expiring, color: "#d97706", icon: "⚠️" },
            { label: "Expired",            value: stats.expired,  color: "#dc2626", icon: "❌" },
            { label: "Total on File",      value: stats.total,    color: "#0f2942", icon: "🪪" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
              <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ maxWidth: 260, marginBottom: 0 }} placeholder="Search license #, owner, pet, address, chip…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width: 110 }} value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}>
            <option value="All">All Species</option>
            {SPECIES_OPTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{ width: 100 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value ? +e.target.value : "")}>
            <option value="">All Years</option>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 4 }}>{licenses.length} record{licenses.length !== 1 ? "s" : ""}</span>
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: "auto" }}>↻ Refresh</button>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>License #</th>
                  <th>Owner</th>
                  <th>Pet Name</th>
                  <th>Species / Breed</th>
                  <th>Address</th>
                  <th>Issue Date</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="empty-state">Loading…</td></tr>
                : licenses.length === 0 ? <tr><td colSpan={9} className="empty-state">No licenses found. Click "Add License" or "Import CSV" to get started.</td></tr>
                : licenses.map((lic) => {
                  const st = licenseStatus(lic);
                  return (
                    <tr key={lic.id} style={{ cursor: "pointer" }} onClick={() => setDetail(lic)}>
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{lic.license_number}</td>
                      <td style={{ fontWeight: 600 }}>{lic.owner_name || "—"}</td>
                      <td>{lic.pet_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{[lic.species, lic.breed].filter(Boolean).join(" · ") || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{[lic.owner_address, lic.owner_city].filter(Boolean).join(", ") || "—"}</td>
                      <td style={{ fontSize: 12 }}>{lic.issue_date ? formatDate(lic.issue_date) : "—"}</td>
                      <td style={{ fontSize: 12, color: st.label === "Expired" ? "#dc2626" : st.label === "Expiring" ? "#d97706" : "inherit", fontWeight: st.label !== "Active" ? 700 : 400 }}>
                        {lic.expiration_date ? formatDate(lic.expiration_date) : "—"}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(lic); }}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="modal-title">🪪 License {detail.license_number}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(detail)}>Edit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {(() => {
                const st = licenseStatus(detail);
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                      {detail.issuing_authority && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{detail.issuing_authority}</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
                      {([
                        ["Issued",        detail.issue_date ? formatDate(detail.issue_date) : null],
                        ["Expires",       detail.expiration_date ? formatDate(detail.expiration_date) : null],
                        ["Owner",         detail.owner_name],
                        ["Phone",         detail.owner_phone],
                        ["Email",         detail.owner_email],
                        ["Address",       [detail.owner_address, detail.owner_city, detail.owner_state, detail.owner_zip].filter(Boolean).join(", ")],
                        ["Pet Name",      detail.pet_name],
                        ["Species",       detail.species],
                        ["Breed",         detail.breed],
                        ["Color",         detail.color],
                        ["Sex",           detail.sex],
                        ["Age",           detail.age],
                        ["Spayed/Neutered", detail.spayed_neutered != null ? (detail.spayed_neutered ? "Yes" : "No") : null],
                        ["Microchip",     detail.microchip_number],
                        ["Rabies Tag",    detail.rabies_tag],
                        ["Rabies Vacc.",  detail.rabies_vaccination_date ? formatDate(detail.rabies_vaccination_date) : null],
                        ["Rabies Exp.",   detail.rabies_expiration_date ? formatDate(detail.rabies_expiration_date) : null],
                        ["Animal ID",     detail.animal_id],
                        ["Person ID",     detail.person_id],
                      ] as [string,string|null][]).map(([l, v]) => v ? (
                        <div key={l}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", display: "block", textTransform: "uppercase", letterSpacing: "0.4px" }}>{l}</span>
                          <span style={{ fontSize: 13 }}>{v}</span>
                        </div>
                      ) : null)}
                    </div>
                    {detail.notes && <div style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>{detail.notes}</div>}
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
              <button className="btn btn-sm" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }} onClick={() => detail.id && handleDelete(detail.id)}>Delete</button>
              {detail.animal_id && <a href={`/animals/${detail.animal_id}`} className="btn btn-ghost btn-sm">→ View Animal</a>}
              {detail.person_id && <a href={`/people/${detail.person_id}`} className="btn btn-ghost btn-sm">→ View Owner</a>}
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "92dvh", display: "flex", flexDirection: "column" }}>
            <div className="modal-header">
              <span className="modal-title">{editLic ? `Edit License ${editLic.license_number}` : "Add Pet License"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>

              {/* License Info */}
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>License</div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">License Number *</label><input className="form-input" value={f.license_number ?? ""} onChange={(e) => setF((p) => ({ ...p, license_number: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={f.status ?? "Active"} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Issue Date</label><input className="form-input" type="date" value={f.issue_date ?? ""} onChange={(e) => setF((p) => ({ ...p, issue_date: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Expiration Date</label><input className="form-input" type="date" value={f.expiration_date ?? ""} onChange={(e) => setF((p) => ({ ...p, expiration_date: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Issuing Authority</label>
                  <select className="form-select" value={f.issuing_authority ?? "City of Madison"} onChange={(e) => setF((p) => ({ ...p, issuing_authority: e.target.value }))}>
                    {AUTHORITIES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* Pet Info */}
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 14, marginBottom: 10 }}>Pet</div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Pet Name</label><input className="form-input" value={f.pet_name ?? ""} onChange={(e) => setF((p) => ({ ...p, pet_name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Species</label><select className="form-select" value={f.species ?? ""} onChange={(e) => setF((p) => ({ ...p, species: e.target.value }))}><option value="">—</option>{SPECIES_OPTS.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Breed</label><input className="form-input" value={f.breed ?? ""} onChange={(e) => setF((p) => ({ ...p, breed: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Color</label><input className="form-input" value={f.color ?? ""} onChange={(e) => setF((p) => ({ ...p, color: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Sex</label><select className="form-select" value={f.sex ?? ""} onChange={(e) => setF((p) => ({ ...p, sex: e.target.value }))}><option value="">—</option>{["Male","Female","Unknown"].map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Age</label><input className="form-input" value={f.age ?? ""} onChange={(e) => setF((p) => ({ ...p, age: e.target.value }))} placeholder="e.g. 3 years"/></div>
                <div className="form-group"><label className="form-label">Microchip #</label><input className="form-input" value={f.microchip_number ?? ""} onChange={(e) => setF((p) => ({ ...p, microchip_number: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Rabies Tag #</label><input className="form-input" value={f.rabies_tag ?? ""} onChange={(e) => setF((p) => ({ ...p, rabies_tag: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Rabies Vaccination</label><input className="form-input" type="date" value={f.rabies_vaccination_date ?? ""} onChange={(e) => setF((p) => ({ ...p, rabies_vaccination_date: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Rabies Expires</label><input className="form-input" type="date" value={f.rabies_expiration_date ?? ""} onChange={(e) => setF((p) => ({ ...p, rabies_expiration_date: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Spayed/Neutered</label><select className="form-select" value={f.spayed_neutered == null ? "" : f.spayed_neutered ? "Yes" : "No"} onChange={(e) => setF((p) => ({ ...p, spayed_neutered: e.target.value === "" ? null : e.target.value === "Yes" }))}><option value="">Unknown</option><option>Yes</option><option>No</option></select></div>
              </div>

              {/* Link to animal record */}
              <div className="form-group">
                <label className="form-label">Link to Animal Record (optional)</label>
                <input className="form-input" placeholder="Search by name or ID…" value={animalQ} onChange={(e) => { setAnimalQ(e.target.value); if (!e.target.value) setF((p) => ({ ...p, animal_id: undefined })); }} />
                {animalMatches.length > 0 && !f.animal_id && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, overflow: "hidden" }}>
                    {animalMatches.map((a) => <div key={a.id} onClick={() => { setF((p) => ({ ...p, animal_id: a.id })); setAnimalQ(`${a.name} (${a.id})`); }} style={{ padding: "7px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}>{a.name} · {a.species} · {a.id}</div>)}
                  </div>
                )}
              </div>

              {/* Owner Info */}
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 14, marginBottom: 10 }}>Owner</div>
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Owner Name *</label><input className="form-input" value={f.owner_name ?? ""} onChange={(e) => setF((p) => ({ ...p, owner_name: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: "1/-1" }}><label className="form-label">Address</label><input className="form-input" value={f.owner_address ?? ""} onChange={(e) => setF((p) => ({ ...p, owner_address: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={f.owner_city ?? "Madison"} onChange={(e) => setF((p) => ({ ...p, owner_city: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Zip</label><input className="form-input" value={f.owner_zip ?? ""} onChange={(e) => setF((p) => ({ ...p, owner_zip: e.target.value }))} maxLength={10}/></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={f.owner_phone ?? ""} onChange={(e) => setF((p) => ({ ...p, owner_phone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={f.owner_email ?? ""} onChange={(e) => setF((p) => ({ ...p, owner_email: e.target.value }))} /></div>
              </div>

              {/* Link to person record */}
              <div className="form-group">
                <label className="form-label">Link to Person Record (optional)</label>
                <input className="form-input" placeholder="Search by name or PID…" value={personQ} onChange={(e) => { setPersonQ(e.target.value); if (!e.target.value) setF((p) => ({ ...p, person_id: undefined })); }} />
                {personMatches.length > 0 && !f.person_id && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 6, marginTop: 4, overflow: "hidden" }}>
                    {personMatches.map((p) => <div key={p.id} onClick={() => { setF((prev) => ({ ...prev, person_id: p.id })); setPersonQ(`${p.first_name} ${p.last_name} (${p.pid})`); }} style={{ padding: "7px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}>{p.first_name} {p.last_name} · {p.pid}</div>)}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={f.notes ?? ""} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} style={{ resize: "vertical" }} />
              </div>

              {formError && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>⚠ {formError}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={formSaving}>{formSaving ? "Saving…" : editLic ? "Save Changes" : "Add License"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ── */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setImportRows([]); setImportMsg(""); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <span className="modal-title">📂 Import Licenses from CSV</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowImport(false); setImportRows([]); setImportMsg(""); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
                Upload a CSV file. Required column: <code>license_number</code>.<br />
                Supported: <code>owner_name, pet_name, species, breed, address, issue_date, expiration_date, rabies_tag, microchip</code>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} style={{ marginBottom: 12 }} />
              {importRows.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--teal)" }}>
                    {importRows.length} record{importRows.length !== 1 ? "s" : ""} ready to import (duplicates will be skipped):
                  </div>
                  <div style={{ overflowX: "auto", marginBottom: 12 }}>
                    <table className="data-table" style={{ fontSize: 11 }}>
                      <thead><tr><th>License #</th><th>Owner</th><th>Pet</th><th>Species</th><th>Expires</th></tr></thead>
                      <tbody>
                        {importRows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: "monospace" }}>{r.license_number}</td>
                            <td>{r.owner_name || "—"}</td>
                            <td>{r.pet_name || "—"}</td>
                            <td>{r.species || "—"}</td>
                            <td>{r.expiration_date || "—"}</td>
                          </tr>
                        ))}
                        {importRows.length > 5 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)" }}>…and {importRows.length - 5} more</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {importMsg && <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>{importMsg}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowImport(false); setImportRows([]); setImportMsg(""); }}>Close</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing || importRows.length === 0}>
                {importing ? "Importing…" : `Import ${importRows.length} Record${importRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
