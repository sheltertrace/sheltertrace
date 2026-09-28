import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffSession } from "@/lib/staffApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BUCKETS = ["evidence", "documents", "animal-photos"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireStaffSession(req);
  if (unauthorized) return unauthorized;

  let body: { bucket?: string; paths?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bucket = body.bucket;
  if (!bucket || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return NextResponse.json({ error: "Unknown or disallowed bucket" }, { status: 400 });
  }
  if (!Array.isArray(body.paths) || body.paths.length === 0 || body.paths.length > 100 || body.paths.some((p) => typeof p !== "string" || !p || p.includes(".."))) {
    return NextResponse.json({ error: "paths must be a non-empty array of at most 100 valid paths" }, { status: 400 });
  }

  const db = adminClient();
  const { error } = await db.storage.from(bucket).remove(body.paths);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
