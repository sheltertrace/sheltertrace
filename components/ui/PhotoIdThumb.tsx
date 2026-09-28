"use client";
import { useEffect, useState } from "react";
import { signStaffFileUrl, extractStoragePath } from "@/lib/staffStorage";

interface Props {
  url: string | null | undefined; // a documents-bucket path, or (for older records) a full legacy public URL
  name?: string;
  size?: number;
}

// `documents` is a private bucket now — this accepts either a bare storage
// path (new records) or a legacy full public URL (older records, from before
// the bucket went private) and resolves it to a short-lived signed URL to
// actually render. The signed URL is refreshed on mount and again whenever
// the full-size view opens, since a thumbnail left on screen for a while can
// outlive the 60-second signature.
export default function PhotoIdThumb({ url, name, size = 56 }: Props) {
  const [fullView, setFullView] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const path = extractStoragePath("documents", url);

  useEffect(() => {
    let cancelled = false;
    setSignedUrl(null);
    if (path) signStaffFileUrl("documents", path).then((u) => { if (!cancelled) setSignedUrl(u); });
    return () => { cancelled = true; };
  }, [path]);

  const openFullView = () => {
    setFullView(true);
    if (path) signStaffFileUrl("documents", path).then(setSignedUrl); // refresh in case the thumbnail's signature has aged
  };

  if (!url) return null;
  const isPdf = url.toLowerCase().includes(".pdf");

  return (
    <>
      <div
        onClick={openFullView}
        title={`View ${name || "Photo ID"}`}
        style={{
          width: size, height: size,
          border: "2px solid #bfdbfe",
          borderRadius: 6,
          overflow: "hidden",
          cursor: "pointer",
          background: "#eff6ff",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {isPdf ? (
          <div style={{ textAlign: "center", padding: 4 }}>
            <div style={{ fontSize: size > 40 ? 20 : 14 }}>📄</div>
            {size > 40 && <div style={{ fontSize: 9, color: "#1d4ed8", fontWeight: 700, marginTop: 2 }}>PDF ID</div>}
          </div>
        ) : signedUrl ? (
          <img
            src={signedUrl}
            alt="Photo ID"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ fontSize: size > 40 ? 20 : 14 }}>🪪</div>
        )}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(29,78,216,0.7)", color: "#fff",
          fontSize: 8, fontWeight: 700, textAlign: "center", padding: "1px 0",
          textTransform: "uppercase", letterSpacing: 0.3,
        }}>
          ID
        </div>
      </div>

      {fullView && (
        <div
          className="modal-overlay"
          onClick={() => setFullView(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 20,
              maxWidth: "90vw", maxHeight: "90vh",
              display: "flex", flexDirection: "column", gap: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {name ? `${name} — Photo ID` : "Photo ID"}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setFullView(false)}>✕</button>
            </div>
            {!signedUrl ? (
              <div style={{ width: "70vw", height: "75vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Loading…</div>
            ) : isPdf ? (
              <iframe
                src={signedUrl}
                style={{ width: "70vw", height: "75vh", border: "none", borderRadius: 6 }}
                title="Photo ID PDF"
              />
            ) : (
              <img
                src={signedUrl}
                alt="Photo ID"
                style={{ maxWidth: "70vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 6, display: "block" }}
              />
            )}
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: "flex-end" }}
              >
                Open in New Tab ↗
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
