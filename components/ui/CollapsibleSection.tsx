"use client";
import { useState } from "react";

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  color?: string;
}

export default function CollapsibleSection({ title, children, defaultOpen = true, color }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${color || "var(--border-light)"}`, borderRadius: 8, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ padding: "9px 14px", background: color ? `${color}18` : "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: open ? `1px solid ${color || "var(--border-light)"}` : "none" }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: color || "var(--text)" }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{open ? "▼" : "▶"}</span>
      </div>
      {open && <div style={{ padding: 14 }}>{children}</div>}
    </div>
  );
}
