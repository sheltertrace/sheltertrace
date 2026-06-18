-- IDEXX VetConnect PLUS integration columns for medical_records
-- Run this in the Supabase SQL editor.

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS idexx_order_id         TEXT,
  ADD COLUMN IF NOT EXISTS idexx_accession_number TEXT,
  ADD COLUMN IF NOT EXISTS idexx_status           TEXT,
  ADD COLUMN IF NOT EXISTS idexx_result_data      JSONB,
  ADD COLUMN IF NOT EXISTS idexx_ordered_at       TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS idexx_resulted_at      TIMESTAMP WITH TIME ZONE;

-- Index for fast webhook lookup by order ID or accession number
CREATE INDEX IF NOT EXISTS idx_medical_records_idexx_order_id
  ON medical_records (idexx_order_id)
  WHERE idexx_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_records_idexx_accession
  ON medical_records (idexx_accession_number)
  WHERE idexx_accession_number IS NOT NULL;
