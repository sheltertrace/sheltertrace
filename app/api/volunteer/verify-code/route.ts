import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyVolunteerCode, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE } from "@/lib/volunteerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 }); }
  if (!body.email || !body.code) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });

  const result = await verifyVolunteerCode(adminClient(), body.email, body.code);
  if (!result.ok) {
    const status = result.error === "locked" ? 429 : 401;
    return NextResponse.json(result, { status });
  }

  const res = NextResponse.json({ ok: true, volunteer: result.volunteer });
  res.cookies.set(SESSION_COOKIE, result.cookieToken!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
