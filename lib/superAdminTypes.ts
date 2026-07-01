export interface PlatformCustomer {
  id: string;
  account_name: string;
  account_type: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  status: string;
  trial_start?: string;
  trial_end?: string;
  subscription_start?: string;
  subscription_end?: string;
  billing_plan?: string;
  billing_amount?: number;
  billing_cycle?: string;
  last_payment_date?: string;
  next_payment_date?: string;
  notes?: string;
  feature_flags: Record<string, boolean>;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogEntry {
  id: string;
  super_admin_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  created_at?: string;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  type: string;
  target_account_types?: string[];
  active: boolean;
  show_from?: string;
  show_until?: string;
  created_by?: string;
  created_at?: string;
}

export const CUSTOMER_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
export const CUSTOMER_TYPES = ["shelter", "clinic", "humane_society", "enterprise", "government", "county"] as const;

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  shelter:        "Shelter",
  clinic:         "Clinic",
  humane_society: "Humane Society",
  enterprise:     "Enterprise",
  government:     "Government / Municipality",
  county:         "County Agency",
};

export const CUSTOMER_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  shelter:        { bg: "#dbeafe", color: "#1d4ed8" },
  clinic:         { bg: "#d1fae5", color: "#065f46" },
  humane_society: { bg: "#ede9fe", color: "#6d28d9" },
  enterprise:     { bg: "#fef3c7", color: "#b45309" },
  government:     { bg: "#dbeafe", color: "#1B3A5C" },
  county:         { bg: "#dcfce7", color: "#14532d" },
};
export const BILLING_PLANS = ["starter", "professional", "enterprise"] as const;
export const BILLING_CYCLES = ["monthly", "annual"] as const;
export const ANNOUNCEMENT_TYPES = ["info", "warning", "maintenance", "feature"] as const;

export const FEATURE_FLAGS = [
  { key: "dispatch",           label: "Field Dispatch & GPS" },
  { key: "citations",          label: "Citations & Court Portal" },
  { key: "foster",             label: "Foster Care System" },
  { key: "volunteers",         label: "Volunteer Kiosk & Portal" },
  { key: "clinic",             label: "Clinic Management" },
  { key: "drug_log",           label: "DEA Drug Log" },
  { key: "gda_reports",        label: "GDA Compliance Reports" },
  { key: "idexx",              label: "IDEXX Integration" },
  { key: "public_portal",      label: "Public Adoption Portal" },
  { key: "petfinder_sync",     label: "Petfinder Sync (coming soon)" },
  { key: "donor_fundraising",  label: "Donor & Fundraising (coming soon)" },
] as const;

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  trial:     { bg: "#fef3c7", color: "#b45309" },
  active:    { bg: "#dcfce7", color: "#15803d" },
  suspended: { bg: "#ffedd5", color: "#c2410c" },
  cancelled: { bg: "#fee2e2", color: "#dc2626" },
};
