import type { Person } from "./types";

// Shared "is this person record complete enough to let an animal leave with
// them" rule — used by both the adoption flow and RTO/redemption, since MCAS
// wants the identical bar for either kind of departure.
export function validateDeparturePerson(person: Person | null | undefined): string[] {
  if (!person) return ["An adopter must be attached to complete this adoption."];
  const errors: string[] = [];
  if (!person.first_name?.trim()) errors.push("First name is required.");
  if (!person.last_name?.trim()) errors.push("Last name is required.");
  if (!person.phone?.trim()) errors.push("Phone is required.");
  if (!person.address?.trim()) errors.push("Address is required.");
  if (!person.city?.trim()) errors.push("City is required.");
  if (!person.state?.trim()) errors.push("State is required.");
  if (!person.zip?.trim()) errors.push("Zip is required.");
  if (!person.id_number?.trim() && !person.photo_id_url) {
    errors.push("Driver's license number or a photo ID upload is required.");
  }
  return errors;
}

export function departurePersonWarnings(person: Person): string[] {
  const warnings: string[] = [];
  if (!person.email?.trim()) warnings.push("No email on file.");
  if (!person.dob?.trim()) warnings.push("No date of birth on file.");
  if (!person.emergency_contact_name?.trim() && !person.emergency_contact_phone?.trim()) warnings.push("No emergency contact on file.");
  return warnings;
}

export function isDeparturePersonComplete(person: Person | null | undefined): boolean {
  return validateDeparturePerson(person).length === 0;
}
