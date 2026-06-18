import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { IdexxConfig } from "@/lib/idexx";
import { idexxGetResult, mapIdexxResult } from "@/lib/idexx";

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

  const { data: configRow } = await db
    .from("shelter_config")
    .select("config_data")
    .eq("id", 6)
    .single();

  const config = configRow?.config_data as IdexxConfig | null;
  if (!config?.practice_id || !config?.api_key || !config?.auto_sync) {
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

export async function GET(req: NextRequest) {
  // Vercel cron passes Authorization: Bearer <CRON_SECRET>
  const auth   = req.headers.get("authorization") ?? "";
  const cronKey = process.env.CRON_SECRET;
  if (cronKey && auth !== `Bearer ${cronKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runPoll();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runPoll();
  return NextResponse.json(result);
}
