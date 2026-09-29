import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requestVolunteerCode } from "@/lib/volunteerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 }); }

  const email = (body.email || "").trim();
  if (!EMAIL_RE.test(email)) {
    // A malformed email isn't an enumeration signal (it never reached a lookup) — fine to say so.
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const result = await requestVolunteerCode(adminClient(), email, clientIp(req));
  return NextResponse.json(result, { status: result.ok ? 200 : 429 });
}
