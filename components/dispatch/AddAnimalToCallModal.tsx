"use client";
import { useState, useEffect } from "react";
import type { Animal, DispatchCallAnimal } from "@/lib/types";
import { searchAnimalsForReturnIntake, type AnimalSearchMatch, linkAnimalToCall, updateCallAnimalLink, DuplicateCallAnimalLinkError } from "@/lib/data";
import { CALL_ANIMAL_ROLES } from "@/lib/constants";
import { getCurrentUserName } from "@/lib/auth";

interface Props {
  callId: string;
  callAddress?: string;
  existingLinks: DispatchCallAnimal[];
  onLinked: () => void;
  onClose: () => void;
}

export default function AddAnimalToCallModal({ callId, callAddress, existingLinks, onLinked, onClose }: Props) {
  const [tab, setTab] = useState<"link" | "intake">("link");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimalSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Animal | null>(null);
  const [role, setRole] = useState<string>(CALL_ANIMAL_ROLES[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateLink, setDuplicateLink] = useState<DispatchCallAnimal | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchAnimalsForReturnIntake(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = (a: Animal) => {
    setError("");
    const existing = existingLinks.find((l) => l.animal_id === a.id);
    if (existing) {
      setDuplicateLink(existing);
      setSelected(a);
      setRole(existing.role);
      setNotes(existing.notes || "");
      return;
    }
    setDuplicateLink(null);
    setSelected(a);
    setRole(CALL_ANIMAL_ROLES[0]);
    setNotes("");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      if (duplicateLink) {
        await updateCallAnimalLink(duplicateLink.id, { role, notes: notes.trim() || undefined }, getCurrentUserName());
      } else {
        await linkAnimalToCall({ dispatch_call_id: callId, animal_id: selected.id, role, notes: notes.trim() || undefined, added_by: getCurrentUserName() });
      }
      onLinked();
    } catch (e) {
      if (e instanceof DuplicateCallAnimalLinkError) {
        setError(e.message);
        const existing = existingLinks.find((l) => l.animal_id === selected.id);
        if (existing) setDuplicateLink(existing);
      } else {
        setError(e instanceof Error ? e.message : "Failed to link animal");
      }
    } finally {
      setSaving(false);
    }
  };

  const startFieldIntake = () => {
    const params = new URLSearchParams({
      callId,
      address: callAddress || "",
      officer: getCurrentUserName(),
    });
    window.open(`/officer/field-intake?${params.toString()}`, "_blank");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 560, width: "95vw", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">🐾 Add Animal to Call</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-alt)" }}>
          {[{ key: "link", label: "🔗 Link Existing Animal" }, { key: "intake", label: "📋 Intake New Animal" }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as "link" | "intake")}
              style={{
                flex: 1, padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                color: tab === key ? "var(--teal)" : "var(--text-secondary)",
                borderBottom: tab === key ? "2px solid var(--teal)" : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}

          {tab === "link" && (
            <div>
              {!selected ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Search for an animal</label>
                    <input
                      className="form-input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Name, ID, microchip, rabies tag, or description…"
                      autoFocus
                    />
                  </div>
                  {searching && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Searching…</div>}
                  {results.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                      {results.map(({ animal, matchedOn }) => {
                        const alreadyLinked = existingLinks.some((l) => l.animal_id === animal.id);
                        return (
                          <div
                            key={animal.id}
                            onClick={() => handleSelect(animal)}
                            style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer" }}
                          >
                            {animal.photo_url ? (
                              <img src={animal.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                                {animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾"}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>
                                {animal.name} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--text-secondary)", fontSize: 11 }}>({animal.id})</span>
                                {alreadyLinked && <span style={{ marginLeft: 6, fontSize: 10, background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>Already linked</span>}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{animal.species} · {animal.status} · Matched on: {matchedOn}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {query.trim().length >= 2 && !searching && results.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "14px 0" }}>No animals found matching &quot;{query}&quot;.</div>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", background: "#f0fdfa", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                    {selected.photo_url ? (
                      <img src={selected.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                        {selected.species === "Dog" ? "🐕" : selected.species === "Cat" ? "🐈" : "🐾"}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{selected.name} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--text-secondary)", fontSize: 11 }}>({selected.id})</span></div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selected.species} · {selected.breed} · {selected.status}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setDuplicateLink(null); setError(""); }}>Change</button>
                  </div>

                  {duplicateLink && (
                    <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#92400e", marginBottom: 14 }}>
                      This animal is already linked to this call — editing the existing link below instead of creating a duplicate.
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Role on This Call</label>
                    <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
                      {CALL_ANIMAL_ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional detail about this animal's involvement…" />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "intake" && (
            <div style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Start a new Field Intake for this call</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 18, lineHeight: 1.6 }}>
                Opens the field intake wizard pre-filled with this call&apos;s location and your officer info.
                When the intake is saved, the new animal record is automatically linked back to this call.
              </div>
              <button className="btn btn-primary" onClick={startFieldIntake}>🚀 Start Field Intake</button>
            </div>
          )}
        </div>

        {tab === "link" && selected && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : duplicateLink ? "✓ Update Link" : "✓ Link Animal"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
