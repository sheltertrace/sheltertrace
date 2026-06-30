"use client";
import { useState, useMemo } from "react";
import type { Person } from "@/lib/types";
import { ANIMAL_PERSON_ROLES } from "@/lib/types";
import { createPerson, linkAnimalToPerson, findDuplicatePerson } from "@/lib/data";

interface Props {
  animalId: string;
  animalName: string;
  people: Person[];
  existingPersonIds: string[];
  onLinked: (link: { person: Person; role: string }) => void;
  onClose: () => void;
}

export default function LinkPersonModal({ animalId, animalName, people, existingPersonIds, onLinked, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [role, setRole] = useState<string>("Owner");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [dupWarning, setDupWarning] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return people
      .filter((p) => !existingPersonIds.includes(p.id))
      .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q) || (p.email || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, people, existingPersonIds]);

  const handleCheckDuplicate = async () => {
    const dup = await findDuplicatePerson(newPhone, newEmail);
    if (dup) { setDupWarning(dup); return false; }
    return true;
  };

  const handleLinkExisting = async () => {
    if (!selectedPerson) return;
    setSaving(true);
    try {
      await linkAnimalToPerson(animalId, selectedPerson.id, role);
      onLinked({ person: selectedPerson, role });
    } finally { setSaving(false); }
  };

  const handleCreateAndLink = async () => {
    if (!newFirst.trim() || !newLast.trim()) return;
    setSaving(true);
    try {
      const ok = await handleCheckDuplicate();
      if (!ok) { setSaving(false); return; }
      const person = await createPerson({
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        role: "Owner",
      } as Partial<Person>);
      await linkAnimalToPerson(animalId, person.id, role);
      onLinked({ person, role });
    } finally { setSaving(false); }
  };

  const useDuplicate = async () => {
    if (!dupWarning) return;
    setSaving(true);
    try {
      await linkAnimalToPerson(animalId, dupWarning.id, role);
      onLinked({ person: dupWarning, role });
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">+ Link Person — {animalName}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {dupWarning ? (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>⚠️ Possible Duplicate</div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>
                A person with this phone or email already exists: <strong>{dupWarning.first_name} {dupWarning.last_name}</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={useDuplicate} disabled={saving}>Use Existing</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDupWarning(null)}>Create New Anyway</button>
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

              {!creatingNew ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Search Existing Person</label>
                    <input className="form-input" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedPerson(null); }} placeholder="Name, phone, or email…" />
                  </div>
                  {matches.length > 0 && !selectedPerson && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 10, maxHeight: 200, overflow: "auto" }}>
                      {matches.map((p) => (
                        <div key={p.id} onClick={() => { setSelectedPerson(p); setSearch(`${p.first_name} ${p.last_name}`); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                          <strong>{p.first_name} {p.last_name}</strong>
                          {p.phone && <span style={{ color: "var(--text-muted)" }}> · {p.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPerson && (
                    <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>
                      Selected: <strong>{selectedPerson.first_name} {selectedPerson.last_name}</strong>
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setCreatingNew(true)}>+ Create New Person Instead</button>
                </>
              ) : (
                <div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={newLast} onChange={(e) => setNewLast(e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCreatingNew(false)}>← Search Existing Instead</button>
                </div>
              )}
            </>
          )}
        </div>
        {!dupWarning && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            {creatingNew ? (
              <button className="btn btn-primary" onClick={handleCreateAndLink} disabled={saving || !newFirst.trim() || !newLast.trim()}>
                {saving ? "Saving…" : "Create & Link"}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleLinkExisting} disabled={saving || !selectedPerson}>
                {saving ? "Linking…" : "Link Person"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
