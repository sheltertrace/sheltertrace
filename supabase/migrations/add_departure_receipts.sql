-- ── Departure Receipts ─────────────────────────────────────────────────────────
-- Auto-generated receipt for every animal departure (adoption, redemption,
-- transfer, euthanasia, foster, release, etc.)

CREATE TABLE IF NOT EXISTS departure_receipts (
  id                   TEXT PRIMARY KEY,
  receipt_number       TEXT NOT NULL,
  animal_id            TEXT NOT NULL,
  animal_name          TEXT,
  animal_info_snapshot JSONB,          -- full Animal snapshot at departure time
  departure_type       TEXT NOT NULL,  -- "Adoption", "Owner Redemption", "Transfer Out", etc.
  departure_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  person_id            TEXT,           -- nullable — linked Person record
  person_name          TEXT,
  person_info_snapshot JSONB,          -- full Person snapshot (if available)
  fees                 JSONB,          -- array of { item: string, amount: number }
  total_fees           NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method       TEXT,
  conditions           TEXT,
  notes                TEXT,
  officer_name         TEXT,
  officer_id           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the most common lookups
CREATE INDEX IF NOT EXISTS departure_receipts_animal_id_idx
  ON departure_receipts (animal_id);

CREATE INDEX IF NOT EXISTS departure_receipts_departure_date_idx
  ON departure_receipts (departure_date DESC);

CREATE INDEX IF NOT EXISTS departure_receipts_departure_type_idx
  ON departure_receipts (departure_type);

-- ── Row-level security ────────────────────────────────────────────────────────
ALTER TABLE departure_receipts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all departure receipts
CREATE POLICY "departure_receipts_select"
  ON departure_receipts FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert (staff generating receipts)
CREATE POLICY "departure_receipts_insert"
  ON departure_receipts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update (corrections)
CREATE POLICY "departure_receipts_update"
  ON departure_receipts FOR UPDATE
  TO authenticated
  USING (true);
