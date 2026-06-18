import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { IdexxConfig, IdexxResultPayload } from "@/lib/idexx";
import { mapIdexxResult } from "@/lib/idexx";
import { createHmac } from "crypto";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const sig = signature.replace(/^sha256=/, "");
  // Constant-time comparison
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const sig      = req.headers.get("x-idexx-signature") ?? req.headers.get("x-hub-signature-256");

  const db = adminClient();

  // Load webhook secret from config
  const { data: configRow } = await db
    .from("shelter_config")
    .select("config_data")
    .eq("id", 6)
    .single();

  const config = configRow?.config_data as IdexxConfig | null;
  const webhookSecret = config?.webhook_secret ?? "";

  // Verify signature when secret is configured
  if (webhookSecret && !verifySignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: IdexxResultPayload;
  try {
    payload = JSON.parse(rawBody) as IdexxResultPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.order_id && !payload.accession_number) {
    return NextResponse.json({ error: "Missing order_id or accession_number" }, { status: 400 });
  }

  // Find medical record
  let query = db.from("medical_records").select("id, animal_name, type");
  if (payload.order_id) {
    query = query.eq("idexx_order_id", payload.order_id);
  } else {
    query = query.eq("idexx_accession_number", payload.accession_number);
  }

  const { data: records } = await query.limit(1);
  const record = records?.[0];

  if (!record) {
    // Acknowledge receipt even if we can't find the record (prevents IDEXX retries)
    console.warn("[IDEXX webhook] No matching medical record for", payload.order_id ?? payload.accession_number);
    return NextResponse.json({ ok: true, matched: false });
  }

  const mappedResult = mapIdexxResult(payload.result);

  await db
    .from("medical_records")
    .update({
      test_result:            mappedResult,
      idexx_status:           "Resulted",
      idexx_result_data:      payload.result_data ?? null,
      idexx_resulted_at:      payload.resulted_at ?? new Date().toISOString(),
      idexx_accession_number: payload.accession_number,
      status:                 "Administered",
      updated_at:             new Date().toISOString(),
    })
    .eq("id", record.id);

  return NextResponse.json({ ok: true, matched: true, record_id: record.id });
}
