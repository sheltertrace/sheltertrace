"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { searchMedications, type Medication } from "@/lib/medicationData";

interface Props {
  value: string;
  onChange: (name: string, med?: Medication) => void;
  species?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function MedicationSearch({ value, onChange, species, placeholder, className, disabled }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Medication[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const results = await searchMedications(q, species);
      setSuggestions(results);
      setOpen(results.length > 0);
    } finally { setLoading(false); }
  }, [species]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => search(q), 150);
  };

  const handleFocus = () => {
    if (query.length === 0) search("");
    else if (suggestions.length > 0) setOpen(true);
  };

  const handleSelect = (med: Medication) => {
    setQuery(med.name);
    onChange(med.name, med);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]); }
    if (e.key === "Escape") { setOpen(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isDea = (m: Medication) => m.dea_schedule && m.dea_schedule !== "None";

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        className={className || "form-input"}
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Search medication library…"}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", maxHeight: 280, overflow: "auto", marginTop: 2 }}>
          {loading && <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 12 }}>Searching…</div>}
          {!loading && suggestions.map((med, i) => (
            <div
              key={med.id}
              onMouseDown={() => handleSelect(med)}
              style={{
                padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)",
                background: i === activeIdx ? "#f0fdfa" : "#fff",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  {med.name}
                  {isDea(med) && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 4, padding: "1px 5px" }}>⚠️ DEA {med.dea_schedule}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {[med.category, med.concentration, med.unit ? `per ${med.unit}` : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              {med.species && med.species.length > 0 && !med.species.includes("All") && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{med.species.join(", ")}</div>
              )}
            </div>
          ))}
          {!loading && suggestions.length === 0 && query.length > 0 && (
            <div style={{ padding: "10px 12px", color: "var(--text-muted)", fontSize: 12 }}>
              No matches — will save as custom medication name
            </div>
          )}
        </div>
      )}
    </div>
  );
}
