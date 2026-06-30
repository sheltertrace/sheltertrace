-- Clinic Portal: customers (people) linked to clinic animals
-- Run in production Supabase SQL editor.

CREATE TABLE IF NOT EXISTS clinic_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_account_id TEXT NOT NULL,
  client_id UUID REFERENCES clinic_clients(id),
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_animal_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id UUID REFERENCES clinic_animals(id),
  person_id UUID REFERENCES clinic_people(id),
  role TEXT DEFAULT 'Owner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE clinic_people DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_animal_people DISABLE ROW LEVEL SECURITY;
