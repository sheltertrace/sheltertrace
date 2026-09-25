"use client";
import { supabase } from "./supabase";
import type { StaffAccount } from "./types";
import { clearCachedPassword } from "./passwordPrompt";

export const CURRENT_USER_KEY = "sheltertrace_current_user";

// Normalize a DB row (snake_case) to the StaffAccount shape the app uses
function normalizeAccount(row: Record<string, unknown>): StaffAccount {
  return {
    id: row.id as string,
    username: row.username as string,
    // Credentials never live on the client session object (it is persisted in
    // browser storage) — the password check happens inside the database.
    password: "",
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

// ── Login ────────────────────────────────────────────────────────────────────
// The password is verified INSIDE the database (staff_login), which holds only
// bcrypt hashes in a locked table, throttles guessing per account, and never
// returns the hash. login() resolves to the account on success and null for a
// wrong username/password; the states below are thrown so callers can show the
// right message instead of a generic "invalid".

/** Password was right but the account must choose a new password before it can sign in. */
export class PasswordResetRequiredError extends Error {
  constructor(public reason: "must_reset" | "expired") {
    super(reason === "expired"
      ? "Your password must be reset by an administrator."
      : "You must choose a new password before signing in.");
    this.name = "PasswordResetRequiredError";
  }
}
export class LoginLockedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Too many attempts. Try again in ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s).`);
    this.name = "LoginLockedError";
  }
}
export class LoginUnavailableError extends Error {
  constructor(message = "Could not reach the server. Check your connection and try again.") { super(message); this.name = "LoginUnavailableError"; }
}

interface StaffLoginRpc {
  ok: boolean;
  error?: "invalid" | "locked" | "reset_expired";
  must_reset?: boolean;
  retry_after_seconds?: number;
  account?: Record<string, unknown>;
}

// PostgREST: 404 / PGRST202 = the function does not exist (yet).
function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message || ""));
}

function storeSession(account: StaffAccount): void {
  if (typeof window !== "undefined") sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(account));
}

export async function login(username: string, password: string): Promise<StaffAccount | null> {
  const trimmedUser = username.trim();
  const trimmedPass = password.trim();

  const { data, error } = await supabase.rpc("staff_login", { p_username: trimmedUser, p_password: trimmedPass });

  if (!error && data) {
    const r = data as StaffLoginRpc;
    if (r.ok && r.account) {
      // Correct password but flagged for a forced change: no session until it is changed.
      if (r.must_reset) throw new PasswordResetRequiredError("must_reset");
      const account = normalizeAccount(r.account);
      storeSession(account);
      return account;
    }
    if (r.error === "locked") throw new LoginLockedError(r.retry_after_seconds ?? 900);
    if (r.error === "reset_expired") throw new PasswordResetRequiredError("expired");
    return null; // invalid
  }

  // staff_login() not deployed: fail closed. There is deliberately no fallback to
  // comparing a password client-side.
  if (isMissingFunction(error)) {
    throw new LoginUnavailableError("Sign-in is temporarily unavailable while a security update is applied. Please try again shortly.");
  }

  throw new LoginUnavailableError();
}

export interface ChangePasswordResult { ok: boolean; error?: string }

/** Change a staff password by proving the current one (also clears a forced reset). */
export async function changeStaffPassword(username: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const { data, error } = await supabase.rpc("staff_change_password", {
    p_username: username.trim(), p_old_password: currentPassword.trim(), p_new_password: newPassword.trim(),
  });
  if (error) {
    return { ok: false, error: isMissingFunction(error) ? "Password changes aren't available until the security update is applied." : "Could not reach the server. Try again." };
  }
  const r = data as { ok: boolean; error?: string; message?: string; retry_after_seconds?: number };
  if (r.ok) return { ok: true };
  if (r.error === "weak") return { ok: false, error: r.message || "That password is too weak." };
  if (r.error === "locked") return { ok: false, error: new LoginLockedError(r.retry_after_seconds ?? 900).message };
  if (r.error === "reset_expired") return { ok: false, error: "Your password must be reset by an administrator." };
  return { ok: false, error: "Your current password is incorrect." };
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
  clearCachedPassword();
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
