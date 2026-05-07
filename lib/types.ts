export interface Animal {
  id: string;
  name: string;
  species: string;
  breed: string;
  color: string;
  secondary_color?: string;
  sex: string;
  age?: string;
  dob?: string;
  weight?: string;
  size?: string;
  coat_type?: string;
  ear_type?: string;
  eye_color?: string;
  fixed: boolean;
  status: string;
  intake_type: string;
  intake_date: string;
  circumstance?: string;
  kennel?: string;
  microchip?: string;
  microchip_brand?: string;
  microchip_date?: string;
  rabies_tag?: string;
  rabies_expiry?: string;
  shelter_tag?: string;
  bar_code?: string;
  aco_record?: string;
  case_number?: string;
  photo_url?: string;
  markings?: string;
  behavior_flags?: Record<string, boolean>;
  intake_condition?: string;
  intake_behavior?: string;
  injuries?: string;
  is_cruelty_case?: boolean;
  is_dangerous?: boolean;
  available_date?: string;
  due_out_days?: number;
  transfer_due?: string;
  spay_neuter_due?: string;
  found_address?: string;
  found_city?: string;
  sub_status?: string;
  transferred_to?: string;
  transfer_date?: string;
  euthanasia?: EuthanasiaRecord | null;
  notes?: AnimalNote[];
  created_at?: string;
  updated_at?: string;
}

export interface EuthanasiaRecord {
  date: string;
  time?: string;
  drug: string;
  reason: string;
  performed_by: string;
  witness: string;
  authorized_by?: string;
  weight?: string;
  dosage: string;
  notes: string;
}

export interface Person {
  id: string;
  pid: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  role: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  id_type?: string;
  id_number?: string;
  id_state?: string;
  id_expiration?: string;
  date_added?: string;
  photo_id_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  barcode_id?: string;
  sex?: string;
  dob?: string;
  hair_color?: string;
  eye_color?: string;
  height?: string;
  weight?: string;
  notes?: PersonNote[];
  created_at?: string;
  updated_at?: string;
}

export interface PersonNote {
  id: string;
  person_id: string;
  text: string;
  type: string;
  date: string;
  time: string;
  created_at?: string;
}

export interface AnimalNote {
  id: string;
  animal_id: string;
  text: string;
  type: string;
  date: string;
  time: string;
  created_at?: string;
}

export interface MedicalRecord {
  id: string;
  animal_id: string;
  animal_name: string;
  type: string;
  description: string;
  date: string;
  vet?: string;
  next_due?: string;
  cost?: number | null;
  status?: string;
  lot_number?: string;
  manufacturer?: string;
  route?: string;
  dosage?: string;
  notes?: string;
  result?: string;
  updated_at?: string;
  updated_by?: string;
  created_at?: string;
}

export interface AdoptionRecord {
  id: string;
  animal_id: string;
  animal_name: string;
  adopter_id: string;
  adopter_name: string;
  adoption_date: string;
  notes?: string;
  receipt_id?: string;
  created_at?: string;
}

export interface DispatchCall {
  id: string;
  type: string;
  priority: string;
  status: string;
  caller?: string;
  caller_phone?: string;
  address?: string;
  city?: string;
  description?: string;
  animal_involved?: boolean;
  animal_description?: string;
  assigned_officers?: AssignedOfficer[];
  narrative?: NarrativeEntry[];
  evidence?: EvidenceItem[];
  involved_parties?: InvolvedParty[];
  linked_citations?: string[];
  animal_ids?: string[];
  date_reported?: string;
  time_reported?: string;
  response_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssignedOfficer {
  id: string;
  name: string;
  vehicle: string;
  badge: string;
}

export interface NarrativeEntry {
  id: string;
  time: string;
  officer: string;
  text: string;
}

export interface EvidenceItem {
  id: string;
  type: string;
  description: string;
  url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  notes?: string;
  date: string;
}

export interface InvolvedParty {
  role: string;
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  statement?: string;
  // Animal party fields
  species?: string;
  breed?: string;
  color?: string;
  sex?: string;
  size?: string;
  desc?: string;
  condition?: string;
  injuries?: string;
  behavior?: string;
  dangerous?: boolean;
  [key: string]: unknown;
}

export interface Citation {
  id: string;
  citation_number: string;
  call_id?: string;
  animal_impound?: string;
  violation_type?: string;
  violation_desc?: string;
  violations?: ViolationItem[];
  violator_name?: string;
  violator_first?: string;
  violator_middle?: string;
  violator_last?: string;
  violator_address?: string;
  violator_city?: string;
  violator_state?: string;
  violator_zip?: string;
  violator_phone?: string;
  violator_email?: string;
  violator_dl?: string;
  violator_sex?: string;
  violator_dob?: string;
  desc_hair?: string;
  desc_eyes?: string;
  desc_weight?: string;
  desc_height?: string;
  animal_desc?: string;
  remarks?: string;
  issuing_officer?: string;
  badge_number?: string;
  served_by?: string;
  date?: string;
  time?: string;
  location?: string;
  court_type?: string;
  court_date?: string;
  court_time?: string;
  court_am_pm?: string;
  fine_amount?: number | null;
  due_date?: string;
  status?: string;
  citation_type?: string;
  physical_cit_number?: string;
  violator_signature?: string;
  officer_signature?: string;
  signed_at?: string;
  notes?: string;
  photo_id_url?: string;
  created_at?: string;
  // Disposition
  disposition_history?: DispositionEntry[];
  fine_paid?: string;
  payment_method_used?: string;
  judge_name?: string;
  dismissed_reason?: string;
  community_service_hours?: number;
  // Court notification
  court_notified?: boolean;
  court_notified_at?: string;
}

export interface RescueGroup {
  id: string;
  organization_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  license_number?: string;
  license_expiration?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VolunteerLog {
  id: string;
  person_id: string;
  person_name: string;
  task: string;
  clock_in: string;
  clock_out?: string | null;
  hours?: number | null;
  date: string;
  notes?: string;
  manually_edited?: boolean;
  is_manual?: boolean;
  created_at?: string;
}

export interface Redemption {
  id: string;
  animal_id: string;
  person_id: string;
  redemption_date: string;
  impound_fee: number;
  boarding_fee: number;
  boarding_days: number;
  rabies_fee: number;
  microchip_fee: number;
  license_fee: number;
  other_fees: number;
  total_fees: number;
  payment_method?: string;
  waiver_reason?: string;
  receipt_number?: string;
  proof_of_ownership?: string;
  conditions_notes?: string;
  citation_issued?: boolean;
  citation_number?: string;
  officer?: string;
  created_at?: string;
}

export interface Transfer {
  id: string;
  transfer_number: string;
  date: string;
  rescue_group_id: string;
  rescue_group_name?: string;
  animal_ids: string[];
  animal_names?: string[];
  notes?: string;
  officer?: string;
  officer_badge?: string;
  condition_at_transfer?: string;
  terms_accepted?: boolean;
  // Full snapshots of agency + animals (with embedded medical_records[]) captured at
  // transfer time so receipts remain accurate even if records are later edited.
  animal_info_snapshot?: Record<string, unknown>[];
  agency_info_snapshot?: Record<string, unknown>;
  created_at?: string;
}

export interface ShelterSettings {
  shelter_name: string;
  shelter_address: string;
  shelter_phone: string;
  gda_license_number: string;
}

export interface FormPreFill {
  call_id?: string;
  call_address?: string;
  call_city?: string;
  call_date?: string;
  call_officer?: string;
  animal_id?: string;
  animal_name?: string;
  animal_species?: string;
  animal_breed?: string;
  animal_color?: string;
  animal_sex?: string;
  animal_age?: string;
  animal_fixed?: boolean;
  person_id?: string;
  person_first?: string;
  person_last?: string;
  person_address?: string;
  person_city?: string;
  person_state?: string;
  person_zip?: string;
  person_phone?: string;
  person_email?: string;
}

export interface CourtSettings {
  magistrate_email: string;
  municipal_email: string;
  portal_url: string;
}

export type FormType =
  | "door_knocker"
  | "rabies_quarantine"
  | "request_for_compliance"
  | "gda_foster_agreement"
  | "gda_foster_inspection"
  | "gda_animal_inventory"
  | "adoption_application";

export interface ShelterForm {
  id: string;
  form_type: FormType;
  form_data: Record<string, unknown>;
  linked_call_id?: string;
  linked_animal_id?: string;
  linked_person_id?: string;
  linked_call_ids?: string[];
  linked_animal_ids?: string[];
  linked_person_ids?: string[];
  status?: string;
  officer?: string;
  created_by?: string;
  created_at?: string;
}

export interface DispositionEntry {
  status: string;
  date: string;
  notes?: string;
  changedBy?: string;
  fineAmount?: number;
  amountPaid?: number;
  paymentMethod?: string;
  judgeName?: string;
  dismissedReason?: string;
  communityServiceHours?: number;
  newCourtDate?: string;
}

export interface ViolationItem {
  code: string;
  description: string;
  count: number;
}

export interface Receipt {
  id: string;
  date: string;
  category: string;
  line_items: LineItem[];
  total: number;
  payment_method: string;
  check_number?: string;
  anonymous: boolean;
  person_id?: string;
  person_name?: string;
  notes?: string;
  created_at?: string;
}

export interface LineItem {
  item: string;
  qty: number;
  price: number;
}

export interface Officer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  badge: string;
  status: string;
  vehicle: string;
  zone?: string;
  radio?: string;
  phone?: string;
  shift?: string;
}

export interface StaffAccount {
  id: string;
  username: string;
  password: string;
  password_hash?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  avatar?: string;
  department?: string;
  email?: string;
  phone?: string;
  badge?: string;
  active?: boolean;
  created_at?: string;
  permissions: string[];
  theme_preference?: "light" | "dark";
}

export interface ShelterRoom {
  id: string;
  name: string;
  type: "label" | "kennels";
  x: number;
  y: number;
  w: number;
  h: number;
  bg?: string;
  layout?: string;
  labels?: string[];
}

export type FieldStatus = 'On Duty' | 'En Route' | 'On Scene' | 'Available' | 'Off Duty' | 'Break';

export interface FieldActivity {
  id: string;
  officer_id: string;
  officer_name: string;
  officer_badge?: string;
  status: FieldStatus;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string;
  call_id?: string | null;
  call_number?: string;
  notes?: string;
  mileage_start?: number | null;
  mileage_end?: number | null;
  recorded_at: string;
  created_at?: string;
}

export interface OfficerFieldProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  badge?: string;
  active?: boolean;
  current_field_status: FieldStatus;
  last_location_lat?: number | null;
  last_location_lng?: number | null;
  last_status_update?: string | null;
}

// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
export interface OfficerSchedule {
  id?: string;
  officer_id: string;
  day_of_week: number;
  is_scheduled: boolean;
  start_time?: string | null; // "HH:MM" 24h
  end_time?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleOverride {
  id?: string;
  officer_id: string;
  override_date: string; // "YYYY-MM-DD"
  is_working: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string;
  created_at?: string;
}

export interface EffectiveShift {
  isScheduled: boolean;          // true if should be working right now
  shiftStart?: string;           // "HH:MM" local
  shiftEnd?: string;
  overrideReason?: string;
  isOverride: boolean;
}

export type Database = {
  public: {
    Tables: {
      animals: { Row: Animal; Insert: Partial<Animal>; Update: Partial<Animal> };
      people: { Row: Person; Insert: Partial<Person>; Update: Partial<Person> };
      animal_notes: { Row: AnimalNote; Insert: Partial<AnimalNote>; Update: Partial<AnimalNote> };
      people_notes: { Row: PersonNote; Insert: Partial<PersonNote>; Update: Partial<PersonNote> };
      medical_records: { Row: MedicalRecord; Insert: Partial<MedicalRecord>; Update: Partial<MedicalRecord> };
      adoption_records: { Row: AdoptionRecord; Insert: Partial<AdoptionRecord>; Update: Partial<AdoptionRecord> };
      dispatch_calls: { Row: DispatchCall; Insert: Partial<DispatchCall>; Update: Partial<DispatchCall> };
      citations: { Row: Citation; Insert: Partial<Citation>; Update: Partial<Citation> };
      receipts: { Row: Receipt; Insert: Partial<Receipt>; Update: Partial<Receipt> };
      staff_accounts: { Row: StaffAccount; Insert: Partial<StaffAccount>; Update: Partial<StaffAccount> };
      officers: { Row: Officer; Insert: Partial<Officer>; Update: Partial<Officer> };
    };
  };
};
