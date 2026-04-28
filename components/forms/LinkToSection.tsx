"use client";
import { useState, useEffect, useMemo } from "react";
import { fetchCalls, fetchAnimals, fetchPeople } from "@/lib/data";
import type { DispatchCall, Animal, Person } from "@/lib/types";

export interface LinkIds {
  call_id?: string;
  animal_id?: string;
  person_id?: string;
}

interface Props {
  value: LinkIds;
  onChange: (ids: LinkIds) => void;
  /** Hide link types already handled by the form's own search UI */
  exclude?: Array<"call" | "animal" | "person">;
}

function SearchRow<T>({
  label,
  icon,
  selected,
  onClear,
  query,
  setQuery,
  results,
  renderResult,
  onSelect,
  placeholder,
}: {
  label: string;
  icon: string;
  selected: string;
  onClear: () => void;
  query: string;
  setQuery: (q: string) => void;
  results: T[];
  renderResult: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
        {icon} {label}
      </div>
      {selected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 12 }}>
          <span style={{ flex: 1 }}>{selected}</span>
          <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "var(--surface)", color: "var(--text-primary)", width: "100%" }}
            placeholder={placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
          />
          {open && results.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 200, overflowY: "auto" }}>
              {results.map((item, i) => (
                <div key={i} onMouseDown={() => { onSelect(item); setQuery(""); setOpen(false); }}
                  style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12, borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                  {renderResult(item)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LinkToSection({ value, onChange, exclude = [] }: Props) {
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [callQ, setCallQ] = useState("");
  const [animalQ, setAnimalQ] = useState("");
  const [personQ, setPersonQ] = useState("");

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    const loads: Promise<void>[] = [];
    if (!exclude.includes("call")) loads.push(fetchCalls().then(setCalls));
    if (!exclude.includes("animal")) loads.push(fetchAnimals().then(setAnimals));
    if (!exclude.includes("person")) loads.push(fetchPeople().then(setPeople));
    Promise.all(loads).catch(() => {});
  }, [loaded, exclude]);

  const filteredCalls = useMemo(() => {
    if (!callQ.trim()) return [];
    const q = callQ.toLowerCase();
    return calls.filter((c) =>
      c.id.toLowerCase().includes(q) ||
      (c.type || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [calls, callQ]);

  const filteredAnimals = useMemo(() => {
    if (!animalQ.trim()) return [];
    const q = animalQ.toLowerCase();
    return animals.filter((a) =>
      a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [animals, animalQ]);

  const filteredPeople = useMemo(() => {
    if (!personQ.trim()) return [];
    const q = personQ.toLowerCase();
    return people.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.phone || "").includes(q) ||
      (p.pid || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [people, personQ]);

  const selectedCall = value.call_id ? calls.find((c) => c.id === value.call_id) : null;
  const selectedAnimal = value.animal_id ? animals.find((a) => a.id === value.animal_id) : null;
  const selectedPerson = value.person_id ? people.find((p) => p.id === value.person_id) : null;

  const showCall = !exclude.includes("call");
  const showAnimal = !exclude.includes("animal");
  const showPerson = !exclude.includes("person");

  if (!showCall && !showAnimal && !showPerson) return null;

  return (
    <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        🔗 Link To Record
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${[showCall, showAnimal, showPerson].filter(Boolean).length}, 1fr)`, gap: 12 }}>
        {showCall && (
          <SearchRow<DispatchCall>
            label="Dispatch Call"
            icon="📡"
            selected={selectedCall ? `Call #${selectedCall.id.slice(-4)} — ${selectedCall.type} · ${selectedCall.address || ""}` : ""}
            onClear={() => onChange({ ...value, call_id: undefined })}
            query={callQ}
            setQuery={setCallQ}
            results={filteredCalls}
            placeholder="Search calls by type or address…"
            renderResult={(c) => (
              <span><strong>#{c.id.slice(-4)}</strong> — {c.type} <span style={{ color: "var(--text-secondary)" }}>· {c.address || ""} · {c.date_reported || ""}</span></span>
            )}
            onSelect={(c) => onChange({ ...value, call_id: c.id })}
          />
        )}
        {showAnimal && (
          <SearchRow<Animal>
            label="Animal"
            icon="🐾"
            selected={selectedAnimal ? `${selectedAnimal.name} (${selectedAnimal.id})` : ""}
            onClear={() => onChange({ ...value, animal_id: undefined })}
            query={animalQ}
            setQuery={setAnimalQ}
            results={filteredAnimals}
            placeholder="Search animals by name or ID…"
            renderResult={(a) => (
              <span><strong>{a.name}</strong> <span style={{ color: "var(--text-secondary)" }}>· {a.species} {a.breed} · {a.id}</span></span>
            )}
            onSelect={(a) => onChange({ ...value, animal_id: a.id })}
          />
        )}
        {showPerson && (
          <SearchRow<Person>
            label="Person / Contact"
            icon="👤"
            selected={selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name} (${selectedPerson.pid})` : ""}
            onClear={() => onChange({ ...value, person_id: undefined })}
            query={personQ}
            setQuery={setPersonQ}
            results={filteredPeople}
            placeholder="Search contacts by name or PID…"
            renderResult={(p) => (
              <span><strong>{p.first_name} {p.last_name}</strong> <span style={{ color: "var(--text-secondary)" }}>· {p.phone || ""} · {p.pid}</span></span>
            )}
            onSelect={(p) => onChange({ ...value, person_id: p.id })}
          />
        )}
      </div>
    </div>
  );
}
