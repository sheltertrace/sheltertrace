// Demo mode utilities. All gated on NEXT_PUBLIC_IS_DEMO=true.
// Inert in production — every export is either a constant false flag or a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";

export const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO === "true";

// Features that are silently disabled in demo mode
export const DEMO_DISABLED = {
  drugLog:              true,
  emailNotifications:   true,
  paymentProcessing:    true,
  gdaSubmit:            true,
  passwordChange:       true,
} as const;

// Pre-configured demo role buttons (credentials live in the demo seed SQL)
export const DEMO_USERS = [
  {
    role: "Administrator",
    username: "demo-admin",
    password: "Demo@Admin2026",
    icon: "⚙️",
    desc: "Full access to all shelter modules",
  },
  {
    role: "Animal Control Officer",
    username: "demo-officer",
    password: "Demo@Officer2026",
    icon: "🚓",
    desc: "Dispatch, field ops, citations, and animal intake",
  },
  {
    role: "Front Desk Staff",
    username: "demo-frontdesk",
    password: "Demo@FrontDesk2026",
    icon: "🖥️",
    desc: "Animal records, adoptions, and public inquiries",
  },
] as const;

// ── Session management ─────────────────────────────────────────────────────────
//
// Each demo login gets a unique UUID stored in localStorage.
// Records created during a session are tagged with this ID so that only
// that session's data is deleted on reset — seed data is never touched.

function genUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getDemoSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("demo_session_id");
  if (!id) {
    id = genUUID();
    localStorage.setItem("demo_session_id", id);
  }
  return id;
}

export function getLastResetTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("demo_last_reset");
}

// Call the session-scoped Supabase RPC, then clear local session state.
// Non-fatal: if the RPC fails (e.g. network issue), we still sign the user out.
export async function resetDemoSession(supabase: SupabaseClient): Promise<void> {
  const sessionId = typeof window !== "undefined" ? localStorage.getItem("demo_session_id") : null;
  if (sessionId) {
    const { error } = await supabase.rpc("reset_demo_session", { p_session_id: sessionId });
    if (error) console.error("[demo] reset_demo_session RPC error:", error.message);
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("demo_session_id");
    localStorage.setItem("demo_last_reset", new Date().toISOString());
  }
}

// Backwards-compat alias used by DemoIdleTimer and AppShell
export const resetDemoData = resetDemoSession;
