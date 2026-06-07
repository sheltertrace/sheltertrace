"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/app/providers";
import { DEMO_USERS, getLastResetTime } from "@/lib/demo";

export default function DemoWelcomePage() {
  const { demoLogin, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wasReset, setWasReset] = useState(false);
  const [lastReset, setLastReset] = useState<string | null>(null);

  // If already logged in (e.g. back-nav after session), go to dashboard
  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  // Check if a session was just reset; log env diagnostics
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "1" || params.get("expired") === "1") setWasReset(true);
      setLastReset(getLastResetTime());
      // Diagnostic: confirm demo env is wired to the correct Supabase project
      console.log("[demo] DemoWelcomePage mounted");
      console.log("[demo] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("[demo] NEXT_PUBLIC_IS_DEMO:", process.env.NEXT_PUBLIC_IS_DEMO);
    }
  }, []);

  const handleDemoLogin = useCallback(async (accountId: string) => {
    setError("");
    setLoading(true);
    try {
      const account = await demoLogin(accountId);
      if (account) {
        router.replace("/dashboard");
      } else {
        setError("Could not find the demo account. The demo database may still be initializing — please try again in a moment.");
        setLoading(false);
      }
    } catch {
      setError("Demo login failed — please try again or refresh the page.");
      setLoading(false);
    }
  }, [demoLogin, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#0f2942", display: "flex", flexDirection: "column" }}>

      {/* Demo banner */}
      <div style={{ background: "#f59e0b", color: "#78350f", padding: "10px 20px", textAlign: "center", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative" }}>
        🔍 <strong>Demo Environment</strong> — Explore freely. Data resets on sign out or after 5 minutes of inactivity.
        <span style={{ position: "absolute", right: 14, background: "#92400e", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>DEMO</span>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>

          {/* Logo */}
          <div style={{ marginBottom: 28 }}>
            <Image
              src="/logo.jpg"
              alt="ShelterTrace"
              width={140}
              height={140}
              priority
              quality={100}
              style={{ borderRadius: 24, background: "#ececec", objectFit: "contain", boxShadow: "0 0 0 5px rgba(26,138,138,0.35), 0 20px 60px rgba(0,0,0,0.5)" }}
            />
          </div>

          {/* Reset confirmation */}
          {wasReset && (
            <div style={{ background: "rgba(26,138,138,0.15)", border: "1px solid rgba(26,138,138,0.4)", borderRadius: 10, padding: "12px 18px", marginBottom: 24, fontSize: 14, color: "#5eead4", fontWeight: 600 }}>
              ✓ Your demo session has been reset. Sign in to start fresh.
            </div>
          )}

          <h1 style={{ color: "#fff", fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 900, margin: "0 0 12px", lineHeight: 1.2 }}>
            Welcome to the ShelterTrace Demo
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, lineHeight: 1.7, margin: "0 0 36px", maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            Explore a fully functional animal shelter management system pre-loaded with sample data. No account needed — just pick a role and start exploring.
          </p>

          {/* Role buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {DEMO_USERS.map(u => (
              <button
                key={u.role}
                onClick={() => handleDemoLogin(u.id)}
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  width: "100%", padding: "18px 22px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 12, cursor: loading ? "wait" : "pointer",
                  color: "#fff", textAlign: "left",
                  transition: "background 0.15s, border-color 0.15s",
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
              >
                <span style={{ fontSize: 30, flexShrink: 0 }}>{u.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>
                    Log in as {u.role}
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{u.desc}</div>
                </div>
                <span style={{ color: "#1a8a8a", fontSize: 20, flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>

          {error && (
            <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
          )}
          {loading && (
            <div style={{ color: "#93c5fd", fontSize: 13, marginBottom: 16 }}>Signing in…</div>
          )}

          {/* Session note */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", lineHeight: 1.6 }}>
            Your session will automatically reset after 5 minutes of inactivity or when you sign out.
            {lastReset && (
              <div style={{ marginTop: 4 }}>
                Last session reset: {new Date(lastReset).toLocaleString()}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "14px 24px", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        ShelterTrace Demo · <a href="https://sheltertrace.com" target="_blank" rel="noopener" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>sheltertrace.com</a>
      </div>
    </div>
  );
}
