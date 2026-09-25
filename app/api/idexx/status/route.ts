import { NextResponse } from "next/server";
import { idexxCredentialStatus } from "@/lib/idexxServer";

// Reports WHICH IDEXX server secrets are set — booleans only, never values.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(idexxCredentialStatus());
}
