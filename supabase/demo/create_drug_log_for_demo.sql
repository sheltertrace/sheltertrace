-- Create drug log tables in the demo Supabase project and seed with demo data.
-- Run AFTER add_drug_log.sql (which has the main table definitions + RLS).
-- If you already ran add_drug_log.sql, just run the INSERT section below.

-- Create tables if not already done (idempotent)
CREATE TABLE IF NOT EXISTS drug_inventory (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  drug_name             TEXT        NOT NULL,
  dea_schedule          TEXT        DEFAULT 'Schedule II',
  ndc_number            TEXT,
  manufacturer          TEXT,
  lot_number            TEXT,
  bottle_number         TEXT,
  concentration         TEXT,
  bottle_size_ml        NUMERIC,
  quantity_remaining_ml NUMERIC,
  date_received         DATE,
  received_from         TEXT,
  distributor_dea_number TEXT,
  dea_form_222_number   TEXT,
  received_by           TEXT,
  receiver_signature    TEXT,
  witness_name          TEXT,
  witness_signature     TEXT,
  expiration_date       DATE,
  bottle_status         TEXT        DEFAULT 'Active',
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS euthanasia_log (
  id                       UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  log_number               TEXT        UNIQUE NOT NULL,
  log_date                 DATE        DEFAULT CURRENT_DATE,
  log_time                 TIME,
  animal_id                TEXT,
  animal_name              TEXT,
  species                  TEXT,
  breed                    TEXT,
  sex                      TEXT,
  weight                   TEXT,
  reason                   TEXT,
  drug_inventory_id        UUID        REFERENCES drug_inventory(id),
  drug_name                TEXT,
  lot_number               TEXT,
  bottle_id                TEXT,
  route                    TEXT,
  pre_sedation_drug        TEXT,
  pre_sedation_dosage      TEXT,
  pre_sedation_route       TEXT,
  dosage_drawn_ml          NUMERIC,
  dosage_administered_ml   NUMERIC,
  dosage_wasted_ml         NUMERIC,
  running_balance_ml       NUMERIC,
  death_verification       TEXT,
  time_of_death            TIME,
  body_disposition         TEXT,
  administered_by_id       TEXT,
  administered_by_name     TEXT,
  administered_by_signature TEXT,
  witness_id               TEXT,
  witness_name             TEXT,
  witness_signature        TEXT,
  owner_present            BOOLEAN     DEFAULT false,
  complications            TEXT,
  notes                    TEXT,
  is_correction            BOOLEAN     DEFAULT false,
  corrects_log_id          UUID,
  correction_reason        TEXT,
  -- extended pre-sedation columns
  pre_sedation_inventory_id  UUID,
  pre_sedation_lot_number    TEXT,
  pre_sedation_bottle_id     TEXT,
  pre_sedation_concentration TEXT,
  pre_sedation_dosage_drawn_ml        NUMERIC,
  pre_sedation_dosage_administered_ml NUMERIC,
  pre_sedation_dosage_wasted_ml       NUMERIC,
  pre_sedation_running_balance_ml     NUMERIC,
  pre_sedation_dea_schedule  TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drug_reconciliation (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  reconciliation_date   DATE        DEFAULT CURRENT_DATE,
  period_start          DATE,
  period_end            DATE,
  drug_inventory_id     UUID        REFERENCES drug_inventory(id),
  drug_name             TEXT,
  lot_number            TEXT,
  starting_quantity_ml  NUMERIC,
  total_used_ml         NUMERIC,
  expected_remaining_ml NUMERIC,
  actual_remaining_ml   NUMERIC,
  discrepancy_ml        NUMERIC,
  discrepancy_flag      BOOLEAN     DEFAULT false,
  performed_by          TEXT,
  performer_signature   TEXT,
  witnessed_by          TEXT,
  witness_signature     TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drug_inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE euthanasia_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drug_reconciliation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_drug_inventory      ON drug_inventory;
DROP POLICY IF EXISTS allow_all_euthanasia_log      ON euthanasia_log;
DROP POLICY IF EXISTS allow_all_drug_reconciliation ON drug_reconciliation;

CREATE POLICY allow_all_drug_inventory      ON drug_inventory      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_euthanasia_log      ON euthanasia_log      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_drug_reconciliation ON drug_reconciliation FOR ALL USING (true) WITH CHECK (true);

-- ── Seed demo drug inventory ──────────────────────────────────────────────────
-- Two demo bottles so staff can see the UI in action

INSERT INTO drug_inventory (drug_name, dea_schedule, ndc_number, manufacturer, lot_number, bottle_number, concentration, bottle_size_ml, quantity_remaining_ml, date_received, received_from, dea_form_222_number, received_by, expiration_date, bottle_status)
VALUES
  ('Fatal-Plus (Sodium Pentobarbital)', 'Schedule II', '11169-0111-1', 'Vortech Pharmaceuticals', 'DEMO-LOT-001', 'FP-001', '390 mg/mL', 250, 220, '2026-01-15', 'Demo Distributor Inc.', 'DEMO-222-001', 'Demo Administrator', '2028-01-15', 'Active'),
  ('Telazol', 'Schedule III', '0856-4025-01', 'Zoetis', 'DEMO-LOT-002', 'T-001', '500 mg/vial', 5, 4.5, '2026-02-01', 'Demo Distributor Inc.', NULL, 'Demo Administrator', '2027-06-30', 'Active')
ON CONFLICT DO NOTHING;
