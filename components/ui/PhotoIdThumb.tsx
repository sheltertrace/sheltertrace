"use client";
import { useState } from "react";

interface Props {
  url: string | null | undefined;
  name?: string;
  size?: number;
}

export default function PhotoIdThumb({ url, name, size = 56 }: Props) {
  const [fullView, setFullView] = useState(false);
  if (!url) return null;

  const isPdf = url.toLowerCase().includes(".pdf");

  return (
    <>
      <div
        onClick={() => setFullView(true)}
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
        ) : (
          <img
            src={url}
            alt="Photo ID"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
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
            {isPdf ? (
              <iframe
                src={url}
                style={{ width: "70vw", height: "75vh", border: "none", borderRadius: 6 }}
                title="Photo ID PDF"
              />
            ) : (
              <img
                src={url}
                alt="Photo ID"
                style={{ maxWidth: "70vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 6, display: "block" }}
              />
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ alignSelf: "flex-end" }}
            >
              Open in New Tab ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
}
