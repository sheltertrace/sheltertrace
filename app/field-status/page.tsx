"use client";

import { useState, useRef } from "react";
import {
  fetchOfficerByUsername,
  updateOfficerFieldStatus,
  logFieldActivity,
} from "@/lib/fieldOps";
import type { OfficerFieldProfile, FieldStatus } from "@/lib/types";

const STATUSES: { label: FieldStatus; color: string; bg: string }[] = [
  { label: "On Duty",  color: "#1e7e34", bg: "#e6f4ea" },
  { label: "En Route", color: "#856404", bg: "#fff3cd" },
  { label: "On Scene", color: "#004085", bg: "#cce5ff" },
  { label: "Available",color: "#0c5460", bg: "#d1ecf1" },
  { label: "Break",    color: "#721c24", bg: "#f8d7da" },
  { label: "Off Duty", color: "#495057", bg: "#e9ecef" },
];

type Step = "identify" | "main";

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
      <div style={{
        width: 32, height: 32, border: "4px solid #ccc",
        borderTopColor: "#1a8a8a", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsLabel, setGpsLabel] = useState("Tap to get GPS");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [history, setHistory] = useState<{ status: FieldStatus; time: string; location?: string }[]>([]);
  const mileageStartRef = useRef<HTMLInputElement>(null);

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

  function captureGPS() {
    if (!navigator.geolocation) {
      setGpsLabel("GPS not supported");
      return;
    }
    setGpsLabel("Getting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude);
        setGpsLng(pos.coords.longitude);
        setGpsLabel(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => setGpsLabel("Location unavailable"),
      { timeout: 10000 }
    );
  }

  async function handleCheckIn(status: FieldStatus) {
    if (!officer) return;
    setSaving(true);
    setSavedMsg("");
    const now = new Date().toISOString();
    await Promise.all([
      updateOfficerFieldStatus(officer.id, status, {
        lat: gpsLat ?? undefined,
        lng: gpsLng ?? undefined,
        locationLabel: locationLabel || undefined,
      }),
      logFieldActivity({
        officer_id: officer.id,
        officer_name: `${officer.first_name} ${officer.last_name}`,
        officer_badge: officer.badge,
        status,
        location_lat: gpsLat,
        location_lng: gpsLng,
        location_label: locationLabel || undefined,
        call_number: callNumber || undefined,
        notes: notes || undefined,
        mileage_start: mileageStart ? parseFloat(mileageStart) : undefined,
        mileage_end: mileageEnd ? parseFloat(mileageEnd) : undefined,
        recorded_at: now,
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

  const activeStatusInfo = STATUSES.find((s) => s.label === currentStatus) ?? STATUSES[5];

  if (step === "identify") {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#0f2942",
      }}>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
          ShelterTrace
        </div>
        <div style={{ color: "#7fc6c6", fontSize: 14, marginBottom: 32 }}>
          Field Status Check-In
        </div>
        <div style={{
          background: "#fff",
          borderRadius: 14,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#0f2942" }}>
            Enter Your Username
          </div>
          <input
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleIdentify(); }}
            placeholder="Your ShelterTrace login username"
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              width: "100%",
              border: "1px solid #ccc",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 16,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          {identifyError && (
            <div style={{ color: "#dc3545", fontSize: 13, marginBottom: 10 }}>{identifyError}</div>
          )}
          {identifyLoading ? (
            <Spinner />
          ) : (
            <button
              onClick={handleIdentify}
              style={{
                width: "100%",
                background: "#1a8a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "13px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px 40px", minHeight: "100dvh" }}>

      {/* Header */}
      <div style={{
        background: "#0f2942",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            {officer?.first_name} {officer?.last_name}
          </div>
          <div style={{ color: "#7fc6c6", fontSize: 13 }}>
            @{officer?.username}
            {officer?.badge ? ` · Badge ${officer.badge}` : ""}
          </div>
        </div>
        <div style={{
          background: activeStatusInfo.bg,
          color: activeStatusInfo.color,
          borderRadius: 20,
          padding: "4px 14px",
          fontSize: 12,
          fontWeight: 700,
        }}>
          {currentStatus}
        </div>
      </div>

      {/* GPS */}
      <div style={{
        background: "#fff",
        border: "1px solid #e0e0e0",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ fontSize: 13, color: "#555" }}>
          <span style={{ fontWeight: 600 }}>GPS: </span>{gpsLabel}
        </div>
        <button
          onClick={captureGPS}
          style={{
            background: "#e8f4f8",
            color: "#0c5460",
            border: "1px solid #bee5eb",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Get GPS
        </button>
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
            ref={mileageStartRef}
            placeholder="Mileage start"
            value={mileageStart}
            onChange={(e) => setMileageStart(e.target.value)}
            type="number"
            step="0.1"
            style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
          />
          <input
            placeholder="Mileage end"
            value={mileageEnd}
            onChange={(e) => setMileageEnd(e.target.value)}
            type="number"
            step="0.1"
            style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", fontSize: 13 }}
          />
        </div>
        <textarea
          placeholder="Notes..."
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
              borderRadius: 10,
              padding: "16px 10px",
              fontSize: 14,
              fontWeight: 700,
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
        <div style={{
          background: "#d4edda",
          color: "#155724",
          border: "1px solid #c3e6cb",
          borderRadius: 8,
          padding: "10px 14px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 16,
        }}>
          {savedMsg}
        </div>
      )}

      {/* Today's check-in history */}
      {history.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0f2942", marginBottom: 10 }}>Today&apos;s Activity</div>
          {history.map((h, i) => {
            const s = STATUSES.find((x) => x.label === h.status) ?? STATUSES[5];
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#888", minWidth: 42 }}>{h.time}</span>
                <span style={{
                  background: s.bg,
                  color: s.color,
                  borderRadius: 12,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {h.status}
                </span>
                {h.location && <span style={{ fontSize: 12, color: "#555" }}>{h.location}</span>}
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => { setStep("identify"); setOfficer(null); setUsernameInput(""); setHistory([]); }}
        style={{
          marginTop: 20,
          background: "transparent",
          border: "none",
          color: "#888",
          fontSize: 13,
          cursor: "pointer",
          textDecoration: "underline",
          display: "block",
          width: "100%",
          textAlign: "center",
        }}
      >
        Sign out / Switch officer
      </button>
    </div>
  );
}
