-- City of Madison Pet Licensing System
-- Run in production Supabase SQL editor.

CREATE TABLE IF NOT EXISTS pet_license_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  status TEXT DEFAULT 'Pending',
  owner_first_name TEXT NOT NULL,
  owner_last_name TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  owner_city TEXT DEFAULT 'Madison',
  owner_state TEXT DEFAULT 'GA',
  owner_zip TEXT,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  animals JSONB DEFAULT '[]',
  submission_type TEXT DEFAULT 'online',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_by_ip TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  denial_reason TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  payment_amount NUMERIC,
  payment_date DATE,
  payment_method TEXT,
  payment_reference TEXT,
  late_fee BOOLEAN DEFAULT false,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_pet_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES pet_license_applications(id),
  license_number TEXT UNIQUE,
  tag_number TEXT UNIQUE,
  year INTEGER DEFAULT EXTRACT(YEAR FROM NOW()),
  status TEXT DEFAULT 'Active',
  animal_name TEXT NOT NULL,
  species TEXT DEFAULT 'Dog',
  breed TEXT,
  color TEXT,
  markings TEXT,
  sex TEXT,
  sterilized BOOLEAN,
  veterinarian TEXT,
  rabies_tag_number TEXT,
  rabies_expiration DATE,
  mcas_animal_id TEXT REFERENCES animals(id),
  owner_name TEXT,
  owner_phone TEXT,
  owner_address TEXT,
  issue_date DATE,
  expiration_date DATE,
  issued_by TEXT,
  issued_at TIMESTAMP WITH TIME ZONE,
  renewal_notice_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS city_license_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES city_pet_licenses(id),
  renewal_year INTEGER,
  renewed_by TEXT,
  renewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_amount NUMERIC,
  notes TEXT
);

ALTER TABLE pet_license_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE city_pet_licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE city_license_renewals DISABLE ROW LEVEL SECURITY;

-- Sequence tables for auto-numbering
CREATE SEQUENCE IF NOT EXISTS city_license_tag_seq START 1;
CREATE SEQUENCE IF NOT EXISTS city_application_seq START 1;
CREATE SEQUENCE IF NOT EXISTS city_license_num_seq START 1;
