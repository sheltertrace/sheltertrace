-- ── Foster Care System ───────────────────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

-- ── foster_placements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foster_placements (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id            TEXT        REFERENCES animals(id) ON DELETE CASCADE,
  animal_name          TEXT,
  foster_parent_id     TEXT        REFERENCES people(id) ON DELETE CASCADE,
  foster_parent_name   TEXT,
  start_date           DATE        DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date   DATE,
  reason               TEXT,
  care_instructions    TEXT,
  medication_schedule  TEXT,
  supplies_provided    JSONB       DEFAULT '[]',
  condition_at_return  TEXT,
  return_notes         TEXT,
  status               TEXT        DEFAULT 'Active', -- Active | Returned | Extended | Transferred
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foster_placements_animal  ON foster_placements(animal_id);
CREATE INDEX IF NOT EXISTS idx_foster_placements_parent  ON foster_placements(foster_parent_id);
CREATE INDEX IF NOT EXISTS idx_foster_placements_status  ON foster_placements(status);

-- ── foster_updates (submitted by foster parent via portal) ────────────────────
CREATE TABLE IF NOT EXISTS foster_updates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id     UUID        REFERENCES foster_placements(id) ON DELETE CASCADE,
  foster_parent_id TEXT,
  animal_id        TEXT,
  date             DATE        DEFAULT CURRENT_DATE,
  status           TEXT,       -- Great | Good | Concerns | Emergency
  eating_well      BOOLEAN,
  weight           TEXT,
  photo_url        TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foster_updates_placement ON foster_updates(placement_id);
CREATE INDEX IF NOT EXISTS idx_foster_updates_animal    ON foster_updates(animal_id);

-- ── foster_checkins (logged by staff) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foster_checkins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id UUID        REFERENCES foster_placements(id) ON DELETE CASCADE,
  staff_id     TEXT,
  staff_name   TEXT,
  method       TEXT,       -- Phone | Text | Visit | Email
  notes        TEXT,
  checked_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foster_checkins_placement ON foster_checkins(placement_id);

-- ── foster_applications (public form submissions) ──────────────────────────────
CREATE TABLE IF NOT EXISTS foster_applications (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name              TEXT        NOT NULL,
  last_name               TEXT        NOT NULL,
  dob                     TEXT,
  address                 TEXT,
  city                    TEXT,
  state                   TEXT,
  zip                     TEXT,
  phone                   TEXT,
  email                   TEXT,
  housing                 TEXT,
  dwelling_type           TEXT,
  landlord_permission     BOOLEAN,
  fenced_yard             BOOLEAN,
  fence_details           TEXT,
  other_pets              TEXT,
  children                TEXT,
  previous_experience     TEXT,
  animal_preference       TEXT,
  special_needs           BOOLEAN,
  bottle_feed             BOOLEAN,
  max_animals             INTEGER,
  foster_duration         TEXT,
  vet_info                TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  why_foster              TEXT,
  signature               TEXT,
  status                  TEXT        DEFAULT 'pending', -- pending | approved | rejected | more_info
  admin_notes             TEXT,
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  assigned_pid            TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foster_applications_status ON foster_applications(status);

-- ── foster_supply_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foster_supply_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  foster_parent_id  TEXT,
  foster_parent_name TEXT,
  items             JSONB       DEFAULT '[]',
  notes             TEXT,
  status            TEXT        DEFAULT 'pending', -- pending | fulfilled | denied
  fulfilled_by      TEXT,
  fulfilled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foster_supply_status ON foster_supply_requests(status);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE foster_placements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE foster_updates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE foster_checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE foster_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE foster_supply_requests  ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_foster_placements      ON foster_placements      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_foster_updates         ON foster_updates         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_foster_checkins        ON foster_checkins        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_foster_applications    ON foster_applications    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_foster_supply_requests ON foster_supply_requests FOR ALL USING (true) WITH CHECK (true);
