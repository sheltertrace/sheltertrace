-- ── Microchip registry additions ─────────────────────────────────────────────
-- Extra fields to record what was found on national databases and whether
-- the owner was successfully contacted.

ALTER TABLE microchip_registry
  ADD COLUMN IF NOT EXISTS lookup_source    TEXT,    -- where the registration was confirmed
  ADD COLUMN IF NOT EXISTS owner_contacted  BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS contacted_date   DATE,
  ADD COLUMN IF NOT EXISTS contacted_by     TEXT;

-- ── Microchip search log ──────────────────────────────────────────────────────
-- Every chip lookup (internal + national) is logged here so staff can track
-- scan volume and lookup success rates.

CREATE TABLE IF NOT EXISTS microchip_searches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chip_number TEXT        NOT NULL,
  searched_by TEXT,
  result      TEXT,       -- 'found_internal' | 'found_national' | 'not_found'
  source      TEXT,       -- which registry had the record
  animal_id   TEXT,
  notes       TEXT,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_microchip_searches_chip
  ON microchip_searches (chip_number);

CREATE INDEX IF NOT EXISTS idx_microchip_searches_at
  ON microchip_searches (searched_at DESC);

ALTER TABLE microchip_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_microchip_searches ON microchip_searches
  FOR ALL USING (true) WITH CHECK (true);
