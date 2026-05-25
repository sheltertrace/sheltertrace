-- ── Pet License Registry ──────────────────────────────────────────────────────
-- Tracks licenses issued by the City of Madison (and other authorities).
-- Staff-only — not public-facing.

CREATE TABLE IF NOT EXISTS pet_licenses (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number          TEXT    NOT NULL,
  issue_date              DATE,
  expiration_date         DATE,
  issuing_authority       TEXT    DEFAULT 'City of Madison',
  status                  TEXT    DEFAULT 'Active',  -- Active | Expired | Revoked | Suspended
  pet_name                TEXT,
  species                 TEXT,
  breed                   TEXT,
  color                   TEXT,
  sex                     TEXT,
  age                     TEXT,
  spayed_neutered         BOOLEAN,
  microchip_number        TEXT,
  rabies_tag              TEXT,
  rabies_vaccination_date DATE,
  rabies_expiration_date  DATE,
  animal_id               TEXT,
  owner_name              TEXT,
  owner_address           TEXT,
  owner_city              TEXT    DEFAULT 'Madison',
  owner_state             TEXT    DEFAULT 'GA',
  owner_zip               TEXT,
  owner_phone             TEXT,
  owner_email             TEXT,
  person_id               TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_licenses_number
  ON pet_licenses (license_number);

CREATE INDEX IF NOT EXISTS idx_pet_licenses_animal   ON pet_licenses (animal_id);
CREATE INDEX IF NOT EXISTS idx_pet_licenses_person   ON pet_licenses (person_id);
CREATE INDEX IF NOT EXISTS idx_pet_licenses_expiry   ON pet_licenses (expiration_date);
CREATE INDEX IF NOT EXISTS idx_pet_licenses_status   ON pet_licenses (status);

ALTER TABLE pet_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_pet_licenses ON pet_licenses
  FOR ALL USING (true) WITH CHECK (true);
