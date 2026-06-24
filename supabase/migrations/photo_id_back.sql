-- Add back-of-license photo field to people table
-- Run this in the Supabase SQL editor.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS photo_id_back_url TEXT;
