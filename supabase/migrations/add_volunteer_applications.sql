-- Volunteer Applications table
-- Public-facing applications submitted via /volunteer-apply
-- Reviewed and approved/rejected by admin staff

CREATE TABLE IF NOT EXISTS volunteer_applications (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status                  TEXT        NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | more_info

  -- Applicant personal info
  first_name              TEXT        NOT NULL,
  middle_name             TEXT,
  last_name               TEXT        NOT NULL,
  email                   TEXT,
  phone                   TEXT,
  address                 TEXT,
  city                    TEXT,
  state                   TEXT        DEFAULT 'GA',
  zip                     TEXT,
  dob                     TEXT,
  sex                     TEXT,

  -- Emergency contact
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,

  -- Application details
  interests               JSONB       DEFAULT '[]',   -- array of task strings
  availability            TEXT,                        -- Weekdays | Weekends | Both | Flexible
  has_animals             BOOLEAN,
  prior_experience        TEXT,
  why_volunteer           TEXT,

  -- Agreements
  agree_to_terms          BOOLEAN     NOT NULL DEFAULT false,
  agree_to_conduct        BOOLEAN     NOT NULL DEFAULT false,
  signature_name          TEXT,

  -- Review fields (filled by staff)
  reviewed_by             TEXT,
  reviewed_at             TIMESTAMPTZ,
  reviewer_notes          TEXT,

  -- Linked person after approval
  person_id               TEXT,
  pid                     TEXT
);

CREATE INDEX IF NOT EXISTS idx_volunteer_applications_status
  ON volunteer_applications (status);

CREATE INDEX IF NOT EXISTS idx_volunteer_applications_submitted
  ON volunteer_applications (submitted_at DESC);

ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "volunteer_applications_all" ON volunteer_applications;
CREATE POLICY "volunteer_applications_all" ON volunteer_applications
  FOR ALL USING (true) WITH CHECK (true);
