import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isActiveStaff } from "@/lib/courtPacket/serverAuth";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "@/lib/shelterInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FROM = `${AGENCY_NAME} <noreply@resend.dev>`;
const MAX_ATTACHMENT_BYTES = 35_000_000; // Resend caps a message at 40MB total

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  if (!(await isActiveStaff(req.headers.get("x-staff-id")))) {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 401 });
  }

  let body: { to?: string; subject?: string; message?: string; pdfUrl?: string; filename?: string; callNumber?: string; sentBy?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const { to, subject, message, pdfUrl, filename, callNumber, sentBy } = body;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ success: false, error: "A valid recipient email is required" }, { status: 400 });
  if (!pdfUrl || !filename) return NextResponse.json({ success: false, error: "pdfUrl and filename are required" }, { status: 400 });

  // The PDF must be one this app saved to the call's evidence storage — never
  // an arbitrary URL — so this can't be pointed at internal hosts or used to
  // mail arbitrary files. Validate the PARSED url: URL normalization resolves
  // ".." / "%2e%2e" segments, so a string-prefix check alone could be walked
  // out of the evidence bucket.
  let target: URL;
  try {
    target = new URL(pdfUrl);
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    const ok = target.origin === base.origin &&
      target.pathname.startsWith("/storage/v1/object/public/evidence/") &&
      target.pathname.includes("/court-packets/");
    if (!ok) throw new Error("not allowed");
  } catch {
    return NextResponse.json({ success: false, error: "Packet file location not allowed" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: "Email not configured" }, { status: 500 });

  try {
    const res = await fetch(target.toString());
    if (!res.ok) return NextResponse.json({ success: false, error: "Could not retrieve the packet PDF" }, { status: 502 });
    const buf = Buffer.from(await res.arrayBuffer());
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
