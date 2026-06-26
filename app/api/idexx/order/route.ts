import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { IdexxConfig, IdexxOrderPayload } from "@/lib/idexx";
import { idexxCreateOrder } from "@/lib/idexx";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    medical_record_id: string;
    test_code:         string;
    requesting_staff:  string;
    animal: {
      name:       string;
      species:    string;
      breed:      string;
      age:        string;
      sex:        string;
      weight?:    number;
    };
  };

  const db = adminClient();

  const { data: configRow } = await db
    .from("shelter_config")
    .select("config_data")
    .eq("id", 6)
    .maybeSingle();

  if (!configRow?.config_data) {
    return NextResponse.json({ error: "IDEXX not configured" }, { status: 400 });
  }

  const config = configRow.config_data as IdexxConfig;

  if (!config.vetconnect_username || !config.vetconnect_password) {
    return NextResponse.json({ error: "VetConnect Agent credentials not configured" }, { status: 400 });
  }

  const payload: IdexxOrderPayload = {
    practice_id:      config.practice_id,
    account_number:   config.account_number,
    external_id:      body.medical_record_id,
    test_code:        body.test_code,
    requesting_staff: body.requesting_staff,
    patient: {
      name:       body.animal.name,
      species:    body.animal.species,
      breed:      body.animal.breed || "Unknown",
      age_years:  parseFloat(body.animal.age) || 0,
      sex:        body.animal.sex || "Unknown",
      weight_lbs: body.animal.weight,
    },
  };

  try {
    const order = await idexxCreateOrder(config, payload);

    await db
      .from("medical_records")
      .update({
        idexx_order_id:         order.order_id,
        idexx_accession_number: order.accession_number,
        idexx_status:           "Pending",
        idexx_ordered_at:       new Date().toISOString(),
      })
      .eq("id", body.medical_record_id);

    return NextResponse.json({
      order_id:         order.order_id,
      accession_number: order.accession_number,
    });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
