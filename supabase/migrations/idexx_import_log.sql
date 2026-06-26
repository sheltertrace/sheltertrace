-- IDEXX CSV Import tracking table
-- Run in production Supabase SQL editor.

CREATE TABLE IF NOT EXISTS idexx_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by TEXT NOT NULL,
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_name TEXT,
  total_rows INTEGER,
  matched_rows INTEGER,
  imported_rows INTEGER,
  skipped_rows INTEGER,
  error_rows INTEGER,
  results JSONB,
  notes TEXT
);
ALTER TABLE idexx_import_log DISABLE ROW LEVEL SECURITY;

ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS source TEXT;
