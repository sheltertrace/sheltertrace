"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/providers";
import Sidebar from "./Sidebar";
import { supabase } from "@/lib/supabase";
import { playNotificationSound, showBrowserNotification, isSoundMuted } from "@/lib/notificationUtils";
import type { Message } from "@/lib/types";
import { IS_DEMO, resetDemoSession } from "@/lib/demo";
import DemoBanner from "@/components/demo/DemoBanner";
import DemoIdleTimer from "@/components/demo/DemoIdleTimer";

// ── Message toast ─────────────────────────────────────────────────────────────

interface MsgToast {
  id:         string;
  senderName: string;
  preview:    string;
  convId:     string;
}

function ToastStack({ toasts, onClose }: { toasts: MsgToast[]; onClose: (id: string) => void }) {
  const router = useRouter();

  if (!toasts.length) return null;
  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .msg-toast {
          animation: toast-in 0.3s ease-out forwards;
          cursor: pointer;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          background: #0f2942;
          color: #fff;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.35);
          max-width: 320px;
          width: 100%;
          border-left: 3px solid #1a8a8a;
        }
        .msg-toast:hover { background: #1a3a5c; }
      `}</style>
      <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
        {toasts.slice(0, 3).map((t) => (
          <div
            key={t.id}
            className="msg-toast"
            onClick={() => {
              router.push(`/messages?conv=${t.convId}`);
              onClose(t.id);
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.senderName}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {t.preview}
              </div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>Click to open →</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
            >✕</button>
          </div>
        ))}
      </div>
    </>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export default function AppShell({ children, title, action }: AppShellProps) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogout = useCallback(async () => {
    if (IS_DEMO) {
      setResetting(true);
      try { await resetDemoSession(supabase); } catch (e) { console.error("Demo reset error:", e); }
      setResetting(false);
    }
    logout();
  }, [logout]);

  // ── Message toasts ──────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<MsgToast[]>([]);
  const realtimeRef   = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const titleFlashRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashToggle   = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Stop title flash when the tab regains focus
  const stopTitleFlash = useCallback(() => {
    if (titleFlashRef.current) {
      clearInterval(titleFlashRef.current);
      titleFlashRef.current = null;
    }
    document.title = "ShelterTrace";
  }, []);

  const startTitleFlash = useCallback(() => {
    if (titleFlashRef.current) return;
    flashToggle.current = false;
    titleFlashRef.current = setInterval(() => {
      document.title = flashToggle.current ? "ShelterTrace" : "💬 New Message — ShelterTrace";
      flashToggle.current = !flashToggle.current;
    }, 2000);
  }, []);

  useEffect(() => {
    window.addEventListener("focus", stopTitleFlash);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) stopTitleFlash();
    });
    return () => { window.removeEventListener("focus", stopTitleFlash); };
  }, [stopTitleFlash]);

  // ── Global Realtime subscription ────────────────────────────────────────────
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      if (realtimeRef.current) { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
      return;
    }

    // Remove any stale channel before (re)creating
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const channel = supabase
      .channel(`appshell:messages:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload: { new: Message }) => {
          const msg = payload.new;

          // Ignore own messages
          if (msg.sender_id === userId) return;

          // Ignore if user is already on the Messages page
          if (pathname.startsWith("/messages")) return;

          // Verify user is a participant in this conversation (lightweight query)
          const { data: conv } = await supabase
            .from("conversations")
            .select("participants")
            .eq("id", msg.conversation_id)
            .single();

          const participants = (conv?.participants as string[] | null) ?? [];
          if (!participants.includes(userId)) return;

          // Play sound
          if (!isSoundMuted()) playNotificationSound();

          // Browser notification
          showBrowserNotification(
            msg.sender_name,
            msg.is_deleted ? "Message deleted" : msg.content.slice(0, 80)
          );

          // Flash page title when tab is hidden
          if (document.hidden) startTitleFlash();

          // Show in-app toast
          const newToast: MsgToast = {
            id:         `${msg.id}-${Date.now()}`,
            senderName: msg.sender_name,
            preview:    msg.is_deleted ? "Message deleted" : msg.content.slice(0, 120),
            convId:     msg.conversation_id,
          };
          setToasts((prev) => {
            const next = [newToast, ...prev].slice(0, 3);
            return next;
          });

          // Auto-dismiss after 8 seconds
          setTimeout(() => dismissToast(newToast.id), 8000);
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      realtimeRef.current = null;
    };
  // pathname changes while on Messages page should update the guard —
  // but we don't want to re-subscribe on every pathname change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Close mobile sidebar on navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#64748b", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🐾</div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>Loading ShelterTrace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {IS_DEMO && <DemoBanner />}

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="main-content">
        <div className="top-bar">
          <button className="hamburger-btn" onClick={() => setMobileOpen((v) => !v)} aria-label="Open navigation menu">☰</button>
          <h1 className="top-bar-title">{title}</h1>
          {action && <div className="top-bar-action">{action}</div>}
        </div>
        <div className="page-content">{children}</div>
        <div className="app-footer">ShelterTrace v1.0 · Shelter Data Systems · © 2026</div>
      </div>

      {/* Global message toast stack — shown on every page except /messages */}
      {!pathname.startsWith("/messages") && (
        <ToastStack toasts={toasts} onClose={dismissToast} />
      )}

      {IS_DEMO && <DemoIdleTimer logout={handleLogout} />}

      {resetting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,41,66,0.95)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 40 }}>🔄</div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Resetting demo environment…</div>
          <div style={{ color: "#93c5fd", fontSize: 14 }}>Please wait a moment.</div>
        </div>
      )}
    </div>
  );
}
