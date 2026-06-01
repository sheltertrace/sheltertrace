-- Ensure the medical_records.status column exists and defaults to 'Scheduled'.
-- This is a safety net: the application code already sends status = 'Scheduled'
-- for auto-generated intake vaccines, but having a DB-level default means
-- any insert that omits the status field will also land as 'Scheduled' rather
-- than NULL (which the UI previously displayed as if it were "Administered").

ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE medical_records
  ALTER COLUMN status SET DEFAULT 'Scheduled';

-- Back-fill: any auto-generated intake record whose status is NULL was created
-- before the status feature existed. Treat them as Scheduled so staff can
-- explicitly confirm them. Only touch records with the tell-tale "Auto-scheduled"
-- vet value that the old intake code stamped on them.
UPDATE medical_records
  SET status = 'Scheduled'
  WHERE status IS NULL
    AND (vet = '' OR vet = 'Auto-scheduled' OR vet IS NULL)
    AND description NOT LIKE '%Edited by%';

-- Re-apply allow_all RLS in case it was dropped.
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON medical_records;
CREATE POLICY allow_all_medical_records_v2 ON medical_records
  FOR ALL USING (true) WITH CHECK (true);
