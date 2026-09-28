import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { verifyStaffSession } from "@/lib/courtPacket/serverAuth";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "@/lib/shelterInfo";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = `${AGENCY_NAME} <noreply@resend.dev>`;
const MAX_ATTACHMENT_BYTES = 35_000_000; // Resend caps a message at 40MB total

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  if (!(await verifyStaffSession(req.headers.get("x-staff-token")))) {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 401 });
  }

  let body: { to?: string; subject?: string; message?: string; path?: string; filename?: string; callNumber?: string; sentBy?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const { to, subject, message, path, filename, callNumber, sentBy } = body;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ success: false, error: "A valid recipient email is required" }, { status: 400 });
  if (!path || !filename) return NextResponse.json({ success: false, error: "path and filename are required" }, { status: 400 });

  // The PDF must be one this app saved to the call's evidence storage under
  // court-packets/ — never an arbitrary path — so this can't be used to mail
  // some other file out of the (now-private) evidence bucket. evidence has no
  // anon access at all, so this fetch uses the service role directly rather
  // than a signed URL — this is a server-to-server read, never exposed to a
  // browser, so there's no URL/expiry to manage at all.
  if (path.includes("..") || !path.includes("/court-packets/")) {
    return NextResponse.json({ success: false, error: "Packet file location not allowed" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });

  try {
    const { data: fileData, error: dlErr } = await adminClient().storage.from("evidence").download(path);
    if (dlErr || !fileData) return NextResponse.json({ success: false, error: "Could not retrieve the packet PDF" }, { status: 502 });
    const buf = Buffer.from(await fileData.arrayBuffer());
    if (buf.length > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ success: false, error: "Packet is too large to email — download it and share it another way." }, { status: 413 });
    }
    const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: subject || `Court Packet ${callNumber || ""}`.trim(),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">
        ${message ? `<p style="white-space:pre-wrap">${esc(message)}</p>` : `<p>Please find the attached court packet${callNumber ? ` for ${esc(callNumber)}` : ""}.</p>`}
        <p style="color:#64748b;font-size:12px;margin-top:24px">${esc(AGENCY_NAME)} · ${esc(AGENCY_ADDRESS)} · ${esc(AGENCY_PHONE)}${sentBy ? `<br/>Sent by ${esc(sentBy)}` : ""}<br/>MCAS Confidential — Law Enforcement Use</p>
      </div>`,
      attachments: [{ filename: safeName, content: buf }],
    });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[court-packet/email]", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
