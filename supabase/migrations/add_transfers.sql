-- ── Rescue Groups ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rescue_groups (
  id                  TEXT PRIMARY KEY,
  organization_name   TEXT NOT NULL,
  contact_person      TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  license_number      TEXT,
  license_expiration  DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rescue_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_rescue_groups" ON rescue_groups;
CREATE POLICY "allow_all_rescue_groups" ON rescue_groups
  FOR ALL USING (true) WITH CHECK (true);

-- ── Transfers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  id                  TEXT PRIMARY KEY,
  transfer_number     TEXT NOT NULL,
  date                DATE NOT NULL,
  rescue_group_id     TEXT REFERENCES rescue_groups(id),
  rescue_group_name   TEXT,
  animal_ids          JSONB DEFAULT '[]',
  animal_names        JSONB DEFAULT '[]',
  notes               TEXT,
  officer             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_transfers" ON transfers;
CREATE POLICY "allow_all_transfers" ON transfers
  FOR ALL USING (true) WITH CHECK (true);

-- ── Add transfer fields to animals ───────────────────────────────────────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS transferred_to   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS transfer_date    DATE;
