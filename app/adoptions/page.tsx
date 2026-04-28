"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import { fetchAnimals, fetchPeople, fetchAdoptions, createAdoption, createPerson, updateAnimal } from "@/lib/data";
import type { Animal, Person, AdoptionRecord } from "@/lib/types";
import ReturnAnimalModal from "@/components/animals/ReturnAnimalModal";
import PhotoIdThumb from "@/components/ui/PhotoIdThumb";
import { formatDate, today, genId, genReceiptId } from "@/lib/utils";

export default function AdoptionsPage() {
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [adoptions, setAdoptions] = useState<AdoptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"available" | "pending" | "adopted" | "records">("available");
  const [search, setSearch] = useState("");
  const [showProcess, setShowProcess] = useState(false);
  const [step, setStep] = useState(1);

  // Process adoption form
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [adopterSearch, setAdopterSearch] = useState("");
  const [selectedAdopter, setSelectedAdopter] = useState<Person | null>(null);
  const [adoptionDate, setAdoptionDate] = useState(today());
  const [adoptionNotes, setAdoptionNotes] = useState("");
  const [showNewAdopter, setShowNewAdopter] = useState(false);
  const [naFirst, setNaFirst] = useState("");
  const [naMid, setNaMid] = useState("");
  const [naLast, setNaLast] = useState("");
  const [naPhone, setNaPhone] = useState("");
  const [naEmail, setNaEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{ animal: Animal; adopterName: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, p, ad] = await Promise.all([fetchAnimals(), fetchPeople(), fetchAdoptions()]);
      setAnimals(a);
      setPeople(p);
      setAdoptions(ad);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const available = useMemo(() => animals.filter((a) => a.status === "Available"), [animals]);
  const pending = useMemo(() => animals.filter((a) => a.status === "Pending"), [animals]);
  const adopted = useMemo(() => animals.filter((a) => a.status === "Adopted"), [animals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = tab === "available" ? available : tab === "pending" ? pending : tab === "adopted" ? adopted : [];
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q) || a.species.toLowerCase().includes(q));
  }, [tab, available, pending, adopted, search]);

  const adopterMatches = adopterSearch
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(adopterSearch.toLowerCase())).slice(0, 8)
    : [];

  const handleCreateAdopter = async () => {
    if (!naFirst.trim() || !naLast.trim()) return;
    const p = await createPerson({ first_name: naFirst.trim(), middle_name: naMid.trim() || undefined, last_name: naLast.trim(), role: "Adopter", phone: naPhone, email: naEmail, date_added: today() });
    setPeople((prev) => [...prev, p]);
    setSelectedAdopter(p);
    setAdopterSearch(`${p.first_name} ${p.last_name}`);
    setShowNewAdopter(false);
    setNaFirst(""); setNaMid(""); setNaLast(""); setNaPhone(""); setNaEmail("");
  };

  const handleProcessAdoption = async () => {
    if (!selectedAnimalId || !selectedAdopter) return;
    setSaving(true);
    try {
      const animal = animals.find((a) => a.id === selectedAnimalId);
      if (!animal) return;
      const receiptId = genReceiptId();
      const rec = await createAdoption({
        animal_id: selectedAnimalId,
        animal_name: animal.name,
        adopter_id: selectedAdopter.id,
        adopter_name: `${selectedAdopter.first_name} ${selectedAdopter.last_name}`,
        adoption_date: adoptionDate,
        notes: adoptionNotes,
        receipt_id: receiptId,
      });
      await updateAnimal(selectedAnimalId, { status: "Adopted" });
      setAnimals((prev) => prev.map((a) => a.id === selectedAnimalId ? { ...a, status: "Adopted" } : a));
      setAdoptions((prev) => [rec, ...prev]);
      setShowProcess(false);
      setStep(1);
      setSelectedAnimalId(""); setSelectedAdopter(null); setAdopterSearch(""); setAdoptionNotes("");
      setTab("records");
    } catch { } finally { setSaving(false); }
  };

  const thisMonthAdopted = useMemo(() => {
    const now = new Date();
    return adoptions.filter((a) => {
      if (!a.adoption_date) return false;
      const d = new Date(a.adoption_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [adoptions]);

  return (
    <AppShell title="Adoptions" action={<button className="btn btn-primary" onClick={() => { setShowProcess(true); setStep(1); }}>+ Process Adoption</button>}>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "Available", value: available.length, color: "#22c55e", icon: "🐾" },
          { label: "Pending", value: pending.length, color: "#a855f7", icon: "⏳" },
          { label: "Adopted This Month", value: thisMonthAdopted, color: "#6366f1", icon: "🏡" },
          { label: "Total Adoptions", value: adoptions.length, color: "#0ea5e9", icon: "📊" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { key: "available", label: `Available (${available.length})` },
          { key: "pending", label: `Pending (${pending.length})` },
          { key: "adopted", label: `Adopted (${adopted.length})` },
          { key: "records", label: `Records (${adoptions.length})` },
        ].map(({ key, label }) => (
          <div key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as typeof tab)}>{label}</div>
        ))}
      </div>

      {tab !== "records" && (
        <div style={{ marginBottom: 10 }}>
          <input className="form-input" style={{ maxWidth: 300 }} placeholder="Search animals…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      )}

      {tab !== "records" ? (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th></th><th>Name</th><th>Species</th><th>Breed</th><th>Age</th><th>Sex</th><th>Status</th><th>Kennel</th><th>Days</th>{tab === "adopted" && <th></th>}</tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={tab === "adopted" ? 10 : 9} className="empty-state">No animals in this category</td></tr>
              ) : filtered.map((a) => {
                const days = Math.round((Date.now() - new Date(a.intake_date).getTime()) / 86400000);
                const adoptionRec = adoptions.find((r) => r.animal_id === a.id);
                return (
                  <tr key={a.id} onClick={() => router.push(`/animals/${a.id}`)}>
                    <td style={{ width: 36, padding: "4px 8px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                        {a.species === "Dog" ? "🐕" : "🐈"}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{a.name}</td>
                    <td>{a.species}</td>
                    <td style={{ fontSize: 12 }}>{a.breed}</td>
                    <td style={{ fontSize: 12 }}>{a.age || "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.sex}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                    <td style={{ fontSize: 12 }}>{days}d</td>
                    {tab === "adopted" && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-sm"
                          style={{ background: "#f59e0b", color: "#fff", borderColor: "#f59e0b", fontSize: 11 }}
                          onClick={() => setReturnTarget({ animal: a, adopterName: adoptionRec?.adopter_name || "" })}
                        >↩ Return</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Animal</th><th>Adopter</th><th>Date</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {adoptions.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No adoption records</td></tr>
              ) : adoptions.map((r) => {
                const animalObj = animals.find((a) => a.id === r.animal_id);
                const isStillAdopted = animalObj?.status === "Adopted";
                return (
                <tr key={r.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.id}</td>
                  <td style={{ fontWeight: 600, cursor: "pointer", color: "var(--teal)" }} onClick={() => router.push(`/animals/${r.animal_id}`)}>{r.animal_name}</td>
                  <td style={{ cursor: "pointer", color: "var(--teal)" }} onClick={() => r.adopter_id && router.push(`/people/${r.adopter_id}`)}>{r.adopter_name}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(r.adoption_date)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.notes || "—"}</td>
                  <td>
                    {isStillAdopted && animalObj && (
                      <button
                        className="btn btn-sm"
                        style={{ background: "#f59e0b", color: "#fff", borderColor: "#f59e0b", fontSize: 11 }}
                        onClick={() => setReturnTarget({ animal: animalObj, adopterName: r.adopter_name || "" })}
                      >↩ Return</button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Return Animal Modal */}
      {returnTarget && (
        <ReturnAnimalModal
          animal={returnTarget.animal}
          adopterName={returnTarget.adopterName}
          onSuccess={(updated) => {
            setAnimals((prev) => prev.map((a) => a.id === updated.id ? updated : a));
            setReturnTarget(null);
          }}
          onClose={() => setReturnTarget(null)}
        />
      )}

      {/* Process Adoption Modal */}
      {showProcess && (
        <div className="modal-overlay" onClick={() => setShowProcess(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Process Adoption — Step {step} of 3</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProcess(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Step 1: Select Animal */}
              {step === 1 && (
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Select Animal</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                    {available.map((a) => (
                      <div key={a.id} onClick={() => setSelectedAnimalId(a.id)} style={{ border: `2px solid ${selectedAnimalId === a.id ? "var(--teal)" : "var(--border)"}`, borderRadius: 10, padding: 12, cursor: "pointer", background: selectedAnimalId === a.id ? "#f0fdfa" : "#fff", transition: "all 0.15s" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{a.species === "Dog" ? "🐕" : "🐈"}</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.breed} · {a.sex}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.kennel || "Unassigned"}</div>
                      </div>
                    ))}
                  </div>
                  {available.length === 0 && <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0" }}>No available animals</div>}
                </div>
              )}

              {/* Step 2: Select Adopter */}
              {step === 2 && (
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Select Adopter</h3>
                  <input className="form-input" value={adopterSearch} onChange={(e) => setAdopterSearch(e.target.value)} placeholder="Search contacts by name…" style={{ marginBottom: 8 }} />
                  {adopterMatches.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 7, marginBottom: 10, overflow: "hidden" }}>
                      {adopterMatches.map((p) => (
                        <div key={p.id} onClick={() => { setSelectedAdopter(p); setAdopterSearch(`${p.first_name} ${p.last_name}`); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13, background: selectedAdopter?.id === p.id ? "#f0fdfa" : "#fff", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                            <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.role} · {p.phone || "No phone"}</span>
                          </div>
                          {p.photo_id_url && <PhotoIdThumb url={p.photo_id_url} name={`${p.first_name} ${p.last_name}`} size={32} />}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedAdopter?.photo_id_url && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, marginBottom: 10, fontSize: 13 }}>
                      <PhotoIdThumb url={selectedAdopter.photo_id_url} name={`${selectedAdopter.first_name} ${selectedAdopter.last_name}`} size={44} />
                      <div>
                        <div style={{ fontWeight: 600, color: "#1d4ed8" }}>Photo ID on file</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Click thumbnail to view</div>
                      </div>
                    </div>
                  )}
                  {!showNewAdopter ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowNewAdopter(true)}>+ New Adopter</button>
                  ) : (
                    <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                      <div className="grid-2">
                        <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={naFirst} onChange={(e) => setNaFirst(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Middle Name</label><input className="form-input" value={naMid} onChange={(e) => setNaMid(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={naLast} onChange={(e) => setNaLast(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={naPhone} onChange={(e) => setNaPhone(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={naEmail} onChange={(e) => setNaEmail(e.target.value)} /></div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={handleCreateAdopter}>Save</button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Confirm */}
              {step === 3 && (
                <div>
                  <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Confirm Adoption</h3>
                  <div style={{ background: "#f0fdfa", border: "1px solid #86efac", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                    <div className="grid-2" style={{ fontSize: 13 }}>
                      <div><span style={{ color: "var(--text-secondary)" }}>Animal:</span> <strong>{animals.find((a) => a.id === selectedAnimalId)?.name}</strong></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div><span style={{ color: "var(--text-secondary)" }}>Adopter:</span> <strong>{selectedAdopter?.first_name} {selectedAdopter?.last_name}</strong></div>
                        {selectedAdopter?.photo_id_url && <PhotoIdThumb url={selectedAdopter.photo_id_url} name={`${selectedAdopter.first_name} ${selectedAdopter.last_name}`} size={28} />}
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Adoption Date</label>
                    <input className="form-input" type="date" value={adoptionDate} onChange={(e) => setAdoptionDate(e.target.value)} style={{ maxWidth: 200 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" value={adoptionNotes} onChange={(e) => setAdoptionNotes(e.target.value)} rows={2} placeholder="Additional notes…" />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { if (step > 1) setStep(step - 1); else setShowProcess(false); }}>
                {step > 1 ? "← Back" : "Cancel"}
              </button>
              {step < 3 ? (
                <button className="btn btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !selectedAnimalId || step === 2 && !selectedAdopter}>
                  Next →
                </button>
              ) : (
                <button className="btn btn-primary" onClick={handleProcessAdoption} disabled={saving || !selectedAnimalId || !selectedAdopter}>
                  {saving ? "Processing…" : "✓ Complete Adoption"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
