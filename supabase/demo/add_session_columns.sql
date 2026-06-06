-- Add demo_session_id column to tables that need session-scoped cleanup.
-- Run this in the DEMO Supabase project SQL editor only — NOT in production.
-- Seed data has demo_session_id = NULL and is never deleted by reset.

ALTER TABLE animals          ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE medical_records  ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE dispatch_calls   ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE citations        ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE people           ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE animal_notes     ADD COLUMN IF NOT EXISTS demo_session_id TEXT;
ALTER TABLE adoption_records ADD COLUMN IF NOT EXISTS demo_session_id TEXT;

-- Index for fast session cleanup
CREATE INDEX IF NOT EXISTS idx_animals_demo_session       ON animals(demo_session_id)          WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medical_demo_session       ON medical_records(demo_session_id)  WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispatch_demo_session      ON dispatch_calls(demo_session_id)   WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_citations_demo_session     ON citations(demo_session_id)        WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_demo_session        ON people(demo_session_id)           WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animal_notes_demo_session  ON animal_notes(demo_session_id)     WHERE demo_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_adoptions_demo_session     ON adoption_records(demo_session_id) WHERE demo_session_id IS NOT NULL;
