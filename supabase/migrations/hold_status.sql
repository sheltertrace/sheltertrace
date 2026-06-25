-- Enhanced Hold status with type, dates, and linked info
-- Run in production Supabase SQL editor.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS hold_type TEXT,
  ADD COLUMN IF NOT EXISTS hold_start_date DATE,
  ADD COLUMN IF NOT EXISTS hold_end_date DATE,
  ADD COLUMN IF NOT EXISTS hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS hold_placed_by TEXT,
  ADD COLUMN IF NOT EXISTS hold_adopter_info JSONB,
  ADD COLUMN IF NOT EXISTS hold_rescue_info JSONB,
  ADD COLUMN IF NOT EXISTS hold_legal_info JSONB;
