"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { fetchPublicAnimals, safeArray } from "@/lib/data";
import type { Animal } from "@/lib/types";
import { displayAge } from "@/lib/utils";

type SpeciesFilter = "All" | "Dogs" | "Cats" | "Other";
type SortOption = "newest" | "name";

function getStatusBadge(animal: Animal) {
  if (animal.status === "Foster") {
    return { label: "In Foster", color: "#1d4ed8", bg: "#dbeafe" };
  }
  if (animal.sub_status && (animal.sub_status.includes("Spay") || animal.sub_status.includes("Neuter"))) {
    return { label: "Awaiting Spay/Neuter", color: "#92400e", bg: "#fef3c7" };
  }
  return { label: "Available", color: "#166534", bg: "#dcfce7" };
}

function AnimalCard({ animal }: { animal: Animal }) {
  const badge = getStatusBadge(animal);
  const photo = animal.featured_photo_url || animal.photo_url || null;
  const age = displayAge(animal.age);
  const emoji = animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾";

  return (
    <Link href={`/available-animals/${animal.id}`} style={{ textDecoration: "none" }} className="animal-card-link">
      <article className="animal-card">
        <div style={{ position: "relative", height: 240, background: "#f4f6f8", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            <img
              src={photo}
              alt={animal.name}
              loading="lazy"
              style={{ maxWidth: "100%", maxHeight: "100%", width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>
              {emoji}
            </div>
          )}
          <span style={{
            position: "absolute", top: 10, right: 10,
            padding: "4px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: badge.bg, color: badge.color,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}>
            {badge.label}
          </span>
        </div>

        <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f2942", lineHeight: 1.2 }}>{animal.name}</div>
          <div style={{ fontSize: 13, color: "#475569" }}>{animal.species} · {animal.breed || "Mixed Breed"}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>{age} · {animal.sex || "Unknown"}</div>
          <div style={{
            padding: "10px 0", background: "#1a8a8a", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14,
            textAlign: "center", cursor: "pointer",
          }}>
            Meet Me! →
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function AvailableAnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [species, setSpecies] = useState<SpeciesFilter>("All");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPublicAnimals()
      .then(setAnimals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...animals];
    if (species === "Dogs") list = list.filter((a) => a.species === "Dog");
    else if (species === "Cats") list = list.filter((a) => a.species === "Cat");
    else if (species === "Other") list = list.filter((a) => a.species !== "Dog" && a.species !== "Cat");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(q) || (a.breed || "").toLowerCase().includes(q)
      );
    }
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [animals, species, sort, search]);

  const counts = useMemo(() => ({
    dogs: animals.filter((a) => a.species === "Dog").length,
    cats: animals.filter((a) => a.species === "Cat").length,
    other: animals.filter((a) => a.species !== "Dog" && a.species !== "Cat").length,
  }), [animals]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        .animal-card-link { color: inherit; }
        .animal-card {
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(15,41,66,0.08);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .animal-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 28px rgba(15,41,66,0.16);
        }
        .animals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .animals-grid { grid-template-columns: repeat(2, 1fr); gap: 18px; }
        }
        @media (max-width: 580px) {
          .animals-grid { grid-template-columns: 1fr; gap: 16px; }
          .filter-row { flex-direction: column !important; }
        }
        .filter-tab {
          padding: 8px 18px;
          border: 2px solid #e2e8f0;
          border-radius: 24px;
          background: #fff;
          color: #475569;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .filter-tab:hover { border-color: #1a8a8a; color: #1a8a8a; }
        .filter-tab.active { background: #0f2942; border-color: #0f2942; color: #fff; }
        .search-input {
          width: 100%;
          padding: 9px 16px 9px 38px;
          border: 2px solid #e2e8f0;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          background: #fff;
          transition: border-color 0.15s;
        }
        .search-input:focus { border-color: #1a8a8a; }
        @media (max-width: 640px) {
          .hero-title { font-size: 26px !important; }
          .hero-sub { font-size: 13px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: "#0f2942", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src="/logo.jpg"
              alt="MCAS"
              style={{ height: 40, width: 40, objectFit: "contain", background: "#ececec", borderRadius: 8, padding: 3 }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Morgan County Animal Services</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Madison, Georgia</div>
            </div>
          </div>
          <a
            href="tel:+17067521195"
            style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
          >
            📞 (706) 752-1195
          </a>
        </div>
      </header>

      {/* ── Hero ── */}
      <div style={{ background: "linear-gradient(135deg, #0f2942 0%, #1a4a6e 100%)", padding: "44px 24px 52px", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
            Find Your New Best Friend
          </div>
          <h1 className="hero-title" style={{ fontSize: 42, fontWeight: 900, color: "#fff", margin: "0 0 14px", lineHeight: 1.15 }}>
            Animals Available for Adoption
          </h1>
          <p className="hero-sub" style={{ fontSize: 15, color: "#94a3b8", margin: "0 0 10px" }}>
            📍 2392 Athens Hwy, Madison, GA 30650 &nbsp;·&nbsp; 📞 (706) 752-1195
          </p>
          <p style={{ fontSize: 14, color: "#38bdf8", margin: 0, fontStyle: "italic", fontWeight: 500 }}>
            Adopt, Don&rsquo;t Shop — Give a shelter animal a forever home
          </p>
        </div>
      </div>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 48px" }}>

        {/* Filter bar */}
        <div className="filter-row" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28, alignItems: "center" }}>
          {/* Species tabs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["All", "Dogs", "Cats", "Other"] as SpeciesFilter[]).map((s) => {
              const count = s === "All" ? animals.length : s === "Dogs" ? counts.dogs : s === "Cats" ? counts.cats : counts.other;
              return (
                <button
                  key={s}
                  className={`filter-tab${species === s ? " active" : ""}`}
                  onClick={() => setSpecies(s)}
                >
                  {s} {count > 0 && <span style={{ opacity: 0.75, fontSize: 12 }}>({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 15, pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or breed…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            style={{ padding: "9px 14px", border: "2px solid #e2e8f0", borderRadius: 24, fontSize: 14, background: "#fff", cursor: "pointer", outline: "none" }}
          >
            <option value="newest">Newest First</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Loading animals…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#64748b" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f2942", marginBottom: 8 }}>
              {animals.length === 0 ? "No animals listed right now" : "No matches found"}
            </div>
            <div style={{ fontSize: 14, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
              {animals.length === 0
                ? "Check back soon — new animals arrive regularly! Call us at (706) 752-1195."
                : "Try a different search or clear your filters."}
            </div>
            {search && (
              <button
                onClick={() => { setSearch(""); setSpecies("All"); }}
                style={{ marginTop: 20, padding: "10px 24px", background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>
              {filtered.length} animal{filtered.length !== 1 ? "s" : ""} available for adoption
            </div>
            <div className="animals-grid">
              {filtered.map((a) => <AnimalCard key={a.id} animal={a} />)}
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: "#0f2942", padding: "28px 24px", marginTop: 12, textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>
          Morgan County Animal Services &bull; 2392 Athens Hwy, Madison, GA 30650 &bull; (706) 752-1195
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 20 }}>
          <Link href="/adopt-apply" style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Apply to Adopt</Link>
          <a href="tel:+17067521195" style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Call Us</a>
        </div>
        <div style={{ color: "#475569", fontSize: 11, marginTop: 10 }}>
          &copy; {new Date().getFullYear()} Morgan County Animal Services &bull; Powered by ShelterTrace
        </div>
      </footer>
    </div>
  );
}
