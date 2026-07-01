export interface LicenseAnimal {
  name: string;
  breed: string;
  color: string;
  markings: string;
  sex: "M" | "F" | "";
  sterilized: boolean | null;
  veterinarian: string;
  rabies_tag: string;
  rabies_expiration: string;
}

export interface PetLicenseApplication {
  id: string;
  application_number?: string;
  year: number;
  status: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_address: string;
  owner_city: string;
  owner_state: string;
  owner_zip?: string;
  owner_phone: string;
  owner_email?: string;
  animals: LicenseAnimal[];
  submission_type: string;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  denial_reason?: string;
  payment_status: string;
  payment_amount?: number;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  late_fee: boolean;
  documents: Array<{ name: string; url: string; type: string; uploaded_at: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface CityPetLicense {
  id: string;
  application_id?: string;
  license_number?: string;
  tag_number?: string;
  year: number;
  status: string;
  animal_name: string;
  species: string;
  breed?: string;
  color?: string;
  markings?: string;
  sex?: string;
  sterilized?: boolean;
  veterinarian?: string;
  rabies_tag_number?: string;
  rabies_expiration?: string;
  mcas_animal_id?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_address?: string;
  issue_date?: string;
  expiration_date?: string;
  issued_by?: string;
  issued_at?: string;
  renewal_notice_sent?: boolean;
  created_at?: string;
}

export const APP_STATUSES = ["Pending", "Under Review", "Approved", "Denied", "Cancelled"] as const;
export const LICENSE_STATUSES = ["Active", "Expired", "Revoked", "Deceased"] as const;
export const PAYMENT_STATUSES = ["Unpaid", "Paid", "Waived"] as const;

export const LICENSE_FEE_STERILIZED = 5;
export const LICENSE_FEE_UNSTERILIZED = 15;
export const LATE_FEE = 5;

export function calcApplicationFee(animals: LicenseAnimal[], late = false): number {
  const base = animals.reduce((sum, a) => sum + (a.sterilized ? LICENSE_FEE_STERILIZED : LICENSE_FEE_UNSTERILIZED), 0);
  return base + (late ? animals.length * LATE_FEE : 0);
}

export function isLate(): boolean {
  const now = new Date();
  const deadline = new Date(now.getFullYear(), 6, 1); // July 1
  return now > deadline;
}
