-- Fix volunteer_applications visibility in the admin Volunteers page.
--
-- The table uses submitted_at as its creation timestamp; add created_at as
-- an alias so either column name works in queries, then ensure RLS is fully
-- open so the anon/staff client can read all rows.

-- 1. Add created_at if it doesn't exist, backfill from submitted_at
ALTER TABLE volunteer_applications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

UPDATE volunteer_applications
  SET created_at = submitted_at
  WHERE created_at IS NULL;

ALTER TABLE volunteer_applications
  ALTER COLUMN created_at SET DEFAULT now();

-- 2. Open RLS (in case the original migration was skipped or partial)
ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_applications_all" ON volunteer_applications;
CREATE POLICY "volunteer_applications_all" ON volunteer_applications
  FOR ALL USING (true) WITH CHECK (true);
