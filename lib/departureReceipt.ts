import type { Animal, DepartureReceipt, Person } from "./types";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "./shelterInfo";

const MCAS_NAME    = AGENCY_NAME;
const MCAS_ADDR    = AGENCY_ADDRESS;
const MCAS_PHONE   = AGENCY_PHONE;
const MCAS_BLUE    = "#0f2942";

export const DEPARTURE_STATUSES = new Set([
  "Adopted", "Foster", "Euthanized", "Transferred", "Redeemed",
  "Released", "Return to Owner", "Escaped",
]);

export function isDepartureStatus(status: string): boolean {
  return DEPARTURE_STATUSES.has(status);
}

export function departureTypeLabel(status: string): string {
  const map: Record<string, string> = {
    Adopted: "Adoption",
    Foster: "Foster Placement",
    Euthanized: "Euthanasia",
    Transferred: "Transfer Out",
    Redeemed: "Owner Redemption",
    Released: "Field Release",
    "Return to Owner": "Return to Owner",
    Escaped: "Escaped / Lost",
  };
  return map[status] || status;
}

export function departureFooter(type: string): string {
  if (type === "Adoption") return "Congratulations on your new family member! Thank you for adopting from Morgan County Animal Services.";
  if (type === "Owner Redemption" || type === "Return to Owner") return "Please ensure your pet has current tags and registration. Contact us at " + MCAS_PHONE + " with any questions.";
  return "Thank you for supporting Morgan County Animal Services.";
}

export function buildDepartureReceiptPayload(
  animal: Animal,
  opts: {
    departureType: string;
    person?: Person | null;
    personName?: string;
    fees?: Array<{ item: string; amount: number }>;
    totalFees?: number;
    paymentMethod?: string;
    conditions?: string;
    notes?: string;
    officerName?: string;
    officerId?: string;
  }
): Omit<DepartureReceipt, "id" | "created_at" | "receipt_number"> {
  return {
    animal_id: animal.id,
    animal_name: animal.name,
    animal_info_snapshot: animal as unknown as Record<string, unknown>,
    departure_type: opts.departureType,
    departure_date: new Date().toISOString(),
    person_id: opts.person?.id,
    person_name: opts.personName || (opts.person ? `${opts.person.first_name} ${opts.person.last_name}`.trim() : undefined),
    person_info_snapshot: opts.person ? (opts.person as unknown as Record<string, unknown>) : undefined,
    fees: opts.fees || [],
    total_fees: opts.totalFees ?? 0,
    payment_method: opts.paymentMethod,
    conditions: opts.conditions,
    notes: opts.notes,
    officer_name: opts.officerName,
    officer_id: opts.officerId,
  };
}

export function buildAdoptionReceiptHTML(receipt: DepartureReceipt): string {
  const a  = (receipt.animal_info_snapshot || {}) as Record<string, unknown>;
  const p  = (receipt.person_info_snapshot || {}) as Record<string, unknown>;

  const animalName = receipt.animal_name || (a.name as string) || "Unknown";
  const animalId   = receipt.animal_id   || (a.id   as string) || "";
  const species    = (a.species   as string) || "";
  const breed      = (a.breed     as string) || "";
  const color      = (a.color     as string) || "";
  const sex        = (a.sex       as string) || "";
  const age        = (a.age       as string) || "";
  const microchip  = (a.microchip as string) || "";
  const fixed      = a.fixed ? "Yes — Already Spayed/Neutered" : "No — Spay/Neuter Agreement Required";
  const rabiesTag  = (a.rabies_tag as string) || "";

  const adopterName    = receipt.person_name || "";
  const adopterPhone   = (p.phone   as string) || "";
  const adopterEmail   = (p.email   as string) || "";
  const adopterAddr    = [p.address, p.city, p.state, p.zip].filter(Boolean).join(", ");

  const depDate = new Date(receipt.departure_date);
  const depStr  = depDate.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const fees    = (receipt.fees || []) as Array<{ item: string; amount: number }>;
  const feeRows = fees.length > 0
    ? fees.map((f) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${f.item}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace">$${f.amount.toFixed(2)}</td>
        </tr>`
      ).join("")
    : `<tr><td colspan="2" style="padding:10px;text-align:center;color:#6b7280;font-style:italic">No fees assessed</td></tr>`;

  const sh = (title: string) =>
    `<div style="background:${MCAS_BLUE};color:#fff;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">${title}</div>`;

  return `<!DOCTYPE html><html>
  <head><title>Adoption Receipt ${receipt.receipt_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
    body{font-family:Arial,sans-serif;font-size:10.5px;padding:24px;margin:0;line-height:1.55;color:#111}
    h1{font-size:16px;font-weight:900;color:${MCAS_BLUE};margin:0 0 1px;text-transform:uppercase;letter-spacing:.5px}
    h2{font-size:11.5px;color:${MCAS_BLUE};margin:0 0 10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .sub{font-size:9.5px;color:#444;margin-bottom:2px}
    table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden}
    .sigline{border-bottom:1.5px solid #000;height:40px;display:block;margin-bottom:4px}
    .field{display:grid;grid-template-columns:120px 1fr;gap:2px;margin-bottom:4px;font-size:10.5px}
    .field .lbl{color:#555}
    .field .val{font-weight:600}
    @media print{body{padding:16px}}
  </style></head>
  <body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${MCAS_BLUE};margin-bottom:14px">
    <div>
      <h1>${MCAS_NAME}</h1>
      <h2>🏡 ADOPTION RECEIPT</h2>
      <div class="sub">${MCAS_ADDR}</div>
      <div class="sub">${MCAS_PHONE}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:900;color:${MCAS_BLUE};font-family:monospace;letter-spacing:1px">${receipt.receipt_number}</div>
      <div style="font-size:10px;color:#374151;margin-top:4px">${depStr}</div>
      ${receipt.officer_name ? `<div style="font-size:10px;color:#555;margin-top:2px">Processed by: ${receipt.officer_name}</div>` : ""}
    </div>
  </div>

  <!-- Animal + Adopter side-by-side -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:2px">
    <div>
      ${sh("Animal Information")}
      <div class="field"><span class="lbl">Name</span><span class="val">${animalName}</span></div>
      <div class="field"><span class="lbl">Animal ID</span><span class="val" style="font-family:monospace">${animalId}</span></div>
      <div class="field"><span class="lbl">Species</span><span class="val">${species}</span></div>
      <div class="field"><span class="lbl">Breed</span><span class="val">${breed}</span></div>
      <div class="field"><span class="lbl">Color</span><span class="val">${color}</span></div>
      <div class="field"><span class="lbl">Sex</span><span class="val">${sex}</span></div>
      <div class="field"><span class="lbl">Age</span><span class="val">${age || "—"}</span></div>
      <div class="field"><span class="lbl">Microchip</span><span class="val" style="font-family:monospace">${microchip || "None"}</span></div>
      <div class="field"><span class="lbl">Rabies Tag</span><span class="val" style="font-family:monospace">${rabiesTag || "—"}</span></div>
      <div class="field"><span class="lbl">Spay/Neuter</span><span class="val">${fixed}</span></div>
    </div>
    <div>
      ${sh("Adopter Information")}
      <div class="field"><span class="lbl">Name</span><span class="val">${adopterName}</span></div>
      ${adopterPhone ? `<div class="field"><span class="lbl">Phone</span><span class="val">${adopterPhone}</span></div>` : ""}
      ${adopterEmail ? `<div class="field"><span class="lbl">Email</span><span class="val">${adopterEmail}</span></div>` : ""}
      ${adopterAddr  ? `<div class="field"><span class="lbl">Address</span><span class="val">${adopterAddr}</span></div>` : ""}
    </div>
  </div>

  <!-- Fees -->
  ${sh("Fees")}
  <table style="margin-bottom:6px">
    <thead><tr style="background:#f3f4f6">
      <th style="padding:7px 12px;text-align:left;font-size:10px;color:#374151">Item</th>
      <th style="padding:7px 12px;text-align:right;font-size:10px;color:#374151">Amount</th>
    </tr></thead>
    <tbody>${feeRows}</tbody>
    <tfoot><tr style="background:${MCAS_BLUE}20">
      <td style="padding:7px 12px;font-weight:700;font-size:11px">TOTAL</td>
      <td style="padding:7px 12px;font-weight:900;text-align:right;font-family:monospace;font-size:12px">$${(receipt.total_fees || 0).toFixed(2)}</td>
    </tr></tfoot>
  </table>
  ${receipt.payment_method ? `<div style="font-size:10px;color:#374151;margin-bottom:8px">Payment Method: <strong>${receipt.payment_method}</strong></div>` : ""}

  ${receipt.conditions ? `${sh("Conditions")}
    <div style="font-size:10px;line-height:1.6;padding:6px 0;color:#111">${receipt.conditions}</div>` : ""}

  <!-- Signatures -->
  ${sh("Signatures")}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:10px">
    <div>
      <div class="sigline"></div>
      <div style="font-size:9px;color:#555">Adopter Signature</div>
      <div style="font-size:9px;color:#555;margin-top:6px">Printed Name: ____________________________</div>
      <div style="font-size:9px;color:#555;margin-top:6px">Date: ____________________________</div>
    </div>
    <div>
      <div class="sigline"></div>
      <div style="font-size:9px;color:#555">MCAS Representative Signature</div>
      <div style="font-size:9px;color:#555;margin-top:6px">Printed Name: ${receipt.officer_name || "____________________________"}</div>
      <div style="font-size:9px;color:#555;margin-top:6px">Date: ____________________________</div>
    </div>
  </div>

  <!-- Proof of Ownership -->
  <div style="margin-top:18px;padding:12px 16px;background:#eff6ff;border:2.5px solid #2563eb;border-radius:6px;text-align:center">
    <div style="font-size:12px;font-weight:900;color:#1e40af;line-height:1.5">
      THIS RECEIPT SERVES AS PROOF OF OWNERSHIP AND ADOPTION FROM MORGAN COUNTY ANIMAL SERVICES
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:14px;padding:12px 16px;background:${MCAS_BLUE}08;border:1px solid ${MCAS_BLUE}20;border-radius:6px;text-align:center">
    <div style="font-size:13px;font-weight:700;color:${MCAS_BLUE};margin-bottom:4px">🎉 Congratulations on your new family member!</div>
    <div style="font-size:9.5px;color:#555;line-height:1.6">
      Thank you for adopting from ${MCAS_NAME}.<br>
      For questions about your new pet, call ${MCAS_PHONE} or visit ${MCAS_ADDR}.
    </div>
  </div>

  </body></html>`;
}

export function printAdoptionReceipt(receipt: DepartureReceipt): void {
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;
  w.document.write(buildAdoptionReceiptHTML(receipt));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function writeReceiptToWindow(w: Window, receipt: DepartureReceipt): void {
  w.document.write(buildAdoptionReceiptHTML(receipt));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

export function printDepartureReceipt(receipt: DepartureReceipt): void {
  if (receipt.departure_type === "Adoption") {
    printAdoptionReceipt(receipt);
    return;
  }
  const w = window.open("", "_blank", "width=760,height=1060");
  if (!w) return;

  const a = (receipt.animal_info_snapshot || {}) as Record<string, unknown>;
  const animalName = receipt.animal_name || (a.name as string) || "Unknown";
  const animalId   = receipt.animal_id || (a.id as string) || "";
  const species    = (a.species as string) || "";
  const breed      = (a.breed as string) || "";
  const color      = (a.color as string) || "";
  const sex        = (a.sex as string) || "";
  const age        = (a.age as string) || "";
  const weight     = (a.weight as string) || "";
  const microchip  = (a.microchip as string) || "";
  const intakeDate = (a.intake_date as string) || "";
  const intakeType = (a.intake_type as string) || "";
  const fixed      = a.fixed ? "Yes" : "No";
  const kennel     = (a.kennel as string) || "";
  const rabiesTag  = (a.rabies_tag as string) || "";

  const depDate  = new Date(receipt.departure_date);
  const depStr   = depDate.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const depType  = receipt.departure_type;
  const footer   = departureFooter(depType);

  const fees = (receipt.fees || []) as Array<{ item: string; amount: number }>;
  const feeRows = fees.length > 0
    ? fees.map((f) =>
        `<tr><td style="padding:5px 10px;border-bottom:1px solid #e5e7eb">${f.item}</td>
         <td style="padding:5px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace">$${f.amount.toFixed(2)}</td></tr>`
      ).join("")
    : `<tr><td colspan="2" style="padding:10px;text-align:center;color:#6b7280;font-style:italic">No fees assessed</td></tr>`;

  const sh = (title: string) =>
    `<div style="background:${MCAS_BLUE};color:#fff;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px">${title}</div>`;

  const fl = (label: string, val: unknown) =>
    `<div style="display:inline-flex;flex-direction:column;gap:1px;margin-right:16px;margin-bottom:8px">
      <div style="border-bottom:1px solid #000;min-width:130px;padding-bottom:2px;font-size:10px">${val || "&nbsp;"}</div>
      <div style="font-size:8.5px;color:#555">${label}</div>
    </div>`;

  w.document.write(`<!DOCTYPE html><html><head><title>Departure Receipt ${receipt.receipt_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
    body{font-family:Arial,sans-serif;font-size:10px;padding:22px;margin:0;line-height:1.5;color:#111}
    h1{font-size:15px;font-weight:900;color:${MCAS_BLUE};margin:0 0 1px;text-transform:uppercase}
    h2{font-size:11px;color:${MCAS_BLUE};margin:0 0 10px;font-weight:600;letter-spacing:.3px}
    .sub{font-size:9px;color:#444;margin-bottom:3px}
    .meta{font-size:9px;color:#444}
    table{width:100%;border-collapse:collapse}
    .sigline{border-bottom:1.5px solid #000;min-width:200px;height:36px;display:inline-block;vertical-align:bottom;margin-right:20px}
    @media print{body{padding:14px}}
  </style></head><body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid ${MCAS_BLUE};padding-bottom:10px">
    <div>
      <h1>${MCAS_NAME}</h1>
      <h2>ANIMAL DEPARTURE RECEIPT</h2>
      <div class="sub">${MCAS_ADDR} · ${MCAS_PHONE}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:900;color:${MCAS_BLUE};font-family:monospace">${receipt.receipt_number}</div>
      <div class="meta">${depStr}</div>
      <div style="margin-top:6px;font-size:11px;font-weight:700;background:${MCAS_BLUE};color:#fff;padding:3px 10px;border-radius:3px">${depType}</div>
    </div>
  </div>

  <!-- Animal Info -->
  ${sh("Animal Information")}
  <div>
    ${fl("Animal ID", animalId)}
    ${fl("Name", animalName)}
    ${fl("Species", species)}
    ${fl("Breed", breed)}
  </div>
  <div>
    ${fl("Color", color)}
    ${fl("Sex", sex)}
    ${fl("Age", age)}
    ${fl("Weight", weight ? weight + " lbs" : "")}
  </div>
  <div>
    ${fl("Intake Date", intakeDate)}
    ${fl("Intake Type", intakeType)}
    ${fl("Spay/Neuter", fixed)}
    ${fl("Kennel", kennel)}
  </div>
  <div>
    ${fl("Microchip #", microchip)}
    ${fl("Rabies Tag #", rabiesTag)}
  </div>

  <!-- Departure Info -->
  ${sh("Departure Information")}
  <div>
    ${fl("Departure Type", depType)}
    ${fl("Departure Date/Time", depStr)}
  </div>
  <div>
    ${fl("Departing To", receipt.person_name || "")}
    ${fl("Processed By", receipt.officer_name || "")}
  </div>

  <!-- Fees -->
  ${sh("Fees")}
  <table style="border:1px solid #e5e7eb;margin-bottom:4px">
    <tbody>${feeRows}</tbody>
    ${fees.length > 0 ? `<tfoot><tr style="background:#f3f4f6">
      <td style="padding:6px 10px;font-weight:700">Total</td>
      <td style="padding:6px 10px;font-weight:700;text-align:right;font-family:monospace">$${(receipt.total_fees || 0).toFixed(2)}</td>
    </tr></tfoot>` : ""}
  </table>
  ${receipt.payment_method ? `<div style="font-size:9px;color:#374151;margin-bottom:4px">Payment Method: <strong>${receipt.payment_method}</strong></div>` : ""}

  ${receipt.conditions ? `${sh("Conditions / Notes")}<div style="font-size:10px;line-height:1.6;padding:4px 0">${receipt.conditions}</div>` : ""}
  ${receipt.notes && receipt.notes !== receipt.conditions ? `<div style="font-size:10px;color:#374151;margin-top:4px">${receipt.notes}</div>` : ""}

  <!-- Signatures -->
  ${sh("Signatures")}
  <div style="margin-top:16px;display:flex;gap:40px;flex-wrap:wrap">
    <div>
      <div class="sigline"></div>
      <div style="font-size:8.5px;color:#555;margin-top:3px">Receiving Party Signature &amp; Date</div>
      <div style="margin-top:8px">${fl("Printed Name", "")}</div>
    </div>
    <div>
      <div class="sigline"></div>
      <div style="font-size:8.5px;color:#555;margin-top:3px">MCAS Representative Signature &amp; Date</div>
      <div style="margin-top:8px">${fl("Printed Name", receipt.officer_name || "")}</div>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:28px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:9px;color:#6b7280;text-align:center;line-height:1.7">
    ${footer}<br>
    ${MCAS_NAME} · ${MCAS_ADDR} · ${MCAS_PHONE}
  </div>

  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
