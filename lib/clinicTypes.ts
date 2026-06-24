export interface ClinicClient {
  id: string;
  clinic_account_id: string;
  county_name: string;
  agency_name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  contract_start?: string;
  contract_end?: string;
  contract_value?: number;
  billing_rate?: number;
  billing_type?: string;
  notes?: string;
  active: boolean;
  created_at?: string;
}

export interface ClinicAnimal {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  name?: string;
  species?: string;
  breed?: string;
  color?: string;
  sex?: string;
  age?: string;
  dob?: string;
  weight?: string;
  microchip?: string;
  shelter_id?: string;
  intake_date?: string;
  status: string;
  notes?: string;
  photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClinicAppointment {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  animal_id?: string;
  animal_name?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_type?: string;
  status: string;
  notes?: string;
  created_at?: string;
}

export interface ClinicInvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ClinicInvoice {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  line_items?: ClinicInvoiceLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  status: string;
  paid_date?: string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
}

export interface ClinicMedicalRecord {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  animal_id?: string;
  animal_name?: string;
  type?: string;
  description?: string;
  medication_name?: string;
  dosage?: string;
  route?: string;
  lot_number?: string;
  manufacturer?: string;
  date?: string;
  next_due?: string;
  result?: string;
  test_result?: string;
  administered_by?: string;
  vet_notes?: string;
  cost?: number;
  status?: string;
  created_at?: string;
}

export interface ClinicProcedure {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  animal_id?: string;
  animal_name?: string;
  procedure_type?: string;
  procedure_date?: string;
  pre_op_weight?: string;
  anesthesia_used?: string;
  anesthesia_dose?: string;
  complications?: string;
  outcome?: string;
  recovery_notes?: string;
  follow_up_date?: string;
  cost?: number;
  performed_by?: string;
  notes?: string;
  created_at?: string;
}

export interface ClinicEmail {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  to_email?: string;
  subject?: string;
  body?: string;
  attachments?: unknown[];
  sent_at?: string;
  status: string;
  created_at?: string;
}

export interface ClinicRabiesCertificate {
  id: string;
  clinic_account_id: string;
  client_id?: string;
  animal_id?: string;
  certificate_number?: string;
  medical_record_id?: string;
  animal_name?: string;
  species?: string;
  breed?: string;
  color?: string;
  sex?: string;
  age?: string;
  weight?: string;
  microchip?: string;
  owner_name?: string;
  vaccine_brand?: string;
  lot_number?: string;
  vaccine_expiration?: string;
  date_administered?: string;
  route?: string;
  duration?: string;
  next_due?: string;
  rabies_tag?: string;
  vet_name?: string;
  vet_license?: string;
  vet_signature_data?: string;
  issued_at?: string;
  voided: boolean;
  void_reason?: string;
}

export interface ClinicSettings {
  clinic_name: string;
  vet_name: string;
  vet_credentials: string;
  license_number: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  logo_url: string;
  tax_rate: number;
  invoice_prefix: string;
  email_signature: string;
}

export const APPOINTMENT_TYPES = [
  "Wellness Exam", "Spay/Neuter", "Vaccination", "Surgery",
  "Dental", "Follow-up", "Emergency", "Other",
] as const;

export const APPOINTMENT_STATUSES = [
  "Scheduled", "Confirmed", "Completed", "No-Show", "Cancelled",
] as const;

export const PROCEDURE_TYPES = [
  "Spay", "Neuter", "Dental Cleaning", "Dental Extraction",
  "Mass Removal", "Laceration Repair", "Wellness Exam",
  "Orthopedic", "Enucleation", "Amputation", "Exploratory", "Other",
] as const;

export const INVOICE_STATUSES = [
  "Draft", "Sent", "Paid", "Overdue",
] as const;

export const BILLING_TYPES = [
  "per_visit", "monthly", "annual",
] as const;
