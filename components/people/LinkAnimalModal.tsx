"use client";
import { useState, useEffect, useCallback } from "react";
import type { Animal } from "@/lib/types";
import { ANIMAL_PERSON_ROLES } from "@/lib/types";
import { searchAnimals, linkAnimalToPerson, findDuplicateAnimalByMicrochip } from "@/lib/data";

interface Props {
  personId: string;
  personName: string;
  onLinked: (link: { animal: Animal; role: string }) => void;
  onClose: () => void;
}

export default function LinkAnimalModal({ personId, personName, onLinked, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Animal[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [role, setRole] = useState<string>("Owner");
  const [newChip, setNewChip] = useState("");
  const [dupWarning, setDupWarning] = useState<Animal | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setMatches([]); return; }
    const t = setTimeout(() => { searchAnimals(search).then(setMatches); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const checkChipDuplicate = useCallback(async (): Promise<boolean> => {
    if (!newChip.trim()) return true;
    const dup = await findDuplicateAnimalByMicrochip(newChip);
    if (dup) { setDupWarning(dup); return false; }
    return true;
  }, [newChip]);

  const handleLinkExisting = async () => {
    if (!selectedAnimal) return;
    setSaving(true);
    try {
      await linkAnimalToPerson(selectedAnimal.id, personId, role);
      onLinked({ animal: selectedAnimal, role });
    } finally { setSaving(false); }
  };

  // Note: full new-animal creation belongs in the Intake Wizard. Here we only
  // support linking to an *existing* animal record, since creating a full
  // animal record requires the multi-step intake flow (kennel, behavior, etc).
  // Duplicate check on chip is still offered as a quick safety net before
  // staff are redirected to start an intake.

  const useDuplicate = async () => {
    if (!dupWarning) return;
    setSaving(true);
    try {
      await linkAnimalToPerson(dupWarning.id, personId, role);
      onLinked({ animal: dupWarning, role });
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">+ Link Animal — {personName}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {dupWarning ? (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>⚠️ Possible Duplicate</div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                An animal with this microchip already exists: <strong>{dupWarning.name}</strong> ({dupWarning.id})
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={useDuplicate} disabled={saving}>Link This Animal Instead</button>
                <a href={`/animals/${dupWarning.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View Existing Record</a>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Role / Relationship</label>
                <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ANIMAL_PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Search Existing Animal</label>
                <input className="form-input" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedAnimal(null); }} placeholder="Name, ID, or microchip…" />
              </div>
              {matches.length > 0 && !selectedAnimal && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10, maxHeight: 220, overflow: "auto" }}>
                  {matches.map((a) => (
                    <div key={a.id} onClick={() => { setSelectedAnimal(a); setSearch(a.name); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                      <span><strong>{a.name}</strong> <span style={{ color: "var(--text-muted)" }}>· {a.species} · {a.breed || "—"}</span></span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{a.id}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedAnimal && (
                <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>
                  Selected: <strong>{selectedAnimal.name}</strong> ({selectedAnimal.id})
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border)", marginTop: 14, paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  Don&rsquo;t see the animal? Check a microchip number for duplicates before starting a new intake:
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="form-input" value={newChip} onChange={(e) => setNewChip(e.target.value)} placeholder="Microchip number" style={{ flex: 1 }} />
                  <button className="btn btn-secondary btn-sm" onClick={checkChipDuplicate} disabled={!newChip.trim()}>Check</button>
                </div>
                <a href="/animals?intake=1" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--teal)", marginTop: 6, display: "inline-block" }}>
                  → Start a new intake for this animal
                </a>
              </div>
            </>
          )}
        </div>
        {!dupWarning && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleLinkExisting} disabled={saving || !selectedAnimal}>
              {saving ? "Linking…" : "Link Animal"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
