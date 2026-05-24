-- ── Microchip Registry ───────────────────────────────────────────────────────
-- Internal registry of all chips implanted or registered through MCAS.
-- Separate from the animals table chip field (which is just an ID field).
-- This table tracks OWNERSHIP so staff can quickly identify animals/owners
-- during intake, dispatch, and front-desk chip scans.

CREATE TABLE IF NOT EXISTS microchip_registry (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_number       TEXT        NOT NULL,
  manufacturer      TEXT,                                  -- HomeAgain, AVID, 24PetWatch, etc.
  animal_id         TEXT,                                  -- links to animals.id
  animal_name       TEXT,
  species           TEXT,
  breed             TEXT,
  color             TEXT,
  sex               TEXT,
  owner_name        TEXT,
  owner_phone       TEXT,
  owner_email       TEXT,
  owner_address     TEXT,
  owner_city        TEXT,
  owner_state       TEXT,
  owner_zip         TEXT,
  registration_date DATE        DEFAULT CURRENT_DATE,
  registered_by     TEXT,
  status            TEXT        DEFAULT 'Active',          -- Active | Transferred | Deceased
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- chip_number must be globally unique in our registry
CREATE UNIQUE INDEX IF NOT EXISTS idx_microchip_registry_chip
  ON microchip_registry (chip_number);

CREATE INDEX IF NOT EXISTS idx_microchip_registry_animal
  ON microchip_registry (animal_id);

CREATE INDEX IF NOT EXISTS idx_microchip_registry_status
  ON microchip_registry (status);

-- RLS — allow_all matching the rest of the codebase
ALTER TABLE microchip_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_microchip_registry ON microchip_registry
  FOR ALL USING (true) WITH CHECK (true);
