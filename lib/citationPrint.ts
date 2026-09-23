import type { Citation } from "./types";
import { AGENCY_SEAL_LOGO, AGENCY_NAME, AGENCY_ADDRESS, AGENCY_SHORT, COURT_MAGISTRATE_ADDR, COURT_STATE_ADDR } from "./shelterInfo";

// The printed citation, as a complete HTML document. Shared by the
// citations page (print one) and the Court Packet (assemble many) so the
// two can never drift apart.
export function buildCitationHTML(cit: Citation): string {
  const courtAddr = cit.court_type === "Magistrate" ? COURT_MAGISTRATE_ADDR : COURT_STATE_ADDR;
  const formalName = cit.violator_last
    ? [cit.violator_last, (cit.violator_first || "") + (cit.violator_middle ? ` ${cit.violator_middle.charAt(0).toUpperCase()}.` : "")].filter(Boolean).join(", ")
    : (cit.violator_name || "—");
  const violatorSigHtml = cit.violator_signature
    ? `<img src="${cit.violator_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #aaa"></div>`;
  const officerSigHtml = cit.officer_signature
    ? `<img src="${cit.officer_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #aaa"></div>`;
  const signedLine = cit.signed_at ? `<div style="font-size:10px;color:#555">Signed: ${cit.signed_at}</div>` : "";
  return `
    <html><head><title>Citation ${cit.citation_number}</title>
    <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
      body{font-family:serif;font-size:11px;padding:20px;margin:0}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #000;padding:4px 6px}
      .section{margin:8px 0;font-weight:bold;font-size:11px;border-bottom:2px solid #000;padding-bottom:2px;text-transform:uppercase}
      @media print{body{padding:12px}}
    </style></head>
    <body>
      <!-- ${AGENCY_SHORT} Header -->
      <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:10px">
        <img src="${AGENCY_SEAL_LOGO}" alt="${AGENCY_SHORT} Seal" style="width:80px;height:80px;object-fit:contain;flex-shrink:0" />
        <div style="flex:1">
          <div style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px">${AGENCY_NAME}</div>
          <div style="font-size:11px;margin-top:2px">${AGENCY_ADDRESS}</div>
          <div style="font-size:11px;margin-top:1px">State of Georgia</div>
          <div style="font-size:12px;font-weight:700;margin-top:4px;font-style:italic">Uniform Citation, Summons, Accusation / Warning</div>
        </div>
        <div style="text-align:right;font-size:11px;flex-shrink:0">
          <div><b>Citation #:</b> ${cit.citation_number || "—"}</div>
          <div style="margin-top:3px"><b>Animal Impound #:</b> ${cit.animal_impound || "—"}</div>
          ${cit.citation_type === "Digital" ? `<div style="margin-top:4px;font-size:10px;color:#1d4ed8">Digital${cit.violator_email ? `<br>${cit.violator_email}` : ""}</div>` : ""}
        </div>
      </div>
      <div class="section">VIOLATOR INFORMATION</div>
      <table>
        <tr><td><b>Name:</b> ${formalName}</td><td><b>DL:</b> ${cit.violator_dl || "—"}</td></tr>
        <tr><td colspan="2"><b>Address:</b> ${[cit.violator_address, cit.violator_city, cit.violator_state, cit.violator_zip].filter(Boolean).join(", ") || "—"}</td></tr>
        <tr><td><b>Phone:</b> ${cit.violator_phone || "—"}</td><td><b>DOB:</b> ${cit.violator_dob || "—"}</td></tr>
        ${cit.violator_email ? `<tr><td colspan="2"><b>Email:</b> ${cit.violator_email}</td></tr>` : ""}
        <tr><td><b>Hair:</b> ${cit.desc_hair || "—"}</td><td><b>Eyes:</b> ${cit.desc_eyes || "—"}</td></tr>
        <tr><td><b>Weight:</b> ${cit.desc_weight || "—"}</td><td><b>Height:</b> ${cit.desc_height || "—"}</td></tr>
      </table>
      <div class="section">VIOLATIONS</div>
      <table>
        <tr><th style="width:55px;text-align:center">Count</th><th style="width:130px">Code Section</th><th>Description</th></tr>
        ${(cit.violations || []).map((v: {code: string; description: string; count: number}) => `<tr><td style="text-align:center;font-weight:bold;font-size:13px">×${v.count ?? 1}</td><td style="font-family:monospace">§ ${v.code}</td><td>${v.description}</td></tr>`).join("")}
      </table>
      <div class="section">ANIMAL DESCRIPTION</div>
      <div>${cit.animal_desc || "—"}</div>
      <div class="section">REMARKS</div>
      <div>${cit.remarks || "—"}</div>
      <div class="section">COURT INFORMATION</div>
      <div><b>Court:</b> ${cit.court_type} Court — ${courtAddr}</div>
      <div><b>Date/Time:</b> ${cit.court_date || "—"} at ${cit.court_time || "—"} ${cit.court_am_pm || ""}</div>
      <div><b>Fine:</b> $${cit.fine_amount || "0.00"} &nbsp; <b>Due:</b> ${cit.due_date || "—"}</div>
      <div class="section">OFFICER</div>
      <div><b>Issuing Officer:</b> ${cit.issuing_officer || "—"} &nbsp; <b>Badge:</b> ${cit.badge_number || "—"}</div>
      <div><b>Served By:</b> ${cit.served_by || "—"} &nbsp; <b>Date:</b> ${cit.date || "—"} &nbsp; <b>Time:</b> ${cit.time || "—"}</div>
      <div style="margin-top:16px;font-size:10px;font-style:italic">My signature acknowledges service of this Summons. I promise to appear in court on the date and time shown above or properly dispose of this case as provided by law.</div>
      <div style="margin-top:12px;width:260px">
        ${violatorSigHtml}
        <div style="border-top:1px solid #000;padding-top:4px">Violator Signature</div>
        ${signedLine}
      </div>
      <div style="margin-top:20px;padding:10px;border:2px solid #000;text-align:center;font-size:11px">
        Failure to appear in court or properly dispose of this case will result in a <b><u>BENCH WARRANT</u></b> being issued for <b><u>CONTEMPT OF COURT</u></b>.
      </div>
      <div style="margin-top:18px;text-align:center;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #000;padding-bottom:4px">Officer's Certification</div>
      <div style="margin-top:8px;font-size:10px">I, the undersigned officer, certify that I personally served the above-named violator with a copy of this Citation and Summons on the date and at the location specified above, and that the foregoing is true and correct to the best of my knowledge and belief.</div>
      <div style="margin-top:14px;display:flex;gap:40px;flex-wrap:wrap">
        <div style="width:220px">
          ${officerSigHtml}
          <div style="border-top:1px solid #000;padding-top:4px">Officer Signature</div>
        </div>
        <div style="min-width:160px">
          <div style="font-size:11px;margin-bottom:4px"><b>Badge #:</b> ${cit.badge_number || "___________"}</div>
          <div style="font-size:11px;margin-bottom:4px"><b>Date:</b> ${cit.date || "___________"}</div>
          <div style="font-size:11px;margin-bottom:4px"><b>Time:</b> ${cit.time || "___________"}</div>
          <div style="font-size:11px"><b>Served By:</b> ${cit.served_by || "___________"}</div>
        </div>
      </div>
    </body></html>
  `;
}
