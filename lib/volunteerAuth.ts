// SERVER ONLY. Volunteer login (email + 6-digit code) — a genuinely separate
// identity from staff_accounts, verified entirely server-side. The browser
// never gets a Supabase client for any of this: these functions are called
// only from the /api/volunteer/* route handlers, using the service-role key,
// against the locked volunteer_login_codes / volunteer_login_sessions /
// volunteers tables (RLS on, no policies — see the foundation migration).
//
// Session model: an opaque random token lives ONLY in the httpOnly cookie;
// the database stores just its SHA-256 hash. Verifying a session means
// hashing the presented token and looking up that hash — the token itself is
// never persisted anywhere, so a database read alone can't produce a working
// session (the same shape used for staff_verify_session, but as a stored,
// revocable session rather than a stateless signed one, since nothing here
// needs a browser-verifiable signature — every check already goes through
// the server).
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomInt, createHash } from "crypto";
import { Resend } from "resend";
import { AGENCY_NAME } from "./shelterInfo";

export const SESSION_COOKIE = "v_session";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_EMAIL = 5;
const MAX_REQUESTS_PER_IP = 20;
// Same shape as staff_login: 5 wrong -> 15 min, 10 wrong -> 1 hour.
const LOCK_AFTER_5_MS = 15 * 60 * 1000;
const LOCK_AFTER_10_MS = 60 * 60 * 1000;

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
function hashCode(code: string, salt: string): string {
  return sha256(`${code}:${salt}`);
}
function randomSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
export function randomSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
/** Timing filler for the "no such row" branches, so they cost about the same as the real path. */
function equalizeTiming(): void {
  hashCode(randomSixDigitCode(), randomBytes(16).toString("hex"));
}

export interface VolunteerSafe {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  status: "pending" | "active" | "inactive" | "rejected";
  handling_level: number;
  volunteer_since: string | null;
  created_at: string;
}

// staff_notes is internal-only by the table's own design — never let it reach the client.
function toSafeVolunteer(row: Record<string, unknown>): VolunteerSafe {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    email: row.email as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    phone: (row.phone as string) ?? null,
    status: row.status as VolunteerSafe["status"],
    handling_level: row.handling_level as number,
    volunteer_since: (row.volunteer_since as string) ?? null,
    created_at: row.created_at as string,
  };
}

async function findVolunteerByEmail(db: SupabaseClient, email: string): Promise<Record<string, unknown> | null> {
  // Matches by email alone — fine while there is exactly one shelter organization;
  // revisit (scope by organization_id too) before a second one ever has volunteers.
  const { data } = await db.from("volunteers").select("*").ilike("email", email).limit(1).maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

async function sendVolunteerCodeEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error("[volunteerAuth] RESEND_API_KEY not configured — could not send login code"); return; }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${AGENCY_NAME} Volunteers <noreply@resend.dev>`,
      to: [email],
      subject: `Your sign-in code: ${code}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">
        <p>Your ${AGENCY_NAME} volunteer sign-in code is:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:4px;margin:16px 0">${code}</p>
        <p style="color:#64748b;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>`,
    });
    if (error) console.error("[volunteerAuth] Resend error:", error.message);
  } catch (e) {
    console.error("[volunteerAuth] send failed:", e);
  }
}

export interface RequestCodeResult { ok: boolean; error?: "rate_limited"; retry_after_seconds?: number }

/**
 * Always resolves to {ok:true} unless the caller itself is being rate-limited —
 * it never reveals whether `email` belongs to a real volunteer, whether they're
 * approved, or anything else about them.
 */
export async function requestVolunteerCode(db: SupabaseClient, emailRaw: string, ip: string): Promise<RequestCodeResult> {
  const email = emailRaw.trim().toLowerCase();
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const [{ count: emailCount }, { count: ipCount }] = await Promise.all([
    db.from("volunteer_login_codes").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", windowStart),
    db.from("volunteer_login_codes").select("id", { count: "exact", head: true }).eq("request_ip", ip).gte("created_at", windowStart),
  ]);
  if ((emailCount ?? 0) >= MAX_REQUESTS_PER_EMAIL || (ipCount ?? 0) >= MAX_REQUESTS_PER_IP) {
    return { ok: false, error: "rate_limited", retry_after_seconds: RATE_WINDOW_MS / 1000 };
  }

  const volunteer = await findVolunteerByEmail(db, email);
  if (!volunteer || volunteer.status === "rejected" || volunteer.status === "inactive") {
    equalizeTiming();
    return { ok: true };
  }

  // A currently-locked code for this email blocks issuing a new one — otherwise
  // asking for a fresh code would trivially reset a lockout's guess counter.
  const { data: liveRows } = await db.from("volunteer_login_codes")
    .select("locked_until").eq("email", email).is("consumed_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1);
  const live = liveRows?.[0] as { locked_until: string | null } | undefined;
  if (live?.locked_until && new Date(live.locked_until) > new Date()) {
    return { ok: true };
  }

  // A fresh code supersedes any other still-live one for this email.
  await db.from("volunteer_login_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email).is("consumed_at", null).gt("expires_at", new Date().toISOString());

  const code = randomSixDigitCode();
  const salt = randomBytes(16).toString("hex");
  await db.from("volunteer_login_codes").insert({
    email, code_hash: hashCode(code, salt), salt,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    request_ip: ip,
  });

  await sendVolunteerCodeEmail(email, code);
  return { ok: true };
}

export interface VerifyCodeResult {
  ok: boolean;
  error?: "invalid" | "locked" | "expired";
  retry_after_seconds?: number;
  cookieToken?: string;
  volunteer?: VolunteerSafe;
}

export async function verifyVolunteerCode(db: SupabaseClient, emailRaw: string, codeRaw: string): Promise<VerifyCodeResult> {
  const email = emailRaw.trim().toLowerCase();
  const code = codeRaw.trim();

  const { data: rows } = await db.from("volunteer_login_codes").select("*")
    .eq("email", email).is("consumed_at", null)
    .order("created_at", { ascending: false }).limit(1);
  const row = rows?.[0] as Record<string, unknown> | undefined;
  if (!row) { equalizeTiming(); return { ok: false, error: "invalid" }; }

  if (row.locked_until && new Date(row.locked_until as string) > new Date()) {
    return { ok: false, error: "locked", retry_after_seconds: Math.ceil((new Date(row.locked_until as string).getTime() - Date.now()) / 1000) };
  }
  if (new Date(row.expires_at as string) < new Date()) return { ok: false, error: "expired" };

  if (hashCode(code, row.salt as string) !== row.code_hash) {
    const attempts = (row.attempts as number) + 1;
    const locked_until = attempts >= 10 ? new Date(Date.now() + LOCK_AFTER_10_MS).toISOString()
      : attempts >= 5 ? new Date(Date.now() + LOCK_AFTER_5_MS).toISOString()
      : null;
    await db.from("volunteer_login_codes").update({ attempts, locked_until }).eq("id", row.id as string);
    return { ok: false, error: "invalid" };
  }

  await db.from("volunteer_login_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id as string);

  const volunteer = await findVolunteerByEmail(db, email);
  if (!volunteer) return { ok: false, error: "invalid" }; // defensive: shouldn't happen, a code is only ever issued for a real volunteer

  const token = randomSessionToken();
  await db.from("volunteer_login_sessions").insert({
    volunteer_id: volunteer.id as string,
    token_hash: sha256(token),
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });

  return { ok: true, cookieToken: token, volunteer: toSafeVolunteer(volunteer) };
}

export async function getVolunteerFromSession(db: SupabaseClient, token: string | undefined | null): Promise<VolunteerSafe | null> {
  if (!token) return null;
  const { data: rows } = await db.from("volunteer_login_sessions").select("*")
    .eq("token_hash", sha256(token)).is("revoked_at", null).gt("expires_at", new Date().toISOString())
    .limit(1);
  const session = rows?.[0] as { id: string; volunteer_id: string } | undefined;
  if (!session) return null;

  await db.from("volunteer_login_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", session.id);

  const { data: volunteer } = await db.from("volunteers").select("*").eq("id", session.volunteer_id).maybeSingle();
  if (!volunteer) return null;
  return toSafeVolunteer(volunteer as Record<string, unknown>);
}

export async function revokeVolunteerSession(db: SupabaseClient, token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.from("volunteer_login_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", sha256(token));
}
