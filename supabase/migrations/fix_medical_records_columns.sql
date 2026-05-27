-- Ensure all extended medical_records columns exist.
-- The base schema.sql only creates 9 columns; two separate migrations
-- (add_medical_extended_fields.sql and add_medical_columns.sql) add the
-- rest.  If either migration was skipped, every UPDATE that includes those
-- columns fails silently from the user's perspective.
--
-- This migration is fully idempotent — safe to run multiple times.

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS cost         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS status       TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lot_number   TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS route        TEXT,
  ADD COLUMN IF NOT EXISTS dosage       TEXT,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS result       TEXT,
  ADD COLUMN IF NOT EXISTS updated_by   TEXT;

-- Re-apply RLS with a clean allow-all policy (matching every other table).
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all"           ON medical_records;
DROP POLICY IF EXISTS "allow_all_medical"   ON medical_records;
DROP POLICY IF EXISTS "medical_allow_all"   ON medical_records;

CREATE POLICY allow_all_medical_records ON medical_records
  FOR ALL USING (true) WITH CHECK (true);
