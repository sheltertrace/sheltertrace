import type { ShelterForm } from "./types";
import { MCAS_SEAL_LOGO } from "./mcasLogo";
import { printDoorKnocker } from "@/app/forms/DoorKnockerForm";
import { printRabiesQuarantine } from "@/app/forms/RabiesQuarantineForm";
import { printRFC } from "@/app/forms/RequestForComplianceForm";
import { printAgreement } from "@/app/forms/GdaFosterAgreementForm";
import { printInspection, INSPECTION_ITEMS } from "@/app/forms/GdaFosterInspectionForm";
import { printInventory, type InventoryRow } from "@/app/forms/GdaAnimalInventoryForm";
import { printApplication } from "@/app/forms/AdoptionApplicationForm";
import { printVolunteerApplication } from "@/app/forms/VolunteerApplicationForm";
import { printVolunteerAgreement } from "@/app/forms/VolunteerAgreementForm";
import { printVolunteerConfidentiality } from "@/app/forms/VolunteerConfidentialityForm";

export function reprintShelterForm(form: ShelterForm): void {
  const d = form.form_data;
  switch (form.form_type) {
    case "door_knocker":
      printDoorKnocker(d, MCAS_SEAL_LOGO);
      break;
    case "rabies_quarantine":
      printRabiesQuarantine(d, MCAS_SEAL_LOGO);
      break;
    case "request_for_compliance":
      printRFC(d, MCAS_SEAL_LOGO);
      break;
    case "gda_foster_agreement":
      printAgreement(d);
      break;
    case "gda_foster_inspection":
      printInspection(d, INSPECTION_ITEMS);
      break;
    case "gda_animal_inventory":
      printInventory(d, (d.rows as InventoryRow[]) || []);
      break;
    case "adoption_application":
      printApplication(d);
      break;
    case "volunteer_application":
      printVolunteerApplication(d);
      break;
    case "volunteer_agreement":
      printVolunteerAgreement(d);
      break;
    case "volunteer_confidentiality":
      printVolunteerConfidentiality(d);
      break;
  }
}

const FORM_TYPE_LABELS: Record<string, string> = {
  door_knocker: "Door Knocker Notice",
  rabies_quarantine: "Home Rabies Quarantine Acknowledgement",
  request_for_compliance: "Request for Compliance",
  gda_foster_agreement: "GDA Foster Home Agreement",
  gda_foster_inspection: "GDA Foster Home Inspection Report",
  gda_animal_inventory: "GDA Foster Home Animal Inventory",
  adoption_application: "Pet Adoption Application",
  volunteer_application: "Volunteer Application",
  volunteer_agreement: "Volunteer Agreement & Release",
  volunteer_confidentiality: "Volunteer Confidentiality Agreement",
};

export function emailShelterForm(form: ShelterForm, toEmail?: string): void {
  const label = FORM_TYPE_LABELS[form.form_type] || form.form_type.replace(/_/g, " ");
  const subject = encodeURIComponent(`Morgan County Animal Services — ${label}`);
  const body = encodeURIComponent(
    `Please find the attached ${label} from Morgan County Animal Services.\n\nContact us at 706.752.1195 with any questions.\n\nThank you,\nMorgan County Animal Services`
  );
  const to = toEmail ? encodeURIComponent(toEmail) : "";
  window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
}
