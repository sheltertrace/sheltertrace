import { NextResponse } from "next/server";
import { verifyStaffSession } from "./courtPacket/serverAuth";

// Shared gate for server routes that must be staff-only (file signing, upload,
// delete). Requires the signed session token from staff_login/staff_verify_session
// (see the 2026-09-28 session-signing fix) — never a client-supplied id, never a
// role/permission claimed by the request body.
export async function requireStaffSession(req: Request): Promise<NextResponse | null> {
  const token = req.headers.get("x-staff-token");
  if (!(await verifyStaffSession(token))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return null; // null = authorized, caller proceeds
}
