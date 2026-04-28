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

export function hasPermission(user: StaffAccount | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes("all") || user.permissions.includes(permission);
}
