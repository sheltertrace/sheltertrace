-- Ensure every column the /volunteer-apply form submits exists.
--
-- The base table (add_volunteer_applications.sql) was missing the four
-- signature fields; they were split into a second migration
-- (add_volunteer_application_signatures.sql) that may not have been run.
--
-- This migration is fully idempotent — safe to run whether or not the
-- previous migrations were applied.

ALTER TABLE volunteer_applications
  -- Signature fields (added by add_volunteer_application_signatures.sql)
  ADD COLUMN IF NOT EXISTS agreement_signature       TEXT,
  ADD COLUMN IF NOT EXISTS confidentiality_signature TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_name      TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_signature TEXT,

  -- Staff review fields (in case add_volunteer_applications.sql was partial)
  ADD COLUMN IF NOT EXISTS reviewed_by   TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT,
  ADD COLUMN IF NOT EXISTS person_id     TEXT,
  ADD COLUMN IF NOT EXISTS pid           TEXT;

-- RLS: open policy matching the rest of the codebase
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_applications_all" ON volunteer_applications;
CREATE POLICY "volunteer_applications_all" ON volunteer_applications
  FOR ALL USING (true) WITH CHECK (true);
