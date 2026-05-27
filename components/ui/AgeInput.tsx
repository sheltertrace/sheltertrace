"use client";
import { useState, useEffect } from "react";

const UNITS = ["Days", "Weeks", "Months", "Years"] as const;

const PRESETS = [
  { label: "Neonate",      desc: "0-2 wks"   },
  { label: "Puppy/Kitten", desc: "< 6 mo"    },
  { label: "Young",        desc: "6 mo-1 yr"  },
  { label: "Adult",        desc: "1-7 yrs"   },
  { label: "Senior",       desc: "7+ yrs"    },
  { label: "Unknown",      desc: ""          },
] as const;

const PRESET_NAMES = new Set(PRESETS.map((p) => p.label));

function parseAge(value: string): { num: string; unit: string; preset: string } {
  if (!value) return { num: "", unit: "Months", preset: "" };
  if (PRESET_NAMES.has(value as never)) return { num: "", unit: "Months", preset: value };
  const m = value.match(/^(\d+)\s+(Days?|Weeks?|Months?|Years?)$/i);
  if (m) {
    const raw = m[2];
    const unit = (UNITS as readonly string[]).find(
      (u) => u.toLowerCase() === raw.toLowerCase() || u.slice(0, -1).toLowerCase() === raw.toLowerCase()
    ) ?? "Months";
    return { num: m[1], unit, preset: "" };
  }
  return { num: "", unit: "Months", preset: value };
}

function buildValue(num: string, unit: string): string {
  const n = parseInt(num, 10);
  if (!num || isNaN(n) || n < 0) return "";
  const u = n === 1 ? unit.replace(/s$/, "") : unit;
  return `${n} ${u}`;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function AgeInput({ value, onChange }: Props) {
  const parsed = parseAge(value);
  const [num, setNum]               = useState(parsed.num);
  const [unit, setUnit]             = useState(parsed.unit);
  const [activePreset, setPreset]   = useState(parsed.preset);

  useEffect(() => {
    const { num: n, unit: u, preset: p } = parseAge(value);
    setNum(n);
    setUnit(u);
    setPreset(p);
  }, [value]);

  const handleNum = (v: string) => {
    setNum(v);
    setPreset("");
    onChange(v ? buildValue(v, unit) : "");
  };

  const handleUnit = (u: string) => {
    setUnit(u);
    setPreset("");
    if (num) onChange(buildValue(num, u));
  };

  const handlePreset = (label: string) => {
    setPreset(label);
    setNum("");
    onChange(label);
  };

  return (
    <div>
      {/* Number + unit row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          min="0"
          className="form-input"
          style={{ width: 72 }}
          value={num}
          onChange={(e) => handleNum(e.target.value)}
          placeholder="#"
        />
        <select
          className="form-select"
          style={{ flex: 1 }}
          value={unit}
          onChange={(e) => handleUnit(e.target.value)}
        >
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>

      {/* Quick-select presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {PRESETS.map(({ label, desc }) => {
          const active = activePreset === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handlePreset(label)}
              style={{
                padding: "3px 9px",
                fontSize: 11,
                borderRadius: 12,
                border: active ? "1.5px solid var(--teal,#1a8a8a)" : "1px solid var(--border,#e2e8f0)",
                background: active ? "var(--teal,#1a8a8a)" : "var(--surface,#f8fafc)",
                color: active ? "#fff" : "var(--text,#0f172a)",
                cursor: "pointer",
                fontWeight: active ? 700 : 500,
                lineHeight: "1.6",
              }}
            >
              {label}{desc ? ` (${desc})` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
