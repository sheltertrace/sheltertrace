import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = "citations@morgancountyanimalservices.gov";
const MCAS_ADDRESS = "2392 Athens Hwy, Madison, GA 30650";
const MCAS_PHONE = "(706) 342-1512";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { citation_id } = await req.json();
    if (!citation_id) {
      return new Response(
        JSON.stringify({ success: false, error: "citation_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: cit, error: fetchErr } = await supabase
      .from("citations")
      .select("*")
      .eq("id", citation_id)
      .single();

    if (fetchErr || !cit) {
      return new Response(
        JSON.stringify({ success: false, error: "Citation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!cit.violator_email) {
      return new Response(
        JSON.stringify({ success: false, error: "No violator email on this citation" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const courtAddr = cit.court_type === "Magistrate"
      ? "149 E Jefferson St, Madison, GA 30650 — (706) 342-3088"
      : "118 N Main St, Madison, GA 30650 — (706) 342-2058";
    const courtName = cit.court_type === "Magistrate"
      ? "Morgan County Magistrate Court"
      : "Morgan County State Court";

    const violatorName = [cit.violator_last, cit.violator_first]
      .filter(Boolean).join(", ") || cit.violator_name || "Recipient";

    const violationRows = (cit.violations ?? []).map((v: { code: string; description: string; count: number }) =>
      `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace">§ ${v.code}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">×${v.count}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${v.description}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Citation ${cit.citation_number}</title></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;margin:0;padding:0;background:#f3f4f6">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:#0f2942;color:#fff;padding:24px 32px">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px">Morgan County Animal Services</div>
      <div style="font-size:13px;margin-top:4px;opacity:.8">${MCAS_ADDRESS} · ${MCAS_PHONE}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="font-size:15px;font-weight:700;margin:0 0 6px">Dear ${violatorName},</p>
      <p style="margin:0 0 20px;color:#374151">You have been issued a citation by Morgan County Animal Services for the following violation(s). Please read this notice carefully.</p>

      <!-- Citation Info -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px 20px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Citation Details</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:40%">Citation Number</td><td style="padding:4px 0;font-weight:700;font-family:monospace">${cit.citation_number || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Date Issued</td><td style="padding:4px 0">${cit.date || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Location</td><td style="padding:4px 0">${cit.location || "—"}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px">Issuing Officer</td><td style="padding:4px 0">${cit.issuing_officer || "—"} ${cit.badge_number ? `(Badge #${cit.badge_number})` : ""}</td></tr>
        </table>
      </div>

      <!-- Violations -->
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:8px">Violation(s)</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#374151">Code Section</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#374151">Count</th>
            <th style="padding:8px 10px;text-align:left;font-size:12px;color:#374151">Description</th>
          </tr></thead>
          <tbody>${violationRows}</tbody>
        </table>
      </div>

      <!-- Fine -->
      ${cit.fine_amount ? `
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:14px 20px;margin-bottom:20px">
        <div style="font-size:13px;color:#b91c1c;font-weight:700">Fine Amount: $${cit.fine_amount}</div>
        ${cit.due_date ? `<div style="font-size:12px;color:#b91c1c;margin-top:4px">Due: ${cit.due_date}</div>` : ""}
        <div style="font-size:12px;color:#6b7280;margin-top:6px">You may pay this fine before your court date at ${MCAS_ADDRESS}.</div>
      </div>` : ""}

      <!-- Court -->
      ${cit.court_date ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:14px 20px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#1d4ed8;margin-bottom:8px">Court Appearance Required</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:3px 0;color:#374151;font-size:13px;width:40%">Court</td><td style="padding:3px 0;font-weight:700">${courtName}</td></tr>
          <tr><td style="padding:3px 0;color:#374151;font-size:13px">Address</td><td style="padding:3px 0">${courtAddr}</td></tr>
          <tr><td style="padding:3px 0;color:#374151;font-size:13px">Date</td><td style="padding:3px 0;font-weight:700">${cit.court_date}</td></tr>
          <tr><td style="padding:3px 0;color:#374151;font-size:13px">Time</td><td style="padding:3px 0">${cit.court_time || "—"} ${cit.court_am_pm || ""}</td></tr>
        </table>
        <p style="font-size:12px;color:#374151;margin:10px 0 0">You must either pay the fine before your court date or appear in court on the date and time listed above. Failure to appear may result in additional penalties.</p>
      </div>` : ""}

      <p style="font-size:12px;color:#6b7280;margin:0">If you have questions about this citation, please contact Morgan County Animal Services at ${MCAS_PHONE} or visit ${MCAS_ADDRESS} during business hours.</p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;font-size:11px;color:#9ca3af">
      Morgan County Animal Services · ${MCAS_ADDRESS} · ${MCAS_PHONE}<br>
      This is an official notice. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [cit.violator_email],
        subject: `Citation ${cit.citation_number} — Morgan County Animal Services`,
        html,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: resData.message || "Resend API error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, email_id: resData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
