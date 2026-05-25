"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase-public";
import type { LostFoundReport } from "@/lib/types";
import { safeArray } from "@/lib/data";

const SPECIES = ["All", "Dog", "Cat", "Other"];

function fmtDate(d?: string | null): string {
  if (!d) return "Unknown date";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ReportCard({ report }: { report: LostFoundReport }) {
  const isLost  = report.type === "lost";
  const photos  = safeArray(report.photo_urls);
  const mainPhoto = photos[0] ?? null;
  const emoji   = report.species === "Dog" ? "🐕" : report.species === "Cat" ? "🐈" : "🐾";

  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column" }}>
      {/* Photo */}
      <div style={{ position: "relative", height: 200, background: "#f0f7ff", flexShrink: 0 }}>
        {mainPhoto ? (
          <img src={mainPhoto} alt={report.pet_name ?? report.species ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>{emoji}</div>
        )}
        <span style={{
          position: "absolute", top: 10, left: 10,
          padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800,
          background: isLost ? "#dc2626" : "#2563eb",
          color: "#fff",
        }}>
          {isLost ? "LOST" : "FOUND"}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {report.pet_name && (
          <div style={{ fontWeight: 800, fontSize: 18, color: "#0f2942" }}>{report.pet_name}</div>
        )}
        <div style={{ fontSize: 14, color: "#475569", fontWeight: 600 }}>
          {[report.species, report.breed].filter(Boolean).join(" · ")}
        </div>
        {report.color && <div style={{ fontSize: 13, color: "#64748b" }}>{report.color}</div>}
        <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          {isLost ? "Last seen:" : "Found:"} <strong>{fmtDate(report.date_lost_found)}</strong>
          {report.location_city && <> near <strong>{report.location_city}</strong></>}
        </div>
        {report.distinguishing_features && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontStyle: "italic" }}>
            {report.distinguishing_features.slice(0, 80)}{report.distinguishing_features.length > 80 ? "…" : ""}
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
          <a
            href="tel:+17067521195"
            style={{ display: "block", width: "100%", padding: "10px 0", background: "#0f2942", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none", textAlign: "center" }}
          >
            📞 Contact MCAS · (706) 752-1195
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LostFoundPage() {
  const [tab, setTab]           = useState<"lost" | "found">("lost");
  const [reports, setReports]   = useState<LostFoundReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [searchQ, setSearchQ]   = useState("");

  useEffect(() => {
    setLoading(true);
    supabasePublic
      .from("lost_found_reports")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200)
      .then((res: { data: unknown }) => {
        setReports((res.data as LostFoundReport[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return reports
      .filter((r) => r.type === tab)
      .filter((r) => speciesFilter === "All" || (r.species ?? "").toLowerCase() === speciesFilter.toLowerCase())
      .filter((r) => {
        if (!searchQ.trim()) return true;
        const q = searchQ.toLowerCase();
        return (
          (r.pet_name ?? "").toLowerCase().includes(q) ||
          (r.breed ?? "").toLowerCase().includes(q) ||
          (r.color ?? "").toLowerCase().includes(q) ||
          (r.location_city ?? "").toLowerCase().includes(q)
        );
      });
  }, [reports, tab, speciesFilter, searchQ]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`*{box-sizing:border-box} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px} @media(max-width:960px){.grid{grid-template-columns:repeat(2,1fr)}} @media(max-width:600px){.grid{grid-template-columns:1fr}}`}</style>

      {/* Header */}
      <header style={{ background: "#0f2942", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/mcas_logo.png" alt="MCAS" style={{ height: 40, width: 40, objectFit: "contain", background: "#fff", borderRadius: 8, padding: 3 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Morgan County Animal Services</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Lost &amp; Found Pets</div>
            </div>
          </div>
          <a href="tel:+17067521195" style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>📞 (706) 752-1195</a>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0f2942 0%, #1a4a6e 100%)", padding: "36px 24px 44px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(24px,5vw,42px)", fontWeight: 900, color: "#fff", margin: "0 0 10px" }}>Lost &amp; Found Pets</h1>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: "0 0 20px" }}>Morgan County, Georgia · 2392 Athens Hwy, Madison, GA 30650</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/lost-found/report-lost" style={{ padding: "12px 24px", background: "#dc2626", color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            🐾 Report Lost Pet
          </Link>
          <Link href="/lost-found/report-found" style={{ padding: "12px 24px", background: "#2563eb", color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
            🏠 Report Found Pet
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* Tabs + Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: "2px solid #e2e8f0" }}>
            {(["lost","found"] as const).map((t) => {
              const count = reports.filter((r) => r.type === t && r.status === "active").length;
              return (
                <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 22px", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", background: tab === t ? (t === "lost" ? "#dc2626" : "#2563eb") : "#fff", color: tab === t ? "#fff" : "#64748b" }}>
                  {t === "lost" ? "🔴 Lost" : "🔵 Found"} ({count})
                </button>
              );
            })}
          </div>

          {SPECIES.map((s) => (
            <button key={s} onClick={() => setSpeciesFilter(s)} style={{ padding: "8px 16px", borderRadius: 20, border: "2px solid", borderColor: speciesFilter === s ? "#0f2942" : "#e2e8f0", background: speciesFilter === s ? "#0f2942" : "#fff", color: speciesFilter === s ? "#fff" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {s}
            </button>
          ))}

          <input
            placeholder="Search breed, color, city…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "2px solid #e2e8f0", borderRadius: 24, fontSize: 14, outline: "none", background: "#fff" }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
            <div>Loading reports…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tab === "lost" ? "🔴" : "🔵"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f2942", marginBottom: 8 }}>
              No active {tab} pet reports{speciesFilter !== "All" ? ` for ${speciesFilter}s` : ""}
            </div>
            <div style={{ fontSize: 14 }}>
              {tab === "lost"
                ? <Link href="/lost-found/report-lost" style={{ color: "#dc2626", fontWeight: 700 }}>Report a lost pet →</Link>
                : <Link href="/lost-found/report-found" style={{ color: "#2563eb", fontWeight: 700 }}>Report a found pet →</Link>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{filtered.length} report{filtered.length !== 1 ? "s" : ""}</div>
            <div className="grid">
              {filtered.map((r) => <ReportCard key={r.id} report={r} />)}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ background: "#0f2942", padding: "24px", textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>
          Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
          All lost &amp; found reports are routed through MCAS. Contact information is kept private.
        </div>
      </footer>
    </div>
  );
}
