-- Add signature fields to volunteer_applications
-- Base64 PNG canvas signatures for both agreements and optional parent/guardian

ALTER TABLE volunteer_applications
  ADD COLUMN IF NOT EXISTS agreement_signature      TEXT,
  ADD COLUMN IF NOT EXISTS confidentiality_signature TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_name      TEXT,
  ADD COLUMN IF NOT EXISTS parent_guardian_signature TEXT;
