"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchAnimals, fetchPeople } from "@/lib/data";
import type { Animal, Person } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function FosterPage() {
  const router = useRouter();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"current" | "parents">("current");

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([fetchAnimals(), fetchPeople()]);
      setAnimals(a);
      setPeople(p);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fosterAnimals = useMemo(() => animals.filter((a) => a.status === "Foster"), [animals]);
  const fosterParents = useMemo(() => people.filter((p) => p.role === "Foster Parent"), [people]);

  return (
    <AppShell title="Foster Care">
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: "In Foster Care", value: fosterAnimals.length, color: "#f59e0b", icon: "❤️" },
          { label: "Foster Parents", value: fosterParents.length, color: "#6366f1", icon: "👥" },
          { label: "Kennels Freed", value: fosterAnimals.length, color: "#22c55e", icon: "🏠" },
          { label: "Animals/Parent Ratio", value: fosterParents.length > 0 ? (fosterAnimals.length / fosterParents.length).toFixed(1) : "N/A", color: "#0ea5e9", icon: "📊" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
            <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      <div className="tabs">
        <div className={`tab ${tab === "current" ? "active" : ""}`} onClick={() => setTab("current")}>Currently in Foster ({fosterAnimals.length})</div>
        <div className={`tab ${tab === "parents" ? "active" : ""}`} onClick={() => setTab("parents")}>Foster Parents ({fosterParents.length})</div>
      </div>

      {tab === "current" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Age</th><th>Sex</th><th>Intake Date</th><th>Days in Foster</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="empty-state">Loading…</td></tr>
                : fosterAnimals.length === 0 ? <tr><td colSpan={8} className="empty-state">No animals in foster care</td></tr>
                : fosterAnimals.map((a) => {
                  const days = Math.round((Date.now() - new Date(a.intake_date).getTime()) / 86400000);
                  return (
                    <tr key={a.id} onClick={() => router.push(`/animals/${a.id}`)}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                      <td style={{ fontWeight: 700 }}>{a.name}</td>
                      <td>{a.species}</td>
                      <td style={{ fontSize: 12 }}>{a.breed}</td>
                      <td style={{ fontSize: 12 }}>{a.age || "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.sex}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(a.intake_date)}</td>
                      <td>
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{days}d</span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "parents" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Date Added</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="empty-state">Loading…</td></tr>
                : fosterParents.length === 0 ? <tr><td colSpan={5} className="empty-state">No foster parents registered</td></tr>
                : fosterParents.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/people/${p.id}`)}>
                    <td style={{ fontWeight: 700 }}>{p.first_name} {p.last_name}</td>
                    <td style={{ fontSize: 12 }}>{p.phone || "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.email || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{[p.address, p.city, p.state].filter(Boolean).join(", ") || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(p.date_added)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
