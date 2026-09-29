import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVolunteerFromSession, SESSION_COOKIE } from "@/lib/volunteerAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Returns the volunteer regardless of status (pending/active/inactive/rejected) —
// the caller decides what to show for each; only a missing/expired/revoked
// SESSION is a 401 here.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const volunteer = await getVolunteerFromSession(adminClient(), token);
  if (!volunteer) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, volunteer });
}
