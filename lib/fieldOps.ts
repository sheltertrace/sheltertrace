"use client";

import { supabase } from "./supabase";
import type { FieldActivity, FieldStatus, LocationHistory, OfficerFieldProfile } from "./types";

export async function fetchOfficerFieldStatuses(): Promise<OfficerFieldProfile[]> {
  const { data, error } = await supabase
    .from("staff_accounts")
    .select("*")
    .eq("active", true)
    .neq("role", "Volunteer")
    .order("last_name")
    .order("first_name");

  console.log("[on-call] staff query result:", data, error);

  if (error) {
    console.error("[fetchOfficerFieldStatuses] Supabase error:", error.message, error.details, error.hint);
    return [];
  }

  return ((data as OfficerFieldProfile[] | null) ?? []).map((p) => ({
    ...p,
    current_field_status: (p.current_field_status as FieldStatus) || "Off Duty",
  }));
}

export async function updateOfficerFieldStatus(
  officerId: string,
  status: FieldStatus,
  opts: {
    lat?: number;
    lng?: number;
    locationLabel?: string;
  } = {}
): Promise<void> {
  await supabase
    .from("staff_accounts")
    .update({
      current_field_status: status,
      last_location_lat: opts.lat ?? null,
      last_location_lng: opts.lng ?? null,
      last_status_update: new Date().toISOString(),
    })
    .eq("id", officerId);
}

export async function logFieldActivity(entry: Omit<FieldActivity, "id" | "created_at">): Promise<void> {
  await supabase.from("field_activity").insert({
    officer_id: entry.officer_id,
    officer_name: entry.officer_name,
    officer_badge: entry.officer_badge,
    status: entry.status,
    location_lat: entry.location_lat,
    location_lng: entry.location_lng,
    location_label: entry.location_label,
    call_id: entry.call_id,
    call_number: entry.call_number,
    notes: entry.notes,
    mileage_start: entry.mileage_start,
    mileage_end: entry.mileage_end,
    recorded_at: entry.recorded_at || new Date().toISOString(),
  });
}

export async function fetchFieldActivity(
  opts: { officerId?: string; since?: string; limit?: number } = {}
): Promise<FieldActivity[]> {
  let q = supabase
    .from("field_activity")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (opts.officerId) q = q.eq("officer_id", opts.officerId);
  if (opts.since) q = q.gte("recorded_at", opts.since);
  if (opts.limit) q = q.limit(opts.limit);

  const { data } = await q;
  return (data as FieldActivity[] | null) ?? [];
}

export async function fetchTodayActivity(officerId?: string): Promise<FieldActivity[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return fetchFieldActivity({ officerId, since: today.toISOString(), limit: 500 });
}

export async function fetchOfficerByUsername(username: string): Promise<OfficerFieldProfile | null> {
  const { data } = await supabase
    .from("staff_accounts")
    .select("id, username, first_name, last_name, role, badge, phone, active, current_field_status, last_location_lat, last_location_lng, last_status_update, tracking_active")
    .eq("username", username.toLowerCase())
    .eq("active", true)
    .neq("role", "Volunteer")
    .limit(1);

  const rows = (data as OfficerFieldProfile[] | null) ?? [];
  if (!rows[0]) return null;
  return {
    ...rows[0],
    current_field_status: (rows[0].current_field_status as FieldStatus) || "Off Duty",
  };
}

// ── GPS Location Pings ────────────────────────────────────────────────────────

export async function saveLocationPing(opts: {
  officerId: string;
  officerName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number | null;
  heading?: number | null;
  status: FieldStatus;
  callId?: string;
}): Promise<void> {
  await Promise.all([
    supabase
      .from("staff_accounts")
      .update({
        last_location_lat: opts.latitude,
        last_location_lng: opts.longitude,
        last_status_update: new Date().toISOString(),
        tracking_active: true,
      })
      .eq("id", opts.officerId),
    supabase.from("location_history").insert({
      officer_id: opts.officerId,
      officer_name: opts.officerName,
      latitude: opts.latitude,
      longitude: opts.longitude,
      accuracy: opts.accuracy ?? null,
      speed: opts.speed ?? null,
      heading: opts.heading ?? null,
      status: opts.status,
      call_id: opts.callId ?? null,
    }),
  ]);
}

export async function clearOfficerTracking(officerId: string): Promise<void> {
  await supabase
    .from("staff_accounts")
    .update({ tracking_active: false })
    .eq("id", officerId);
}

// Returns today's GPS breadcrumb trail in chronological order
export async function fetchTodayRoute(officerId: string): Promise<LocationHistory[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("location_history")
    .select("*")
    .eq("officer_id", officerId)
    .gte("timestamp", start.toISOString())
    .order("timestamp", { ascending: true });
  return (data as LocationHistory[] | null) ?? [];
}

// Returns recent location history for all officers (for live map)
export async function fetchRecentLocations(sinceMinutes = 60): Promise<LocationHistory[]> {
  const since = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const { data } = await supabase
    .from("location_history")
    .select("*")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false });
  return (data as LocationHistory[] | null) ?? [];
}
