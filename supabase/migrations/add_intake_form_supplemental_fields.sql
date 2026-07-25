-- Supplemental to add_intake_form_fields.sql — additional gaps found while
-- auditing the intake wizard against the MCAS paper form's Staff Use
-- sections (Intake Details / Animal Description / Condition Assessment).
-- Run this in the Supabase SQL editor alongside add_intake_form_fields.sql.

ALTER TABLE animals
ADD COLUMN IF NOT EXISTS intake_method TEXT,
  -- Office Intake | Field Intake | Cage Trap | Owner Surrender
ADD COLUMN IF NOT EXISTS processed_by_employee TEXT,
ADD COLUMN IF NOT EXISTS owner_vet TEXT,
ADD COLUMN IF NOT EXISTS owner_vet_phone TEXT,
ADD COLUMN IF NOT EXISTS collar_tag TEXT,
ADD COLUMN IF NOT EXISTS condition_visible_injury BOOLEAN,
ADD COLUMN IF NOT EXISTS condition_signs_of_illness BOOLEAN,
ADD COLUMN IF NOT EXISTS condition_parasites_observed BOOLEAN,
ADD COLUMN IF NOT EXISTS condition_pregnant_nursing BOOLEAN;
