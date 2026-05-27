"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchPublicAnimal, safeArray } from "@/lib/data";
import type { Animal } from "@/lib/types";
import { displayAge, formatDate } from "@/lib/utils";

function getStatusBadge(animal: Animal) {
  if (animal.status === "Foster") return { label: "In Foster", color: "#1d4ed8", bg: "#dbeafe" };
  if (animal.sub_status && (animal.sub_status.includes("Spay") || animal.sub_status.includes("Neuter"))) {
    return { label: "Awaiting Spay/Neuter", color: "#92400e", bg: "#fef3c7" };
  }
  return { label: "Available", color: "#166534", bg: "#dcfce7" };
}

function DetailRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" }}>
      <div style={{ minWidth: 160, fontSize: 13, color: "#64748b", fontWeight: 600, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#1e293b" }}>{value}</div>
    </div>
  );
}

export default function AnimalPublicDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : (params.id as string[])?.[0] ?? "";
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchPublicAnimal(id)
      .then(setAnimal)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!animal || !animal.show_on_website) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
        <h2 style={{ color: "#0f2942", marginBottom: 8, fontSize: 24, fontWeight: 800 }}>Animal Not Found</h2>
        <p style={{ color: "#64748b", marginBottom: 24, textAlign: "center", maxWidth: 400, lineHeight: 1.6 }}>
          This animal may have already been adopted or the link may be outdated. Check our current listings!
        </p>
        <Link
          href="/available-animals"
          style={{ padding: "12px 28px", background: "#0f2942", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 15, textDecoration: "none" }}
        >
          ← See All Available Animals
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(animal);
  const age = displayAge(animal.age) || "Unknown";
  const emoji = animal.species === "Dog" ? "🐕" : animal.species === "Cat" ? "🐈" : "🐾";

  // Build photo gallery — featured first, then any extras, then fall back to photo_url
  const gallery: string[] = [];
  if (animal.featured_photo_url) gallery.push(animal.featured_photo_url);
  safeArray(animal.photo_urls).forEach((u) => {
    if (u && u !== animal.featured_photo_url) gallery.push(u);
  });
  if (gallery.length === 0 && animal.photo_url) gallery.push(animal.photo_url);

  const currentPhoto = gallery[photoIdx] ?? null;
  const hasMultiple = gallery.length > 1;

  function prevPhoto() { setPhotoIdx((i) => (i === 0 ? gallery.length - 1 : i - 1)); }
  function nextPhoto() { setPhotoIdx((i) => (i === gallery.length - 1 ? 0 : i + 1)); }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleFacebookShare() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "width=600,height=400");
  }

  const adoptUrl = `/adopt-apply?animal_name=${encodeURIComponent(animal.name)}&animal_id=${encodeURIComponent(animal.id)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f0f7ff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        .detail-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr; }
        }
        .gallery-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(15,41,66,0.65);
          border: none;
          color: #fff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .gallery-btn:hover { background: rgba(15,41,66,0.9); }
        .adopt-btn {
          display: block;
          width: 100%;
          padding: 15px 0;
          background: #1a8a8a;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 17px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: none;
          text-align: center;
          transition: background 0.15s;
          margin-bottom: 10px;
        }
        .adopt-btn:hover { background: #148080; }
        .share-btn {
          flex: 1;
          padding: 10px 0;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          font-size: 13px;
          font-weight: 700;
          color: #374151;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .share-btn:hover { border-color: #0f2942; color: #0f2942; background: #f8fafc; }
        @media (max-width: 480px) {
          .page-title { font-size: 28px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: "#0f2942", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.jpg" alt="MCAS" style={{ height: 40, width: 40, objectFit: "contain", background: "#ececec", borderRadius: 8, padding: 3 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>Morgan County Animal Services</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Madison, Georgia</div>
            </div>
          </div>
          <a href="tel:+17067521195" style={{ color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
            📞 (706) 752-1195
          </a>
        </div>
      </header>

      {/* ── Back bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 46, display: "flex", alignItems: "center" }}>
          <Link
            href="/available-animals"
            style={{ color: "#1a8a8a", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Back to All Animals
          </Link>
        </div>
      </div>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 60px" }}>
        {/* Heading */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 className="page-title" style={{ fontSize: 38, fontWeight: 900, color: "#0f2942", margin: 0 }}>
              {animal.name}
            </h1>
            <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          </div>
          <div style={{ fontSize: 15, color: "#64748b" }}>
            {animal.species} · {animal.breed || "Mixed Breed"} · {age} · {animal.sex || "Unknown"}
          </div>
        </div>

        <div className="detail-grid">
          {/* ── Left: Photo Gallery ── */}
          <div>
            <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#eef4fb", aspectRatio: "1/1", boxShadow: "0 4px 20px rgba(15,41,66,0.12)" }}>
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={animal.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 100 }}>
                  {emoji}
                </div>
              )}

              {hasMultiple && (
                <>
                  <button className="gallery-btn" style={{ left: 12 }} onClick={prevPhoto} aria-label="Previous photo">‹</button>
                  <button className="gallery-btn" style={{ right: 12 }} onClick={nextPhoto} aria-label="Next photo">›</button>
                  <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                    {gallery.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIdx(i)}
                        style={{
                          width: i === photoIdx ? 20 : 8, height: 8, borderRadius: 4,
                          background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.5)",
                          border: "none", cursor: "pointer", padding: 0,
                          transition: "all 0.2s",
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {hasMultiple && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {gallery.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    style={{
                      width: 64, height: 64, border: i === photoIdx ? "3px solid #1a8a8a" : "2px solid #e2e8f0",
                      borderRadius: 10, overflow: "hidden", cursor: "pointer", padding: 0, background: "none",
                    }}
                  >
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            )}

            {/* Share buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="share-btn" onClick={handleCopyLink}>
                {copied ? "✓ Copied!" : "🔗 Copy Link"}
              </button>
              <button className="share-btn" onClick={handleFacebookShare}>
                <span style={{ color: "#1877f2", fontSize: 16 }}>f</span> Share
              </button>
            </div>
          </div>

          {/* ── Right: Details + Adopt ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Adopt CTA */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 10px rgba(15,41,66,0.08)", border: "2px solid #dcfce7" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>How to Adopt</div>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, margin: "0 0 16px" }}>
                Interested in adopting <strong>{animal.name}</strong>? Visit us at the shelter or fill out an adoption application online!
              </p>
              <Link href={adoptUrl} className="adopt-btn">
                Apply to Adopt {animal.name}
              </Link>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginTop: 8 }}>
                📍 2392 Athens Hwy, Madison, GA 30650<br />
                📞 (706) 752-1195<br />
                🕐 Please call for current shelter hours
              </div>
            </div>

            {/* Animal details */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 10px rgba(15,41,66,0.08)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 4 }}>Animal Details</div>
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 4 }}>
                <DetailRow label="Animal ID" value={animal.id} />
                <DetailRow label="Species" value={animal.species} />
                <DetailRow label="Breed" value={animal.breed || "Mixed Breed"} />
                <DetailRow label="Color" value={[animal.color, animal.secondary_color].filter(Boolean).join(" / ") || "—"} />
                {animal.markings && <DetailRow label="Markings" value={animal.markings} />}
                <DetailRow label="Age" value={age} />
                <DetailRow label="Sex" value={animal.sex || "—"} />
                {animal.weight && <DetailRow label="Weight" value={`${animal.weight} lbs`} />}
                {animal.size && <DetailRow label="Size" value={animal.size} />}
                <DetailRow
                  label="Spayed / Neutered"
                  value={
                    <span style={{ color: animal.fixed ? "#166534" : "#92400e", fontWeight: 700 }}>
                      {animal.fixed ? "✓ Yes" : "Not yet — will be done before adoption"}
                    </span>
                  }
                />
                <DetailRow
                  label="Microchipped"
                  value={
                    animal.microchip
                      ? <span style={{ color: "#166534", fontWeight: 700 }}>✓ Yes ({animal.microchip})</span>
                      : <span style={{ color: "#64748b" }}>No</span>
                  }
                />
                {animal.intake_date && (
                  <DetailRow label="Date Arrived" value={formatDate(animal.intake_date)} />
                )}
              </div>
            </div>

            {/* About Me */}
            {animal.public_bio && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 10px rgba(15,41,66,0.08)", borderLeft: "4px solid #1a8a8a" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f2942", marginBottom: 12 }}>About {animal.name}</div>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" }}>
                  {animal.public_bio}
                </p>
              </div>
            )}

            {/* Back link */}
            <Link
              href="/available-animals"
              style={{ color: "#1a8a8a", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
            >
              ← Back to All Animals
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: "#0f2942", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8 }}>
          Morgan County Animal Services &bull; 2392 Athens Hwy, Madison, GA 30650 &bull; (706) 752-1195
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 20 }}>
          <Link href="/available-animals" style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>All Animals</Link>
          <Link href={adoptUrl} style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Apply to Adopt</Link>
          <a href="tel:+17067521195" style={{ color: "#38bdf8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Call Us</a>
        </div>
        <div style={{ color: "#475569", fontSize: 11, marginTop: 10 }}>
          &copy; {new Date().getFullYear()} Morgan County Animal Services &bull; Powered by ShelterTrace
        </div>
      </footer>
    </div>
  );
}
