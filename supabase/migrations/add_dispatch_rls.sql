-- Allow all authenticated access to dispatch_calls
-- Run this if dispatch saves are failing with RLS/permission errors.

ALTER TABLE dispatch_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dispatch_calls_all" ON dispatch_calls;
CREATE POLICY "dispatch_calls_all" ON dispatch_calls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
