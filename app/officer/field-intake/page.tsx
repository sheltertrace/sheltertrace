"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, getCurrentUser, PasswordResetRequiredError, LoginLockedError } from "@/lib/auth";
import type { StaffAccount } from "@/lib/types";
import FieldIntakeWizard from "@/components/fieldIntake/FieldIntakeWizard";

const SESSION_KEY = "officer_app_session";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 14px", borderRadius: 10, border: "1px solid #334155",
  background: "#0f2942", color: "#e2e8f0", fontSize: 16, boxSizing: "border-box", minHeight: 48,
};

export default function FieldIntakePage() {
  return (
    <Suspense fallback={null}>
      <FieldIntakePageContent />
    </Suspense>
  );
}

function FieldIntakePageContent() {
  const [officer, setOfficer] = useState<StaffAccount | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const params = useSearchParams();
  const callId = params.get("callId") || "";
  const address = params.get("address") || "";
  const officerParam = params.get("officer") || "";

  // This route has two real entry points: (1) opened from inside the
  // already-authenticated main app (a dispatch call's "Intake Animal"
  // link), and (2) a true cold-open on an officer's phone that has never
  // logged into the main web app. Case 1 must never see a sign-in screen —
  // check for the main app's own session first and only fall back to the
  // officer-app's separate remembered session, then finally the sign-in
  // form, if neither exists.
  useEffect(() => {
    const mainSessionUser = getCurrentUser();
    if (mainSessionUser) {
      console.log("[field-intake] session:", mainSessionUser.id, "params:", callId, address, officerParam);
      setOfficer(mainSessionUser);
      setAuthChecked(true);
      return;
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const restored = JSON.parse(raw) as StaffAccount;
        console.log("[field-intake] session:", restored.id, "params:", callId, address, officerParam);
        setOfficer(restored);
        setAuthChecked(true);
        return;
      }
    } catch { /* ignore */ }
    console.log("[field-intake] session:", undefined, "params:", callId, address, officerParam);
    setAuthChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authChecked) {
    return <div style={{ minHeight: "100dvh", background: "#0f2942" }} />;
  }
  if (!officer) {
    return <FieldIntakeGate onLogin={setOfficer} />;
  }
  return (
    <FieldIntakeWizard
      officer={officer}
      prefillCallId={callId}
      prefillAddress={address}
    />
  );
}

// ── Auth gate — true cold-open only (no main-app session, no remembered
// officer-app session) ─────────────────────────────────────────────────────

function FieldIntakeGate({ onLogin }: { onLogin: (o: StaffAccount) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const account = await login(username.trim(), password);
      if (!account) { setError("Invalid username or password."); return; }
      localStorage.setItem(SESSION_KEY, JSON.stringify(account));
      onLogin(account);
    } catch (err) {
      if (err instanceof PasswordResetRequiredError) setError("Your password must be changed first. Sign in at the main ShelterTrace site to set a new one, then return here.");
      else if (err instanceof LoginLockedError) setError(err.message);
      else setError("Login failed. Check your connection.");
    }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0f2942", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Field Intake</div>
      <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 32 }}>Officer sign-in required</div>
      <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
        <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoCapitalize="none" autoCorrect="off" style={{ ...inputStyle, marginBottom: 12 }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" style={{ ...inputStyle, marginBottom: 16 }} />
        {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}
        <button type="submit" disabled={loading || !username || !password} style={{ width: "100%", padding: "16px 0", borderRadius: 12, border: "none", background: loading ? "#334155" : "#1a8a8a", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
