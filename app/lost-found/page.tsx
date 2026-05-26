"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { supabasePublic } from "@/lib/supabase-public";
import type { LostFoundReport } from "@/lib/types";
import { safeArray } from "@/lib/data";

const SPECIES = ["All", "Dog", "Cat", "Other"];

function fmtDate(d?: string | null): string {
  if (!d) return "Unknown date";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Photo Carousel ─────────────────────────────────────────────────────────────

function PhotoCarousel({ photos, name, species }: { photos: string[]; name?: string | null; species?: string | null }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(0);
  const emoji = species === "Dog" ? "🐕" : species === "Cat" ? "🐈" : "🐾";

  const prev = () => setIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === photos.length - 1 ? 0 : i + 1));

  if (!photos.length) {
    return (
      <div style={{ height: 320, background: "#f0f7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, flexShrink: 0 }}>
        {emoji}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 320, background: "#000", flexShrink: 0, overflow: "hidden" }}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const d = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(d) > 40) d > 0 ? prev() : next();
      }}
    >
      <img
        key={idx}
        src={photos[idx]}
        alt={name ?? ""}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      {photos.length > 1 && (
        <>
          <button onClick={prev} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <button onClick={next} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
            {photos.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 20 : 8, height: 8, borderRadius: 4, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Detail modal ───────────────────────────────────────────────────────────────

function DetailModal({ report, onClose }: { report: LostFoundReport; onClose: () => void }) {
  const isLost = report.type === "lost";
  const photos = safeArray(report.photo_urls);
  const [matches, setMatches] = useState<{ id: string; match_score: number; related_id: string; related_name?: string }[]>([]);
  const [shelterAnimals, setShelterAnimals] = useState<{ id: string; name: string; status: string; species: string }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Load potential matches
    if (!report.id) return;
    supabasePublic
      .from("lost_found_matches")
      .select("*")
      .or(`lost_report_id.eq.${report.id},found_report_id.eq.${report.id}`)
      .gte("match_score", 40)
      .then((res: { data: unknown }) => {
        const rows = (res.data as { id: string; lost_report_id?: string; found_report_id?: string; match_score: number }[]) ?? [];
        setMatches(rows.map((r) => ({
          id: r.id,
          match_score: r.match_score,
          related_id: (r.lost_report_id === report.id ? r.found_report_id : r.lost_report_id) ?? "",
        })));
      });
    // Check shelter animals
    if (report.species) {
      supabasePublic
        .from("animals")
        .select("id, name, status, species")
        .in("status", ["Available", "Medical Hold", "Quarantine", "Pending"])
        .eq("species", report.species)
        .limit(3)
        .then((res: { data: unknown }) => setShelterAnimals((res.data as { id: string; name: string; status: string; species: string }[]) ?? []));
    }
  }, [report.id, report.species]);

  function copyLink() {
    const url = `${window.location.origin}/lost-found/${report.id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function shareOnFacebook() {
    const url = encodeURIComponent(`${window.location.origin}/lost-found/${report.id}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "width=600,height=400");
  }

  const mapsUrl = report.location_lat && report.location_lng
    ? `https://maps.google.com/?q=${report.location_lat},${report.location_lng}`
    : report.location_address
    ? `https://maps.google.com/?q=${encodeURIComponent([report.location_address, report.location_city, "GA"].filter(Boolean).join(", "))}`
    : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 16px 40px" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, maxWidth: 640, width: "100%", overflow: "hidden", position: "relative", margin: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close + Back */}
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Photos */}
        <PhotoCarousel photos={photos} name={report.pet_name} species={report.species} />

        {/* Content */}
        <div style={{ padding: "20px 20px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
          {/* Status + name */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
            <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800, background: isLost ? "#dc2626" : "#2563eb", color: "#fff", flexShrink: 0 }}>
              {isLost ? "LOST" : "FOUND"}
            </span>
            <div>
              {report.pet_name && <div style={{ fontWeight: 900, fontSize: 22, color: "#0f2942", lineHeight: 1.2 }}>{report.pet_name}</div>}
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 2 }}>
                {[report.species, report.breed].filter(Boolean).join(" · ")}
                {report.color && ` · ${report.color}`}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", marginBottom: 18, fontSize: 13 }}>
            {[
              [isLost ? "Last seen" : "Date found", fmtDate(report.date_lost_found)],
              ["Sex",         report.sex],
              ["Age",         report.age],
              ["Size",        report.size],
              ["Microchipped", report.microchip ? `Yes (${report.microchip})` : report.microchip === "" ? "No" : null],
              ["Spayed/Neutered", report.spayed_neutered],
              ["Collar",      report.collar_description || null],
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={String(l)}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>{String(l)}</span>
                <span style={{ fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          {report.distinguishing_features && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Description</div>
              {report.distinguishing_features}
            </div>
          )}

          {/* Location */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8fafc", borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {isLost ? "Last seen location" : "Found location"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f2942" }}>
              {[report.location_address, report.location_city, report.location_zip].filter(Boolean).join(", ") || "Location not specified"}
            </div>
            {report.circumstances && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{report.circumstances}</div>}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                🗺 View on Google Maps ↗
              </a>
            )}
          </div>

          {/* Shelter animal match */}
          {shelterAnimals.length > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#fef3c7", borderRadius: 10, border: "1px solid #fbbf24" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>🏠 Possibly at MCAS Shelter</div>
              <div style={{ fontSize: 13, color: "#78350f", marginBottom: 8 }}>
                {shelterAnimals.length === 1
                  ? `A similar ${report.species?.toLowerCase()} may currently be at the shelter.`
                  : `${shelterAnimals.length} similar ${report.species?.toLowerCase()}s are currently at the shelter.`}
              </div>
              <a href="tel:+17067521195" style={{ fontSize: 13, fontWeight: 700, color: "#92400e", textDecoration: "none" }}>
                📞 Call MCAS at (706) 752-1195 to check
              </a>
            </div>
          )}

          {/* Matches */}
          {matches.length > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #86efac" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#15803d", marginBottom: 6 }}>🔗 Potential Matches Found</div>
              <div style={{ fontSize: 13, color: "#166534", marginBottom: 8 }}>
                The system found {matches.length} possible match{matches.length > 1 ? "es" : ""}. Contact MCAS for details.
              </div>
              {matches.slice(0, 3).map((m) => (
                <a key={m.id} href={`/lost-found/${m.related_id}`} style={{ display: "block", fontSize: 13, color: "#15803d", fontWeight: 600, marginBottom: 4, textDecoration: "none" }}>
                  → View match (score: {m.match_score}/100)
                </a>
              ))}
            </div>
          )}

          {/* Contact */}
          <div style={{ marginBottom: 16, background: "#f0f7ff", borderRadius: 10, padding: "14px 16px", border: "1px solid #bfdbfe" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1d4ed8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Have Information?</div>
            <p style={{ fontSize: 14, color: "#1e40af", margin: "0 0 10px", lineHeight: 1.6 }}>
              {isLost
                ? "If you've found this pet, call Morgan County Animal Services immediately."
                : "If this is your lost pet, call Morgan County Animal Services to arrange a reunion."}
            </p>
            <a href="tel:+17067521195" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", background: "#0f2942", color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
              📞 Call MCAS · (706) 752-1195
            </a>
          </div>

          {/* Share */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={copyLink} style={{ flex: 1, padding: "11px 0", border: "2px solid #e2e8f0", borderRadius: 10, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {copied ? "✓ Copied!" : "🔗 Copy Link"}
            </button>
            <button onClick={shareOnFacebook} style={{ flex: 1, padding: "11px 0", border: "2px solid #1877f2", borderRadius: 10, background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontWeight: 900 }}>f</span> Share
            </button>
          </div>

          {/* View full page link */}
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <a href={`/lost-found/${report.id}`} style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}>
              View full page →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Report card (clickable) ────────────────────────────────────────────────────

function ReportCard({ report, onClick }: { report: LostFoundReport; onClick: () => void }) {
  const isLost  = report.type === "lost";
  const photos  = safeArray(report.photo_urls);
  const photo   = photos[0] ?? null;
  const emoji   = report.species === "Dog" ? "🐕" : report.species === "Cat" ? "🐈" : "🐾";
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff", borderRadius: 16, overflow: "hidden", cursor: "pointer",
        boxShadow: hovered ? "0 8px 24px rgba(15,41,66,0.18)" : "0 2px 10px rgba(0,0,0,0.08)",
        transform: hovered ? "translateY(-3px)" : "none",
        transition: "all 0.18s ease",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Photo */}
      <div style={{ position: "relative", height: 200, background: "#f0f7ff", flexShrink: 0 }}>
        {photo ? (
          <img src={photo} alt={report.pet_name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72 }}>{emoji}</div>
        )}
        <span style={{ position: "absolute", top: 10, left: 10, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 800, background: isLost ? "#dc2626" : "#2563eb", color: "#fff" }}>
          {isLost ? "LOST" : "FOUND"}
        </span>
        {photos.length > 1 && (
          <span style={{ position: "absolute", top: 10, right: 10, padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "rgba(0,0,0,0.5)", color: "#fff" }}>
            +{photos.length - 1} more
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {report.pet_name
          ? <div style={{ fontWeight: 800, fontSize: 18, color: "#0f2942" }}>{report.pet_name}</div>
          : <div style={{ fontWeight: 600, fontSize: 15, color: "#64748b", fontStyle: "italic" }}>Name unknown</div>
        }
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
            {report.distinguishing_features.slice(0, 70)}{report.distinguishing_features.length > 70 ? "…" : ""}
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>Tap for details</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: isLost ? "#dc2626" : "#2563eb" }}>View →</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LostFoundPage() {
  const [tab,           setTab]           = useState<"lost" | "found">("lost");
  const [reports,       setReports]       = useState<LostFoundReport[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [searchQ,       setSearchQ]       = useState("");
  const [selectedReport,setSelectedReport]= useState<LostFoundReport | null>(null);

  // Load reports
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

  // Handle ?id= URL param — auto-open modal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (id && reports.length) {
      const r = reports.find((x) => x.id === id);
      if (r) setSelectedReport(r);
    }
  }, [reports]);

  // Update URL when modal opens/closes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedReport) {
      url.searchParams.set("id", selectedReport.id ?? "");
    } else {
      url.searchParams.delete("id");
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedReport]);

  // Close modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedReport(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
      <style>{`
        *{box-sizing:border-box}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        @media(max-width:960px){.grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.grid{grid-template-columns:1fr}}
      `}</style>

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
          <Link href="/lost-found/report-lost" style={{ padding: "12px 24px", background: "#dc2626", color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>🐾 Report Lost Pet</Link>
          <Link href="/lost-found/report-found" style={{ padding: "12px 24px", background: "#2563eb", color: "#fff", borderRadius: 10, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>🏠 Report Found Pet</Link>
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
          <input placeholder="Search breed, color, city…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "2px solid #e2e8f0", borderRadius: 24, fontSize: 14, outline: "none", background: "#fff" }} />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div><div>Loading reports…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{tab === "lost" ? "🔴" : "🔵"}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f2942", marginBottom: 8 }}>No active {tab} pet reports{speciesFilter !== "All" ? ` for ${speciesFilter}s` : ""}</div>
            <div style={{ fontSize: 14 }}>
              {tab === "lost" ? <Link href="/lost-found/report-lost" style={{ color: "#dc2626", fontWeight: 700 }}>Report a lost pet →</Link> : <Link href="/lost-found/report-found" style={{ color: "#2563eb", fontWeight: 700 }}>Report a found pet →</Link>}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{filtered.length} report{filtered.length !== 1 ? "s" : ""} — click any card for full details</div>
            <div className="grid">
              {filtered.map((r) => <ReportCard key={r.id} report={r} onClick={() => setSelectedReport(r)} />)}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer style={{ background: "#0f2942", padding: "24px", textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>All lost &amp; found reports are routed through MCAS. Contact information is kept private.</div>
      </footer>

      {/* Detail modal */}
      {selectedReport && <DetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />}
    </div>
  );
}
