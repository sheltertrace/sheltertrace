-- ── Redemptions table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS redemptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id           TEXT NOT NULL,
  person_id           TEXT NOT NULL,
  redemption_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  impound_fee         NUMERIC(10,2) DEFAULT 0,
  boarding_fee        NUMERIC(10,2) DEFAULT 0,
  boarding_days       INTEGER DEFAULT 0,
  rabies_fee          NUMERIC(10,2) DEFAULT 0,
  microchip_fee       NUMERIC(10,2) DEFAULT 0,
  license_fee         NUMERIC(10,2) DEFAULT 0,
  other_fees          NUMERIC(10,2) DEFAULT 0,
  total_fees          NUMERIC(10,2) DEFAULT 0,
  payment_method      TEXT,
  waiver_reason       TEXT,
  receipt_number      TEXT,
  proof_of_ownership  TEXT,
  conditions_notes    TEXT,
  citation_issued     BOOLEAN DEFAULT false,
  citation_number     TEXT,
  officer             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_redemptions" ON redemptions;
CREATE POLICY "allow_all_redemptions" ON redemptions
  FOR ALL USING (true) WITH CHECK (true);
