"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { login } from "@/lib/auth";
// All Supabase writes use supabasePublic — consistent anon key, no fieldOps abstraction.
import { supabasePublic } from "@/lib/supabase-public";
import type { StaffAccount, FieldStatus, DispatchCall } from "@/lib/types";
import { today } from "@/lib/utils";

// ── Direct Supabase helpers (bypass fieldOps / lib/supabase.ts) ───────────────

async function dbUpdateStatus(
  officerId: string,
  status: FieldStatus,
  lat?: number | null,
  lng?: number | null
) {
  const fields = {
    current_field_status: status,
    tracking_active: status !== "Off Duty",
    last_location_lat: lat ?? null,
    last_location_lng: lng ?? null,
    last_status_update: new Date().toISOString(),
  };
  console.log("[officer-app] ON DUTY update - id:", officerId, "fields:", fields);
  const { data, error } = await supabasePublic
    .from("staff_accounts")
    .update(fields)
    .eq("id", officerId)
    .select();
  console.log("[officer-app] staff_accounts update result:", data, "error:", error);
  if (error) console.error("[officer-app] UPDATE FAILED:", error.message, error.details, error.hint);
}

async function dbLogActivity(
  officerId: string,
  officerName: string,
  badge: string | undefined,
  status: FieldStatus,
  lat?: number | null,
  lng?: number | null
) {
  const { error } = await supabasePublic.from("field_activity").insert({
    officer_id:    officerId,
    officer_name:  officerName,
    officer_badge: badge,
    status,
    location_lat:  lat ?? null,
    location_lng:  lng ?? null,
    recorded_at:   new Date().toISOString(),
  });
  if (error) console.error("[officer-app] field_activity insert error:", error.message);
}

async function dbLocationPing(
  officerId: string,
  officerName: string,
  status: FieldStatus,
  pos: GeolocationPosition
) {
  const { latitude, longitude, accuracy, speed, heading } = pos.coords;
  console.log("[officer-app] GPS update sent:", latitude, longitude, "accuracy:", accuracy, "officer:", officerId);

  const [staffRes, histRes] = await Promise.all([
    supabasePublic
      .from("staff_accounts")
      .update({
        last_location_lat: latitude,
        last_location_lng: longitude,
        last_status_update: new Date().toISOString(),
        tracking_active: true,
      })
      .eq("id", officerId)
      .select(),
    supabasePublic.from("location_history").insert({
      officer_id:   officerId,
      officer_name: officerName,
      latitude,
      longitude,
      accuracy:     accuracy ?? null,
      speed:        speed    ?? null,
      heading:      heading  ?? null,
      status,
      timestamp:    new Date().toISOString(),
    }),
  ]);

  console.log("[officer-app] GPS update sent:", latitude, longitude, "error:", staffRes.error);
  if (staffRes.error) console.error("[officer-app] GPS staff update FAILED:", staffRes.error.message);
  if (histRes.error)  console.log("[officer-app] location_history error:", histRes.error.message);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const GPS_INTERVAL_MS = 30_000;
const SESSION_KEY = "officer_app_session";

const STATUS_CONFIG: Record<FieldStatus, { color: string; bg: string; label: string }> = {
  "On Duty":  { color: "#22c55e", bg: "#14532d", label: "On Duty" },
  "En Route": { color: "#f59e0b", bg: "#451a03", label: "En Route" },
  "On Scene": { color: "#f97316", bg: "#431407", label: "On Scene" },
  "Available":{ color: "#38bdf8", bg: "#0c4a6e", label: "Available" },
  "Break":    { color: "#a855f7", bg: "#3b0764", label: "Break" },
  "Off Duty": { color: "#94a3b8", bg: "#1e293b", label: "Off Duty" },
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#ef4444", High: "#f97316", Medium: "#f59e0b", Low: "#22c55e",
};

type GpsState = "idle" | "requesting" | "active" | "denied" | "error";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useTime(): string {
  const [time, setTime] = useState(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function PulsingDot({ color = "#22c55e", size = 10 }: { color?: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "op-ping 1.4s ease-out infinite", opacity: 0 }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      <style>{`@keyframes op-ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}`}</style>
    </span>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (officer: StaffAccount) => void }) {
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
      if (!["Officer","Dispatcher","Administrator","Shelter Manager"].some((r) => account.role.includes(r))) {
        setError("This app is for field officers. Contact admin if you need access.");
        return;
      }
      console.log("[officer-app] logged in as:", account.id, account.username, account.first_name, account.last_name, "role:", account.role);
      localStorage.setItem(SESSION_KEY, JSON.stringify(account));
      onLogin(account);
    } catch { setError("Login failed. Check your connection."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#0f2942", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <img src="/mcas_logo.png" alt="MCAS" style={{ width: 80, height: 80, objectFit: "contain", borderRadius: 16, background: "#fff", padding: 8, marginBottom: 20 }} />
      <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>ShelterTrace</div>
      <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 32 }}>Officer Field App · MCAS</div>

      <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
        <input
          autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
          placeholder="Username" autoCapitalize="none" autoCorrect="off"
          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", fontSize: 16, marginBottom: 12, boxSizing: "border-box", background: "#1a3a5c", color: "#e2e8f0" }}
        />
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", fontSize: 16, marginBottom: 16, boxSizing: "border-box", background: "#1a3a5c", color: "#e2e8f0" }}
        />
        {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{error}</div>}
        <button type="submit" disabled={loading || !username || !password} style={{ width: "100%", padding: "16px 0", borderRadius: 12, border: "none", background: loading ? "#334155" : "#1a8a8a", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: 28, fontSize: 12, color: "#475569", textAlign: "center" }}>
        Use your ShelterTrace staff username and password.<br />
        For help call <a href="tel:+17067521195" style={{ color: "#7fc6c6" }}>(706) 752-1195</a>
      </div>
    </div>
  );
}

// ── Main Officer App ──────────────────────────────────────────────────────────

export default function OfficerAppPage() {
  const [officer, setOfficer] = useState<StaffAccount | null>(null);
  const [currentStatus, setCurrentStatus] = useState<FieldStatus>("Off Duty");
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [myCalls, setMyCalls] = useState<DispatchCall[]>([]);
  const [todayLog, setTodayLog] = useState<{ status: FieldStatus; time: string }[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => void } | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [addNarrativeCall, setAddNarrativeCall] = useState<DispatchCall | null>(null);
  const [narrativeText, setNarrativeText] = useState("");
  const [narrativeSaving, setNarrativeSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const watchIdRef   = useRef<number | null>(null);
  const lastSavedRef = useRef<number>(0);
  const officerRef   = useRef<StaffAccount | null>(null);
  const statusRef    = useRef<FieldStatus>("Off Duty");
  const wakeLockRef  = useRef<{ release(): Promise<void> } | null>(null);

  officerRef.current = officer;
  statusRef.current  = currentStatus;

  const time = useTime();

  // ── Restore session & register SW ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const acc: StaffAccount = JSON.parse(raw);
        setOfficer(acc);
      }
    } catch { /* ignore */ }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt({ prompt: () => (e as Event & { prompt?: () => void }).prompt?.() });
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Online/offline
    const setOnline  = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online",  setOnline);
    window.addEventListener("offline", setOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("online",  setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  // ── Load my calls ─────────────────────────────────────────────────────────
  const loadMyCalls = useCallback(async (acc: StaffAccount) => {
    const todayStart = `${today()}T00:00:00`;
    const { data } = await supabasePublic
      .from("dispatch_calls")
      .select("*")
      .gte("date_reported", todayStart)
      .not("status", "in", '("Resolved","Cancelled")')
      .order("date_reported", { ascending: false })
      .limit(50);
    const calls = (data as DispatchCall[] | null) ?? [];
    setMyCalls(calls.filter((c) =>
      (c.assigned_officers ?? []).some(
        (o) => o.id === acc.id || o.name?.toLowerCase().includes(acc.last_name?.toLowerCase() ?? "")
      )
    ));
  }, []);

  useEffect(() => {
    if (officer) loadMyCalls(officer);
    const id = setInterval(() => { if (officer) loadMyCalls(officer); }, 60_000);
    return () => clearInterval(id);
  }, [officer, loadMyCalls]);

  // ── GPS tracking ─────────────────────────────────────────────────────────
  const persistPing = useCallback((pos: GeolocationPosition) => {
    const off = officerRef.current;
    if (!off) return;
    const name = `${off.first_name ?? off.firstName ?? ""} ${off.last_name ?? off.lastName ?? ""}`.trim();
    dbLocationPing(off.id, name, statusRef.current, pos).catch(console.error);
  }, []);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setGpsState("idle");
    setGpsCoords(null);
    // Clear tracking flag in DB
    const off = officerRef.current;
    if (off) {
      supabasePublic.from("staff_accounts").update({
        tracking_active: false,
        last_location_lat: null,
        last_location_lng: null,
        last_status_update: new Date().toISOString(),
      }).eq("id", off.id).then((res: { error: { message: string } | null }) => {
        if (res.error) console.error("[officer-app] stopGPS clear error:", res.error.message);
      });
    }
  }, []);

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) { setGpsState("denied"); return; }
    if (watchIdRef.current !== null) return;
    setGpsState("requesting");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState("active");
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        const now = Date.now();
        if (now - lastSavedRef.current >= GPS_INTERVAL_MS) {
          lastSavedRef.current = now;
          persistPing(pos);
        }
      },
      (err) => { setGpsState(err.code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "error"); watchIdRef.current = null; },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 15_000 }
    );
    // Wake lock — keep screen on while tracking
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } })
        .wakeLock.request("screen")
        .then((l) => { wakeLockRef.current = l; })
        .catch(() => {});
    }
  }, [persistPing]);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const onVisible = () => {
      if (wakeLockRef.current === null && gpsState === "active") {
        (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } })
          .wakeLock?.request("screen").then((l) => { wakeLockRef.current = l; }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [gpsState]);

  useEffect(() => () => { stopGPS(); }, [stopGPS]);

  // ── Status helpers ────────────────────────────────────────────────────────
  async function saveStatus(status: FieldStatus) {
    if (!officer) return;
    const name = `${officer.first_name ?? officer.firstName ?? ""} ${officer.last_name ?? officer.lastName ?? ""}`.trim();
    await Promise.all([
      dbUpdateStatus(officer.id, status, gpsCoords?.lat, gpsCoords?.lng),
      dbLogActivity(officer.id, name, officer.badge, status, gpsCoords?.lat, gpsCoords?.lng),
    ]);
    setCurrentStatus(status);
    setTodayLog((prev) => [{ status, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
  }

  async function handleGoOnDuty() {
    if (!officer) return;
    console.log("[officer-app] Going on duty, updating staff_accounts...");
    console.log("[officer-app] Officer id:", officer.id, "| username:", officer.username, "| badge:", officer.badge);
    console.log("[officer-app] Updated fields: current_field_status, last_location_lat, last_location_lng, last_status_update, tracking_active");
    setIsOnDuty(true);
    startGPS();
    await saveStatus("On Duty");
    setStatusMsg("You are now ON DUTY — location tracking active");
    setTimeout(() => setStatusMsg(null), 4000);
  }

  async function handleGoOffDuty() {
    if (!officer) return;
    setIsOnDuty(false);
    stopGPS(); // also clears lat/lng/tracking_active in DB
    // Explicit Off Duty write so the map removes the marker immediately
    const { data, error } = await supabasePublic
      .from("staff_accounts")
      .update({
        current_field_status: "Off Duty",
        tracking_active: false,
        last_location_lat: null,
        last_location_lng: null,
        last_status_update: new Date().toISOString(),
      })
      .eq("id", officer.id)
      .select();
    console.log("[officer-app] OFF DUTY update result:", data, "error:", error);
    setCurrentStatus("Off Duty");
    setTodayLog((prev) => [{ status: "Off Duty", time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
    setStatusMsg("You are now OFF DUTY — location tracking stopped");
    setTimeout(() => setStatusMsg(null), 4000);
  }

  async function handleStatusChange(status: FieldStatus) {
    await saveStatus(status);
  }

  // ── Narrative ─────────────────────────────────────────────────────────────
  async function handleSaveNarrative() {
    if (!addNarrativeCall || !narrativeText.trim() || !officer) return;
    setNarrativeSaving(true);
    try {
      const entry = {
        id: Math.random().toString(36).slice(2).toUpperCase(),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        officer: `${officer.first_name ?? officer.firstName ?? ""} ${officer.last_name ?? officer.lastName ?? ""}`.trim(),
        text: narrativeText.trim(),
      };
      const existing = (addNarrativeCall.narrative ?? []) as typeof entry[];
      await supabasePublic.from("dispatch_calls").update({ narrative: [...existing, entry] }).eq("id", addNarrativeCall.id);
      setAddNarrativeCall(null);
      setNarrativeText("");
      if (officer) loadMyCalls(officer);
    } catch (e) { console.error("[narrative]", e); }
    finally { setNarrativeSaving(false); }
  }

  function handleSignOut() {
    stopGPS();
    localStorage.removeItem(SESSION_KEY);
    setOfficer(null);
    setIsOnDuty(false);
    setCurrentStatus("Off Duty");
    setTodayLog([]);
  }

  // ── Render: login ─────────────────────────────────────────────────────────
  if (!officer) {
    return <LoginScreen onLogin={(acc) => { setOfficer(acc); setCurrentStatus("Off Duty"); }} />;
  }

  const sc = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG["Off Duty"];
  const officerName = `${officer.first_name ?? officer.firstName ?? ""} ${officer.last_name ?? officer.lastName ?? ""}`.trim() || officer.username;

  // ── Render: main app ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "#0f2942", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#e2e8f0", userSelect: "none" }}>
      <style>{`
        * { box-sizing: border-box; }
        button { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        .action-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; padding: 14px 8px; background: #1a3a5c; border: 1px solid #2d4f6e;
          border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 700;
          color: #7fc6c6; min-height: 72px; text-align: center; transition: background 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .action-btn:active { background: #243f5e; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ background: "#071e33", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid #1a3a5c" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/mcas_logo.png" alt="MCAS" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 6, background: "#fff", padding: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{officerName}</div>
            {officer.badge && <div style={{ fontSize: 11, color: "#7fc6c6" }}>Badge #{officer.badge}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* GPS indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: gpsState === "active" ? "#22c55e" : "#64748b" }}>
            {gpsState === "active" ? <PulsingDot size={8} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#334155", display: "inline-block" }} />}
            GPS
          </div>
          {/* Online indicator */}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOnline ? "#22c55e" : "#ef4444" }} title={isOnline ? "Online" : "Offline"} />
          <div style={{ fontSize: 12, color: "#94a3b8", minWidth: 70, textAlign: "right" }}>{time}</div>
          <button onClick={handleSignOut} style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", padding: "4px 6px" }}>Sign out</button>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{ background: "#7c2d12", padding: "8px 16px", fontSize: 13, fontWeight: 700, textAlign: "center", color: "#fed7aa" }}>
          ⚠ No internet connection — status changes will sync when back online
        </div>
      )}

      {/* GPS denied warning */}
      {gpsState === "denied" && (
        <div style={{ background: "#450a0a", padding: "8px 16px", fontSize: 12, textAlign: "center", color: "#fca5a5" }}>
          Location access denied. Enable location in Settings → Browser to share your position.
        </div>
      )}

      {/* Status toast */}
      {statusMsg && (
        <div style={{ position: "fixed", bottom: 24, left: 16, right: 16, background: isOnDuty ? "#14532d" : "#7f1d1d", color: "#fff", borderRadius: 12, padding: "14px 18px", fontWeight: 700, fontSize: 14, textAlign: "center", zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {statusMsg}
        </div>
      )}

      <div style={{ padding: "16px 16px 40px", maxWidth: 480, margin: "0 auto" }}>

        {/* ── Duty Card ── */}
        <div style={{ background: "#1a3a5c", borderRadius: 16, padding: 18, marginBottom: 16, border: `2px solid ${isOnDuty ? "#22c55e30" : "#ef444430"}` }}>
          {/* Current status badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 800, background: sc.bg, color: sc.color }}>
              {sc.label}
            </span>
            {gpsState === "active" && gpsCoords && (
              <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
                ● GPS · ±{Math.round(gpsCoords.accuracy)}m
              </span>
            )}
          </div>

          {/* Duty toggle button */}
          <button
            onClick={isOnDuty ? handleGoOffDuty : handleGoOnDuty}
            style={{
              width: "100%", padding: "18px 0", borderRadius: 14, border: "none",
              background: isOnDuty ? "#7f1d1d" : "#14532d",
              color: "#fff", fontSize: 20, fontWeight: 900, cursor: "pointer",
              letterSpacing: "0.05em", marginBottom: 14,
              boxShadow: `0 0 20px ${isOnDuty ? "#ef444440" : "#22c55e40"}`,
            }}
          >
            {isOnDuty ? "🔴 GO OFF DUTY" : "🟢 GO ON DUTY"}
          </button>

          {/* Status buttons — only when on duty */}
          {isOnDuty && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["Available","En Route","On Scene","Break"] as FieldStatus[]).map((s) => {
                const c = STATUS_CONFIG[s];
                const active = currentStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    style={{
                      padding: "13px 0", borderRadius: 10, border: `2px solid ${active ? c.color : c.color + "40"}`,
                      background: active ? c.bg : "transparent",
                      color: active ? c.color : c.color + "99",
                      fontSize: 14, fontWeight: 800, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── My Calls ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7fc6c6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            My Calls Today ({myCalls.length})
          </div>
          {myCalls.length === 0 ? (
            <div style={{ background: "#1a3a5c", borderRadius: 12, padding: "16px 18px", fontSize: 14, color: "#475569", textAlign: "center" }}>
              No calls assigned to you today
            </div>
          ) : myCalls.map((call) => {
            const priorityColor = PRIORITY_COLORS[call.priority ?? ""] ?? "#94a3b8";
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([call.address, call.city, "GA"].filter(Boolean).join(", "))}`;
            return (
              <div key={call.id} style={{ background: "#1a3a5c", borderRadius: 12, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${priorityColor}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{call.type}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{call.address || "No address"}{call.city ? `, ${call.city}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: `${priorityColor}30`, color: priorityColor }}>{call.priority}</span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{call.status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#0f2942", color: "#38bdf8", fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center", border: "1px solid #1d4ed8" }}>
                    🗺 Navigate
                  </a>
                  <button onClick={() => { setAddNarrativeCall(call); setNarrativeText(""); }}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#0f2942", color: "#94a3b8", fontSize: 13, fontWeight: 700, border: "1px solid #334155", cursor: "pointer" }}>
                    📝 Narrative
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7fc6c6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Quick Actions</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { icon: "📡", label: "New Call",     href: "/dispatch/new" },
              { icon: "🔬", label: "Microchip",    href: "/search?tab=microchip" },
              { icon: "🪪", label: "Scan License", href: "/search?tab=people" },
              { icon: "🐾", label: "Find Animal",  href: "/search?tab=animals" },
              { icon: "👤", label: "Find Person",  href: "/search?tab=people" },
              { icon: "🗺",  label: "Field Map",   href: "/field-ops" },
            ].map(({ icon, label, href }) => (
              <a key={label} href={href}
                className="action-btn"
                style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Today's Activity ── */}
        {todayLog.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7fc6c6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Today&apos;s Activity</div>
            <div style={{ background: "#1a3a5c", borderRadius: 12, overflow: "hidden" }}>
              {todayLog.map((entry, i) => {
                const sc2 = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG["Off Duty"];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i < todayLog.length - 1 ? "1px solid #0f2942" : "none" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc2.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, flex: 1, fontWeight: 600, color: sc2.color }}>{entry.status}</span>
                    <span style={{ fontSize: 12, color: "#475569" }}>{entry.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PWA Install Banner ── */}
        {showInstallBanner && (
          <div style={{ marginTop: 20, background: "#1e3a5f", border: "1px solid #2d4f6e", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Install ShelterTrace</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>Add to your home screen for quick access from the field.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { installPrompt?.prompt(); setShowInstallBanner(false); }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#1a8a8a", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Install
              </button>
              <button onClick={() => setShowInstallBanner(false)}
                style={{ padding: "10px 16px", borderRadius: 8, background: "none", color: "#475569", border: "1px solid #334155", cursor: "pointer", fontSize: 14 }}>
                Not now
              </button>
            </div>
          </div>
        )}

        {/* iOS install hint — shown when NOT standalone */}
        {!showInstallBanner && typeof window !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as Navigator & { standalone?: boolean }).standalone && (
          <div style={{ marginTop: 20, background: "#1a3a5c", borderRadius: 12, padding: "12px 16px", fontSize: 12, color: "#7fc6c6", textAlign: "center" }}>
            📲 To install: tap <strong>Share</strong> then <strong>Add to Home Screen</strong>
          </div>
        )}
      </div>

      {/* ── Add Narrative Modal ── */}
      {addNarrativeCall && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end", zIndex: 300 }} onClick={() => setAddNarrativeCall(null)}>
          <div style={{ background: "#1a3a5c", borderRadius: "20px 20px 0 0", padding: "20px 20px 32px", width: "100%", maxHeight: "70dvh" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#334155", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Add Narrative</div>
            <div style={{ fontSize: 12, color: "#7fc6c6", marginBottom: 14 }}>{addNarrativeCall.type} · {addNarrativeCall.address}</div>
            <textarea
              autoFocus
              value={narrativeText}
              onChange={(e) => setNarrativeText(e.target.value)}
              placeholder="Enter narrative entry…"
              rows={5}
              style={{ width: "100%", background: "#0f2942", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", color: "#e2e8f0", fontSize: 14, resize: "none", marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAddNarrativeCall(null)} style={{ flex: 1, padding: "14px 0", borderRadius: 10, background: "#0f2942", color: "#94a3b8", border: "1px solid #334155", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSaveNarrative} disabled={narrativeSaving || !narrativeText.trim()}
                style={{ flex: 2, padding: "14px 0", borderRadius: 10, background: narrativeSaving || !narrativeText.trim() ? "#334155" : "#1a8a8a", color: "#fff", border: "none", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                {narrativeSaving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
