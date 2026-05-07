-- Add extended fields to medical_records for full veterinary record keeping
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS lot_number   TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS route        TEXT,
  ADD COLUMN IF NOT EXISTS dosage       TEXT,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS result       TEXT,
  ADD COLUMN IF NOT EXISTS updated_by   TEXT;
