"use client";
import { supabase } from "./supabase";
import { STAFF_ACCOUNTS } from "./constants";
import type { StaffAccount } from "./types";

const CURRENT_USER_KEY = "sheltertrace_current_user";

// Normalize a DB row (snake_case) to the StaffAccount shape the app uses
function normalizeAccount(row: Record<string, unknown>): StaffAccount {
  return {
    id: row.id as string,
    username: row.username as string,
    password: (row.password_hash as string) || "",
    password_hash: row.password_hash as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    role: row.role as string,
    email: row.email as string,
    phone: row.phone as string,
    badge: row.badge as string,
    permissions: Array.isArray(row.permissions) ? row.permissions as string[] : [],
    active: row.active as boolean,
    created_at: row.created_at as string,
    theme_preference: (row.theme_preference as "light" | "dark") || "light",
    account_type: (row.account_type as string) || "shelter",
    is_super_admin: !!row.is_super_admin,
    platform_customer_id: (row.platform_customer_id as string) || undefined,
  };
}

export async function login(username: string, password: string): Promise<StaffAccount | null> {
  const trimmedUser = username.trim();
  const trimmedPass = password.trim();

  // Check Supabase first (covers all accounts added via admin UI).
  // Use .limit(1) instead of .single() — .single() sends a special Accept header
  // that causes HTTP 400 on any unexpected row count, making errors opaque.
  try {
    const { data, error } = await supabase
      .from("staff_accounts")
      .select("*")
      .eq("username", trimmedUser)
      .limit(1);

    if (error) {
      console.warn("Supabase login query error:", error.code, error.message);
      // Fall through to hardcoded accounts
    } else if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      // Reject inactive accounts
      if (row.active === false) return null;
      // Compare password — stop here, no fallback (user exists in DB)
      const stored = (row.password_hash as string || "").trim();
      if (stored === trimmedPass) {
        const account = normalizeAccount(row);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(account));
        }
        return account;
      }
      return null;
    }
    // data.length === 0 means no DB account — fall through to hardcoded accounts
  } catch {
    // Network error — fall through
  }

  // Fallback: hardcoded STAFF_ACCOUNTS (for initial setup / offline)
  const account = STAFF_ACCOUNTS.find(
    (a) => a.username === trimmedUser && a.password === trimmedPass
  ) as StaffAccount | undefined;

  if (account) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(account));
    }
    return account;
  }

  return null;
}

// Demo-only: fetch a staff account directly by id (no password check).
// Only called when NEXT_PUBLIC_IS_DEMO=true.
export async function demoLoginById(id: string): Promise<StaffAccount | null> {
  // Diagnostic: confirm which Supabase project is being targeted
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "(not set)";
  console.log("[demo] demoLoginById called — id:", id);
  console.log("[demo] NEXT_PUBLIC_SUPABASE_URL:", projectUrl);
  console.log("[demo] IS_DEMO env:", process.env.NEXT_PUBLIC_IS_DEMO);

  try {
    console.log("[demo] Querying staff_accounts WHERE id =", id);
    const { data, error } = await supabase
      .from("staff_accounts")
      .select("*")
      .eq("id", id)
      .limit(1);

    console.log("[demo] Query result — data:", JSON.stringify(data), "error:", error);

    if (error) {
      console.error("[demo] Supabase error:", error.code, error.message, error.hint || "");
      return null;
    }
    if (!data || data.length === 0) {
      console.warn("[demo] No account found with id:", id, "— check that seed.sql was run");
      return null;
    }
    const account = normalizeAccount(data[0] as Record<string, unknown>);
    console.log("[demo] Account fetched:", account.id, account.role, account.first_name);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(account));
      console.log("[demo] Session stored in sessionStorage key:", CURRENT_USER_KEY);
    }
    return account;
  } catch (err) {
    console.error("[demo] demoLoginById unexpected error:", err);
    return null;
  }
}

export function logout(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function getCurrentUser(): StaffAccount | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffAccount;
  } catch {
    return null;
  }
}

export function getCurrentUserName(): string {
  const u = getCurrentUser();
  if (!u) return "Staff";
  const first = u.firstName || u.first_name || "";
  const last = u.lastName || u.last_name || "";
  return `${first} ${last}`.trim() || u.username || "Staff";
}

export function getCurrentUserBadge(): string | null {
  return getCurrentUser()?.badge || null;
}

export function getCurrentUserId(): string | null {
  return getCurrentUser()?.id || null;
}

export function hasPermission(user: StaffAccount | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes("all") || user.permissions.includes(permission);
}
