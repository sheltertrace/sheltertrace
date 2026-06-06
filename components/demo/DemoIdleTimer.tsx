"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resetDemoSession } from "@/lib/demo";

const IDLE_TIMEOUT = 300; // 5 minutes in seconds
const WARNING_AT = 60;    // show warning when 60 seconds remain

interface DemoIdleTimerProps {
  logout: () => void;
}

export default function DemoIdleTimer({ logout }: DemoIdleTimerProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_AT);
  const [resetting, setResetting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(secondsLeft);

  const clearWarningInterval = useCallback(() => {
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
      warningIntervalRef.current = null;
    }
  }, []);

  const handleExpire = useCallback(async () => {
    clearWarningInterval();
    setShowWarning(false);
    setResetting(true);
    try {
      await resetDemoSession(supabase);
    } catch (e) {
      console.error("Demo idle reset error:", e);
    }
    setResetting(false);
    logout();
    router.replace("/login?expired=1");
  }, [logout, router, clearWarningInterval]);

  const startWarningCountdown = useCallback(() => {
    secondsRef.current = WARNING_AT;
    setSecondsLeft(WARNING_AT);
    setShowWarning(true);

    clearWarningInterval();
    warningIntervalRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSecondsLeft(secondsRef.current);
      if (secondsRef.current <= 0) {
        clearWarningInterval();
        handleExpire();
      }
    }, 1000);
  }, [clearWarningInterval, handleExpire]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, (IDLE_TIMEOUT - WARNING_AT) * 1000);
  }, [startWarningCountdown]);

  const keepSession = useCallback(() => {
    clearWarningInterval();
    setShowWarning(false);
    resetTimer();
  }, [clearWarningInterval, resetTimer]);

  const handleSignOutNow = useCallback(async () => {
    clearWarningInterval();
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowWarning(false);
    setResetting(true);
    try {
      await resetDemoSession(supabase);
    } catch (e) {
      console.error("Demo sign-out reset error:", e);
    }
    setResetting(false);
    logout();
    router.replace("/login");
  }, [logout, router, clearWarningInterval]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "scroll", "touchstart"] as const;

    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      clearWarningInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning]);

  if (resetting) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,41,66,0.97)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 40 }}>🔄</div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Resetting demo environment…</div>
        <div style={{ color: "#93c5fd", fontSize: 14 }}>Please wait a moment.</div>
      </div>
    );
  }

  if (!showWarning) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 20, 40, 0.88)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#0f2942",
          border: "2px solid #f59e0b",
          borderRadius: 16,
          padding: "36px 40px",
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏱️</div>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Session Expiring Soon
        </h2>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>
          Your demo session will expire due to inactivity. Demo data will be reset on sign out.
        </p>
        <div
          style={{
            background: "rgba(245,158,11,0.15)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 10,
            padding: "14px 20px",
            marginBottom: 24,
          }}
        >
          <div style={{ color: "#f59e0b", fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
            {secondsLeft}
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
            seconds remaining
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={keepSession}
            style={{
              background: "#1a8a8a",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "13px 24px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#15766e")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1a8a8a")}
          >
            Keep Session Active
          </button>
          <button
            onClick={handleSignOutNow}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 9,
              padding: "11px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }}
          >
            Sign Out Now
          </button>
        </div>
      </div>
    </div>
  );
}
