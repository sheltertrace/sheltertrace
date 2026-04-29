"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../providers";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  // If already logged in, go straight to dashboard
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

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
      router.replace("/");
    } else {
      setError("Invalid username or password. Please try again.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  }, [username, password, login, router]);

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
