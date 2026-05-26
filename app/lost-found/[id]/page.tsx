"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabasePublic } from "@/lib/supabase-public";
import type { LostFoundReport } from "@/lib/types";
import { safeArray } from "@/lib/data";

function fmtDate(d?: string | null): string {
  if (!d) return "Unknown date";
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PhotoGallery({ photos, name, species }: { photos: string[]; name?: string | null; species?: string | null }) {
  const [idx, setIdx] = useState(0);
  const touchX = useRef(0);
  const emoji = species === "Dog" ? "🐕" : species === "Cat" ? "🐈" : "🐾";

  if (!photos.length) {
    return (
      <div style={{ height: 380, background: "#f0f7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120, borderRadius: "16px 16px 0 0" }}>
        {emoji}
      </div>
    );
  }

  const prev = () => setIdx((i) => (i === 0 ? photos.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === photos.length - 1 ? 0 : i + 1));

  return (
    <div>
      <div
        style={{ position: "relative", height: 380, background: "#000", borderRadius: "16px 16px 0 0", overflow: "hidden" }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 40) d > 0 ? prev() : next(); }}
      >
        <img src={photos[idx]} alt={name ?? ""} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        {photos.length > 1 && (
          <>
            <button onClick={prev} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
            <button onClick={next} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 7 }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.2s" }} />
              ))}
            </div>
          </>
        )}
      </div>
      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 0", overflowX: "auto" }}>
          {photos.map((url, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{ width: 64, height: 64, flexShrink: 0, border: i === idx ? "3px solid #0f2942" : "2px solid #e2e8f0", borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, background: "none" }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LostFoundDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : (params.id as string[])?.[0] ?? "";
  const [report, setReport] = useState<LostFoundReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabasePublic
      .from("lost_found_reports")
      .select("*")
      .eq("id", id)
      .single()
      .then((res: { data: unknown }) => {
        setReport(res.data as LostFoundReport | null);
        setLoading(false);
      });
  }, [id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }
  function shareOnFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank", "width=600,height=400");
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 56, marginBottom: 12 }}>🐾</div><div style={{ color: "#64748b" }}>Loading…</div></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🐾</div>
          <h2 style={{ color: "#0f2942", marginBottom: 8 }}>Report Not Found</h2>
          <p style={{ color: "#64748b", marginBottom: 20 }}>This report may have been removed or the link may be incorrect.</p>
          <Link href="/lost-found" style={{ padding: "12px 24px", background: "#0f2942", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>← View All Reports</Link>
        </div>
      </div>
    );
  }

  const isLost = report.type === "lost";
  const photos = safeArray(report.photo_urls);
  const mapsUrl = report.location_lat && report.location_lng
    ? `https://maps.google.com/?q=${report.location_lat},${report.location_lng}`
    : report.location_address
    ? `https://maps.google.com/?q=${encodeURIComponent([report.location_address, report.location_city, "GA"].filter(Boolean).join(", "))}`
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#0f2942", padding: "0 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/lost-found" style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>← Back to Lost &amp; Found Board</Link>
          <a href="tel:+17067521195" style={{ color: "#94a3b8", fontSize: 13, textDecoration: "none" }}>📞 (706) 752-1195</a>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>

          {/* Photo gallery */}
          <PhotoGallery photos={photos} name={report.pet_name} species={report.species} />

          <div style={{ padding: "24px 24px 28px" }}>
            {/* Status + title */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
              <span style={{ padding: "6px 16px", borderRadius: 20, fontSize: 14, fontWeight: 800, background: isLost ? "#dc2626" : "#2563eb", color: "#fff", flexShrink: 0 }}>
                {isLost ? "LOST" : "FOUND"}
              </span>
              <div>
                {report.pet_name ? (
                  <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f2942", margin: "0 0 4px" }}>{report.pet_name}</h1>
                ) : (
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: "#64748b", margin: "0 0 4px", fontStyle: "italic" }}>Name unknown</h1>
                )}
                <div style={{ fontSize: 15, color: "#475569" }}>{[report.species, report.breed].filter(Boolean).join(" · ")}{report.color ? ` · ${report.color}` : ""}</div>
              </div>
            </div>

            {/* Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginBottom: 20 }}>
              {[
                [isLost ? "Last Seen" : "Date Found", fmtDate(report.date_lost_found)],
                ["Sex",               report.sex],
                ["Age",               report.age],
                ["Size",              report.size],
                ["Microchipped",      report.microchip ? `Yes (${report.microchip})` : null],
                ["Spayed/Neutered",   report.spayed_neutered !== "Unknown" ? report.spayed_neutered : null],
                ["Collar",            report.collar_description || null],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={String(l)}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{String(l)}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f2942" }}>{String(v)}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            {report.distinguishing_features && (
              <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Description / Markings</div>
                <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>{report.distinguishing_features}</div>
              </div>
            )}

            {/* Location */}
            <div style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                {isLost ? "Last Seen Location" : "Found Location"}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f2942" }}>
                {[report.location_address, report.location_city, report.location_zip].filter(Boolean).join(", ") || "Not specified"}
              </div>
              {report.circumstances && <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{report.circumstances}</div>}
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 14, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
                  🗺 View on Google Maps ↗
                </a>
              )}
            </div>

            {/* Contact */}
            <div style={{ padding: "16px 18px", background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", marginBottom: 6 }}>Have Information?</div>
              <p style={{ fontSize: 14, color: "#1e40af", margin: "0 0 12px", lineHeight: 1.6 }}>
                {isLost ? "If you've seen this pet or know its whereabouts, please contact MCAS immediately." : "If this is your lost pet, contact MCAS to arrange a reunion."}
              </p>
              <a href="tel:+17067521195" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", background: "#0f2942", color: "#fff", borderRadius: 12, fontWeight: 800, fontSize: 16, textDecoration: "none" }}>
                📞 Call MCAS · (706) 752-1195
              </a>
            </div>

            {/* Share */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={copyLink} style={{ flex: 1, padding: "12px 0", border: "2px solid #e2e8f0", borderRadius: 12, background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>
                {copied ? "✓ Link Copied!" : "🔗 Copy Link"}
              </button>
              <button onClick={shareOnFacebook} style={{ flex: 1, padding: "12px 0", border: "2px solid #1877f2", borderRadius: 12, background: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#1877f2" }}>
                <span style={{ fontWeight: 900 }}>f</span> Share on Facebook
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ background: "#0f2942", padding: "20px 24px", textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>Morgan County Animal Services · 2392 Athens Hwy, Madison, GA 30650 · (706) 752-1195</div>
      </footer>
    </div>
  );
}
