"use client";

export default function DemoBanner() {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9998,
      height: 36,
      background: "#f59e0b",
      color: "#78350f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      fontWeight: 600,
      gap: 8,
      padding: "0 50px 0 16px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}>
      🔍 <strong>Demo Environment</strong>&nbsp;— Explore freely. Data resets on sign out or after 5 min of inactivity.
      <span style={{
        position: "absolute",
        right: 10,
        background: "#92400e",
        color: "#fff",
        borderRadius: 5,
        padding: "1px 7px",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 1,
      }}>
        DEMO
      </span>
    </div>
  );
}
