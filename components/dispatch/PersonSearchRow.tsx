"use client";
import { useState, useMemo } from "react";
import type { Person } from "@/lib/types";
import PhotoIdThumb from "@/components/ui/PhotoIdThumb";

export default function PersonSearchRow({ people, selectedId, onSelect, onClear }: {
  people: Person[]; selectedId: string; onSelect: (p: Person) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (q.trim().length < 2) return [];
    const lo = q.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(lo) || (p.phone || "").includes(q)).slice(0, 6);
  }, [people, q]);

  const sel = selectedId ? people.find((p) => p.id === selectedId) : null;
  if (sel) return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        {sel.photo_id_url && <PhotoIdThumb url={sel.photo_id_url} name={`${sel.first_name} ${sel.last_name}`} size={36} />}
        <span>✓ <strong>{sel.first_name} {sel.last_name}</strong> · {sel.phone || "no phone"} · <span style={{ color: "var(--text-muted)" }}>{sel.pid} · {sel.role}</span>
          {sel.photo_id_url && <span style={{ marginLeft: 8, fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>🪪 ID on file</span>}
        </span>
      </div>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onClear}>Change</button>
    </div>
  );
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <input className="form-input" placeholder="Search contacts by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
          {matches.map((p) => (
            <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}
              onClick={() => { onSelect(p); setQ(""); }}>
              <div style={{ flex: 1 }}>
                <strong>{p.first_name} {p.last_name}</strong>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.role} · {p.pid}</span>
              </div>
              {p.photo_id_url && <PhotoIdThumb url={p.photo_id_url} name={`${p.first_name} ${p.last_name}`} size={28} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
