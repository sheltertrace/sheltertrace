"use client";
import { useState, useEffect } from "react";
import { fetchCityLicenses } from "@/lib/cityLicenseData";
import type { CityPetLicense } from "@/lib/cityLicenseTypes";
import { printLicenseCertificate } from "@/lib/licenseCertPrint";

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<CityPetLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchCityLicenses().then(setLicenses).finally(() => setLoading(false));
  }, []);

  const filtered = licenses
    .filter((l) => filterStatus === "all" || l.status === filterStatus)
    .filter((l) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (l.animal_name || "").toLowerCase().includes(q) || (l.owner_name || "").toLowerCase().includes(q) || (l.license_number || "").toLowerCase().includes(q) || (l.tag_number || "").includes(q) || (l.rabies_tag_number || "").includes(q);
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏷️ Licenses</h1>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search animal, owner, license#, tag#…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        {["all", "Active", "Expired", "Revoked"].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}>{s}</button>
        ))}
        <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} license{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>License #</th><th>Tag #</th><th>Animal</th><th>Owner</th><th>Breed/Color</th><th>Issued</th><th>Expires</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No licenses found</td></tr>
              ) : filtered.map((l) => {
                const expired = l.expiration_date && l.expiration_date < new Date().toISOString().split("T")[0];
                const statusColor = l.status === "Active" && !expired ? "#15803d" : "#dc2626";
                const statusBg = l.status === "Active" && !expired ? "#dcfce7" : "#fee2e2";
                return (
                  <tr key={l.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{l.license_number}</td>
                    <td style={{ fontWeight: 700 }}>{l.tag_number}</td>
                    <td style={{ fontWeight: 600 }}>{l.animal_name}</td>
                    <td style={{ fontSize: 12 }}><div>{l.owner_name}</div><div style={{ color: "var(--text-muted)" }}>{l.owner_phone}</div></td>
                    <td style={{ fontSize: 12 }}>{l.breed}{l.color ? ` · ${l.color}` : ""}</td>
                    <td style={{ fontSize: 12 }}>{l.issue_date}</td>
                    <td style={{ fontSize: 12, color: expired ? "#dc2626" : "inherit", fontWeight: expired ? 700 : 400 }}>{l.expiration_date}</td>
                    <td><span className="badge" style={{ background: statusBg, color: statusColor, fontSize: 10 }}>{expired && l.status === "Active" ? "Expired" : l.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printLicenseCertificate(l)}>🖨</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
