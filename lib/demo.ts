// Demo mode utilities. All gated on NEXT_PUBLIC_IS_DEMO=true.
// Inert in production — every export is either a constant false flag or a no-op.

import type { SupabaseClient } from "@supabase/supabase-js";

export const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO === "true";

// Features that are silently disabled in demo mode.
export const DEMO_DISABLED = {
  drugLog:              false,   // show drug log UI in demo
  emailNotifications:   true,
  paymentProcessing:    true,
  gdaSubmit:            true,
  passwordChange:       true,
} as const;

// Pre-configured demo role buttons.
export const DEMO_USERS = [
  { role: "Administrator",          id: "demo-admin",    icon: "⚙️", desc: "Full access to all shelter modules" },
  { role: "Animal Control Officer", id: "demo-officer1", icon: "🚓", desc: "Dispatch, field ops, citations, and animal intake" },
  { role: "Front Desk Staff",       id: "demo-staff",    icon: "🖥️", desc: "Animal records, adoptions, and public inquiries" },
] as const;

// ── Session management ─────────────────────────────────────────────────────────

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
  if (!id) { id = genUUID(); localStorage.setItem("demo_session_id", id); }
  return id;
}

export function getLastResetTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("demo_last_reset");
}

// ── Seed animal state — restore these on every reset ──────────────────────────
// Kennels match the shelter_config layout (D-1..D-10, C-1..C-8, ISO-1).

const SEED_ANIMALS: Array<{ id: string; kennel: string | null; status: string }> = [
  { id: "26-04-001", kennel: "D-1",   status: "Available"    },  // Buddy
  { id: "26-04-002", kennel: "C-1",   status: "Available"    },  // Luna
  { id: "26-04-003", kennel: "D-2",   status: "Medical Hold" },  // Max
  { id: "26-04-004", kennel: "C-2",   status: "Available"    },  // Daisy
  { id: "26-04-005", kennel: "ISO-1", status: "Quarantine"   },  // Rex
  { id: "26-04-006", kennel: "C-3",   status: "Available"    },  // Coco
  { id: "26-05-001", kennel: "D-3",   status: "Available"    },  // Charlie
  { id: "26-05-002", kennel: null,    status: "Foster"       },  // Molly  (in foster)
  { id: "26-05-003", kennel: "D-4",   status: "Available"    },  // Rocky
  { id: "26-05-004", kennel: "C-4",   status: "Available"    },  // Stella
  { id: "26-05-005", kennel: "D-5",   status: "Medical Hold" },  // Duke
  { id: "26-05-006", kennel: "C-5",   status: "Available"    },  // Bella
  { id: "26-05-007", kennel: "D-6",   status: "Pending"      },  // Cooper
  { id: "26-05-008", kennel: "C-6",   status: "Available"    },  // Lily
  { id: "26-05-009", kennel: "D-7",   status: "Available"    },  // Zeus
  { id: "26-05-010", kennel: "D-8",   status: "Available"    },  // Nala
  { id: "26-05-011", kennel: "C-7",   status: "Available"    },  // Milo
  { id: "26-05-012", kennel: "D-9",   status: "Available"    },  // Sadie
  { id: "26-05-013", kennel: "D-10",  status: "Available"    },  // Bear
  { id: "26-05-014", kennel: "C-8",   status: "Available"    },  // Penny
];

const SEED_ANIMAL_IDS = SEED_ANIMALS.map(a => a.id);

// ── resetDemoSession ───────────────────────────────────────────────────────────
//
// Primary path: calls full_demo_reset() RPC (server-side, atomic, fast).
// Fallback path: if RPC fails (e.g. function not yet created), does individual
//   client-side operations so the demo still works without the SQL function.

export async function resetDemoSession(supabase: SupabaseClient): Promise<void> {
  console.log("DEMO RESET: Starting reset...");
  console.log("DEMO RESET: Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  const sessionId = typeof window !== "undefined" ? localStorage.getItem("demo_session_id") : null;
  console.log("DEMO RESET: Session ID:", sessionId ?? "(none)");

  // ── Step 1: Try server-side RPC (preferred — runs atomically in Postgres) ──
  console.log("DEMO RESET: Calling full_demo_reset() RPC...");
  const start = Date.now();
  const { error: rpcError } = await supabase.rpc("full_demo_reset");

  if (!rpcError) {
    console.log(`DEMO RESET: RPC succeeded in ${Date.now() - start}ms — stamping reset time`);
    _stampReset();
    return;
  }

  console.error("DEMO RESET: RPC failed:", rpcError.code, rpcError.message);
  console.warn("DEMO RESET: → Falling back to client-side reset (run supabase/demo/full_reset_function.sql to fix the RPC)");

  // ── Step 2: Client-side fallback ───────────────────────────────────────────

  // 2a. Delete all session-tagged records (records created during this session)
  console.log("DEMO RESET: Deleting session records (demo_session_id =", sessionId, ")...");
  if (sessionId) {
    const tables = ["medical_records","dispatch_calls","citations","adoption_records","departure_receipts","animal_notes","foster_placements","people","animals"];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq("demo_session_id", sessionId);
      if (error && error.code !== "42703") {
        console.error(`DEMO RESET: Failed deleting session records from ${table}:`, error.message);
      } else {
        console.log(`DEMO RESET: Cleaned ${table}`);
      }
    }
  }

  // 2b. Delete any animals that were added during the session (no demo_session_id
  //     if the column doesn't exist — fall back to deleting anything NOT in seed list)
  console.log("DEMO RESET: Removing non-seed animals...");
  const { error: delAnimErr } = await supabase.from("animals")
    .delete()
    .not("id", "in", `(${SEED_ANIMAL_IDS.join(",")})`);
  if (delAnimErr) console.error("DEMO RESET: Failed removing non-seed animals:", delAnimErr.message);

  // 2c. Delete non-seed dispatch calls and citations
  console.log("DEMO RESET: Removing non-seed dispatch calls and citations...");
  const SEED_CALL_IDS  = ["DC-DEMO-001","DC-DEMO-002","DC-DEMO-003","DC-DEMO-004","DC-DEMO-005","DC-DEMO-006","DC-DEMO-007"];
  const SEED_CIT_IDS   = ["cit-demo-001","cit-demo-002","cit-demo-003","cit-demo-004"];
  const SEED_MED_IDS   = ["M-SEED-001","M-SEED-002","M-SEED-003","M-SEED-004","M-SEED-005","M-SEED-006","M-SEED-007","M-SEED-008","M-SEED-009","M-SEED-010","M-SEED-011","M-SEED-012","M-SEED-013"];

  await supabase.from("dispatch_calls").delete().not("id","in",`(${SEED_CALL_IDS.join(",")})`);
  await supabase.from("citations").delete().not("id","in",`(${SEED_CIT_IDS.join(",")})`);
  await supabase.from("medical_records").delete().not("id","in",`(${SEED_MED_IDS.join(",")})`);

  // 2d. Restore kennel assignments and statuses for every seed animal
  console.log("DEMO RESET: Restoring kennel assignments...");
  for (const a of SEED_ANIMALS) {
    const { error } = await supabase.from("animals")
      .update({ kennel: a.kennel, status: a.status })
      .eq("id", a.id);
    if (error) {
      console.error(`DEMO RESET: Failed to restore animal ${a.id} (${a.kennel}, ${a.status}):`, error.message);
    } else {
      console.log(`DEMO RESET: ✓ ${a.id} → kennel=${a.kennel ?? "null"} status=${a.status}`);
    }
  }

  console.log("DEMO RESET: Client-side fallback complete");
  _stampReset();
}

function _stampReset() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("demo_session_id");
    localStorage.setItem("demo_last_reset", new Date().toISOString());
    console.log("DEMO RESET: localStorage cleared, last_reset stamped");
  }
  console.log("DEMO RESET: Done, redirecting...");
}

// Backwards-compat alias
export const resetDemoData = resetDemoSession;
