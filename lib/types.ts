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
  // Record provenance
  import_source?: string | null;  // 'shelterbuddy' | 'import' | null (null = native ShelterTrace record)
  // Public website profile
  show_on_website?: boolean;
  public_bio?: string;
  featured_photo_url?: string;
  photo_urls?: string[];
  updated_by?: string;
  // Hold
  hold_type?: string;
  hold_start_date?: string;
  hold_end_date?: string;
  hold_reason?: string;
  hold_placed_by?: string;
  hold_adopter_info?: { first_name?: string; last_name?: string; phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string; notes?: string; application_on_file?: boolean; application_date?: string };
  hold_rescue_info?: { rescue_name?: string; contact_person?: string; contact_phone?: string; expected_pickup?: string };
  hold_legal_info?: { case_number?: string; issuing_authority?: string; court_date?: string };
  // Died in Care
  death_date?: string;
  death_time?: string;
  cause_of_death?: string;
  death_location?: string;
  death_notes?: string;
  body_disposition?: string;
  death_recorded_by?: string;
  death_recorded_at?: string;
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
  photo_id_back_url?: string;
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
  popup?: boolean;
  created_at?: string;
}

export interface AnimalNote {
  id: string;
  animal_id: string;
  text: string;
  type: string;
  date: string;
  time: string;
  popup?: boolean;
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
  test_result?: string;    // Positive | Negative | Inconclusive | Pending — for diagnostic test types
  tested_by?: string;
  updated_at?: string;
  updated_by?: string;
  created_by?: string;
  source?: string;
  created_at?: string;
  // IDEXX VetConnect PLUS fields
  idexx_order_id?:         string;
  idexx_accession_number?: string;
  idexx_status?:           string;   // Pending | Resulted | Error
  idexx_result_data?:      Record<string, unknown> | null;
  idexx_ordered_at?:       string;
  idexx_resulted_at?:      string;
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
  created_by?: string;
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
  edited?: boolean;
  edited_by?: string;
  edited_at?: string;
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
  // Violator email notification
  email_sent?: boolean;
  email_sent_at?: string;
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
  | "adoption_application"
  | "volunteer_application"
  | "volunteer_agreement"
  | "volunteer_confidentiality";

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

export interface DepartureReceipt {
  id: string;
  receipt_number: string;
  animal_id: string;
  animal_name: string;
  animal_info_snapshot: Record<string, unknown>;
  departure_type: string;
  departure_date: string;
  person_id?: string;
  person_name?: string;
  person_info_snapshot?: Record<string, unknown>;
  fees?: Array<{ item: string; amount: number }>;
  total_fees: number;
  payment_method?: string;
  conditions?: string;
  notes?: string;
  officer_name?: string;
  officer_id?: string;
  created_at?: string;
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
  animal_id?: string;
  notes?: string;
  created_by?: string;
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
  account_type?: string;
  is_super_admin?: boolean;
  platform_customer_id?: string;
  signature_data?: string;
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

export interface LocationHistory {
  id: string;
  officer_id: string;
  officer_name?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  status?: string;
  call_id?: string;
  timestamp: string;
}

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
  tracking_active?: boolean | null;
  phone?: string | null;
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
  officer_name?: string;   // denormalized for fast display
  override_date: string;   // "YYYY-MM-DD"
  is_working: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string;
  shift_type?: string;     // "On-Call" | "Weekend Duty" | "Holiday Coverage" | "Emergency"
  created_at?: string;
}

export interface EffectiveShift {
  isScheduled: boolean;          // true if should be working right now
  shiftStart?: string;           // "HH:MM" local
  shiftEnd?: string;
  overrideReason?: string;
  isOverride: boolean;
}

export interface VolunteerApplication {
  id: string;
  submitted_at: string;
  status: "pending" | "approved" | "rejected" | "more_info";
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dob?: string;
  sex?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  interests?: string[];
  availability?: string;
  has_animals?: boolean;
  prior_experience?: string;
  why_volunteer?: string;
  agree_to_terms: boolean;
  agree_to_conduct: boolean;
  signature_name?: string;
  agreement_signature?: string;
  confidentiality_signature?: string;
  parent_guardian_name?: string;
  parent_guardian_signature?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  person_id?: string;
  pid?: string;
}

export interface AdoptionApplication {
  id: string;
  created_at: string;
  status: "pending" | "approved" | "denied" | "more_info";
  date?: string;
  event_location?: string;
  staff_name?: string;
  staff_phone?: string;
  animal_name?: string;
  animal_id_number?: string;
  species?: string;
  breed?: string;
  color_markings?: string;
  age?: string;
  sex?: string;
  weight?: string;
  spayed_neutered?: boolean;
  microchipped?: boolean;
  vaccinated?: boolean;
  heartworm_tested?: boolean;
  microchip_number?: string;
  animal_notes?: string;
  adopter_name: string;
  adopter_dob?: string;
  adopter_address?: string;
  adopter_city?: string;
  adopter_state?: string;
  adopter_zip?: string;
  adopter_phone?: string;
  adopter_email?: string;
  drivers_license?: string;
  dl_state?: string;
  housing?: string;
  landlord_info?: string;
  dwelling_type?: string;
  num_adults?: string;
  children_ages?: string;
  pet_allergies?: boolean;
  current_pets?: string;
  surrendered_pet?: boolean;
  surrendered_explain?: string;
  pet_kept_day?: string;
  pet_sleep?: string;
  hours_alone?: string;
  fenced_yard?: boolean;
  vet_info?: string;
  adoption_fee?: number;
  deposit?: number;
  payment_method?: string;
  receipt_number?: string;
  adopter_signature?: string;
  staff_signature?: string;
  processed_by?: string;
  date_entered?: string;
  rabies_tag?: string;
  license_number?: string;
  spay_neuter_date?: string;
  office_notes?: string;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface MicrochipSearch {
  id?: string;
  chip_number: string;
  searched_by?: string;
  result?: string;   // 'found_internal' | 'found_national' | 'not_found'
  source?: string;
  animal_id?: string;
  notes?: string;
  searched_at?: string;
}

export interface MicrochipRegistration {
  id?: string;
  chip_number: string;
  manufacturer?: string;
  animal_id?: string;
  animal_name?: string;
  species?: string;
  breed?: string;
  color?: string;
  sex?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  owner_address?: string;
  owner_city?: string;
  owner_state?: string;
  owner_zip?: string;
  registration_date?: string;
  registered_by?: string;
  status?: string;
  notes?: string;
  lookup_source?: string;
  owner_contacted?: boolean;
  contacted_date?: string;
  contacted_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Foster Care System ────────────────────────────────────────────────────────

export interface FosterPlacement {
  id?: string;
  animal_id: string;
  animal_name?: string;
  foster_parent_id: string;
  foster_parent_name?: string;
  start_date?: string;
  expected_return_date?: string;
  actual_return_date?: string;
  reason?: string;
  care_instructions?: string;
  medication_schedule?: string;
  supplies_provided?: string[];
  condition_at_return?: string;
  return_notes?: string;
  status?: string; // Active | Returned | Extended | Transferred
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FosterUpdate {
  id?: string;
  placement_id?: string;
  foster_parent_id?: string;
  animal_id?: string;
  date?: string;
  status?: string; // Great | Good | Concerns | Emergency
  eating_well?: boolean;
  weight?: string;
  photo_url?: string;
  notes?: string;
  created_at?: string;
}

export interface FosterCheckin {
  id?: string;
  placement_id?: string;
  staff_id?: string;
  staff_name?: string;
  method?: string; // Phone | Text | Visit | Email
  notes?: string;
  checked_at?: string;
}

export interface FosterApplication {
  id?: string;
  first_name: string;
  last_name: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  housing?: string;
  dwelling_type?: string;
  landlord_permission?: boolean;
  fenced_yard?: boolean;
  fence_details?: string;
  other_pets?: string;
  children?: string;
  previous_experience?: string;
  animal_preference?: string;
  special_needs?: boolean;
  bottle_feed?: boolean;
  max_animals?: number;
  foster_duration?: string;
  vet_info?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  why_foster?: string;
  signature?: string;
  agree_to_agreement?: boolean;
  agreement_signature?: string;
  agree_to_confidentiality?: boolean;
  confidentiality_signature?: string;
  status?: string; // pending | approved | rejected | more_info
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  assigned_pid?: string;
  created_at?: string;
}

export interface FosterSupplyRequest {
  id?: string;
  foster_parent_id?: string;
  foster_parent_name?: string;
  items?: string[];
  notes?: string;
  status?: string; // pending | fulfilled | denied
  fulfilled_by?: string;
  fulfilled_at?: string;
  created_at?: string;
}

// ── Internal Messaging ───────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  name?: string | null;
  type: "direct" | "group" | "broadcast";
  participants: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  // Client-side enriched fields
  lastMessage?: Message | null;
  unreadCount?: number;
  otherParticipantName?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  message_type: "text" | "urgent" | "system" | "shared_animal" | "shared_call";
  shared_record_id?: string | null;
  shared_record_type?: string | null;
  is_deleted?: boolean;
  reply_to_id?: string | null;
  reply_to?: Message | null;  // client-side populated
  created_at: string;
}

export interface MessageReadStatus {
  id?: string;
  message_id: string;
  user_id: string;
  read_at?: string;
}

// ── Pet License Registry ──────────────────────────────────────────────────────

export interface PetLicense {
  id?: string;
  license_number: string;
  issue_date?: string;
  expiration_date?: string;
  issuing_authority?: string;
  status?: string;             // Active | Expired | Revoked | Suspended
  pet_name?: string;
  species?: string;
  breed?: string;
  color?: string;
  sex?: string;
  age?: string;
  spayed_neutered?: boolean | null;
  microchip_number?: string;
  rabies_tag?: string;
  rabies_vaccination_date?: string;
  rabies_expiration_date?: string;
  animal_id?: string;
  owner_name?: string;
  owner_address?: string;
  owner_city?: string;
  owner_state?: string;
  owner_zip?: string;
  owner_phone?: string;
  owner_email?: string;
  person_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Lost & Found ──────────────────────────────────────────────────────────────

export interface LostFoundReport {
  id?: string;
  type: "lost" | "found";
  status?: string;       // active | matched | reunited | archived
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  age?: string;
  pet_name?: string;
  microchip?: string;
  spayed_neutered?: string;
  collar_description?: string;
  distinguishing_features?: string;
  photo_urls?: string[];
  date_lost_found?: string;
  time_lost_found?: string;
  location_address?: string;
  location_city?: string;
  location_zip?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  direction_heading?: string;
  circumstances?: string;
  current_location?: string;
  can_hold?: boolean;
  hold_duration?: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_email: string;
  reporter_alt_phone?: string;
  best_contact_time?: string;
  matched_report_id?: string;
  matched_animal_id?: string;
  match_score?: number;
  reunited_date?: string;
  reunited_notes?: string;
  staff_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LostFoundMatch {
  id?: string;
  lost_report_id?: string;
  found_report_id?: string;
  animal_id?: string;
  match_score?: number;
  match_type?: string;   // lost_to_found | lost_to_shelter | found_to_lost
  status?: string;       // pending | confirmed | dismissed
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
}

export interface CitizenReport {
  id: string;
  reference_number: string;
  report_type: string;
  location_address?: string;
  location_city?: string;
  location_zip?: string;
  location_details?: string;
  species?: string;
  breed?: string;
  animal_color?: string;
  animal_count?: number;
  animal_contained?: boolean;
  animal_injured?: boolean;
  animal_aggressive?: boolean;
  description: string;
  duration?: string;
  reported_before?: boolean;
  reporter_first_name?: string;
  reporter_last_name?: string;
  reporter_phone?: string;
  reporter_email?: string;
  anonymous: boolean;
  wants_update: boolean;
  contact_time?: string;
  photo_urls?: string[];
  status: string;
  priority?: string;
  assigned_officer?: string;
  staff_notes?: string;
  dispatch_call_id?: string;
  resolved_at?: string;
  resolution_notes?: string;
  dismissed_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DrugInventory {
  id: string;
  drug_name: string;
  dea_schedule?: string;
  ndc_number?: string;
  manufacturer?: string;
  lot_number?: string;
  concentration?: string;
  bottle_size_ml?: number;
  quantity_remaining_ml?: number;
  date_received?: string;
  received_from?: string;
  distributor_dea_number?: string;
  dea_form_222_number?: string;
  received_by?: string;
  receiver_signature?: string;
  witness_name?: string;
  witness_signature?: string;
  expiration_date?: string;
  bottle_number?: string;
  bottle_status?: string;
  notes?: string;
  created_at?: string;
}

export interface EuthanasiaLog {
  id: string;
  log_number: string;
  log_date?: string;
  log_time?: string;
  animal_id?: string;
  animal_name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  weight?: string;
  reason?: string;
  drug_inventory_id?: string;
  drug_name?: string;
  lot_number?: string;
  bottle_id?: string;
  route?: string;
  pre_sedation_drug?: string;
  pre_sedation_dosage?: string;
  pre_sedation_route?: string;
  pre_sedation_inventory_id?: string;
  pre_sedation_lot_number?: string;
  pre_sedation_bottle_id?: string;
  pre_sedation_concentration?: string;
  pre_sedation_dosage_drawn_ml?: number;
  pre_sedation_dosage_administered_ml?: number;
  pre_sedation_dosage_wasted_ml?: number;
  pre_sedation_running_balance_ml?: number;
  pre_sedation_dea_schedule?: string;
  dosage_drawn_ml?: number;
  dosage_administered_ml?: number;
  dosage_wasted_ml?: number;
  running_balance_ml?: number;
  death_verification?: string;
  time_of_death?: string;
  body_disposition?: string;
  administered_by_id?: string;
  administered_by_name?: string;
  administered_by_signature?: string;
  witness_id?: string;
  witness_name?: string;
  witness_signature?: string;
  owner_present?: boolean;
  complications?: string;
  notes?: string;
  is_correction?: boolean;
  corrects_log_id?: string;
  correction_reason?: string;
  created_at?: string;
}

export interface DrugReconciliation {
  id: string;
  reconciliation_date?: string;
  period_start?: string;
  period_end?: string;
  drug_inventory_id?: string;
  drug_name?: string;
  lot_number?: string;
  starting_quantity_ml?: number;
  total_used_ml?: number;
  expected_remaining_ml?: number;
  actual_remaining_ml?: number;
  discrepancy_ml?: number;
  discrepancy_flag?: boolean;
  performed_by?: string;
  performer_signature?: string;
  witnessed_by?: string;
  witness_signature?: string;
  notes?: string;
  created_at?: string;
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
