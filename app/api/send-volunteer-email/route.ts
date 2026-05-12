import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const MCAS_ADDRESS = "2392 Athens Hwy, Madison, GA 30650";
const MCAS_PHONE   = "(706) 752-1195";
const FROM         = "Morgan County Animal Services <noreply@resend.dev>";

type EmailType = "approval" | "rejection" | "more_info";

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: false, error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  let body: {
    type: EmailType;
    applicantEmail: string;
    applicantName: string;
    pid?: string;
    reviewerNotes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const { type, applicantEmail, applicantName, pid, reviewerNotes } = body;

  if (!applicantEmail || !applicantName || !type) {
    return NextResponse.json({ success: false, error: "type, applicantEmail, and applicantName are required." }, { status: 400 });
  }

  let subject = "";
  let html    = "";

  if (type === "approval") {
    subject = "Welcome to the MCAS Volunteer Team!";
    html = buildApprovalEmail(applicantName, pid || "—", reviewerNotes);
  } else if (type === "rejection") {
    subject = "Morgan County Animal Services — Volunteer Application Update";
    html = buildRejectionEmail(applicantName, reviewerNotes);
  } else if (type === "more_info") {
    subject = "Action Required — MCAS Volunteer Application";
    html = buildMoreInfoEmail(applicantName, reviewerNotes);
  } else {
    return NextResponse.json({ success: false, error: `Unknown email type: ${type}` }, { status: 400 });
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to: [applicantEmail], subject, html });
    if (error) {
      console.error("[send-volunteer-email] Resend error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-volunteer-email] unexpected error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 200 });
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
  <div style="max-width:620px;margin:32px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.12)">

    <div style="background:#0f2942;padding:28px 32px">
      <div style="font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.5px;line-height:1.2">
        Morgan County Animal Services
      </div>
      <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:6px">
        ${MCAS_ADDRESS} &nbsp;·&nbsp; ${MCAS_PHONE}
      </div>
    </div>

    <div style="background:#fff;padding:32px">
      ${content}
    </div>

    <div style="background:#1f2937;padding:18px 32px">
      <div style="font-size:12px;color:rgba(255,255,255,.6);line-height:1.8">
        Morgan County Animal Services &nbsp;·&nbsp; ${MCAS_ADDRESS}<br>
        Phone: ${MCAS_PHONE}<br>
        <span style="font-size:11px">Do not reply to this email — contact us by phone or in person.</span>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function buildApprovalEmail(name: string, pid: string, notes?: string): string {
  return shell(`
    <div style="background:#1a8a8a;padding:10px 32px;margin:-32px -32px 32px">
      <div style="color:#fff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">
        🎉 Volunteer Application Approved
      </div>
    </div>

    <p style="margin:0 0 18px;font-size:15px">Dear <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;line-height:1.7">
      We are thrilled to welcome you as a volunteer with <strong>Morgan County Animal Services</strong>!
      Your application has been reviewed and approved.
    </p>

    <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:20px 22px;margin-bottom:24px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#15803d;letter-spacing:0.8px;margin-bottom:8px">
        Your Volunteer ID
      </div>
      <div style="font-size:32px;font-weight:900;color:#0f2942;font-family:monospace;letter-spacing:2px">
        ${pid}
      </div>
      <div style="font-size:12px;color:#6b7280;margin-top:8px">
        You will need this ID to clock in at the volunteer kiosk and access the volunteer portal.
      </div>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.8px;margin-bottom:10px">Next Steps</div>
      <ul style="margin:0;padding:0 0 0 18px;font-size:13px;color:#374151;line-height:2">
        <li>Visit us at ${MCAS_ADDRESS} to pick up your volunteer badge</li>
        <li>Complete your orientation with a staff member before your first shift</li>
        <li>Clock in using the kiosk at the front desk or at <strong>sheltertrace.com/volunteer-clock</strong></li>
        <li>Check your hours and announcements at <strong>sheltertrace.com/volunteer</strong> using your Volunteer ID</li>
      </ul>
    </div>

    ${notes ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1d4ed8;letter-spacing:0.8px;margin-bottom:8px">Note from Staff</div>
      <div style="font-size:13px;color:#374151">${notes}</div>
    </div>` : ""}

    <p style="margin:0;font-size:13px;color:#374151;line-height:1.7">
      Thank you for choosing to make a difference in the lives of animals in Morgan County.
      We look forward to working with you!
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#374151">
      Warmly,<br>
      <strong>Morgan County Animal Services Volunteer Team</strong>
    </p>
  `);
}

function buildRejectionEmail(name: string, notes?: string): string {
  return shell(`
    <div style="background:#6b7280;padding:10px 32px;margin:-32px -32px 32px">
      <div style="color:#fff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">
        Volunteer Application — Update
      </div>
    </div>

    <p style="margin:0 0 18px;font-size:15px">Dear <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;line-height:1.7">
      Thank you for your interest in volunteering with <strong>Morgan County Animal Services</strong>.
      After careful review of your application, we are unable to move forward with your volunteer registration at this time.
    </p>

    ${notes ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.8px;margin-bottom:8px">Additional Information</div>
      <div style="font-size:13px;color:#374151;line-height:1.7">${notes}</div>
    </div>` : ""}

    <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.7">
      We appreciate your willingness to give your time to help animals in our community.
      If you have questions about this decision, please contact us directly at ${MCAS_PHONE} or visit us at ${MCAS_ADDRESS}.
    </p>
    <p style="margin:0;font-size:13px;color:#374151">
      Thank you,<br>
      <strong>Morgan County Animal Services</strong>
    </p>
  `);
}

function buildMoreInfoEmail(name: string, notes?: string): string {
  return shell(`
    <div style="background:#d97706;padding:10px 32px;margin:-32px -32px 32px">
      <div style="color:#fff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">
        Action Required — Additional Information Needed
      </div>
    </div>

    <p style="margin:0 0 18px;font-size:15px">Dear <strong>${name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;line-height:1.7">
      Thank you for applying to volunteer with <strong>Morgan County Animal Services</strong>.
      We have reviewed your application and need a bit more information before we can make a decision.
    </p>

    ${notes ? `
    <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:8px;padding:16px 18px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#92400e;letter-spacing:0.8px;margin-bottom:8px">What We Need</div>
      <div style="font-size:13px;color:#374151;line-height:1.7">${notes}</div>
    </div>` : `
    <div style="background:#fffbeb;border:2px solid #fcd34d;border-radius:8px;padding:16px 18px;margin-bottom:24px">
      <div style="font-size:13px;color:#374151;line-height:1.7">
        Please contact us to provide additional information about your application.
      </div>
    </div>`}

    <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.7">
      Please contact us at <strong>${MCAS_PHONE}</strong> or visit us at ${MCAS_ADDRESS} during business hours
      so we can complete your application review.
    </p>
    <p style="margin:0;font-size:13px;color:#374151">
      Thank you,<br>
      <strong>Morgan County Animal Services</strong>
    </p>
  `);
}
