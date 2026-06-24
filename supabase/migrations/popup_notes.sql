-- Add popup flag to notes tables so important notes display as alerts
-- Run this in the Supabase SQL editor for both production and demo.

ALTER TABLE animal_notes
  ADD COLUMN IF NOT EXISTS popup BOOLEAN DEFAULT false;

ALTER TABLE people_notes
  ADD COLUMN IF NOT EXISTS popup BOOLEAN DEFAULT false;
