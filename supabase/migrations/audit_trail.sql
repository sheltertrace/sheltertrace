-- Audit trail: created_by / updated_by on core tables + kennel move history
-- Run in production Supabase SQL editor.

ALTER TABLE animals ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE dispatch_calls ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE foster_placements ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE lost_found_reports ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE animal_notes ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS kennel_move_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id TEXT NOT NULL,
  animal_name TEXT,
  from_kennel TEXT,
  to_kennel TEXT,
  moved_by TEXT NOT NULL,
  moved_by_id TEXT,
  reason TEXT,
  moved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE kennel_move_history DISABLE ROW LEVEL SECURITY;
