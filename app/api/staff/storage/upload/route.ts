import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffSession } from "@/lib/staffApiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// animal-photos stays public for READ (the adoption page depends on it) but
// no longer allows anon writes — this is the only way in now. evidence and
// documents are private end-to-end.
const ALLOWED_BUCKETS = ["evidence", "documents", "animal-photos", "platform-assets"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const MAX_BYTES = 35 * 1024 * 1024;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireStaffSession(req);
  if (unauthorized) return unauthorized;

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const bucket = form.get("bucket");
  const path = form.get("path");
  const file = form.get("file");
  const upsert = form.get("upsert") === "true";
  const contentType = form.get("contentType");

  if (typeof bucket !== "string" || !ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return NextResponse.json({ error: "Unknown or disallowed bucket" }, { status: 400 });
  }
  if (typeof path !== "string" || !path || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const db = adminClient();
  const { error } = await db.storage.from(bucket).upload(path, file, {
    upsert,
    contentType: typeof contentType === "string" && contentType ? contentType : file.type || undefined,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, path });
}
