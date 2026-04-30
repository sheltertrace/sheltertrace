"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import IntakeWizard from "@/components/animals/IntakeWizard";
import { fetchAnimals, createAnimal, fetchPeople, createPerson } from "@/lib/data";
import type { Animal, Person } from "@/lib/types";
import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import { formatDate, calcAge } from "@/lib/utils";

export default function AnimalsPage() {
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [showIntake, setShowIntake] = useState(false);
  const perPage = 15;

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([fetchAnimals(), fetchPeople()]);
      setAnimals(a);
      setPeople(p);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => setPage(1), [search, filterSpecies, filterStatus]);

  const filtered = useMemo(() => {
    return animals.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (a.name || "").toLowerCase().includes(q)
        || a.id.toLowerCase().includes(q)
        || (a.breed || "").toLowerCase().includes(q)
        || (a.microchip || "").toLowerCase().includes(q);
      const matchSpecies = filterSpecies === "All" || a.species === filterSpecies;
      const matchStatus = filterStatus === "All" || a.status === filterStatus;
      return matchSearch && matchSpecies && matchStatus;
    });
  }, [animals, search, filterSpecies, filterStatus]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const handleIntakeComplete = async (animalData: Partial<Animal>) => {
    try {
      const created = await createAnimal(animalData);
      setAnimals((prev) => [created, ...prev]);
      setShowIntake(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPerson = async (personData: Partial<Person>): Promise<Person> => {
    const created = await createPerson(personData);
    setPeople((prev) => [...prev, created]);
    return created;
  };

  if (showIntake) {
    return (
      <AppShell title="New Animal Intake">
        <IntakeWizard
          onComplete={handleIntakeComplete}
          onCancel={() => setShowIntake(false)}
          people={people}
          onAddPerson={handleAddPerson}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Animal Records"
      action={
        <button className="btn btn-primary" onClick={() => setShowIntake(true)}>
          + New Intake
        </button>
      }
    >
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div className="search-bar" style={{ flex: "1 1 240px", maxWidth: 300 }}>
          <span className="search-icon">🔍</span>
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="Search name, ID, breed, microchip…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Dog", "Cat"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSpecies(s)}
              className={`btn btn-sm ${filterSpecies === s ? "btn-primary" : "btn-secondary"}`}
            >{s}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {["All", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}
              style={filterStatus === s && s !== "All" ? { background: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] } : {}}
            >{s}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
          {filtered.length} animal{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>ID</th>
                <th>Name</th>
                <th>Species</th>
                <th>Breed</th>
                <th>Sex</th>
                <th>Age</th>
                <th>Status</th>
                <th>Kennel</th>
                <th>Intake Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="empty-state">Loading…</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={10} className="empty-state">No animals match your filters</td></tr>
              ) : paged.map((a) => (
                <tr key={a.id} onClick={() => router.push(`/animals/${a.id}`)}>
                  <td style={{ padding: "4px 8px" }}>
                    {a.photo_url ? (
                      <img src={a.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                        {a.species === "Dog" ? "🐕" : a.species === "Cat" ? "🐈" : "🐾"}
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>{a.id}</td>
                  <td style={{ fontWeight: 700 }}>{a.name}</td>
                  <td>{a.species}</td>
                  <td style={{ fontSize: 12 }}>{a.breed}</td>
                  <td style={{ fontSize: 12 }}>{a.sex}</td>
                  <td style={{ fontSize: 12 }}>{a.dob ? calcAge(a.dob) : a.age || "—"}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontSize: 12 }}>{a.kennel || "Unassigned"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(a.intake_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 12px" }}>
          <Pagination total={filtered.length} perPage={perPage} current={page} onChange={setPage} />
          {filtered.length > 0 && (
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
