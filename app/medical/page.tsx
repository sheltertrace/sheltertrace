"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import { fetchMedical, fetchAnimals, createMedical, updateMedical, deleteMedical } from "@/lib/data";
import type { MedicalRecord, Animal } from "@/lib/types";
import { MEDICAL_TYPES, MEDICAL_DESC_MAP } from "@/lib/constants";
import StaffSelect from "@/components/ui/StaffSelect";
import { formatDate, today } from "@/lib/utils";
import { useRouter } from "next/navigation";
import MedicalEditModal from "@/components/medical/MedicalEditModal";
import DateInput from "@/components/ui/DateInput";

export default function MedicalPage() {
  const router = useRouter();
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<MedicalRecord | null>(null);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [medTypes, setMedTypes] = useState([...MEDICAL_TYPES]);
  const perPage = 15;

  // Add form
  const [animalSearch, setAnimalSearch] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [medType, setMedType] = useState(medTypes[0]);
  const [medDesc, setMedDesc] = useState("");
  const [medDate, setMedDate] = useState(today());
  const [medVet, setMedVet] = useState("");
  const [medNextDue, setMedNextDue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([fetchMedical(), fetchAnimals()]);
      setMedical(m);
      setAnimals(a);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(1), [search, filterType]);

  const filtered = useMemo(() => {
    return medical.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (m.animal_name || "").toLowerCase().includes(q) || m.type.toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q);
      const matchType = filterType === "All" || m.type === filterType;
      return matchSearch && matchType;
    });
  }, [medical, search, filterType]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const overdueCount = medical.filter((m) => m.next_due && new Date(m.next_due) < new Date()).length;
  const dueSoonCount = medical.filter((m) => {
    if (!m.next_due) return false;
    const diff = (new Date(m.next_due).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  const animalMatches = animalSearch
    ? animals.filter((a) => a.name.toLowerCase().includes(animalSearch.toLowerCase()) || a.id.toLowerCase().includes(animalSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleSave = async () => {
    if (!selectedAnimal) return;
    setSaving(true);
    try {
      const rec = await createMedical({
        animal_id: selectedAnimal.id,
        animal_name: selectedAnimal.name,
        type: medType,
        description: medDesc,
        date: medDate,
        vet: medVet,
        next_due: medNextDue || undefined,
      });
      setMedical((prev) => [rec, ...prev]);
      setShowAdd(false);
      setSelectedAnimal(null); setAnimalSearch(""); setMedDesc(""); setMedNextDue("");
    } catch { } finally { setSaving(false); }
  };

  return (
    <AppShell title="Medical Records" action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Medical Record</button>}>
      {/* Alerts */}
      {overdueCount > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
          ⚠️ {overdueCount} overdue medical treatment{overdueCount !== 1 ? "s" : ""}
        </div>
      )}
      {dueSoonCount > 0 && (
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
          🔔 {dueSoonCount} treatment{dueSoonCount !== 1 ? "s" : ""} due within 7 days
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search-bar" style={{ flex: "1 1 240px", maxWidth: 300 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search animal, type, description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {["All", ...medTypes].map((t) => (
          <button key={t} onClick={() => setFilterType(t)} className={`btn btn-sm ${filterType === t ? "btn-primary" : "btn-secondary"}`}>{t}</button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTypesModal(true)} style={{ marginLeft: "auto" }}>⚙ Manage Types</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Animal</th><th>Type</th><th>Description</th><th>Date</th><th>Vet / Staff</th><th>Next Due</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="empty-state">Loading…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No medical records</td></tr>
              ) : paged.map((m) => {
                const isOverdue = m.next_due && new Date(m.next_due) < new Date();
                const isDueSoon = m.next_due && !isOverdue && (new Date(m.next_due).getTime() - Date.now()) / 86400000 <= 7;
                return (
                  <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => setEditRecord(m)} className="hover-row">
                    <td onClick={(e) => { e.stopPropagation(); router.push(`/animals/${m.animal_id}`); }}>
                      <span style={{ fontWeight: 700, color: "var(--teal)", textDecoration: "underline" }}>{m.animal_name}</span>
                    </td>
                    <td><span className="badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>{m.type}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      {m.description}
                      {m.updated_at && <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>Updated {formatDate(m.updated_at.slice(0, 10))}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(m.date)}</td>
                    <td style={{ fontSize: 12 }}>{m.vet || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {m.next_due ? (
                        <span style={{ color: isOverdue ? "#dc2626" : isDueSoon ? "#f59e0b" : "var(--text-secondary)", fontWeight: isOverdue || isDueSoon ? 700 : 400 }}>
                          {isOverdue ? "⚠️ " : isDueSoon ? "🔔 " : ""}{formatDate(m.next_due)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 12px" }}>
          <Pagination total={filtered.length} perPage={perPage} current={page} onChange={setPage} />
        </div>
      </div>

      {/* Edit Medical Modal */}
      {editRecord && (
        <MedicalEditModal
          record={editRecord}
          onSave={(updated) => {
            setMedical((prev) => prev.map((m) => m.id === updated.id ? updated : m));
            setEditRecord(null);
          }}
          onDelete={(id) => {
            setMedical((prev) => prev.filter((m) => m.id !== id));
            setEditRecord(null);
          }}
          onClose={() => setEditRecord(null)}
        />
      )}

      {/* Add Medical Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add Medical Record</span><button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Animal *</label>
                <input className="form-input" value={animalSearch} onChange={(e) => setAnimalSearch(e.target.value)} placeholder="Search animal by name or ID…" />
                {animalMatches.length > 0 && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: 7, marginTop: 4, overflow: "hidden" }}>
                    {animalMatches.map((a) => (
                      <div key={a.id} onClick={() => { setSelectedAnimal(a); setAnimalSearch(`${a.name} (${a.id})`); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{a.name}</span> <span style={{ color: "var(--text-secondary)" }}>{a.id} · {a.species} · {a.breed}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="form-select" value={medType} onChange={(e) => { setMedType(e.target.value); setMedDesc(""); }}>
                    {medTypes.map((t) => <option key={t}>{t}</option>)}
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
                  <label className="form-label">Date *</label>
                  <DateInput className="form-input" value={medDate} onChange={(e) => setMedDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Vet / Staff</label>
                  <StaffSelect value={medVet} onChange={setMedVet} placeholder="— None —" />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Due</label>
                  <DateInput className="form-input" value={medNextDue} onChange={(e) => setMedNextDue(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedAnimal}>
                {saving ? "Saving…" : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Types Modal */}
      {showTypesModal && (
        <div className="modal-overlay" onClick={() => setShowTypesModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">Manage Medical Types</span><button className="btn btn-ghost btn-sm" onClick={() => setShowTypesModal(false)}>✕</button></div>
            <div className="modal-body">
              {medTypes.map((t, i) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{t}</span>
                  {medTypes.length > 1 && (
                    <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => setMedTypes((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                  )}
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <input className="form-input" placeholder="New type name…" id="newMedType" style={{ marginBottom: 6 }} />
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const inp = document.getElementById("newMedType") as HTMLInputElement;
                  if (inp?.value.trim()) { setMedTypes((prev) => [...prev, inp.value.trim()]); inp.value = ""; }
                }}>Add Type</button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowTypesModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
