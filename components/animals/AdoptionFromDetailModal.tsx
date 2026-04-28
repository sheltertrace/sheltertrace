"use client";
import { useState, useMemo } from "react";
import type { Animal, Person } from "@/lib/types";
import { createAdoption, createPerson, updateAnimal } from "@/lib/data";
import { today, genReceiptId } from "@/lib/utils";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

interface Props {
  animal: Animal;
  people: Person[];
  onSuccess: (updated: Animal) => void;
  onClose: () => void;
}

export default function AdoptionFromDetailModal({ animal, people, onSuccess, onClose }: Props) {
  const [adopterSearch, setAdopterSearch] = useState("");
  const [selectedAdopter, setSelectedAdopter] = useState<Person | null>(null);
  const [adoptionDate, setAdoptionDate] = useState(today());
  const [adoptionNotes, setAdoptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // New adopter inline creation
  const [showNewAdopter, setShowNewAdopter] = useState(false);
  const [naFirst, setNaFirst] = useState("");
  const [naLast, setNaLast] = useState("");
  const [naPhone, setNaPhone] = useState("");
  const [naEmail, setNaEmail] = useState("");
  const [naAddress, setNaAddress] = useState("");
  const [naCity, setNaCity] = useState("");
  const [creatingAdopter, setCreatingAdopter] = useState(false);

  const matches = useMemo(() => {
    if (!adopterSearch.trim()) return [];
    const q = adopterSearch.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q)).slice(0, 8);
  }, [people, adopterSearch]);

  const handleCreateAdopter = async () => {
    if (!naFirst.trim() || !naLast.trim()) return;
    setCreatingAdopter(true);
    try {
      const p = await createPerson({ first_name: naFirst.trim(), last_name: naLast.trim(), role: "Adopter", phone: naPhone, email: naEmail, address: naAddress, city: naCity, date_added: today() });
      setSelectedAdopter(p);
      setAdopterSearch(`${p.first_name} ${p.last_name}`);
      setShowNewAdopter(false);
      setNaFirst(""); setNaLast(""); setNaPhone(""); setNaEmail(""); setNaAddress(""); setNaCity("");
    } finally { setCreatingAdopter(false); }
  };

  const handleProcess = async () => {
    if (!selectedAdopter) return;
    setSaving(true);
    try {
      const receiptId = genReceiptId();
      await createAdoption({
        animal_id: animal.id,
        animal_name: animal.name,
        adopter_id: selectedAdopter.id,
        adopter_name: `${selectedAdopter.first_name} ${selectedAdopter.last_name}`,
        adoption_date: adoptionDate,
        notes: adoptionNotes,
        receipt_id: receiptId,
      });
      const updated = await updateAnimal(animal.id, { status: "Adopted", kennel: undefined });
      onSuccess(updated);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Adoption failed: ${err?.message || "Unknown error"}`);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🏡 Process Adoption — {animal.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Animal summary */}
          <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, display: "flex", gap: 20 }}>
            <div><b>Animal:</b> {animal.name}</div>
            <div><b>ID:</b> <span style={{ fontFamily: "monospace" }}>{animal.id}</span></div>
            <div><b>Species:</b> {animal.species}</div>
            <div><b>Breed:</b> {animal.breed}</div>
          </div>

          {/* Adopter search */}
          <F label="Adopter *">
            <div style={{ position: "relative" }}>
              <input
                className="form-input"
                placeholder="Search by name or phone…"
                value={adopterSearch}
                onChange={(e) => { setAdopterSearch(e.target.value); setSelectedAdopter(null); }}
              />
              {matches.length > 0 && !selectedAdopter && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
                  {matches.map((p) => (
                    <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
                      onClick={() => { setSelectedAdopter(p); setAdopterSearch(`${p.first_name} ${p.last_name}`); }}>
                      <span style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</span>
                      <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone || ""}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.pid}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </F>

          {selectedAdopter && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 4 }}>
              ✓ <b>{selectedAdopter.first_name} {selectedAdopter.last_name}</b> · {selectedAdopter.phone || "no phone"} · {selectedAdopter.pid}
            </div>
          )}

          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16, fontSize: 12 }} onClick={() => setShowNewAdopter(!showNewAdopter)}>
            {showNewAdopter ? "▲ Cancel new adopter" : "＋ Create new adopter"}
          </button>

          {showNewAdopter && (
            <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>New Adopter</div>
              <div className="grid-2">
                <F label="First Name *"><input className="form-input" value={naFirst} onChange={(e) => setNaFirst(e.target.value)} /></F>
                <F label="Last Name *"><input className="form-input" value={naLast} onChange={(e) => setNaLast(e.target.value)} /></F>
                <F label="Phone"><input className="form-input" value={naPhone} onChange={(e) => setNaPhone(e.target.value)} /></F>
                <F label="Email"><input className="form-input" value={naEmail} onChange={(e) => setNaEmail(e.target.value)} /></F>
                <F label="Address"><input className="form-input" value={naAddress} onChange={(e) => setNaAddress(e.target.value)} /></F>
                <F label="City"><input className="form-input" value={naCity} onChange={(e) => setNaCity(e.target.value)} /></F>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleCreateAdopter} disabled={creatingAdopter || !naFirst.trim() || !naLast.trim()}>
                {creatingAdopter ? "Creating…" : "Create & Select"}
              </button>
            </div>
          )}

          <div className="grid-2">
            <F label="Adoption Date *"><input className="form-input" type="date" value={adoptionDate} onChange={(e) => setAdoptionDate(e.target.value)} /></F>
          </div>
          <F label="Notes"><textarea className="form-textarea" value={adoptionNotes} onChange={(e) => setAdoptionNotes(e.target.value)} rows={2} placeholder="Any adoption notes…" /></F>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ background: "#16a34a", borderColor: "#16a34a" }}
            onClick={handleProcess}
            disabled={saving || !selectedAdopter || !adoptionDate}
          >
            {saving ? "Processing…" : "✓ Complete Adoption"}
          </button>
        </div>
      </div>
    </div>
  );
}
