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
import { formatDate, displayAge, isImported, IN_SHELTER_STATUSES } from "@/lib/utils";

type Tab = "current" | "all" | "historical";

const TAB_LABELS: Record<Tab, string> = {
  current: "Current Animals",
  all: "All Animals",
  historical: "Archived / Historical",
};

export default function AnimalsPage() {
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("current");
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
  useEffect(() => { setPage(1); }, [search, filterSpecies, filterStatus, tab]);

  // Tab-level pre-filter
  const tabFiltered = useMemo(() => {
    switch (tab) {
      case "current":
        return animals.filter((a) => !isImported(a) && IN_SHELTER_STATUSES.includes(a.status));
      case "historical":
        return animals.filter((a) => isImported(a));
      default:
        return animals;
    }
  }, [animals, tab]);

  const filtered = useMemo(() => {
    return tabFiltered.filter((a) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || (a.name || "").toLowerCase().includes(q)
        || a.id.toLowerCase().includes(q)
        || (a.breed || "").toLowerCase().includes(q)
        || (a.microchip || "").toLowerCase().includes(q);
      const matchSpecies = filterSpecies === "All" || a.species === filterSpecies;
      const matchStatus = filterStatus === "All" || a.status === filterStatus;
      return matchSearch && matchSpecies && matchStatus;
    });
  }, [tabFiltered, search, filterSpecies, filterStatus]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const counts = useMemo(() => ({
    current: animals.filter((a) => !isImported(a) && IN_SHELTER_STATUSES.includes(a.status)).length,
    all: animals.length,
    historical: animals.filter((a) => isImported(a)).length,
  }), [animals]);

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
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid var(--border)" }}>
        {(["current", "all", "historical"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setFilterStatus("All"); setFilterSpecies("All"); setSearch(""); }}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 500,
              border: "none",
              borderBottom: tab === t ? "2px solid var(--teal)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              color: tab === t ? "var(--teal)" : "var(--text-secondary)",
              marginBottom: -2,
              transition: "color 0.15s",
            }}
          >
            {TAB_LABELS[t]}
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, background: tab === t ? "#f0fdfa" : "#f1f5f9", color: tab === t ? "var(--teal)" : "var(--text-muted)", borderRadius: 10, padding: "1px 6px" }}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {/* Historical banner */}
      {tab === "historical" && (
        <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
          📦 Showing historical records imported from ShelterBuddy. These animals are excluded from active kennel views and dashboard counts but are fully searchable for history and repeat-offender tracking.
        </div>
      )}

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
                  <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                    {a.id}
                    {isImported(a) && (
                      <span style={{ marginLeft: 4, fontSize: 9, background: "#fef3c7", color: "#92400e", borderRadius: 3, padding: "0 4px", fontFamily: "system-ui", verticalAlign: "middle" }}>
                        SB
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{a.name}</td>
                  <td>{a.species}</td>
                  <td style={{ fontSize: 12 }}>{a.breed}</td>
                  <td style={{ fontSize: 12 }}>{a.sex}</td>
                  <td style={{ fontSize: 12 }}>{displayAge(a.age)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
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
