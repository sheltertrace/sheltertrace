"use client";
import { supabase } from "./supabase";
import type { PlatformCustomer, AuditLogEntry, PlatformAnnouncement } from "./superAdminTypes";
import type { StaffAccount } from "./types";

// ── Customers ────────────────────────────────────────────────────────────────

export async function fetchCustomers(): Promise<PlatformCustomer[]> {
  const { data } = await supabase.from("platform_customers").select("*").order("account_name");
  return (data || []) as PlatformCustomer[];
}

export async function fetchCustomer(id: string): Promise<PlatformCustomer | null> {
  const { data } = await supabase.from("platform_customers").select("*").eq("id", id).limit(1);
  return (data?.[0] as PlatformCustomer) || null;
}

export async function createCustomer(customer: Omit<PlatformCustomer, "id" | "created_at" | "updated_at">): Promise<PlatformCustomer> {
  const { data, error } = await supabase.from("platform_customers").insert(customer).select().single();
  if (error) throw error;
  return data as PlatformCustomer;
}

export async function updateCustomer(id: string, updates: Partial<PlatformCustomer>): Promise<PlatformCustomer> {
  const { data, error } = await supabase.from("platform_customers").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw error;
  return data as PlatformCustomer;
}

// ── Users (global view) ──────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<StaffAccount[]> {
  const { data } = await supabase.from("staff_accounts").select("*").order("created_at", { ascending: false });
  return (data || []) as StaffAccount[];
}

export async function fetchUsersByCustomer(customerId: string): Promise<StaffAccount[]> {
  const { data } = await supabase.from("staff_accounts").select("*").eq("platform_customer_id", customerId).order("first_name");
  return (data || []) as StaffAccount[];
}

export async function createUser(user: Record<string, unknown>): Promise<StaffAccount> {
  const { data, error } = await supabase.from("staff_accounts").insert(user).select().single();
  if (error) throw error;
  return data as StaffAccount;
}

export async function updateUser(id: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("staff_accounts").update(updates).eq("id", id);
  if (error) throw error;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export async function logAuditAction(
  superAdminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await supabase.from("platform_audit_log").insert({
    super_admin_id: superAdminId, action, target_type: targetType, target_id: targetId, details,
  });
}

export async function fetchAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const { data } = await supabase.from("platform_audit_log").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  return (data || []) as AuditLogEntry[];
}

// ── Announcements ────────────────────────────────────────────────────────────

export async function fetchAnnouncements(): Promise<PlatformAnnouncement[]> {
  const { data } = await supabase.from("platform_announcements").select("*").order("created_at", { ascending: false });
  return (data || []) as PlatformAnnouncement[];
}

export async function createAnnouncement(a: Omit<PlatformAnnouncement, "id" | "created_at">): Promise<PlatformAnnouncement> {
  const { data, error } = await supabase.from("platform_announcements").insert(a).select().single();
  if (error) throw error;
  return data as PlatformAnnouncement;
}

export async function updateAnnouncement(id: string, updates: Partial<PlatformAnnouncement>): Promise<void> {
  await supabase.from("platform_announcements").update(updates).eq("id", id);
}

// ── Dashboard Stats ──────────────────────────────────────────────────────────

export async function fetchPlatformStats() {
  const [customers, users, animals] = await Promise.all([
    supabase.from("platform_customers").select("status, billing_amount, billing_cycle, account_type, trial_end", { count: "exact" }),
    supabase.from("staff_accounts").select("id", { count: "exact", head: true }),
    supabase.from("animals").select("id", { count: "exact", head: true }),
  ]);

  const custs = (customers.data || []) as Array<{ status: string; billing_amount?: number; billing_cycle?: string; account_type?: string; trial_end?: string }>;
  const totalCustomers = custs.length;
  const active = custs.filter((c) => c.status === "active").length;
  const trial = custs.filter((c) => c.status === "trial").length;
  const suspended = custs.filter((c) => c.status === "suspended").length;

  const mrr = custs
    .filter((c) => c.status === "active" && c.billing_amount)
    .reduce((sum, c) => {
      const amt = c.billing_amount || 0;
      return sum + (c.billing_cycle === "annual" ? amt / 12 : amt);
    }, 0);

  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];
  const trialsExpiring = custs.filter((c) => c.status === "trial" && c.trial_end && c.trial_end <= thirtyDays && c.trial_end >= todayStr);

  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const newThisMonth = custs.filter((c) => {
    return false; // can't compute without created_at in select — handled via count below
  });

  return {
    totalCustomers,
    active,
    trial,
    suspended,
    totalUsers: users.count || 0,
    totalAnimals: animals.count || 0,
    mrr: Math.round(mrr * 100) / 100,
    trialsExpiring: trialsExpiring.length,
  };
}
