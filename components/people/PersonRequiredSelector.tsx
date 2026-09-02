"use client";
import { useState, useMemo, useEffect } from "react";
import type { Person, AdoptionRecord } from "@/lib/types";
import { fetchAdoptionsByPerson } from "@/lib/data";
import { validateDeparturePerson, departurePersonWarnings } from "@/lib/personValidation";
import PersonCompletionForm from "./PersonCompletionForm";

interface Props {
  people: Person[];
  selected: Person | null;
  onChange: (p: Person | null) => void;
  roleForNew: string; // "Adopter" | "Previous Owner"
  label?: string; // used in button/heading copy, e.g. "Adopter" or "Owner"
}

// Shared "who is this" selector for any workflow that requires a complete
// person record before an animal can leave the shelter (adoption, RTO). Search
// existing contacts, or add a new one; either way, if the selected person is
// missing a required field, drops straight into PersonCompletionForm inline
// so staff never have to leave the flow to fix it.
export default function PersonRequiredSelector({ people, selected, onChange, roleForNew, label = "Person" }: Props) {
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [priorAdoptions, setPriorAdoptions] = useState<AdoptionRecord[]>([]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return people.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.phone || "").includes(query) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.id_number || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [people, query]);

  useEffect(() => {
    if (!selected) { setPriorAdoptions([]); return; }
    fetchAdoptionsByPerson(selected.id).then(setPriorAdoptions).catch(() => {});
  }, [selected]);

  const errors = validateDeparturePerson(selected);
  const warnings = selected ? departurePersonWarnings(selected) : [];

  const handlePersonSaved = (p: Person) => {
    onChange(p);
    setShowNew(false);
    setQuery("");
  };

  if (showNew) {
    return <PersonCompletionForm person={null} roleForNew={roleForNew} onSaved={handlePersonSaved} onCancel={() => setShowNew(false)} />;
  }

  if (selected) {
    const isComplete = errors.length === 0;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: isComplete ? "#f0fdf4" : "#fff7ed", border: `1px solid ${isComplete ? "#86efac" : "#fed7aa"}`, borderRadius: 8, padding: "12px 16px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.first_name} {selected.last_name} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}>{selected.pid}</span></div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{[selected.phone, selected.address, selected.city && selected.state ? `${selected.city}, ${selected.state}` : ""].filter(Boolean).join(" · ") || "No contact info on file"}</div>
            {priorAdoptions.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{priorAdoptions.length} prior adoption{priorAdoptions.length === 1 ? "" : "s"} on file</div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Change</button>
        </div>
        {!isComplete ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>⚠️ This person&apos;s record is missing required information — complete it below to continue:</div>
            <PersonCompletionForm person={selected} roleForNew={roleForNew} onSaved={(p) => onChange(p)} onCancel={() => onChange(null)} />
          </div>
        ) : warnings.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#92400e" }}>ℹ️ {warnings.join(" ")}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="form-group">
        <label className="form-label">Search existing person (name, phone, email, DL#)</label>
        <input className="form-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing…" autoFocus />
      </div>
      {matches.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
          {matches.map((p) => (
            <div key={p.id} onClick={() => onChange(p)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border-light)" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.first_name} {p.last_name} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>{p.pid}</span></div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{[p.phone, p.address].filter(Boolean).join(" · ") || "No contact info"}</div>
            </div>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && matches.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>No matches for &quot;{query}&quot;.</div>
      )}
      <button className="btn btn-secondary" onClick={() => setShowNew(true)}>+ Add New {label}</button>
    </div>
  );
}
