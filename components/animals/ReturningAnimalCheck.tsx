"use client";
import { useState, useEffect } from "react";
import type { Animal } from "@/lib/types";
import { searchAnimalsForReturnIntake, type AnimalSearchMatch } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";

interface Props {
  onSelectNew: () => void;
  onSelectReturning: (animal: Animal) => void;
  onCancel: () => void;
}

export default function ReturningAnimalCheck({ onSelectNew, onSelectReturning, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimalSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearched(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      searchAnimalsForReturnIntake(query)
        .then((r) => { setResults(r); setSearched(true); })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>← Cancel</button>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Animal Intake</h2>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--teal)", marginBottom: 8 }}>
          Is this a new animal, or one returning to our care?
        </h3>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Search first so a returning animal keeps its full history in one record instead of creating a duplicate.
        </p>

        <div className="form-group">
          <label className="form-label">Check if this animal has been with us before</label>
          <input
            className="form-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, microchip, rabies tag, shelter tag, description, or previous owner name…"
            autoFocus
          />
        </div>

        {searching && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Searching…</div>}

        {results.length > 0 && (
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {results.map(({ animal, matchedOn }) => (
              <div key={animal.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border-light)" }}>
                {animal.photo_url ? (
                  <img src={animal.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {animal.name} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--text-secondary)", fontSize: 11 }}>({animal.id})</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {animal.species} · {animal.breed} · Last intake {formatDate(animal.intake_date)} · Matched on: {matchedOn}
                  </div>
                </div>
                <StatusBadge status={animal.status} />
                <button className="btn btn-primary btn-sm" onClick={() => onSelectReturning(animal)} style={{ whiteSpace: "nowrap" }}>
                  This is {animal.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {searched && results.length === 0 && !searching && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>No matching animals found.</div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={onSelectNew}>This is a new animal — proceed →</button>
        </div>
      </div>
    </div>
  );
}
