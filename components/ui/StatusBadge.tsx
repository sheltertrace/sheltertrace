"use client";
import { STATUS_COLORS } from "@/lib/constants";

const CLASS_MAP: Record<string, string> = {
  Available: "status-available",
  Adopted: "status-adopted",
  Foster: "status-foster",
  "Medical Hold": "status-medical",
  Quarantine: "status-quarantine",
  Pending: "status-pending",
  Euthanized: "status-euthanized",
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = CLASS_MAP[status] || "";
  const color = STATUS_COLORS[status];
  const style = cls ? {} : color
    ? { background: `${color}18`, color, border: `1px solid ${color}40` }
    : { background: "#f1f5f9", color: "#475569" };
  return (
    <span className={`badge ${cls}`} style={style}>
      {status}
    </span>
  );
}

export function ColorDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || "#94a3b8";
  return (
    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6, flexShrink: 0 }} />
  );
}
