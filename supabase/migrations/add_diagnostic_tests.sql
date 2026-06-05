-- Add diagnostic test result tracking to medical_records.
-- Run in Supabase SQL Editor.

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS test_result TEXT
    CHECK (test_result IN ('Positive', 'Negative', 'Inconclusive', 'Pending')),
  ADD COLUMN IF NOT EXISTS tested_by   TEXT;
