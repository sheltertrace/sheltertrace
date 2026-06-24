"use client";
import { useClinic } from "@/components/clinic/ClinicShell";

export default function ClinicPlaceholderPage() {
  const { selectedClient } = useClinic();
  const title = typeof window !== "undefined" ? window.location.pathname.split("/").pop() || "" : "";
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, textTransform: "capitalize", marginBottom: 8 }}>{title.replace(/-/g, " ")}</h1>
      {selectedClient && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Filtered to: {selectedClient.county_name}</div>}
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Coming Soon</div>
        <div style={{ fontSize: 13 }}>This module is under development.</div>
      </div>
    </div>
  );
}
