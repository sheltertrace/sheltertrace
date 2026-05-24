"use client";
import { identifyMicrochip } from "@/lib/utils";

interface Props {
  chip: string;
  /** compact=true drops the "Call Now" button — use inside tight form layouts */
  compact?: boolean;
}

export default function MicrochipBadge({ chip, compact = false }: Props) {
  const id = identifyMicrochip(chip.trim());
  if (!id) return null;

  const isUnknown = !id.phone;
  const accent = id.certain && !isUnknown ? "#0d9488" : "#64748b";
  const bg     = id.certain && !isUnknown ? "#f0fdfa"  : "#f8fafc";
  const border = id.certain && !isUnknown ? "#99f6e4"  : "#e2e8f0";

  if (isUnknown) {
    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "#fef9f0", color: "#92400e", border: "1px solid #fcd34d", whiteSpace: "nowrap" }}>
          🔬 Unknown manufacturer
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>
          Unable to identify from chip number — try searching manually at petmicrochiplookup.org
        </span>
      </div>
    );
  }

  const tel = id.phone!.replace(/\D/g, "");

  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: bg, color: accent, border: `1px solid ${border}`, whiteSpace: "nowrap" }}>
        🔬 {id.manufacturer}
      </span>
      <a
        href={`tel:${tel}`}
        style={{ fontSize: 12, fontWeight: 700, color: accent, textDecoration: "none", whiteSpace: "nowrap" }}
      >
        {id.phone}
      </a>
      {!compact && (
        <a
          href={`tel:${tel}`}
          style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 700, background: accent, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}
        >
          📞 Call Now
        </a>
      )}
      {!id.certain && (
        <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>prefix not definitive</span>
      )}
    </div>
  );
}
