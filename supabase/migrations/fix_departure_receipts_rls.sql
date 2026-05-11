-- Fix departure_receipts RLS policies.
-- The original migration used "TO authenticated" which blocks this app because
-- it uses its own session auth (anon key, no Supabase JWT). Replace with
-- open policies that match every other table in this project.

DROP POLICY IF EXISTS "departure_receipts_select" ON departure_receipts;
DROP POLICY IF EXISTS "departure_receipts_insert" ON departure_receipts;
DROP POLICY IF EXISTS "departure_receipts_update" ON departure_receipts;

CREATE POLICY "allow_all_departure_receipts"
  ON departure_receipts
  FOR ALL
  USING (true)
  WITH CHECK (true);
