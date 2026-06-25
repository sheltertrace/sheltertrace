-- Link clinic accounts to shelter customers for shared animal access
-- Run in production Supabase SQL editor.

ALTER TABLE platform_customers
  ADD COLUMN IF NOT EXISTS linked_shelter_customer_id UUID;

CREATE TABLE IF NOT EXISTS clinic_shelter_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_customer_id UUID NOT NULL REFERENCES platform_customers(id),
  shelter_customer_id UUID NOT NULL REFERENCES platform_customers(id),
  access_level TEXT DEFAULT 'medical',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE clinic_shelter_links DISABLE ROW LEVEL SECURITY;
