"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicAnimals } from "@/lib/clinicData";
import { fetchShelterAnimals } from "@/lib/clinicShelterLink";
import type { ClinicAnimal } from "@/lib/clinicTypes";
import type { Animal } from "@/lib/types";
import { displayAge } from "@/lib/utils";

type AnyAnimal = (ClinicAnimal | Animal) & { _source?: "clinic" | "shelter" };

export default function ClinicAnimalsPage() {
  const { user } = useAuth();
  const { selectedClientId, isShelterMode } = useClinic();
  const [animals, setAnimals] = useState<AnyAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    if (isShelterMode) {
      fetchShelterAnimals().then((a) => setAnimals(a.map((x) => ({ ...x, _source: "shelter" as const })))).finally(() => setLoading(false));
    } else {
      fetchClinicAnimals(user.id, selectedClientId || undefined).then((a) => setAnimals(a.map((x) => ({ ...x, _source: "clinic" as const })))).finally(() => setLoading(false));
    }
  }, [user?.id, selectedClientId, isShelterMode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return animals;
    const q = search.toLowerCase();
    return animals.filter((a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.breed || "").toLowerCase().includes(q) ||
      (a.species || "").toLowerCase().includes(q) ||
      (a.microchip || "").toLowerCase().includes(q) ||
      (a.id || "").toLowerCase().includes(q)
    );
  }, [animals, search]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>
            🐾 {isShelterMode ? "Shelter Animals" : "Animals"}
          </h1>
          {isShelterMode && <div style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Viewing linked shelter animals — medical access</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="form-input" placeholder="Search by name, breed, ID, microchip…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} animal{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>ID</th>
                <th>Species</th>
                <th>Breed</th>
                <th>Sex</th>
                <th>Age</th>
                <th>Status</th>
                {isShelterMode && <th>Kennel</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={isShelterMode ? 9 : 8} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No animals found</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ width: 36 }}>
                    {a.photo_url ? (
                      <img src={a.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 20 }}>{a.species === "Dog" ? "🐕" : a.species === "Cat" ? "🐈" : "🐾"}</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {a.name || "—"}
                    {a._source === "shelter" && <span style={{ marginLeft: 6, fontSize: 9, background: "#dcfce7", color: "#15803d", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>SHELTER</span>}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                  <td style={{ fontSize: 12 }}>{a.species || "—"}</td>
                  <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                  <td style={{ fontSize: 12 }}>{a.sex || "—"}</td>
                  <td style={{ fontSize: 12 }}>{displayAge(a.age) || "—"}</td>
                  <td><span className="badge">{a.status || "—"}</span></td>
                  {isShelterMode && <td style={{ fontSize: 12 }}>{(a as Animal).kennel || "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
