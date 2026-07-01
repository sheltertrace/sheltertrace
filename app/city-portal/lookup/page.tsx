"use client";
import { useState } from "react";
import { fetchCityLicenses } from "@/lib/cityLicenseData";
import type { CityPetLicense } from "@/lib/cityLicenseTypes";
import { printLicenseCertificate } from "@/lib/licenseCertPrint";

export default function LicenseLookupPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityPetLicense[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const found = await fetchCityLicenses({ search: query.trim() });
    setResults(found);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>🔍 License Lookup</h1>
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Search by owner name, address, animal name, license number, tag number, or rabies tag number.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="form-input" style={{ flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="e.g. Johnson, 1375 Meadowbrook, Buddy, MAD-2026-00001, Tag #35…" />
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>{loading ? "Searching…" : "Search"}</button>
        </div>
      </div>

      {searched && (
        results.length === 0 ? (
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#64748b" }}>No licenses found</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No active or historical licenses match "{query}"</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>{results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;</div>
            {results.map((l) => {
              const expired = l.expiration_date && l.expiration_date < new Date().toISOString().split("T")[0];
              const isActive = l.status === "Active" && !expired;
              return (
                <div key={l.id} className="card" style={{ padding: 16, marginBottom: 10, borderLeft: `4px solid ${isActive ? "#22c55e" : "#dc2626"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>{l.license_number}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>Tag #{l.tag_number}</span>
                    </div>
                    <span className="badge" style={{ background: isActive ? "#dcfce7" : "#fee2e2", color: isActive ? "#15803d" : "#dc2626", fontSize: 11, fontWeight: 700 }}>
                      {isActive ? "ACTIVE" : expired ? "EXPIRED" : l.status?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Animal</div><div style={{ fontWeight: 700 }}>{l.animal_name}</div><div style={{ color: "var(--text-muted)" }}>{l.breed} · {l.color}</div></div>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Owner</div><div style={{ fontWeight: 700 }}>{l.owner_name}</div><div style={{ color: "var(--text-muted)" }}>{l.owner_phone}</div></div>
                    <div><div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Expiration</div><div style={{ fontWeight: 700, color: expired ? "#dc2626" : "inherit" }}>{l.expiration_date}</div></div>
                  </div>
                  <div style={{ marginTop: 8 }}><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printLicenseCertificate(l)}>🖨 Print Certificate</button></div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
