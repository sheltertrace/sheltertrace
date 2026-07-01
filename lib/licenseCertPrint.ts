import type { CityPetLicense } from "./cityLicenseTypes";

function fmtDate(d?: string): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

export function buildLicenseCertificateHTML(license: CityPetLicense): string {
  const sterilized = license.sterilized === true ? "Yes" : license.sterilized === false ? "No" : "—";
  return `<!DOCTYPE html><html><head><title>Dog License — ${license.license_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0;}body{font-family:Georgia,serif;padding:0.6in;font-size:11px;color:#111;}@media print{@page{size:letter;margin:0.5in;}}
  .border-box{border:3px solid #1a3a6b;border-radius:4px;padding:24px;}
  .section{margin-bottom:14px;border-bottom:1px solid #d1d5db;padding-bottom:10px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;}
  .fld{margin-bottom:6px;}
  .lbl{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;}
  .val{font-size:12px;font-weight:600;color:#0f172a;}
  h1{font-size:20px;font-weight:900;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;}
  h2{font-size:12px;font-weight:600;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;}
  </style></head><body>
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:14px;font-weight:800;color:#1a3a6b;letter-spacing:2px;text-transform:uppercase;">City of Madison, Georgia</div>
    <h1>Official Dog License Certificate</h1>
    <h2>Year ${license.year}</h2>
  </div>
  <div class="border-box">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1a3a6b;">
      <div>
        <div class="lbl">License Number</div>
        <div style="font-size:22px;font-weight:900;color:#1a3a6b;font-family:monospace;">${license.license_number || "—"}</div>
      </div>
      <div style="text-align:right;">
        <div class="lbl">Tag Number</div>
        <div style="font-size:22px;font-weight:900;color:#1a3a6b;">${license.tag_number || "—"}</div>
      </div>
    </div>

    <div class="section">
      <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Animal Information</div>
      <div class="grid">
        <div class="fld"><div class="lbl">Animal Name</div><div class="val">${license.animal_name || "—"}</div></div>
        <div class="fld"><div class="lbl">Species</div><div class="val">${license.species || "Dog"}</div></div>
        <div class="fld"><div class="lbl">Breed</div><div class="val">${license.breed || "—"}</div></div>
        <div class="fld"><div class="lbl">Color</div><div class="val">${license.color || "—"}</div></div>
        <div class="fld"><div class="lbl">Markings</div><div class="val">${license.markings || "—"}</div></div>
        <div class="fld"><div class="lbl">Sex</div><div class="val">${license.sex === "M" ? "Male" : license.sex === "F" ? "Female" : "—"}</div></div>
        <div class="fld"><div class="lbl">Sterilized</div><div class="val">${sterilized}</div></div>
      </div>
    </div>

    <div class="section">
      <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Owner Information</div>
      <div class="grid">
        <div class="fld"><div class="lbl">Owner Name</div><div class="val">${license.owner_name || "—"}</div></div>
        <div class="fld"><div class="lbl">Phone</div><div class="val">${license.owner_phone || "—"}</div></div>
        <div class="fld" style="grid-column:1/-1;"><div class="lbl">Address</div><div class="val">${license.owner_address || "—"}</div></div>
      </div>
    </div>

    <div class="section">
      <div style="font-size:10px;font-weight:700;color:#1a3a6b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Rabies Vaccination</div>
      <div class="grid">
        <div class="fld"><div class="lbl">Rabies Tag #</div><div class="val">${license.rabies_tag_number || "—"}</div></div>
        <div class="fld"><div class="lbl">Expiration Date</div><div class="val">${fmtDate(license.rabies_expiration)}</div></div>
        <div class="fld"><div class="lbl">Veterinarian</div><div class="val">${license.veterinarian || "—"}</div></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;padding:12px 0;border-top:1px solid #d1d5db;">
      <div class="fld"><div class="lbl">Issue Date</div><div class="val">${fmtDate(license.issue_date)}</div></div>
      <div class="fld"><div class="lbl">Expiration Date</div><div style="font-size:14px;font-weight:800;color:#1a3a6b;">July 1, ${license.year ? license.year + 1 : "—"}</div></div>
    </div>

    <!-- Signature -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:20px;padding-top:16px;border-top:2px solid #1a3a6b;">
      <div>
        <div style="border-bottom:1.5px solid #000;height:40px;"></div>
        <div style="font-size:9px;color:#64748b;margin-top:4px;">City of Madison Official Signature</div>
        <div style="font-size:10px;color:#475569;margin-top:2px;">Issued by: ${license.issued_by || "—"}</div>
      </div>
      <div>
        <div style="font-size:9px;color:#64748b;">Date Issued: ${fmtDate(license.issue_date)}</div>
      </div>
    </div>
  </div>

  <div style="margin-top:16px;text-align:center;font-size:9px;color:#94a3b8;line-height:1.6;">
    This certificate must be kept as proof of licensure. The license tag must be worn by your dog at all times.<br>
    Questions? Contact City Hall: (706) 342-1251 · <strong>Powered by ShelterTrace</strong>
  </div>
  </body></html>`;
}

export function printLicenseCertificate(license: CityPetLicense): void {
  const w = window.open("", "_blank", "width=820,height=1060");
  if (!w) return;
  w.document.write(buildLicenseCertificateHTML(license));
  w.document.close();
  setTimeout(() => w.print(), 400);
}
