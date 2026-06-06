"use client";

export default function DemoBanner() {
  return (
    <div
      style={{
        background: "#f59e0b",
        color: "#78350f",
        padding: "8px 20px",
        textAlign: "center",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        position: "relative",
      }}
    >
      <span>
        🔍 <strong>Demo Environment</strong> — Explore freely. Data resets after each session. No real animals or records are affected.
      </span>
      <span
        style={{
          position: "absolute",
          right: 14,
          background: "#92400e",
          color: "#fff",
          borderRadius: 6,
          padding: "2px 8px",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        DEMO
      </span>
    </div>
  );
}
