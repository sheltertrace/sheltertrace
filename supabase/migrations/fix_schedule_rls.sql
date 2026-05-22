-- Fix officer_schedules and schedule_overrides RLS.
--
-- The original migration created policies scoped to the 'authenticated' role
-- (Supabase Auth JWT). This app uses a custom auth system with the anon key,
-- so those policies block every INSERT / UPDATE from the app.
--
-- Replace them with allow-all policies that match the rest of the codebase.

-- officer_schedules
DROP POLICY IF EXISTS "schedules_select" ON officer_schedules;
DROP POLICY IF EXISTS "schedules_insert" ON officer_schedules;
DROP POLICY IF EXISTS "schedules_update" ON officer_schedules;
DROP POLICY IF EXISTS "schedules_delete" ON officer_schedules;

CREATE POLICY allow_all_officer_schedules ON officer_schedules
  FOR ALL USING (true) WITH CHECK (true);

-- schedule_overrides
DROP POLICY IF EXISTS "overrides_select" ON schedule_overrides;
DROP POLICY IF EXISTS "overrides_insert" ON schedule_overrides;
DROP POLICY IF EXISTS "overrides_update" ON schedule_overrides;
DROP POLICY IF EXISTS "overrides_delete" ON schedule_overrides;

CREATE POLICY allow_all_schedule_overrides ON schedule_overrides
  FOR ALL USING (true) WITH CHECK (true);
