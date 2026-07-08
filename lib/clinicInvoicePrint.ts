import type { ClinicInvoice, ClinicInvoiceLineItem, ClinicSettings, ClinicClient } from "./clinicTypes";

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

export function buildClinicInvoiceHTML(invoice: ClinicInvoice, settings: ClinicSettings, client?: ClinicClient | null): string {
  const items = (invoice.line_items || []) as ClinicInvoiceLineItem[];
  const vetLine = [settings.vet_name, settings.vet_credentials].filter(Boolean).join(", ");
  const rows = items.map((item) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;">${item.description}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;">${item.quantity}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;">$${(item.unit_price || 0).toFixed(2)}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;font-weight:700;">$${(item.total || 0).toFixed(2)}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoice_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;padding:28px;font-size:11px;color:#111;}@media print{@page{margin:0.5in;}}</style>
  </head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:3px solid #1a3a6b;margin-bottom:20px;">
    <div>
      ${settings.logo_url ? `<img src="${settings.logo_url}" style="height:44px;margin-bottom:6px;display:block;" />` : ""}
      <div style="font-size:17px;font-weight:900;color:#1a3a6b;">${settings.clinic_name || "Veterinary Clinic"}</div>
      <div style="font-size:11px;color:#475569;">${vetLine}</div>
      ${settings.license_number ? `<div style="font-size:10px;color:#64748b;">License: ${settings.license_number}</div>` : ""}
      <div style="font-size:10px;color:#64748b;">${settings.clinic_address || ""}</div>
      <div style="font-size:10px;color:#64748b;">${settings.clinic_phone || ""}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:24px;font-weight:900;color:#1a3a6b;font-family:monospace;letter-spacing:1px;">${invoice.invoice_number}</div>
      <div style="margin-top:6px;font-size:12px;font-weight:800;background:#1a3a6b;color:#fff;padding:3px 10px;border-radius:3px;display:inline-block;">INVOICE</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
    <div>
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Bill To</div>
      <div style="font-size:14px;font-weight:700;">${client?.agency_name || client?.county_name || "—"}</div>
      ${client?.contact_person ? `<div style="font-size:11px;">${client.contact_person}</div>` : ""}
      ${client?.address ? `<div style="font-size:11px;color:#475569;">${client.address}${client.city ? `, ${client.city}` : ""}${client.state ? `, ${client.state}` : ""}</div>` : ""}
      ${client?.contact_email ? `<div style="font-size:11px;color:#475569;">${client.contact_email}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Invoice Details</div>
      <div style="font-size:11px;"><strong>Invoice Date:</strong> ${fmtDate(invoice.invoice_date)}</div>
      <div style="font-size:11px;"><strong>Due Date:</strong> <span style="color:#dc2626;font-weight:700;">${fmtDate(invoice.due_date)}</span></div>
      <div style="font-size:11px;"><strong>Status:</strong> ${invoice.status}</div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr style="background:#1a3a6b;color:#fff;">
      <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;">Description</th>
      <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;">Qty</th>
      <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;">Unit Price</th>
      <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;">Total</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="padding:10px;text-align:center;color:#94a3b8;font-style:italic;">No line items</td></tr>`}</tbody>
    <tfoot>
      <tr style="background:#f8fafc;"><td colspan="3" style="padding:6px 10px;text-align:right;font-size:11px;font-weight:700;">Subtotal</td><td style="padding:6px 10px;text-align:right;font-size:11px;font-weight:700;">$${(invoice.subtotal || 0).toFixed(2)}</td></tr>
      ${(invoice.tax || 0) > 0 ? `<tr style="background:#f8fafc;"><td colspan="3" style="padding:4px 10px;text-align:right;font-size:11px;">Tax</td><td style="padding:4px 10px;text-align:right;font-size:11px;">$${(invoice.tax || 0).toFixed(2)}</td></tr>` : ""}
      <tr style="background:#1a3a6b;color:#fff;"><td colspan="3" style="padding:8px 10px;text-align:right;font-size:14px;font-weight:900;">TOTAL DUE</td><td style="padding:8px 10px;text-align:right;font-size:14px;font-weight:900;font-family:monospace;">$${(invoice.total || 0).toFixed(2)}</td></tr>
    </tfoot>
  </table>

  ${invoice.notes ? `<div style="margin-bottom:14px;font-size:10px;color:#64748b;border:1px solid #e5e7eb;border-radius:4px;padding:8px 10px;">${invoice.notes}</div>` : ""}

  <div style="text-align:center;font-size:11px;color:#64748b;margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;">
    Thank you for your business. Please remit payment by <strong>${fmtDate(invoice.due_date)}</strong>.<br>
    Questions? Contact us at ${settings.clinic_email || settings.clinic_phone || "—"}
  </div>
  </body></html>`;
}

export function printClinicInvoice(invoice: ClinicInvoice, settings: ClinicSettings, client?: ClinicClient | null): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(buildClinicInvoiceHTML(invoice, settings, client));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
