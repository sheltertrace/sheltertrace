import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { IdexxOrderPayload } from "@/lib/idexx";
import { idexxCreateOrder } from "@/lib/idexx";
import { loadIdexxConfig } from "@/lib/idexxServer";

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

  // Credentials come from server environment variables, never from the database.
  const config = await loadIdexxConfig(db);

  if (!config.vetconnect_username || !config.vetconnect_password) {
    return NextResponse.json({ error: "VetConnect credentials are not configured on the server" }, { status: 400 });
  }

  const payload: IdexxOrderPayload = {
    practice_id:      config.account_number || "",
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
