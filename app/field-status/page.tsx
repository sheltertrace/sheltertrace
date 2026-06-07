"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  fetchOfficerByUsername,
  updateOfficerFieldStatus,
  logFieldActivity,
  saveLocationPing,
  clearOfficerTracking,
} from "@/lib/fieldOps";
import type { OfficerFieldProfile, FieldStatus } from "@/lib/types";
import { AGENCY_NAME, AGENCY_SHORT } from "@/lib/shelterInfo";

const STATUSES: { label: FieldStatus; color: string; bg: string }[] = [
  { label: "On Duty",   color: "#1e7e34", bg: "#e6f4ea" },
  { label: "En Route",  color: "#856404", bg: "#fff3cd" },
  { label: "On Scene",  color: "#004085", bg: "#cce5ff" },
  { label: "Available", color: "#0c5460", bg: "#d1ecf1" },
  { label: "Break",     color: "#721c24", bg: "#f8d7da" },
  { label: "Off Duty",  color: "#495057", bg: "#e9ecef" },
];

const GPS_INTERVAL_MS = 30_000; // save to DB every 30 seconds

type Step = "identify" | "main";
type GpsState = "idle" | "requesting" | "active" | "denied" | "error";

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
      <div style={{ width: 32, height: 32, border: "4px solid #ccc", borderTopColor: "#1a8a8a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PulsingDot({ color = "#22c55e" }: { color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10, verticalAlign: "middle" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "gps-ping 1.4s ease-out infinite", opacity: 0 }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
      <style>{`@keyframes gps-ping { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }`}</style>
    </span>
  );
}

export default function FieldStatusPage() {
  const [step, setStep] = useState<Step>("identify");
  const [usernameInput, setUsernameInput] = useState("");
  const [officer, setOfficer] = useState<OfficerFieldProfile | null>(null);
  const [identifyError, setIdentifyError] = useState("");
  const [identifyLoading, setIdentifyLoading] = useState(false);

  const [currentStatus, setCurrentStatus] = useState<FieldStatus>("Off Duty");
  const [locationLabel, setLocationLabel] = useState("");
  const [callNumber, setCallNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [mileageStart, setMileageStart] = useState("");
  const [mileageEnd, setMileageEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [history, setHistory] = useState<{ status: FieldStatus; time: string; location?: string }[]>([]);

  // GPS tracking state
  const [gpsState, setGpsState] = useState<GpsState>("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Refs — safe to read from watchPosition callbacks
  const watchIdRef   = useRef<number | null>(null);
  const lastSavedRef = useRef<number>(0);
  const officerRef   = useRef<OfficerFieldProfile | null>(null);
  const statusRef    = useRef<FieldStatus>("Off Duty");
  const wakeLockRef  = useRef<{ release(): Promise<void> } | null>(null);

  // Keep refs in sync with state (called synchronously in render)
  officerRef.current = officer;
  statusRef.current  = currentStatus;

  // Save a location ping to DB (throttled — only called from watchPosition callback)
  const persistPing = useCallback((pos: GeolocationPosition) => {
    const off = officerRef.current;
    if (!off) return;
    saveLocationPing({
      officerId:   off.id,
      officerName: `${off.first_name} ${off.last_name}`,
      latitude:    pos.coords.latitude,
      longitude:   pos.coords.longitude,
      accuracy:    pos.coords.accuracy,
      speed:       pos.coords.speed,
      heading:     pos.coords.heading,
      status:      statusRef.current,
    }).catch(console.error);
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    setGpsState("idle");
    // Mark tracking inactive in DB (non-blocking)
    officerRef.current && clearOfficerTracking(officerRef.current.id).catch(console.error);
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) { setGpsState("denied"); return; }
    if (watchIdRef.current !== null) return; // already running

    setGpsState("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState("active");
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });

        // Throttle: save to DB at most once every 30 s
        const now = Date.now();
        if (now - lastSavedRef.current >= GPS_INTERVAL_MS) {
          lastSavedRef.current = now;
          persistPing(pos);
        }
      },
      (err) => {
        setGpsState(err.code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "error");
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, timeout: 30_000, maximumAge: 10_000 }
    );

    // Screen Wake Lock — keeps screen on so tracking continues
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request(t: string): Promise<{ release(): Promise<void> }> } })
        .wakeLock.request("screen")
        .then((lock) => { wakeLockRef.current = lock; })
        .catch(() => {}); // non-critical
    }
  }, [persistPing]);

  // Start / stop tracking based on officer + status
  useEffect(() => {
    if (officer && currentStatus !== "Off Duty") {
      startTracking();
    } else {
      stopTracking();
    }
  }, [officer?.id, currentStatus, startTracking, stopTracking]);

  // Stop tracking when the page is unmounted (officer navigates away)
  useEffect(() => () => { stopTracking(); }, [stopTracking]);

  // Re-acquire wake lock when page becomes visible again (device unlocked)
  useEffect(() => {
    const onVisible = () => {
      if (wakeLockRef.current === null && gpsState === "active") {
        (navigator as Navigator & { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } })
          .wakeLock?.request("screen")
          .then((l) => { wakeLockRef.current = l; })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [gpsState]);

  async function handleIdentify() {
    if (!usernameInput.trim()) return;
    setIdentifyLoading(true);
    setIdentifyError("");
    const p = await fetchOfficerByUsername(usernameInput.trim());
    setIdentifyLoading(false);
    if (!p) {
      setIdentifyError("Username not found. Use your ShelterTrace login username.");
      return;
    }
    setOfficer(p);
    setCurrentStatus(p.current_field_status);
    setStep("main");
  }

  async function handleCheckIn(status: FieldStatus) {
    if (!officer) return;
    setSaving(true);
    setSavedMsg("");
    const now = new Date().toISOString();
    await Promise.all([
      updateOfficerFieldStatus(officer.id, status, {
        lat: gpsCoords?.lat,
        lng: gpsCoords?.lng,
        locationLabel: locationLabel || undefined,
      }),
      logFieldActivity({
        officer_id:    officer.id,
        officer_name:  `${officer.first_name} ${officer.last_name}`,
        officer_badge: officer.badge,
        status,
        location_lat:   gpsCoords?.lat ?? null,
        location_lng:   gpsCoords?.lng ?? null,
        location_label: locationLabel || undefined,
        call_number:    callNumber || undefined,
        notes:          notes || undefined,
        mileage_start:  mileageStart ? parseFloat(mileageStart) : undefined,
        mileage_end:    mileageEnd   ? parseFloat(mileageEnd)   : undefined,
        recorded_at:    now,
      }),
    ]);
    setCurrentStatus(status);
    setOfficer((prev) => prev ? { ...prev, current_field_status: status, last_status_update: now } : prev);
    setHistory((prev) => [
      { status, time: new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), location: locationLabel },
      ...prev,
    ]);
    setNotes("");
    setCallNumber("");
    setMileageStart(mileageEnd || "");
    setMileageEnd("");
    setSaving(false);
    setSavedMsg(`Checked in as "${status}"`);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  function handleSignOut() {
    stopTracking();
    setStep("identify");
    setOfficer(null);
    setUsernameInput("");
    setHistory([]);
    setCurrentStatus("Off Duty");
    setGpsState("idle");
    setGpsCoords(null);
  }

  const activeStatusInfo = STATUSES.find((s) => s.label === currentStatus) ?? STATUSES[5];
  const isTracking = gpsState === "active";

  // ── Identify step ─────────────────────────────────────────────────────────
  if (step === "identify") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "#0f2942" }}>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>ShelterTrace</div>
        <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 32 }}>Field Status Check-In</div>
        <div style={{ background: "#fff", borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 380, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "#0f2942" }}>Enter Your Username</div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16, lineHeight: 1.5 }}>
            ${AGENCY_SHORT} needs your location while on duty for dispatch coordination.
          </div>
          <input
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleIdentify(); }}
            placeholder="Your ShelterTrace login username"
            autoCapitalize="none"
            autoCorrect="off"
            style={{ width: "100%", border: "1px solid #ccc", borderRadius: 8, padding: "12px 14px", fontSize: 16, marginBottom: 12, boxSizing: "border-box" }}
          />
          {identifyError && <div style={{ color: "#dc3545", fontSize: 13, marginBottom: 10 }}>{identifyError}</div>}
          {identifyLoading ? <Spinner /> : (
            <button
              onClick={handleIdentify}
              style={{ width: "100%", background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 8, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Main step ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px", minHeight: "100dvh" }}>

      {/* Header */}
      <div style={{ background: "#0f2942", borderRadius: 12, padding: "14px 18px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            {officer?.first_name} {officer?.last_name}
          </div>
          <div style={{ color: "#7fc6c6", fontSize: 13 }}>
            @{officer?.username}{officer?.badge ? ` · Badge ${officer.badge}` : ""}
          </div>
        </div>
        <div style={{ background: activeStatusInfo.bg, color: activeStatusInfo.color, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
          {currentStatus}
        </div>
      </div>

      {/* GPS Tracking Indicator */}
      <div style={{
        borderRadius: 10, padding: "10px 14px", marginBottom: 12,
        background: gpsState === "active" ? "#f0fdf4" : gpsState === "denied" ? "#fef2f2" : gpsState === "requesting" ? "#fefce8" : "#f8fafc",
        border: `1px solid ${gpsState === "active" ? "#86efac" : gpsState === "denied" ? "#fca5a5" : gpsState === "requesting" ? "#fde047" : "#e2e8f0"}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {gpsState === "active" ? (
          <>
            <PulsingDot color="#22c55e" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Location sharing: Active</div>
              {gpsCoords && (
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                  {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
                  {gpsCoords.accuracy < 100 ? ` · ±${Math.round(gpsCoords.accuracy)}m` : ""}
                </div>
              )}
            </div>
          </>
        ) : gpsState === "denied" ? (
          <div style={{ fontSize: 13, color: "#dc2626" }}>
            📵 Location sharing is disabled. Enable location access in your browser settings.
          </div>
        ) : gpsState === "requesting" ? (
          <div style={{ fontSize: 13, color: "#92400e" }}>📍 Requesting location permission…</div>
        ) : gpsState === "error" ? (
          <div style={{ fontSize: 13, color: "#dc2626" }}>⚠ GPS unavailable. Check device location settings.</div>
        ) : (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            📍 Location sharing will start when you go on duty.
          </div>
        )}

        {isTracking && (
          <div style={{ fontSize: 10, color: "#86efac", fontWeight: 600, flexShrink: 0 }}>AUTO</div>
        )}
      </div>

      {/* Optional fields */}
      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0f2942", marginBottom: 10 }}>Details (optional)</div>
        <input
          placeholder="Location / Address"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value)}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
        />
        <input
          placeholder="Call # (if responding)"
          value={callNumber}
          onChange={(e) => setCallNumber(e.target.value)}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, marginBottom: 8, boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Mileage start"
            value={mileageStart}
            onChange={(e) => setMileageStart(e.target.value)}
            type="number" step="0.1"
            style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
          />
          <input
            placeholder="Mileage end"
            value={mileageEnd}
            onChange={(e) => setMileageEnd(e.target.value)}
            type="number" step="0.1"
            style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
          />
        </div>
        <textarea
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13, resize: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Status buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <button
            key={s.label}
            disabled={saving}
            onClick={() => handleCheckIn(s.label)}
            style={{
              background: currentStatus === s.label ? s.color : s.bg,
              color: currentStatus === s.label ? "#fff" : s.color,
              border: `2px solid ${s.color}`,
              borderRadius: 10, padding: "16px 10px", fontSize: 14, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {savedMsg && (
        <div style={{ background: "#d4edda", color: "#155724", border: "1px solid #c3e6cb", borderRadius: 8, padding: "10px 14px", textAlign: "center", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
          {savedMsg}
        </div>
      )}

      {/* Background tracking note */}
      {isTracking && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1d4ed8", marginBottom: 16, lineHeight: 1.5 }}>
          🔒 Keep this page open for continuous location updates. Updates are sent every 30 seconds while you&apos;re on duty.
        </div>
      )}

      {/* Today's check-in history */}
      {history.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f2942", marginBottom: 10 }}>Today&apos;s Activity</div>
          {history.map((h, i) => {
            const s = STATUSES.find((x) => x.label === h.status) ?? STATUSES[5];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#888", minWidth: 42 }}>{h.time}</span>
                <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{h.status}</span>
                {h.location && <span style={{ fontSize: 12, color: "#555" }}>{h.location}</span>}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleSignOut}
        style={{ background: "transparent", border: "none", color: "#888", fontSize: 13, cursor: "pointer", textDecoration: "underline", display: "block", width: "100%", textAlign: "center" }}
      >
        Sign out / Switch officer
      </button>
    </div>
  );
}
