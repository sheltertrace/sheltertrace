-- Public adoption applications submitted via /adopt-apply
-- Reviewed and processed by admin staff

CREATE TABLE IF NOT EXISTS adoption_applications (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT        NOT NULL DEFAULT 'pending',
    -- pending | approved | denied | more_info

  -- Section 1 — Top info
  date             TEXT,
  event_location   TEXT,
  staff_name       TEXT,
  staff_phone      TEXT,

  -- Section 2 — Animal information
  animal_name      TEXT,
  animal_id_number TEXT,
  species          TEXT,
  breed            TEXT,
  color_markings   TEXT,
  age              TEXT,
  sex              TEXT,
  weight           TEXT,
  spayed_neutered  BOOLEAN,
  microchipped     BOOLEAN,
  vaccinated       BOOLEAN,
  heartworm_tested BOOLEAN,
  microchip_number TEXT,
  animal_notes     TEXT,

  -- Section 3 — Adopter information
  adopter_name     TEXT        NOT NULL,
  adopter_dob      TEXT,
  adopter_address  TEXT,
  adopter_city     TEXT,
  adopter_state    TEXT,
  adopter_zip      TEXT,
  adopter_phone    TEXT,
  adopter_email    TEXT,
  drivers_license  TEXT,
  dl_state         TEXT,
  housing          TEXT,
  landlord_info    TEXT,
  dwelling_type    TEXT,

  -- Section 4 — Household information
  num_adults       TEXT,
  children_ages    TEXT,
  pet_allergies    BOOLEAN,
  current_pets     TEXT,
  surrendered_pet  BOOLEAN,
  surrendered_explain TEXT,

  -- Section 5 — Pet care plan
  pet_kept_day     TEXT,
  pet_sleep        TEXT,
  hours_alone      TEXT,
  fenced_yard      BOOLEAN,
  vet_info         TEXT,

  -- Section 7 — Adoption fees
  adoption_fee     NUMERIC,
  deposit          NUMERIC,
  payment_method   TEXT,
  receipt_number   TEXT,

  -- Section 9 — Signatures (base64 PNG)
  adopter_signature TEXT,
  staff_signature   TEXT,

  -- Section 8 — Office use only (staff-filled during review)
  processed_by     TEXT,
  date_entered     TEXT,
  rabies_tag       TEXT,
  license_number   TEXT,
  spay_neuter_date TEXT,
  office_notes     TEXT,

  -- Admin review fields
  admin_notes      TEXT,
  reviewed_by      TEXT,
  reviewed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_adoption_applications_status
  ON adoption_applications (status);
CREATE INDEX IF NOT EXISTS idx_adoption_applications_email
  ON adoption_applications (adopter_email);
CREATE INDEX IF NOT EXISTS idx_adoption_applications_created
  ON adoption_applications (created_at DESC);

ALTER TABLE adoption_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adoption_applications_all" ON adoption_applications;
CREATE POLICY "adoption_applications_all" ON adoption_applications
  FOR ALL USING (true) WITH CHECK (true);
