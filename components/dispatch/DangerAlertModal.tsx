"use client";

export interface DangerAlertBlock {
  id: string;
  heading: string;
  lines: string[];
}

interface Props {
  blocks: DangerAlertBlock[];
  onAcknowledge: () => void;
}

// Officer-safety warning — cannot be dismissed by clicking outside; the
// overlay has no onClick handler, so only the Acknowledge button clears it.
export default function DangerAlertModal({ blocks, onAcknowledge }: Props) {
  if (blocks.length === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ background: "#dc2626", color: "#fff", padding: "16px 20px", borderRadius: "12px 12px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>⚠️</span>
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0.3 }}>OFFICER SAFETY ALERT</div>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {blocks.map((b) => (
            <div key={b.id} style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: "#7f1d1d", marginBottom: 6, fontSize: 14 }}>{b.heading}</div>
              {b.lines.map((l, i) => (
                <div key={i} style={{ fontSize: 13, color: "#1f2937", marginBottom: 4, whiteSpace: "pre-wrap" }}>{l}</div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 20px 18px", borderTop: "1px solid #e5e7eb", textAlign: "center" }}>
          <button
            onClick={onAcknowledge}
            style={{ background: "#dc2626", border: "1px solid #dc2626", borderRadius: 6, color: "#fff", padding: "10px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
