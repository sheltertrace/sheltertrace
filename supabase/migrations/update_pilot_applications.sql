ALTER TABLE pilot_applications
  ADD COLUMN IF NOT EXISTS org_type TEXT;
