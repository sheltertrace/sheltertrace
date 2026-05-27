"use client";
import { useState, useEffect, useRef } from "react";

// ── date helpers ─────────────────────────────────────────────────────────────

function isoToDisplay(iso: string): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
}

function displayToIso(v: string): string {
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const mo = +m[1], dy = +m[2], yr = +m[3];
  if (mo < 1 || mo > 12) return "";
  if (dy < 1 || dy > new Date(yr, mo, 0).getDate()) return "";
  return `${yr}-${String(mo).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
}

function autoFormat(raw: string, prev: string): string {
  // Pasted ISO date → convert to display
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  // Deleting — strip trailing slash so it doesn't get stuck at "MM/"
  if (raw.length < prev.length) return raw.endsWith("/") ? raw.slice(0, -1) : raw;
  // Typing — extract digits, re-insert slashes
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// Split a style object into layout props (go on wrapper div) and
// appearance props (go on the inner <input>). This lets callers pass
// flex / width for layout while font/padding/border style the actual field.
const LAYOUT_KEYS = new Set(["width", "minWidth", "maxWidth", "flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf"]);

function splitStyle(s?: React.CSSProperties): [React.CSSProperties, React.CSSProperties] {
  if (!s) return [{}, {}];
  const layout: Record<string, unknown> = {};
  const appearance: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    (LAYOUT_KEYS.has(k) ? layout : appearance)[k] = v;
  }
  return [layout as React.CSSProperties, appearance as React.CSSProperties];
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  value: string;                 // ISO YYYY-MM-DD or ""
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  id?: string;
  // Accepted for API compatibility with <DateInput> but not enforced
  max?: string;
  min?: string;
  placeholder?: string;
}

export default function DateInput({
  value, onChange, className, style, disabled, id,
  max: _max, min: _min, placeholder: _pl,
}: Props) {
  const [display, setDisplay] = useState(() => isoToDisplay(value ?? ""));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Sync when the external value is changed programmatically (e.g. reset, load)
  useEffect(() => {
    if (displayToIso(display) !== (value ?? "")) {
      setDisplay(isoToDisplay(value ?? ""));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (iso: string) =>
    onChange({ target: { value: iso } } as React.ChangeEvent<HTMLInputElement>);

  const handleChange = (raw: string) => {
    const next = autoFormat(raw, display);
    setDisplay(next);
    if (!next) { emit(""); return; }
    if (next.length === 10) {
      const iso = displayToIso(next);
      if (iso) emit(iso);
    }
  };

  const handleNative = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    setDisplay(isoToDisplay(e.target.value));
    emit(e.target.value);
  };

  const [containerStyle, inputStyle] = splitStyle(style);
  const invalid = display.length === 10 && !displayToIso(display);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", ...containerStyle }}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        className={className}
        style={{
          width: "100%",
          paddingRight: 28,
          borderColor: invalid ? "#ef4444" : undefined,
          boxShadow: invalid ? "0 0 0 1px #ef4444" : undefined,
          ...inputStyle,
        }}
        placeholder="MM/DD/YYYY"
        disabled={disabled}
        maxLength={10}
        autoComplete="off"
      />
      {/* Hidden native picker — triggered by the calendar icon as a fallback */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        value={value ?? ""}
        onChange={handleNative}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => { try { nativeRef.current?.showPicker?.(); } catch { /* not supported */ } }}
        style={{
          position: "absolute", right: 6,
          background: "none", border: "none", padding: 0,
          cursor: disabled ? "default" : "pointer",
          fontSize: 13, lineHeight: 1,
          color: "var(--text-muted,#94a3b8)",
          opacity: disabled ? 0.4 : 1,
        }}
        aria-label="Open calendar"
        disabled={disabled}
      >
        📅
      </button>
      {invalid && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 2,
          fontSize: 11, color: "#ef4444",
          background: "var(--bg,#fff)", border: "1px solid #fca5a5",
          borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap", zIndex: 20,
        }}>
          Invalid date
        </div>
      )}
    </div>
  );
}
