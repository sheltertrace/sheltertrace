import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const MCAS_ADDRESS = "1535 Buckhead Rd, Madison, GA 30650";
const MCAS_PHONE = "(706) 474-7170";
const FROM = "Morgan County Animal Services <noreply@resend.dev>";

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ success: false, error: "Email not configured. RESEND_API_KEY is missing." }, { status: 500 });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  let body: {
    violatorEmail: string;
    violatorName: string;
    citationNumber: string;
    citationDate: string;
    violations: Array<{ code: string; description: string; count: number }>;
    fineAmount?: string | number | null;
    dueDate?: string;
    courtName?: string;
    courtAddress?: string;
    courtDate?: string;
    courtTime?: string;
    courtAmPm?: string;
    officerName?: string;
    officerBadge?: string;
    animalInfo?: string;
    remarks?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const {
    violatorEmail, violatorName, citationNumber, citationDate,
    violations = [], fineAmount, dueDate, courtName, courtAddress,
    courtDate, courtTime, courtAmPm, officerName, officerBadge,
    animalInfo, remarks,
  } = body;

  if (!violatorEmail || !citationNumber) {
    return NextResponse.json({ success: false, error: "violatorEmail and citationNumber are required." }, { status: 400 });
  }

  const violationRows = violations.map((v) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;white-space:nowrap">§ ${v.code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700">×${v.count}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${v.description}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Citation ${citationNumber} — Morgan County Animal Services</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937">
  <div style="max-width:620px;margin:32px auto;border-radius:10px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.12)">

    <!-- Header -->
    <div style="background:#0f2942;padding:28px 32px">
      <div style="font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.5px;line-height:1.2">
        Morgan County Animal Services
      </div>
      <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:6px">
        ${MCAS_ADDRESS} &nbsp;·&nbsp; ${MCAS_PHONE}
      </div>
    </div>

    <!-- Notice bar -->
    <div style="background:#dc2626;padding:10px 32px">
      <div style="color:#fff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px">
        Official Citation Notice
      </div>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px">

      <p style="margin:0 0 20px;font-size:15px">Dear <strong>${violatorName || "Recipient"}</strong>,</p>
      <p style="margin:0 0 24px;color:#374151;line-height:1.6">
        You have been issued a citation by Morgan County Animal Services for the violation(s) listed below.
        Please read this notice carefully — you must either pay the fine before your court date or appear in court as scheduled.
      </p>

      <!-- Citation info box -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.8px;margin-bottom:12px">
          Citation Details
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;width:45%">Citation Number</td>
            <td style="padding:4px 0;font-weight:800;font-family:monospace;font-size:14px">${citationNumber}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px">Date Issued</td>
            <td style="padding:4px 0;font-size:13px">${citationDate || "—"}</td>
          </tr>
          ${officerName ? `<tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px">Issuing Officer</td>
            <td style="padding:4px 0;font-size:13px">${officerName}${officerBadge ? ` &nbsp;(Badge #${officerBadge})` : ""}</td>
          </tr>` : ""}
          ${animalInfo ? `<tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px">Animal Involved</td>
            <td style="padding:4px 0;font-size:13px">${animalInfo}</td>
          </tr>` : ""}
        </table>
      </div>

      <!-- Violations -->
      <div style="margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.8px;margin-bottom:10px">
          Violation(s)
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:9px 12px;text-align:left;font-size:12px;color:#374151;font-weight:700">Code Section</th>
              <th style="padding:9px 12px;text-align:center;font-size:12px;color:#374151;font-weight:700;width:60px">Count</th>
              <th style="padding:9px 12px;text-align:left;font-size:12px;color:#374151;font-weight:700">Description</th>
            </tr>
          </thead>
          <tbody>${violationRows || `<tr><td colspan="3" style="padding:10px 12px;color:#6b7280;font-size:13px">See attached citation for violation details.</td></tr>`}</tbody>
        </table>
      </div>

      ${remarks ? `
      <!-- Remarks -->
      <div style="margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:0.8px;margin-bottom:8px">Remarks</div>
        <div style="font-size:13px;color:#374151;padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">${remarks}</div>
      </div>` : ""}

      <!-- Fine -->
      ${fineAmount ? `
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#991b1b;letter-spacing:0.8px;margin-bottom:8px">Fine</div>
        <div style="font-size:22px;font-weight:900;color:#dc2626">$${fineAmount}</div>
        ${dueDate ? `<div style="font-size:13px;color:#991b1b;margin-top:4px">Due by: <strong>${dueDate}</strong></div>` : ""}
        <div style="font-size:12px;color:#6b7280;margin-top:8px">
          You may pay this fine before your court date in person at ${MCAS_ADDRESS}.
        </div>
      </div>` : ""}

      <!-- Court date -->
      ${courtDate ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#1d4ed8;letter-spacing:0.8px;margin-bottom:12px">
          Court Appearance Required
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;color:#374151;font-size:13px;width:40%">Court</td>
            <td style="padding:4px 0;font-weight:700;font-size:13px">${courtName || "—"}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#374151;font-size:13px">Address</td>
            <td style="padding:4px 0;font-size:13px">${courtAddress || "—"}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#374151;font-size:13px">Date</td>
            <td style="padding:4px 0;font-weight:700;font-size:14px;color:#1d4ed8">${courtDate}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#374151;font-size:13px">Time</td>
            <td style="padding:4px 0;font-size:13px">${[courtTime, courtAmPm].filter(Boolean).join(" ") || "—"}</td>
          </tr>
        </table>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #bfdbfe;font-size:12px;color:#1e40af;line-height:1.6">
          You must either pay the fine in full before the date above <strong>or</strong> appear in court on the scheduled date and time.
          Failure to appear may result in a bench warrant and additional penalties.
        </div>
      </div>` : ""}

      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.7">
        If you have questions about this citation, please contact Morgan County Animal Services at
        <strong>${MCAS_PHONE}</strong> or visit us at ${MCAS_ADDRESS} during business hours.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#1f2937;padding:18px 32px">
      <div style="font-size:12px;color:rgba(255,255,255,.6);line-height:1.8">
        Morgan County Animal Services &nbsp;·&nbsp; ${MCAS_ADDRESS}<br>
        Phone: ${MCAS_PHONE}<br>
        <span style="font-size:11px">This is an official notice. Do not reply to this email.</span>
      </div>
    </div>

  </div>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [violatorEmail],
      subject: `Citation ${citationNumber} — Morgan County Animal Services`,
      html,
    });

    if (error) {
      console.error("[send-citation-email] Resend error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-citation-email] unexpected error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 200 });
  }
}
