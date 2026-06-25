-- Died in Care status fields on animals table
-- Run in production Supabase SQL editor.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS death_date DATE,
  ADD COLUMN IF NOT EXISTS death_time TIME,
  ADD COLUMN IF NOT EXISTS cause_of_death TEXT,
  ADD COLUMN IF NOT EXISTS death_location TEXT,
  ADD COLUMN IF NOT EXISTS death_notes TEXT,
  ADD COLUMN IF NOT EXISTS body_disposition TEXT,
  ADD COLUMN IF NOT EXISTS death_recorded_by TEXT,
  ADD COLUMN IF NOT EXISTS death_recorded_at TIMESTAMP WITH TIME ZONE;
