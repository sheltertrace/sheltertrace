-- Clinic Portal — database changes
-- Run in production Supabase SQL editor.

-- Clinic accounts
ALTER TABLE staff_accounts
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'shelter';

-- County clients table
CREATE TABLE IF NOT EXISTS clinic_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL REFERENCES staff_accounts(id),
  county_name TEXT NOT NULL,
  agency_name TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  contract_start DATE,
  contract_end DATE,
  contract_value NUMERIC,
  billing_rate NUMERIC,
  billing_type TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic animals
CREATE TABLE IF NOT EXISTS clinic_animals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  name TEXT,
  species TEXT,
  breed TEXT,
  color TEXT,
  sex TEXT,
  age TEXT,
  dob DATE,
  weight TEXT,
  microchip TEXT,
  shelter_id TEXT,
  intake_date DATE,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic appointments
CREATE TABLE IF NOT EXISTS clinic_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  animal_id UUID REFERENCES clinic_animals(id),
  animal_name TEXT,
  appointment_date DATE,
  appointment_time TIME,
  appointment_type TEXT,
  status TEXT DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic invoices
CREATE TABLE IF NOT EXISTS clinic_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  line_items JSONB,
  subtotal NUMERIC,
  tax NUMERIC DEFAULT 0,
  total NUMERIC,
  status TEXT DEFAULT 'Draft',
  paid_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic medical records
CREATE TABLE IF NOT EXISTS clinic_medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  animal_id UUID REFERENCES clinic_animals(id),
  animal_name TEXT,
  type TEXT,
  description TEXT,
  medication_name TEXT,
  dosage TEXT,
  route TEXT,
  lot_number TEXT,
  manufacturer TEXT,
  date DATE,
  next_due DATE,
  result TEXT,
  test_result TEXT CHECK (test_result IN ('Positive','Negative','Inconclusive','Pending')),
  administered_by TEXT,
  vet_notes TEXT,
  cost NUMERIC,
  status TEXT DEFAULT 'Administered',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic procedures/surgeries
CREATE TABLE IF NOT EXISTS clinic_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  animal_id UUID REFERENCES clinic_animals(id),
  animal_name TEXT,
  procedure_type TEXT,
  procedure_date DATE,
  pre_op_weight TEXT,
  anesthesia_used TEXT,
  anesthesia_dose TEXT,
  complications TEXT,
  outcome TEXT,
  recovery_notes TEXT,
  follow_up_date DATE,
  cost NUMERIC,
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clinic email log
CREATE TABLE IF NOT EXISTS clinic_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  to_email TEXT,
  subject TEXT,
  body TEXT,
  attachments JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS on all clinic tables
ALTER TABLE clinic_clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_animals DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_medical_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_procedures DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_emails DISABLE ROW LEVEL SECURITY;
