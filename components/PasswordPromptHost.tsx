"use client";
import { useEffect, useRef, useState } from "react";
import { registerPasswordAsker } from "@/lib/passwordPrompt";

// Mounted once (AuthProvider). Renders a modal whenever an account-management
// action needs the signed-in person's password (see lib/passwordPrompt.ts).
export default function PasswordPromptHost() {
  const [reason, setReason] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const resolver = useRef<((pw: string | null) => void) | null>(null);

  useEffect(() => {
    registerPasswordAsker((why) => new Promise((resolve) => {
      resolver.current?.(null);   // a newer request supersedes an older one
      resolver.current = resolve;
      setValue("");
      setReason(why);
    }));
    return () => { registerPasswordAsker(null); resolver.current?.(null); };
  }, []);

  const finish = (pw: string | null) => {
    resolver.current?.(pw);
    resolver.current = null;
    setReason(null);
    setValue("");
  };

  if (reason === null) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Confirm your password"
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null); }}>
      <form onSubmit={(e) => { e.preventDefault(); if (value) finish(value); }}
        style={{ background: "var(--surface, #fff)", color: "var(--text-primary, #0f172a)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>Confirm your password</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #64748b)", marginBottom: 14 }}>{reason}</div>
        <input className="form-input" type="password" autoFocus autoComplete="current-password" value={value}
          onChange={(e) => setValue(e.target.value)} placeholder="Your password" />
        <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", margin: "8px 0 16px" }}>
          Remembered in this tab for 5 minutes only.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={() => finish(null)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!value}>Confirm</button>
        </div>
      </form>
    </div>
  );
}
