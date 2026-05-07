"use client";

import { supabase } from "./supabase";
import type { OfficerSchedule, ScheduleOverride, EffectiveShift, FieldStatus } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "HH:MM" into minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** "HH:MM" → "h:MM AM/PM" */
export function fmt12(t?: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

/** Today's local YYYY-MM-DD */
export function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** JS day-of-week (0=Sun … 6=Sat) for a given YYYY-MM-DD */
function dowForDate(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay();
}

/** Is current local time within [startTime, endTime) ? */
function isWithinShift(startTime: string, endTime: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= toMinutes(startTime) && cur < toMinutes(endTime);
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchSchedules(officerIds?: string[]): Promise<OfficerSchedule[]> {
  let q = supabase.from("officer_schedules").select("*").order("officer_id").order("day_of_week");
  if (officerIds?.length) q = q.in("officer_id", officerIds);
  const { data } = await q;
  return (data as OfficerSchedule[] | null) ?? [];
}

export async function fetchOverrides(opts: { officerIds?: string[]; from?: string; to?: string } = {}): Promise<ScheduleOverride[]> {
  let q = supabase.from("schedule_overrides").select("*").order("override_date");
  if (opts.officerIds?.length) q = q.in("officer_id", opts.officerIds);
  if (opts.from) q = q.gte("override_date", opts.from);
  if (opts.to)   q = q.lte("override_date", opts.to);
  const { data } = await q;
  return (data as ScheduleOverride[] | null) ?? [];
}

// ── Upsert ────────────────────────────────────────────────────────────────────

export async function upsertScheduleDay(row: Omit<OfficerSchedule, "id" | "created_at" | "updated_at">): Promise<void> {
  await supabase.from("officer_schedules").upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: "officer_id,day_of_week" }
  );
}

export async function upsertScheduleDays(rows: Omit<OfficerSchedule, "id" | "created_at" | "updated_at">[]): Promise<void> {
  if (!rows.length) return;
  const ts = new Date().toISOString();
  await supabase.from("officer_schedules").upsert(
    rows.map((r) => ({ ...r, updated_at: ts })),
    { onConflict: "officer_id,day_of_week" }
  );
}

export async function upsertOverride(row: Omit<ScheduleOverride, "id" | "created_at">): Promise<void> {
  await supabase.from("schedule_overrides").upsert(row, { onConflict: "officer_id,override_date" });
}

export async function deleteOverride(id: string): Promise<void> {
  await supabase.from("schedule_overrides").delete().eq("id", id);
}

// ── Copy schedule ─────────────────────────────────────────────────────────────

export async function copySchedule(fromOfficerId: string, toOfficerId: string): Promise<void> {
  const rows = await fetchSchedules([fromOfficerId]);
  await upsertScheduleDays(rows.map((r) => ({ ...r, officer_id: toOfficerId, id: undefined } as Omit<OfficerSchedule, "id" | "created_at" | "updated_at">)));
}

// ── Effective shift computation ────────────────────────────────────────────────

/**
 * Compute an officer's effective shift for a given date.
 * Respects overrides (take priority), then falls back to weekly schedule.
 */
export function computeEffectiveShift(
  officerId: string,
  dateStr: string,
  schedules: OfficerSchedule[],
  overrides: ScheduleOverride[]
): EffectiveShift {
  const dow = dowForDate(dateStr);

  // Check override first
  const ov = overrides.find((o) => o.officer_id === officerId && o.override_date === dateStr);
  if (ov) {
    if (!ov.is_working) return { isScheduled: false, overrideReason: ov.reason, isOverride: true };
    return {
      isScheduled: true,
      shiftStart: ov.start_time ?? undefined,
      shiftEnd:   ov.end_time   ?? undefined,
      overrideReason: ov.reason,
      isOverride: true,
    };
  }

  // Weekly schedule
  const sched = schedules.find((s) => s.officer_id === officerId && s.day_of_week === dow);
  if (!sched || !sched.is_scheduled) return { isScheduled: false, isOverride: false };
  return {
    isScheduled: true,
    shiftStart: sched.start_time ?? undefined,
    shiftEnd:   sched.end_time   ?? undefined,
    isOverride: false,
  };
}

/**
 * Determine the display status for an officer on the field-ops board.
 * - If a manual active status (En Route / On Scene / Break / Available / On Duty) is set
 *   AND they are within their scheduled shift → keep it.
 * - If within shift but manual status is "Off Duty" → promote to "On Duty".
 * - If outside shift → force "Off Duty" regardless of manual status.
 */
export function resolveDisplayStatus(
  manualStatus: FieldStatus,
  shift: EffectiveShift,
  today: string
): { displayStatus: FieldStatus; withinShift: boolean } {
  if (!shift.isScheduled) {
    return { displayStatus: "Off Duty", withinShift: false };
  }

  // If shift has defined times, check whether we're within them
  if (shift.shiftStart && shift.shiftEnd) {
    const within = isWithinShift(shift.shiftStart, shift.shiftEnd);
    if (!within) return { displayStatus: "Off Duty", withinShift: false };
    // Within shift — manual active status takes priority
    const display = manualStatus === "Off Duty" ? "On Duty" : manualStatus;
    return { displayStatus: display, withinShift: true };
  }

  // Scheduled with no times set — treat as on duty all day
  const display = manualStatus === "Off Duty" ? "On Duty" : manualStatus;
  return { displayStatus: display, withinShift: true };
}

// ── Week helpers ──────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for each day of the current week (Sun-Sat) */
export function currentWeekDates(): string[] {
  const today = new Date();
  const dow = today.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dow + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

/** Short day labels Sun-Sat */
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
