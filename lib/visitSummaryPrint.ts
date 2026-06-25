interface MedRecord {
  id?: string;
  type?: string;
  description?: string;
  test_result?: string;
  vet?: string;
  administered_by?: string;
  lot_number?: string;
  vet_notes?: string;
}

interface ProcRecord {
  id?: string;
  procedure_type?: string;
  outcome?: string;
  notes?: string;
  performed_by?: string;
}

interface VisitPrintOptions {
  clinicName: string;
  clinicSubtitle?: string;
  logoUrl?: string;
  vetLine?: string;
  licenseNumber?: string;
  addressLine?: string;
  animalName: string;
  animalDetail?: string;
  animalId?: string;
  clientName?: string;
  visitDate: string;
  visitType?: string;
  notes?: string;
  medRecords: MedRecord[];
  procedures?: ProcRecord[];
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

function resultCell(result?: string): string {
  if (!result) return "";
  switch (result) {
    case "Negative":
      return `<span style="font-weight:800;color:#15803d;print-color-adjust:exact;-webkit-print-color-adjust:exact;">(-) NEGATIVE</span>`;
    case "Positive":
      return `<span style="font-weight:900;color:#dc2626;print-color-adjust:exact;-webkit-print-color-adjust:exact;">(+) POSITIVE !!!</span>`;
    case "Inconclusive":
      return `<span style="font-weight:800;color:#b45309;print-color-adjust:exact;-webkit-print-color-adjust:exact;">(~) INCONCLUSIVE</span>`;
    case "Pending":
      return `<span style="font-weight:600;color:#64748b;">PENDING</span>`;
    default:
      return `<span style="font-weight:600;color:#64748b;">${result}</span>`;
  }
}

export function buildVisitSummaryHTML(opts: VisitPrintOptions): string {
  const hasPositive = opts.medRecords.some((m) => m.test_result === "Positive");

  const medRows = opts.medRecords.map((m) => {
    const isTest = (m.type || "").includes("Test") || !!m.test_result;
    const resultHtml = isTest ? resultCell(m.test_result) : "";
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${m.type || "—"}</td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${m.description || "—"}</td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${resultHtml}</td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${m.vet || m.administered_by || "—"}</td>
    </tr>`;
  }).join("");

  const procRows = (opts.procedures || []).map((p) =>
    `<tr>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${p.procedure_type || "—"}</td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${p.outcome || "Completed"}</td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;"></td>
      <td style="padding:4px 8px;border:1px solid #d1d5db;font-size:11px;">${p.performed_by || "—"}</td>
    </tr>`
  ).join("");

  const allRows = medRows + procRows;
  const hasServices = opts.medRecords.length > 0 || (opts.procedures || []).length > 0;

  const positiveWarning = hasPositive
    ? `<div style="margin-top:16px;padding:10px 14px;border:3px solid #dc2626;border-radius:6px;background:#fef2f2;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
        <div style="font-size:13px;font-weight:900;color:#dc2626;text-transform:uppercase;">⚠️ IMPORTANT: ONE OR MORE POSITIVE TEST RESULTS ON THIS VISIT — SEE DETAILS ABOVE</div>
       </div>`
    : "";

  return `<!DOCTYPE html><html><head><title>Visit Summary — ${opts.animalName}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:24px;font-size:11px;color:#111;}@media print{@page{margin:0.5in;}}</style>
  </head><body>

  <!-- Header -->
  <div style="border-bottom:2px solid #1a3a6b;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;">
    <div>
      ${opts.logoUrl ? `<img src="${opts.logoUrl}" style="height:40px;margin-bottom:6px;" />` : ""}
      <div style="font-size:16px;font-weight:800;color:#1a3a6b;">${opts.clinicName}</div>
      ${opts.vetLine ? `<div style="font-size:11px;color:#475569;">${opts.vetLine}</div>` : ""}
      ${opts.licenseNumber ? `<div style="font-size:10px;color:#64748b;">License: ${opts.licenseNumber}</div>` : ""}
      ${opts.addressLine ? `<div style="font-size:10px;color:#64748b;">${opts.addressLine}</div>` : ""}
      ${opts.clinicSubtitle ? `<div style="font-size:10px;color:#64748b;">${opts.clinicSubtitle}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:14px;font-weight:800;color:#1a3a6b;">VISIT SUMMARY</div>
      <div style="font-size:11px;color:#475569;">${fmtDate(opts.visitDate)}</div>
      ${opts.visitType ? `<div style="font-size:10px;color:#64748b;">${opts.visitType}</div>` : ""}
    </div>
  </div>

  <!-- Animal + Client -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
    <div>
      <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Animal</div>
      <div style="font-size:14px;font-weight:700;">${opts.animalName}</div>
      ${opts.animalDetail ? `<div style="font-size:11px;color:#475569;">${opts.animalDetail}</div>` : ""}
      ${opts.animalId ? `<div style="font-size:10px;color:#64748b;font-family:monospace;">ID: ${opts.animalId}</div>` : ""}
    </div>
    ${opts.clientName ? `<div>
      <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Client</div>
      <div style="font-size:14px;font-weight:700;">${opts.clientName}</div>
    </div>` : ""}
  </div>

  ${opts.notes ? `<div style="margin-bottom:12px;font-size:11px;color:#374151;padding:6px 10px;background:#f8fafc;border-radius:4px;">Notes: ${opts.notes}</div>` : ""}

  <!-- Services -->
  <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;margin:12px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Services Rendered</div>
  ${hasServices
    ? `<table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f3f4f6;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
          <th style="padding:4px 8px;text-align:left;font-size:10px;border:1px solid #d1d5db;">Service</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;border:1px solid #d1d5db;">Details</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;border:1px solid #d1d5db;">Result</th>
          <th style="padding:4px 8px;text-align:left;font-size:10px;border:1px solid #d1d5db;">Staff</th>
        </tr></thead>
        <tbody>${allRows}</tbody>
       </table>`
    : `<div style="color:#94a3b8;font-style:italic;">No services recorded for this visit.</div>`}

  ${positiveWarning}

  <!-- Signature -->
  <div style="margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:30px;">
    <div><div style="border-bottom:1.5px solid #000;height:40px;"></div><div style="font-size:10px;color:#64748b;margin-top:4px;">${opts.vetLine || "Staff"} Signature</div></div>
    <div><div style="font-size:10px;color:#64748b;">Date: ${fmtDate(opts.visitDate)}</div></div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;">
    ${opts.clinicName} · ShelterTrace · Printed ${new Date().toLocaleString()}
  </div>

  </body></html>`;
}

export function printVisitSummary(opts: VisitPrintOptions): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(buildVisitSummaryHTML(opts));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
