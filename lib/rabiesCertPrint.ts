import type { ClinicRabiesCertificate, ClinicSettings } from "./clinicTypes";

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

export function buildRabiesCertificateHTML(
  cert: ClinicRabiesCertificate,
  settings: ClinicSettings,
  halfPage = false,
): string {
  const vetLine = [settings.vet_name, settings.vet_credentials].filter(Boolean).join(", ");
  const voidWatermark = cert.voided
    ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;font-weight:900;color:rgba(220,38,38,0.15);pointer-events:none;white-space:nowrap;z-index:1;">VOID</div>`
    : "";

  const sigHtml = cert.vet_signature_data
    ? `<img src="${cert.vet_signature_data}" alt="Signature" style="max-height:60px;display:block;" />`
    : `<div style="border-bottom:1.5px solid #000;width:250px;height:40px;"></div>`;

  return `
  <div style="position:relative;width:7.5in;${halfPage ? "min-height:4.8in;max-height:5in;" : "min-height:9.5in;"}padding:0.4in;box-sizing:border-box;font-family:Georgia,'Times New Roman',serif;border:3px solid #1a3a6b;border-radius:4px;page-break-after:always;page-break-inside:avoid;">
    ${voidWatermark}

    <!-- Header -->
    <div style="text-align:center;border-bottom:2px solid #1a3a6b;padding-bottom:14px;margin-bottom:16px;">
      ${settings.logo_url ? `<img src="${settings.logo_url}" style="height:50px;margin-bottom:8px;" />` : ""}
      <div style="font-size:${halfPage ? "13px" : "16px"};font-weight:700;color:#1a3a6b;">${settings.clinic_name || "Veterinary Clinic"}</div>
      <div style="font-size:${halfPage ? "10px" : "12px"};color:#475569;">${vetLine}</div>
      ${settings.license_number ? `<div style="font-size:${halfPage ? "9px" : "11px"};color:#64748b;">License: ${settings.license_number}</div>` : ""}
      <div style="font-size:${halfPage ? "9px" : "10px"};color:#64748b;">${[settings.clinic_address, settings.clinic_phone].filter(Boolean).join(" · ")}</div>
      <div style="margin-top:${halfPage ? "8px" : "14px"};font-size:${halfPage ? "16px" : "20px"};font-weight:900;color:#1a3a6b;letter-spacing:2px;text-transform:uppercase;">Certificate of Rabies Vaccination</div>
    </div>

    <!-- Two-column layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${halfPage ? "10px" : "20px"};margin-bottom:${halfPage ? "12px" : "18px"};">
      <!-- Animal Info -->
      <div>
        <div style="font-size:${halfPage ? "9px" : "10px"};font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Animal Information</div>
        ${field("Name", cert.animal_name, halfPage)}
        ${field("Species", cert.species, halfPage)}
        ${field("Breed", cert.breed, halfPage)}
        ${field("Color/Markings", cert.color, halfPage)}
        ${field("Sex", cert.sex, halfPage)}
        ${field("Age / DOB", cert.age, halfPage)}
        ${field("Weight", cert.weight, halfPage)}
        ${field("Microchip", cert.microchip, halfPage)}
      </div>

      <!-- Owner/Agency Info -->
      <div>
        <div style="font-size:${halfPage ? "9px" : "10px"};font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Owner / Agency</div>
        ${field("Name", cert.owner_name, halfPage)}
      </div>
    </div>

    <!-- Vaccination Info -->
    <div style="margin-bottom:${halfPage ? "12px" : "18px"};">
      <div style="font-size:${halfPage ? "9px" : "10px"};font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;">Vaccination Information</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 16px;">
        ${field("Vaccine / Manufacturer", cert.vaccine_brand, halfPage)}
        ${field("Lot Number", cert.lot_number, halfPage)}
        ${field("Route", cert.route, halfPage)}
        ${field("Date Administered", fmtDate(cert.date_administered), halfPage)}
        ${field("Duration of Immunity", cert.duration, halfPage)}
        ${field("Next Due Date", fmtDate(cert.next_due), halfPage)}
        ${field("Rabies Tag #", cert.rabies_tag, halfPage)}
      </div>
    </div>

    <!-- Signatures -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:${halfPage ? "10px" : "16px"};padding-top:${halfPage ? "8px" : "14px"};border-top:2px solid #1a3a6b;">
      <div>
        <div style="margin-bottom:4px;">${sigHtml}</div>
        <div style="font-size:${halfPage ? "10px" : "11px"};font-weight:600;">${vetLine}</div>
        ${settings.license_number ? `<div style="font-size:${halfPage ? "9px" : "10px"};color:#64748b;">License: ${settings.license_number}</div>` : ""}
        <div style="font-size:${halfPage ? "9px" : "10px"};color:#64748b;">Date: ${fmtDate(cert.date_administered) || new Date().toLocaleDateString()}</div>
      </div>
      <div>
        <div style="border-bottom:1.5px solid #000;width:250px;height:40px;"></div>
        <div style="font-size:${halfPage ? "9px" : "10px"};color:#64748b;margin-top:4px;">Owner / Agency Representative Signature &amp; Date</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:${halfPage ? "6px" : "10px"};border-top:1px solid #e2e8f0;">
      <div style="font-size:${halfPage ? "10px" : "12px"};font-weight:700;color:#1a3a6b;font-family:monospace;letter-spacing:1px;margin-bottom:3px;">${cert.certificate_number || "—"}</div>
      <div style="font-size:${halfPage ? "8px" : "9px"};color:#94a3b8;line-height:1.4;">
        This certificate is issued in accordance with applicable state and local regulations.<br>
        ${settings.clinic_name || "Veterinary Clinic"} · ShelterTrace Clinic Portal
      </div>
    </div>
  </div>`;
}

function field(label: string, value: string | undefined | null, halfPage: boolean): string {
  const fs = halfPage ? "9px" : "11px";
  return `<div style="margin-bottom:${halfPage ? "3px" : "5px"};"><span style="font-size:${halfPage ? "8px" : "9px"};color:#64748b;">${label}:</span> <span style="font-size:${fs};font-weight:600;color:#0f172a;">${value || "—"}</span></div>`;
}

export function printRabiesCertificate(cert: ClinicRabiesCertificate, settings: ClinicSettings, halfPage = false): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  const html = halfPage
    ? buildRabiesCertificateHTML(cert, settings, true) + buildRabiesCertificateHTML(cert, settings, true)
    : buildRabiesCertificateHTML(cert, settings, false);
  w.document.write(`<!DOCTYPE html><html><head><title>Rabies Certificate ${cert.certificate_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{background:#fff;font-family:Georgia,serif;}@media print{@page{size:letter;margin:0.3in;}}</style>
  </head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
