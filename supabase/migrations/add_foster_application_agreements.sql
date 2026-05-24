-- Add full agreement signature fields to foster_applications.
-- The original table had a single `signature` column; these columns
-- carry the two separate signed agreements matching the volunteer form.

ALTER TABLE foster_applications
  ADD COLUMN IF NOT EXISTS agree_to_agreement      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_signature     TEXT,
  ADD COLUMN IF NOT EXISTS agree_to_confidentiality BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidentiality_signature TEXT;
