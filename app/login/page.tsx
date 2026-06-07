"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../providers";
import { IS_DEMO, DEMO_USERS, getLastResetTime } from "@/lib/demo";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (!authLoading && user) router.replace("/dashboard");
  }, [user, authLoading, router]);

  // In demo mode, /login redirects to / where DemoWelcomePage lives
  useEffect(() => {
    if (IS_DEMO && !user) {
      const params = typeof window !== "undefined" ? window.location.search : "";
      router.replace(`/${params}`);
    }
  }, [IS_DEMO, user, router]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [lastReset, setLastReset] = useState<string | null>(null);

  // Check for ?expired=1 query param and last reset time on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("expired=1")) setSessionExpired(true);
      setLastReset(getLastResetTime());
    }
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    const account = await login(username.trim(), password);
    if (account) {
      router.replace("/dashboard");
    } else {
      setError("Invalid username or password. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  }, [username, password, login, router]);

  const handleDemoLogin = useCallback(async (demoUsername: string, demoPassword: string) => {
    setError("");
    setLoading(true);
    const account = await login(demoUsername, demoPassword);
    if (account) {
      router.replace("/dashboard");
    } else {
      setError("Demo login failed. Please try again.");
      setLoading(false);
    }
  }, [login, router]);

  if (IS_DEMO) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f2942", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          {sessionExpired && (
            <div style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#fde68a", fontWeight: 600, marginBottom: 20 }}>
              ⏱️ Your demo session expired due to inactivity. Sign in again to continue.
            </div>
          )}

          {/* Logo */}
          <Image
            src="/logo.jpg"
            alt="ShelterTrace"
            width={120}
            height={120}
            style={{ borderRadius: 20, background: "#ececec", padding: 8, objectFit: "contain", marginBottom: 24 }}
          />

          {/* Demo badge */}
          <div style={{ background: "#f59e0b", color: "#78350f", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, marginBottom: 24, display: "inline-block" }}>
            🔍 DEMO ENVIRONMENT
          </div>

          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Welcome to the ShelterTrace Demo</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, lineHeight: 1.65, marginBottom: 32 }}>
            Explore a fully functional shelter management system pre-loaded with sample data. Choose a role to get started.
          </p>

          {/* Role buttons */}
          {DEMO_USERS.map((u) => (
            <button
              key={u.role}
              onClick={() => handleDemoLogin(u.username, u.password)}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                padding: "16px 20px",
                marginBottom: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                cursor: loading ? "wait" : "pointer",
                color: "#fff",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{u.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Log in as {u.role}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{u.desc}</div>
              </div>
              <span style={{ marginLeft: "auto", color: "#1a8a8a", fontSize: 18 }}>→</span>
            </button>
          ))}

          {error && <div style={{ color: "#fca5a5", fontSize: 13, marginTop: 8 }}>{error}</div>}
          {loading && <div style={{ color: "#93c5fd", fontSize: 13, marginTop: 8 }}>Signing in…</div>}

          <div style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            No password required · Data resets on sign out
          </div>
          {lastReset && (
            <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
              Last session reset: {new Date(lastReset).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f2942", display: "flex" }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 60px", color: "#fff" }}>
        <div style={{ marginBottom: 32 }}>
          <Image src="/logo.jpg" alt="ShelterTrace" width={280} height={140} style={{ objectFit: "contain", borderRadius: 16, background: "#ececec", padding: 8 }} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 300, marginBottom: 12, maxWidth: 480, textAlign: "center", lineHeight: 1.4 }}>
          Every animal <em>deserves</em> a second chance.
        </div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", maxWidth: 420, textAlign: "center", lineHeight: 1.7, marginBottom: 32 }}>
          Streamline your shelter operations with centralized animal records, adoption tracking, medical management, officer dispatch, and real-time reporting.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 380 }}>
          {[
            { icon: "🐾", text: "Centralized animal records with full intake-to-outcome tracking" },
            { icon: "🏡", text: "Adoption management with real-time availability updates" },
            { icon: "📡", text: "Field officer dispatch with live call queue and status tracking" },
            { icon: "💊", text: "Medical records, vaccination schedules, and vet coordination" },
            { icon: "📊", text: "Advanced reporting for compliance, fundraising, and operations" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
              <span style={{ width: 28, height: 28, background: "rgba(26,138,138,0.3)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{f.icon}</span>
              {f.text}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{ width: 440, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 48px", boxShadow: "-10px 0 40px rgba(0,0,0,0.2)" }}>
        <div style={{ width: "100%", animation: shake ? "none" : undefined, filter: shake ? "none" : undefined }}>
          {sessionExpired && (
            <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", padding: "8px 12px", borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
              ⏱️ Your demo session expired due to inactivity.
            </div>
          )}
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Welcome back</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Sign in to your ShelterTrace account</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                autoComplete="username"
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16 }}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: "#fee2e2", color: "#dc2626", padding: "8px 12px", borderRadius: 7, fontSize: 13, marginBottom: 12, border: "1px solid #fca5a5" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "10px", fontSize: 14, marginBottom: 20 }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 20 }}>
            ShelterTrace v1.0 · Shelter Data Systems · © 2026
          </p>
        </div>
      </div>
    </div>
  );
}
