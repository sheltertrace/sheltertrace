"use client";
// Client wrappers for the password-verified account functions
// (supabase/migrations/20260925170000_staff_accounts_write_lockdown.sql).
// Direct writes to staff_accounts are no longer possible for the browser.
import { supabase } from "./supabase";
import { getCurrentUser } from "./auth";
import { requirePassword, clearCachedPassword } from "./passwordPrompt";
import type { StaffAccount } from "./types";

interface RpcResult {
  ok: boolean;
  error?: string;
  retry_after_seconds?: number;
  account?: Record<string, unknown>;
  temp_password?: string;
}

const MESSAGES: Record<string, string> = {
  invalid: "That password is incorrect.",
  forbidden: "You don't have permission to do that.",
  username_taken: "That username is already taken.",
  not_found: "That account no longer exists.",
  self: "You can't change your own role, permissions or status, or delete or reset your own account, from here.",
  invalid_input: "Some required fields are missing or invalid.",
  reset_required: "You must choose a new password before you can do that.",
  reset_expired: "Your temporary password has expired. Ask an administrator for a new one.",
};

export class StaffAdminError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "StaffAdminError"; }
}

function toAccount(row: Record<string, unknown>): StaffAccount {
  return { ...row, firstName: row.first_name, lastName: row.last_name, password: "" } as unknown as StaffAccount;
}

async function call(
  reason: string,
  fn: string,
  build: (username: string, password: string) => Record<string, unknown>,
): Promise<RpcResult> {
  const me = getCurrentUser();
  if (!me) throw new StaffAdminError("not_signed_in", "You are signed out. Sign in again.");
  const password = await requirePassword(reason);
  if (!password) throw new StaffAdminError("cancelled", "Cancelled.");

  const { data, error } = await supabase.rpc(fn, build(me.username, password));
  if (error) {
    const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message || "");
    throw new StaffAdminError(missing ? "unavailable" : "network",
      missing ? "This action isn't available until the latest security update is applied." : "Could not reach the server. Try again.");
  }
  const r = data as RpcResult;
  if (!r?.ok) {
    if (r?.error === "invalid" || r?.error === "locked") clearCachedPassword();
    const msg = r?.error === "locked"
      ? `Too many attempts. Try again in ${Math.max(1, Math.ceil((r.retry_after_seconds ?? 900) / 60))} minute(s).`
      : MESSAGES[r?.error ?? ""] ?? "The request was rejected.";
    throw new StaffAdminError(r?.error ?? "rejected", msg);
  }
  return r;
}

/** Create an account. The database generates a one-time temporary password (24 h) and returns it once. */
export async function adminCreateStaff(user: Record<string, unknown>): Promise<{ account: StaffAccount; tempPassword: string }> {
  const r = await call("Confirm your password to create this account.", "staff_admin_create",
    (u, p) => ({ p_admin_username: u, p_admin_password: p, p_user: user }));
  return { account: toAccount(r.account!), tempPassword: r.temp_password! };
}

export async function adminUpdateStaff(id: string, updates: Record<string, unknown>): Promise<StaffAccount> {
  const r = await call("Confirm your password to save changes to this account.", "staff_admin_update",
    (u, p) => ({ p_admin_username: u, p_admin_password: p, p_target_id: id, p_updates: updates }));
  return toAccount(r.account!);
}

export async function adminDeleteStaff(id: string): Promise<void> {
  await call("Confirm your password to permanently delete this account.", "staff_admin_delete",
    (u, p) => ({ p_admin_username: u, p_admin_password: p, p_target_id: id }));
}

/** Issue a new 24-hour temporary password for someone else. Returns it once. */
export async function adminResetStaffPassword(id: string): Promise<string> {
  const r = await call("Confirm your password to issue a temporary password.", "staff_admin_reset_password",
    (u, p) => ({ p_admin_username: u, p_admin_password: p, p_target_id: id }));
  return r.temp_password!;
}

/** Update your own name / email / phone. */
export async function updateOwnProfile(fields: { first_name?: string; last_name?: string; email?: string | null; phone?: string | null }): Promise<StaffAccount> {
  const r = await call("Confirm your password to update your profile.", "staff_update_profile",
    (u, p) => ({ p_username: u, p_password: p, p_fields: fields }));
  return toAccount(r.account!);
}

/** Save (or clear, with "") your own signature image. */
export async function setOwnSignature(dataUrl: string): Promise<void> {
  await call("Confirm your password to change your signature.", "staff_set_signature",
    (u, p) => ({ p_username: u, p_password: p, p_data: dataUrl }));
}
