-- Emergency contact and barcode fields for volunteers
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS emergency_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS barcode_id              TEXT;
