import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { idexxGetResult, mapIdexxResult } from "@/lib/idexx";
import { loadIdexxConfig } from "@/lib/idexxServer";
import { timingSafeEqual } from "crypto";

// Vercel cron: runs every 30 minutes (configured in vercel.json)
// Also callable manually via GET /api/idexx/poll

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function runPoll(): Promise<{ polled: number; updated: number; errors: string[] }> {
  if (process.env.NEXT_PUBLIC_IS_DEMO === "true") {
    return { polled: 0, updated: 0, errors: ["Polling disabled in demo mode"] };
  }

  const db = adminClient();

  const config = await loadIdexxConfig(db);
  if (!config.vetconnect_username || !config.vetconnect_password || !config.auto_sync) {
    return { polled: 0, updated: 0, errors: ["IDEXX not configured or auto-sync disabled"] };
  }

  // Find pending IDEXX orders (ordered but not yet resulted)
  const { data: pending } = await db
    .from("medical_records")
    .select("id, idexx_accession_number, idexx_order_id, animal_name, type")
    .eq("idexx_status", "Pending")
    .not("idexx_accession_number", "is", null);

  if (!pending?.length) return { polled: 0, updated: 0, errors: [] };

  let updated = 0;
  const errors: string[] = [];

  for (const record of pending) {
    try {
      const result = await idexxGetResult(config, record.idexx_accession_number);
      if (result.status === "RESULTED" && result.result !== "PENDING") {
        const mappedResult = mapIdexxResult(result.result);
        await db
          .from("medical_records")
          .update({
            test_result:       mappedResult,
            idexx_status:      "Resulted",
            idexx_result_data: result.result_data ?? null,
            idexx_resulted_at: result.resulted_at ?? new Date().toISOString(),
            status:            "Administered",
            updated_at:        new Date().toISOString(),
          })
          .eq("id", record.id);
        updated++;
      }
    } catch (err: unknown) {
      const e = err as Error;
      errors.push(`${record.id}: ${e.message}`);
    }
  }

  return { polled: pending.length, updated, errors };
}

// Fails CLOSED: without CRON_SECRET configured nobody can trigger a poll (this endpoint calls IDEXX
// with the practice's credentials and writes results into medical records).
// Vercel cron sends Authorization: Bearer <CRON_SECRET> when the CRON_SECRET env var is set.
function authorized(req: NextRequest): boolean {
  const cronKey = process.env.CRON_SECRET;
  if (!cronKey) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${cronKey}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runPoll());
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runPoll());
}
