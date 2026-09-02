-- Enforce "every adoption must have an adopter" at the database level, so
-- imports/scripts/direct API calls can't bypass the app-layer validation.
--
-- BEFORE RUNNING: confirm there are no existing adoption_records rows with a
-- NULL adopter_id (see the diagnostic query below) — SET NOT NULL will fail
-- outright if any exist, and they'd need a backfill decision first.
--
-- SELECT COUNT(*) AS null_adopter_count FROM adoption_records WHERE adopter_id IS NULL;
-- SELECT id, animal_id, animal_name, adoption_date, receipt_id, created_at
--   FROM adoption_records WHERE adopter_id IS NULL ORDER BY created_at DESC;

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop the existing inline FK (adopter_id ... ON DELETE SET NULL) if
  -- present — it's incompatible with adopter_id being required, since a
  -- person delete would otherwise try to null out a NOT NULL column.
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'adoption_records'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'adoption_records'::regclass AND attname = 'adopter_id')];
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE adoption_records DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE adoption_records ALTER COLUMN adopter_id SET NOT NULL;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_adoptions_adopter') THEN
    ALTER TABLE adoption_records
      ADD CONSTRAINT fk_adoptions_adopter
      FOREIGN KEY (adopter_id) REFERENCES people(id);
  END IF;
END $$;
