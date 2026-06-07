import type { AdoptionApplication } from "./types";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE } from "./shelterInfo";

const AGENCY  = AGENCY_NAME;
const ADDRESS = AGENCY_ADDRESS;
const PHONE   = AGENCY_PHONE;
const FOOTER  = `${AGENCY} • ${ADDRESS} • Thank you for choosing to adopt!`;

type FormData = Partial<AdoptionApplication>;

/** Render a field value or a blank underline for the print form. */
function v(val: string | number | boolean | null | undefined, blank = "_______________________"): string {
  return val != null && val !== "" ? String(val) : blank;
}

/** Render a checkbox character. */
function cb(val: boolean | null | undefined): string {
  return val ? "?" : "?";
}

/** Two-column row inside a section table. */
function row2(labelA: string, valA: string, labelB: string, valB: string): string {
  return `<tr>
    <td class="lbl">${labelA}</td><td class="val">${valA}</td>
    <td class="lbl">${labelB}</td><td class="val">${valB}</td>
  </tr>`;
}

/** Full-width single row. */
function row1(label: string, val: string): string {
  return `<tr><td class="lbl" colspan="1">${label}</td><td class="val" colspan="3">${val}</td></tr>`;
}

export function buildAdoptionFormHTML(data?: FormData): string {
  const d = data || {};
  const isBlank = !data;

  const checkRow = (items: Array<[string, keyof FormData]>) =>
    items.map(([label, key]) => `${cb(d[key] as boolean)} ${label}`).join(" &nbsp;&nbsp; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pet Adoption Application — ${AGENCY}</title>
<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
  @page { size: letter; margin: 0.55in 0.5in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #111; }

  .header { background: #0f2942; color: #fff; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; border-radius: 4px; }
  .header-title { font-size: 15pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3px; }
  .header-sub { font-size: 9pt; opacity: 0.75; margin-top: 3px; }
  .header-right { text-align: right; font-size: 9pt; opacity: 0.8; line-height: 1.5; }

  .form-title { background: #1a8a8a; color: #fff; text-align: center; font-size: 12pt; font-weight: 900; padding: 5px; border-radius: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.8px; }

  .section { margin-bottom: 7px; break-inside: avoid; }
  .section-head { background: #1d3a5a; color: #fff; font-weight: 700; font-size: 9pt; padding: 3px 8px; border-radius: 3px 3px 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #bbb; border-top: none; }
  td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: top; }
  td.lbl { font-weight: 700; font-size: 8.5pt; color: #444; width: 18%; white-space: nowrap; background: #f7f7f7; }
  td.val { font-size: 9pt; min-height: 18px; }
  td.val-lg { font-size: 9pt; min-height: 40px; vertical-align: top; }

  .agree-box { border: 1px solid #bbb; border-radius: 3px; padding: 7px 10px; font-size: 8.5pt; line-height: 1.55; margin-bottom: 7px; background: #fafafa; }
  .agree-box ol { padding-left: 18px; margin: 6px 0 0; }
  .agree-box li { margin-bottom: 3px; }

  .sig-row { display: flex; gap: 16px; margin-bottom: 8px; }
  .sig-box { flex: 1; border: 1px solid #bbb; border-radius: 3px; padding: 6px 10px; }
  .sig-label { font-size: 8pt; font-weight: 700; color: #444; margin-bottom: 4px; }
  .sig-line { border-bottom: 1.5px solid #333; margin: 14px 0 4px; }
  .sig-img { max-width: 100%; max-height: 60px; display: block; }
  .sig-subline { font-size: 7.5pt; color: #666; }
  .sig-fill { font-size: 9pt; font-style: italic; }

  .office-box { border: 2px dashed #888; border-radius: 3px; padding: 7px 10px; margin-bottom: 7px; background: #f9f9f9; }
  .office-title { font-weight: 900; font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }

  .footer { text-align: center; font-size: 8pt; color: #666; margin-top: 10px; padding-top: 6px; border-top: 1px solid #ddd; }
  .check-row { font-size: 9pt; line-height: 1.9; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div>
    <div class="header-title">${AGENCY}</div>
    <div class="header-sub">${ADDRESS} &nbsp;·&nbsp; ${PHONE}</div>
  </div>
  <div class="header-right">
    Date: ${v(d.date, "_____ / _____ / _______")}<br>
    ${isBlank ? "Application #: _______________" : `Application Submitted: ${new Date(d.created_at || "").toLocaleDateString()}`}
  </div>
</div>

<div class="form-title">Pet Adoption Application</div>

<!-- Section 1: Top info -->
<div class="section">
  <div class="section-head">Event / Location Information</div>
  <table>
    ${row2("Event / Location", v(d.event_location), "Staff / Volunteer", v(d.staff_name))}
    ${row2("Staff Phone", v(d.staff_phone), "", "")}
  </table>
</div>

<!-- Section 2: Animal -->
<div class="section">
  <div class="section-head">Animal Information</div>
  <table>
    ${row2("Animal Name", v(d.animal_name), "Animal ID #", v(d.animal_id_number))}
    ${row2("Species", v(d.species), "Breed", v(d.breed))}
    ${row2("Color / Markings", v(d.color_markings), "Age", v(d.age))}
    ${row2("Sex", v(d.sex), "Weight", v(d.weight))}
    <tr>
      <td class="lbl" colspan="1">Status</td>
      <td class="val check-row" colspan="3">
        ${cb(d.spayed_neutered)} Spayed/Neutered &nbsp;&nbsp;
        ${cb(d.microchipped)} Microchipped &nbsp;&nbsp;
        ${cb(d.vaccinated)} Vaccinated &nbsp;&nbsp;
        ${cb(d.heartworm_tested)} Heartworm Tested
      </td>
    </tr>
    ${row2("Microchip #", v(d.microchip_number), "", "")}
    <tr><td class="lbl">Notes</td><td class="val-lg" colspan="3">${v(d.animal_notes, "")}</td></tr>
  </table>
</div>

<!-- Section 3: Adopter -->
<div class="section">
  <div class="section-head">Adopter Information</div>
  <table>
    ${row2("Full Name", v(d.adopter_name), "Date of Birth", v(d.adopter_dob))}
    ${row1("Street Address", v(d.adopter_address))}
    ${row2("City", v(d.adopter_city), "State / ZIP", `${v(d.adopter_state, "")} &nbsp; ${v(d.adopter_zip, "")}`)}
    ${row2("Phone", v(d.adopter_phone), "Email", v(d.adopter_email))}
    ${row2("Driver's License #", v(d.drivers_license), "DL State", v(d.dl_state))}
    <tr>
      <td class="lbl">Housing</td>
      <td class="val" colspan="3">
        ${d.housing === "Own" || isBlank ? "? Own" : "? Own"} &nbsp;&nbsp;
        ${d.housing === "Rent" || isBlank ? "? Rent" : d.housing === "Rent" ? "? Rent" : "? Rent"}
        ${d.housing === "Own" ? "" : d.housing === "Rent" ? ` &nbsp;&nbsp; Landlord Info: ${v(d.landlord_info)}` : ""}
      </td>
    </tr>
    ${d.housing === "Rent" && d.landlord_info ? "" : isBlank ? `<tr><td class="lbl">Landlord Name &amp; Phone</td><td class="val" colspan="3">&nbsp;</td></tr>` : ""}
    <tr>
      <td class="lbl">Dwelling Type</td>
      <td class="val" colspan="3">
        ${d.dwelling_type === "House" ? "?" : "?"} House &nbsp;&nbsp;
        ${d.dwelling_type === "Apartment" ? "?" : "?"} Apartment &nbsp;&nbsp;
        ${d.dwelling_type === "Mobile Home" ? "?" : "?"} Mobile Home &nbsp;&nbsp;
        ${d.dwelling_type === "Other" ? "?" : "?"} Other${d.dwelling_type === "Other" && d.landlord_info ? `: ${d.landlord_info}` : ""}
      </td>
    </tr>
  </table>
</div>

<!-- Section 4: Household -->
<div class="section">
  <div class="section-head">Household Information</div>
  <table>
    ${row2("# of Adults", v(d.num_adults), "# &amp; Ages of Children", v(d.children_ages))}
    <tr>
      <td class="lbl">Pet Allergies in Household</td>
      <td class="val" colspan="3">
        ${d.pet_allergies === true ? "? Yes &nbsp; ? No" : d.pet_allergies === false ? "? Yes &nbsp; ? No" : "? Yes &nbsp; ? No"}
      </td>
    </tr>
    <tr><td class="lbl">Current Pets (species, breed, altered, vaccinated)</td><td class="val-lg" colspan="3">${v(d.current_pets, "")}</td></tr>
    <tr>
      <td class="lbl">Ever Surrendered / Rehomed a Pet</td>
      <td class="val" colspan="3">
        ${d.surrendered_pet === true ? "? Yes &nbsp; ? No" : d.surrendered_pet === false ? "? Yes &nbsp; ? No" : "? Yes &nbsp; ? No"}
        ${d.surrendered_pet && d.surrendered_explain ? ` &nbsp; Explanation: ${d.surrendered_explain}` : ""}
      </td>
    </tr>
    ${isBlank || (d.surrendered_pet && !d.surrendered_explain) ? `<tr><td class="lbl">If yes, explain</td><td class="val-lg" colspan="3">&nbsp;</td></tr>` : ""}
  </table>
</div>

<!-- Section 5: Pet care -->
<div class="section">
  <div class="section-head">Pet Care Plan</div>
  <table>
    ${row2("Where will pet be kept during the day", v(d.pet_kept_day), "Where will pet sleep at night", v(d.pet_sleep))}
    ${row2("Avg hours per day pet will be alone", v(d.hours_alone), "Fenced yard", d.fenced_yard === true ? "Yes" : d.fenced_yard === false ? "No" : v(undefined))}
    ${row1("Veterinarian name &amp; phone", v(d.vet_info))}
  </table>
</div>

<!-- Section 6: Agreement -->
<div class="section">
  <div class="section-head">Adoption Agreement &amp; Acknowledgments</div>
  <div class="agree-box">
    <strong>By signing below, I certify that all information provided is true and accurate. I have read and agree to the terms of the Adoption Agreement above.</strong>
    <ol>
      <li>I am at least 18 years of age and legally able to enter into a binding agreement.</li>
      <li>I agree to provide proper food, clean water, shelter, and veterinary care for this animal at all times.</li>
      <li>I agree to comply with all Morgan County and State of Georgia ordinances regarding animal ownership, including licensing and leash laws.</li>
      <li>I understand that if the animal has not yet been spayed/neutered, I agree to have the procedure completed within 30 days of adoption or as directed by a veterinarian, and to provide proof to Animal Services.</li>
      <li>I agree to keep current identification (tag, microchip) on the animal at all times.</li>
      <li>I will not sell, give away, or transfer ownership of this animal without first contacting ${AGENCY}.</li>
      <li>If I can no longer care for this animal, I agree to return it to ${AGENCY}.</li>
      <li>I understand that ${AGENCY} makes no guarantees regarding the health, temperament, or breed of the animal.</li>
      <li>I understand that an adjustment period is normal and I will allow adequate time for the animal to settle into my home.</li>
      <li>I understand that providing false information on this application may result in the animal being reclaimed by ${AGENCY}.</li>
    </ol>
  </div>
</div>

<!-- Section 7: Fees -->
<div class="section">
  <div class="section-head">Adoption Fees</div>
  <table>
    ${row2("Adoption Fee $", v(d.adoption_fee != null ? `$${d.adoption_fee}` : undefined), "Deposit $", v(d.deposit != null ? `$${d.deposit}` : undefined))}
    <tr>
      <td class="lbl">Payment Method</td>
      <td class="val" colspan="3">
        ${d.payment_method === "Cash" ? "?" : "?"} Cash &nbsp;&nbsp;
        ${d.payment_method === "Check" ? "?" : "?"} Check &nbsp;&nbsp;
        ${d.payment_method === "Card" ? "?" : "?"} Card &nbsp;&nbsp;
        ${d.payment_method === "Other" ? "?" : "?"} Other
      </td>
    </tr>
    ${row1("Receipt / Transaction #", v(d.receipt_number))}
  </table>
</div>

<!-- Section 8: Office use only -->
<div class="section">
  <div class="office-box">
    <div class="office-title">For Office Use Only</div>
    <table style="border:none">
      <tr>
        <td class="lbl" style="border:none">Processed By</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.processed_by)}</td>
        <td class="lbl" style="border:none">Date Entered</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.date_entered)}</td>
      </tr>
      <tr>
        <td class="lbl" style="border:none">Rabies Tag #</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.rabies_tag)}</td>
        <td class="lbl" style="border:none">License #</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.license_number)}</td>
      </tr>
      <tr>
        <td class="lbl" style="border:none">Spay/Neuter Date</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.spay_neuter_date)}</td>
        <td class="lbl" style="border:none">Notes</td><td class="val" style="border:none;border-bottom:1px solid #999">${v(d.office_notes)}</td>
      </tr>
    </table>
  </div>
</div>

<!-- Section 9: Signatures -->
<div class="section">
  <div class="section-head">Signatures</div>
  <div style="padding:8px 10px;border:1px solid #bbb;border-top:none;font-size:8.5pt;color:#444;margin-bottom:6px">
    By signing below, I certify that all information provided is true and accurate. I have read and agree to the terms of the Adoption Agreement above.
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-label">Adopter Signature</div>
      ${d.adopter_signature
        ? `<img src="${d.adopter_signature}" class="sig-img" />`
        : '<div class="sig-line"></div>'}
      <div class="sig-subline">
        Printed Name: <span class="sig-fill">${v(d.adopter_name)}</span>
        &nbsp;&nbsp;&nbsp; Date: <span class="sig-fill">${v(d.date)}</span>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Staff / Volunteer Signature</div>
      ${d.staff_signature
        ? `<img src="${d.staff_signature}" class="sig-img" />`
        : '<div class="sig-line"></div>'}
      <div class="sig-subline">
        Printed Name: <span class="sig-fill">${v(d.staff_name)}</span>
        &nbsp;&nbsp;&nbsp; Date: _______________
      </div>
    </div>
  </div>
</div>

<div class="footer">${FOOTER}</div>

</body>
</html>`;
}

export function printBlankAdoptionForm(): void {
  const w = window.open("", "_blank", "width=850,height=1100");
  if (!w) return;
  w.document.write(buildAdoptionFormHTML());
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export function printCompletedAdoptionForm(app: FormData): void {
  const w = window.open("", "_blank", "width=850,height=1100");
  if (!w) return;
  w.document.write(buildAdoptionFormHTML(app));
  w.document.close();
  setTimeout(() => w.print(), 500);
}
