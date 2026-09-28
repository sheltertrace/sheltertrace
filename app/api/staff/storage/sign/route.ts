import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffSession } from "@/lib/staffApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Buckets this route is allowed to sign for. Everything else is refused, even
// if a valid staff session is presented — this route is not a general-purpose
// storage proxy.
const ALLOWED_BUCKETS = ["evidence", "documents", "pet-license-documents"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

// The TTL is decided HERE, from a fixed purpose, never from anything the
// client sends. 'view' covers a staff member clicking to open one file.
// 'court-packet' covers generateCourtPacket() (runs in the browser, fetches
// every evidence photo/document itself, and can take a while for a large
// packet) — all needed URLs are signed once, up front, in a single batch call.
const TTL_SECONDS: Record<"view" | "court-packet", number> = {
  view: 60,
  "court-packet": 900,
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireStaffSession(req);
  if (unauthorized) return unauthorized;

  let body: { bucket?: string; path?: string; paths?: string[]; purpose?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bucket = body.bucket;
  if (!bucket || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return NextResponse.json({ error: "Unknown or disallowed bucket" }, { status: 400 });
  }
  const purpose = body.purpose === "court-packet" ? "court-packet" : "view";
  const ttl = TTL_SECONDS[purpose];

  const db = adminClient();

  if (Array.isArray(body.paths)) {
    if (body.paths.length === 0 || body.paths.length > 200) {
      return NextResponse.json({ error: "paths must be a non-empty array of at most 200" }, { status: 400 });
    }
    const { data, error } = await db.storage.from(bucket).createSignedUrls(body.paths, ttl);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const urls: Record<string, string | null> = {};
    data.forEach((d, i) => { urls[body.paths![i]] = d.signedUrl ?? null; });
    return NextResponse.json({ urls, expires_in: ttl });
  }

  if (!body.path) return NextResponse.json({ error: "path or paths is required" }, { status: 400 });
  const { data, error } = await db.storage.from(bucket).createSignedUrl(body.path, ttl);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, expires_in: ttl });
}
