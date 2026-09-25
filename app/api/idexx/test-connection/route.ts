import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { idexxTestConnection } from "@/lib/idexx";
import { loadIdexxConfig, idexxCredentialStatus } from "@/lib/idexxServer";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Credentials are read from server environment variables only. A request body is ignored, so
// this endpoint can no longer be used to test (or exfiltrate through) arbitrary credentials.
export async function POST(_req: NextRequest) {
  if (!idexxCredentialStatus().vetconnect) {
    return NextResponse.json({ ok: false, message: "IDEXX credentials are not set on the server. Add IDEXX_VETCONNECT_USERNAME and IDEXX_VETCONNECT_PASSWORD in Vercel → Settings → Environment Variables, then redeploy." });
  }
  const config = await loadIdexxConfig(adminClient());
  const result = await idexxTestConnection(config);
  return NextResponse.json(result);
}
