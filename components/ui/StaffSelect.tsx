"use client";
import { useState, useRef, useEffect } from "react";
import { useStaff } from "@/app/providers";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export default function StaffSelect({ value, onChange, placeholder = "— None —", className, id }: Props) {
  const { staffOptions } = useStaff();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep query in sync when value is changed externally
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? staffOptions.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : staffOptions;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v); // allow free text — existing records may have names not in DB
    setOpen(true);
  };

  // mousedown fires before onBlur, so the click registers before the dropdown closes
  const handleOptionMouseDown = (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          className={className || "form-input"}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ paddingRight: query ? 28 : undefined }}
        />
        {query && (
          <button
            type="button"
            onMouseDown={handleClear}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
              fontSize: 13, lineHeight: 1, padding: "2px 4px",
            }}
            tabIndex={-1}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderRadius: "0 0 7px 7px",
          zIndex: 300,
          maxHeight: 220,
          overflowY: "auto",
          boxShadow: "0 6px 16px rgba(0,0,0,.12)",
        }}>
          {staffOptions.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              No staff on file — add staff via the People directory
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
              No matches — the typed name will be saved as entered
            </div>
          ) : (
            filtered.map((name) => (
              <div
                key={name}
                onMouseDown={() => handleOptionMouseDown(name)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                  borderBottom: "1px solid var(--border-light)",
                  background: name === value ? "rgba(26,138,138,0.08)" : undefined,
                  fontWeight: name === value ? 600 : undefined,
                  color: name === value ? "var(--teal)" : "var(--text)",
                }}
              >
                {name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
