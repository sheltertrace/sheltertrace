// Demo mode utilities. All gated on NEXT_PUBLIC_IS_DEMO=true.
// Inert in production — every export is either a constant false flag or a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";

export const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO === "true";

// Features that are silently disabled in demo mode.
// drugLog is intentionally ENABLED so visitors can explore the UI —
// the tables just need to exist in the demo Supabase project.
export const DEMO_DISABLED = {
  drugLog:              false,   // show drug log UI in demo (run create_drug_log_for_demo.sql)
  emailNotifications:   true,
  paymentProcessing:    true,
  gdaSubmit:            true,
  passwordChange:       true,
} as const;

// Pre-configured demo role buttons.
// id must match the id column in the demo staff_accounts table.
export const DEMO_USERS = [
  {
    role: "Administrator",
    id: "demo-admin",
    icon: "⚙️",
    desc: "Full access to all shelter modules",
  },
  {
    role: "Animal Control Officer",
    id: "demo-officer1",
    icon: "🚓",
    desc: "Dispatch, field ops, citations, and animal intake",
  },
  {
    role: "Front Desk Staff",
    id: "demo-staff",
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

// Full demo reset — truncates all data tables and reseeds the demo state.
// Called on every sign-out and idle timeout so the next visitor starts fresh.
// Non-fatal: if the RPC fails we still sign the user out and stamp the reset time.
export async function resetDemoSession(supabase: SupabaseClient): Promise<void> {
  console.log("[demo] resetDemoSession() called");
  console.log("[demo] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("[demo] calling full_demo_reset RPC...");

  const start = Date.now();
  const { data, error } = await supabase.rpc("full_demo_reset");
  const elapsed = Date.now() - start;

  if (error) {
    console.error(`[demo] full_demo_reset FAILED after ${elapsed}ms:`, error.code, error.message, error.hint || "");
    console.error("[demo] → If error is 'function full_demo_reset() does not exist', run supabase/demo/full_reset_function.sql in the demo Supabase SQL editor.");
  } else {
    console.log(`[demo] full_demo_reset SUCCESS in ${elapsed}ms`, data ?? "(no return data)");
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem("demo_session_id");
    localStorage.setItem("demo_last_reset", new Date().toISOString());
    console.log("[demo] localStorage cleared, last_reset stamped");
  }
}

// Backwards-compat alias used by DemoIdleTimer and AppShell
export const resetDemoData = resetDemoSession;
