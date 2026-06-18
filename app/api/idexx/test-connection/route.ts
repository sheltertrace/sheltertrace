import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { IdexxConfig } from "@/lib/idexx";
import { idexxTestConnection } from "@/lib/idexx";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // Allow passing config directly from the admin form (unsaved credentials test)
  const body = await req.json() as { config?: IdexxConfig };

  let config: IdexxConfig | null = body.config ?? null;

  if (!config) {
    const db = adminClient();
    const { data: configRow } = await db
      .from("shelter_config")
      .select("config_data")
      .eq("id", 6)
      .single();
    config = (configRow?.config_data as IdexxConfig) ?? null;
  }

  if (!config?.practice_id || !config?.api_key) {
    return NextResponse.json({ ok: false, message: "IDEXX credentials not configured" });
  }

  const result = await idexxTestConnection(config);
  return NextResponse.json(result);
}
