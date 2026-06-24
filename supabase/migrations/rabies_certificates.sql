-- Rabies certificate support + vet signature storage
-- Run in production Supabase SQL editor.

ALTER TABLE staff_accounts
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

CREATE TABLE IF NOT EXISTS clinic_rabies_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  animal_id UUID REFERENCES clinic_animals(id),
  certificate_number TEXT UNIQUE,
  medical_record_id UUID,
  animal_name TEXT,
  species TEXT,
  breed TEXT,
  color TEXT,
  sex TEXT,
  age TEXT,
  weight TEXT,
  microchip TEXT,
  owner_name TEXT,
  vaccine_brand TEXT,
  lot_number TEXT,
  vaccine_expiration DATE,
  date_administered DATE,
  route TEXT,
  duration TEXT,
  next_due DATE,
  rabies_tag TEXT,
  vet_name TEXT,
  vet_license TEXT,
  vet_signature_data TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  voided BOOLEAN DEFAULT false,
  void_reason TEXT
);

ALTER TABLE clinic_rabies_certificates DISABLE ROW LEVEL SECURITY;
