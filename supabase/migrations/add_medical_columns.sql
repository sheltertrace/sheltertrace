-- Add missing columns to medical_records
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS cost       NUMERIC(10,2);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS status     TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Ensure anon role can SELECT / INSERT / UPDATE / DELETE (same pattern as other tables)
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_medical" ON medical_records;
CREATE POLICY "allow_all_medical" ON medical_records
  FOR ALL
  USING (true)
  WITH CHECK (true);
