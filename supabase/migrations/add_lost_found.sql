-- ── Lost & Found System ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lost_found_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  TEXT        NOT NULL CHECK (type IN ('lost','found')),
  status                TEXT        DEFAULT 'active' CHECK (status IN ('active','matched','reunited','archived')),
  species               TEXT,
  breed                 TEXT,
  color                 TEXT,
  size                  TEXT,
  sex                   TEXT,
  age                   TEXT,
  pet_name              TEXT,
  microchip             TEXT,
  spayed_neutered       TEXT,
  collar_description    TEXT,
  distinguishing_features TEXT,
  photo_urls            JSONB       DEFAULT '[]',
  date_lost_found       DATE,
  time_lost_found       TEXT,
  location_address      TEXT,
  location_city         TEXT        DEFAULT 'Madison',
  location_zip          TEXT,
  location_lat          NUMERIC(10,7),
  location_lng          NUMERIC(10,7),
  direction_heading     TEXT,
  circumstances         TEXT,
  current_location      TEXT,
  can_hold              BOOLEAN,
  hold_duration         TEXT,
  reporter_name         TEXT        NOT NULL,
  reporter_phone        TEXT        NOT NULL,
  reporter_email        TEXT        NOT NULL,
  reporter_alt_phone    TEXT,
  best_contact_time     TEXT,
  matched_report_id     UUID,
  matched_animal_id     TEXT,
  match_score           INTEGER,
  reunited_date         DATE,
  reunited_notes        TEXT,
  staff_notes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lf_type_status ON lost_found_reports (type, status);
CREATE INDEX IF NOT EXISTS idx_lf_date        ON lost_found_reports (date_lost_found DESC);
CREATE INDEX IF NOT EXISTS idx_lf_species     ON lost_found_reports (species);

CREATE TABLE IF NOT EXISTS lost_found_matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_report_id  UUID        REFERENCES lost_found_reports(id) ON DELETE CASCADE,
  found_report_id UUID        REFERENCES lost_found_reports(id) ON DELETE CASCADE,
  animal_id       TEXT,
  match_score     INTEGER,
  match_type      TEXT,  -- lost_to_found | lost_to_shelter | found_to_lost
  status          TEXT        DEFAULT 'pending' CHECK (status IN ('pending','confirmed','dismissed')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lf_matches_lost  ON lost_found_matches (lost_report_id);
CREATE INDEX IF NOT EXISTS idx_lf_matches_found ON lost_found_matches (found_report_id);
CREATE INDEX IF NOT EXISTS idx_lf_matches_status ON lost_found_matches (status);

-- RLS
ALTER TABLE lost_found_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_found_matches  ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_lost_found_reports ON lost_found_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_lost_found_matches ON lost_found_matches  FOR ALL USING (true) WITH CHECK (true);
