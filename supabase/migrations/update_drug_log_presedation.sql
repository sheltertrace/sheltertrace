-- Expand euthanasia drug log with bottle numbers and full pre-sedation tracking.

-- Add user-assigned bottle number to inventory (e.g. "FP-003", "K-001")
ALTER TABLE drug_inventory
  ADD COLUMN IF NOT EXISTS bottle_number TEXT;

-- Full pre-sedation tracking on each log entry
ALTER TABLE euthanasia_log
  ADD COLUMN IF NOT EXISTS pre_sedation_inventory_id  UUID     REFERENCES drug_inventory(id),
  ADD COLUMN IF NOT EXISTS pre_sedation_lot_number    TEXT,
  ADD COLUMN IF NOT EXISTS pre_sedation_bottle_id     TEXT,
  ADD COLUMN IF NOT EXISTS pre_sedation_concentration TEXT,
  ADD COLUMN IF NOT EXISTS pre_sedation_dosage_drawn_ml        NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_sedation_dosage_administered_ml NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_sedation_dosage_wasted_ml       NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_sedation_running_balance_ml     NUMERIC,
  ADD COLUMN IF NOT EXISTS pre_sedation_dea_schedule  TEXT;
