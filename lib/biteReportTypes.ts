export interface BiteAnimalData {
  linked_animal_id?: string;
  name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  age: string;
  size: string;
  microchip: string;
  rabies_status: string;
  rabies_tag: string;
  rabies_expiration: string;
  veterinarian: string;
  vet_phone: string;
  disposition_at_time: string;
  was_provoked: string;
  current_status: string;
}

export interface BiteOwnerData {
  known: string;
  linked_person_id?: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  phone2: string;
  email: string;
  dl_number: string;
  dl_state: string;
  was_cited: string;
  citation_number: string;
}

export interface BiteVictimHumanData {
  first_name: string;
  last_name: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  sex: string;
  relationship: string;
  on_owner_property: string;
}

export interface BiteVictimAnimalData {
  linked_animal_id?: string;
  name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  age: string;
  microchip: string;
  rabies_status: string;
  rabies_tag: string;
  veterinarian: string;
  vet_phone: string;
  // Legacy flat owner fields (kept for old records)
  owner_first_name: string;
  owner_last_name: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip: string;
  owner_phone: string;
  owner_email: string;
}

// Full owner section for victim animals in animal_animal reports
export interface VictimAnimalOwner {
  known: string;
  linked_person_id?: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  phone2: string;
  email: string;
  was_present: string;
  seeking_restitution: string;
  estimated_vet_costs: string;
}

// Per-animal injury for each victim in an animal_animal report
export interface VictimAnimalInjury {
  body_parts: string[];
  severity: string;
  vet_treated: string;
  vet_clinic: string;
  estimated_bill: string;
}

// One victim animal entry (animal + owner + injury) stored in victim_data array
export interface VictimAnimalEntry {
  animal: BiteVictimAnimalData;
  owner: VictimAnimalOwner;
  injury: VictimAnimalInjury;
}

// One attacking animal entry (animal + owner + was_present) stored in biting_animal_data array
export interface AttackingAnimalEntry {
  animal: BiteAnimalData;
  owner: BiteOwnerData;
  was_owner_present: string;
}

export interface BiteInjuryData {
  body_parts: string[];
  severity: string;
  sought_medical: string;
  medical_facility: string;
  pep_recommended: string;
  treating_physician: string;
  // Animal-animal legacy fields (for animal_human forms)
  vet_treated: string;
  vet_clinic: string;
  estimated_bill: string;
  seeking_restitution: string;
}

export interface BiteQuarantineData {
  ordered: boolean;
  type: string;
  start_date: string;
  end_date: string;
  location: string;
  contact_name: string;
  contact_phone: string;
  check_dates: string[];
}

export interface BiteReport {
  id?: string;
  report_number?: string;
  report_type: "animal_human" | "animal_animal";
  status: string;
  incident_date: string;
  incident_time: string;
  incident_address: string;
  incident_city: string;
  incident_location_type: string;
  incident_location_other?: string;
  law_enforcement_notified: string;
  law_enforcement_report: string;
  biting_animal_id?: string;
  // For animal_human: single BiteAnimalData. For animal_animal: AttackingAnimalEntry[] stored as JSONB.
  biting_animal_data: BiteAnimalData | AttackingAnimalEntry[];
  victim_type: string;
  // For animal_human: BiteVictimHumanData. For animal_animal: VictimAnimalEntry[] stored as JSONB.
  victim_data: BiteVictimHumanData | BiteVictimAnimalData | VictimAnimalEntry[];
  owner_data: BiteOwnerData;
  injury_data: BiteInjuryData;
  quarantine_ordered: string;
  quarantine_data: BiteQuarantineData;
  quarantine_released: string;
  quarantine_release_date: string;
  disposition: string;
  follow_up_required: string;
  follow_up_date: string;
  investigating_officer: string;
  investigating_officer_id: string;
  narrative: string;
  photos: string[];
  dispatch_call_id?: string;
  citation_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const LOCATION_TYPES = [
  "Private Residence", "Public Property", "Business", "School/Daycare",
  "Park/Recreation Area", "Road/Highway", "Other",
] as const;

export const BODY_PARTS = [
  "Head/Face", "Neck", "Shoulder", "Upper arm", "Forearm", "Hand/Fingers",
  "Chest/Torso", "Back", "Hip/Buttocks", "Upper leg/Thigh", "Lower leg", "Foot/Toes", "Other",
] as const;

export const INJURY_SEVERITIES_HUMAN = [
  "Minor (skin not broken)", "Moderate (skin broken, no sutures)", "Serious (sutures required)",
  "Severe (hospitalization required)", "Life threatening", "Fatal",
] as const;

export const INJURY_SEVERITIES_ANIMAL = [
  "Minor (superficial wounds)", "Moderate (lacerations, punctures)",
  "Serious (deep wounds, surgery needed)", "Severe (life threatening)", "Fatal",
] as const;

export const DISPOSITIONS = [
  "Open — under investigation",
  "Closed — no action taken",
  "Closed — citation issued",
  "Closed — animal euthanized",
  "Closed — animal quarantine completed",
  "Referred to law enforcement",
  "Other",
] as const;

export const RABIES_STATUSES = ["Current", "Unknown", "Overdue", "Never vaccinated"] as const;

export const VICTIM_RELATIONSHIPS = [
  "Stranger", "Neighbor", "Family member", "Friend/acquaintance",
  "Mail carrier/delivery", "Veterinary staff", "Animal control staff", "Other",
] as const;

export const ANIMAL_DISPOSITIONS_AT_TIME = [
  "Contained — owner present", "Contained — owner not present",
  "Stray/At large", "Escaped enclosure", "Other",
] as const;

export const ANIMAL_CURRENT_STATUSES = [
  "At owner's residence — quarantine ordered", "Impounded at MCAS",
  "At veterinary clinic", "Escaped/at large", "Euthanized", "Other",
] as const;

export const QUARANTINE_TYPES = [
  "Home quarantine", "MCAS impound quarantine", "Veterinary clinic quarantine",
] as const;

// ── Blank factory functions ──────────────────────────────────────────────────

export function blankAnimal(): BiteAnimalData {
  return { name: "", species: "", breed: "", color: "", sex: "", age: "", size: "", microchip: "", rabies_status: "Unknown", rabies_tag: "", rabies_expiration: "", veterinarian: "", vet_phone: "", disposition_at_time: "", was_provoked: "Unknown", current_status: "" };
}

export function blankOwner(): BiteOwnerData {
  return { known: "", first_name: "", last_name: "", address: "", city: "", state: "GA", zip: "", phone: "", phone2: "", email: "", dl_number: "", dl_state: "", was_cited: "", citation_number: "" };
}

export function blankHumanVictim(): BiteVictimHumanData {
  return { first_name: "", last_name: "", dob: "", address: "", city: "", state: "GA", zip: "", phone: "", email: "", sex: "", relationship: "", on_owner_property: "" };
}

export function blankAnimalVictim(): BiteVictimAnimalData {
  return { name: "", species: "", breed: "", color: "", sex: "", age: "", microchip: "", rabies_status: "Unknown", rabies_tag: "", veterinarian: "", vet_phone: "", owner_first_name: "", owner_last_name: "", owner_address: "", owner_city: "", owner_state: "GA", owner_zip: "", owner_phone: "", owner_email: "" };
}

export function blankVictimAnimalOwner(): VictimAnimalOwner {
  return { known: "", first_name: "", last_name: "", address: "", city: "", state: "GA", zip: "", phone: "", phone2: "", email: "", was_present: "", seeking_restitution: "", estimated_vet_costs: "" };
}

export function blankVictimAnimalInjury(): VictimAnimalInjury {
  return { body_parts: [], severity: "", vet_treated: "", vet_clinic: "", estimated_bill: "" };
}

export function blankVictimAnimalEntry(): VictimAnimalEntry {
  return { animal: blankAnimalVictim(), owner: blankVictimAnimalOwner(), injury: blankVictimAnimalInjury() };
}

export function blankAttackingAnimalEntry(): AttackingAnimalEntry {
  return { animal: blankAnimal(), owner: blankOwner(), was_owner_present: "" };
}

function blankInjury(): BiteInjuryData {
  return { body_parts: [], severity: "", sought_medical: "", medical_facility: "", pep_recommended: "Unknown", treating_physician: "", vet_treated: "", vet_clinic: "", estimated_bill: "", seeking_restitution: "" };
}

function blankQuarantine(): BiteQuarantineData {
  return { ordered: false, type: "Home quarantine", start_date: "", end_date: "", location: "", contact_name: "", contact_phone: "", check_dates: [] };
}

export function blankBiteReport(type: "animal_human" | "animal_animal"): BiteReport {
  const today = new Date().toISOString().split("T")[0];
  return {
    report_type: type, status: "Open", incident_date: today, incident_time: "", incident_address: "",
    incident_city: "Madison", incident_location_type: "", law_enforcement_notified: "", law_enforcement_report: "",
    biting_animal_data: type === "animal_animal" ? [blankAttackingAnimalEntry()] : blankAnimal(),
    victim_type: type === "animal_human" ? "human" : "animal",
    victim_data: type === "animal_human" ? blankHumanVictim() : [blankVictimAnimalEntry()],
    owner_data: blankOwner(), injury_data: blankInjury(), quarantine_ordered: "",
    quarantine_data: blankQuarantine(), quarantine_released: "", quarantine_release_date: "",
    disposition: "Open — under investigation", follow_up_required: "", follow_up_date: "",
    investigating_officer: "", investigating_officer_id: "", narrative: "", photos: [],
  };
}
