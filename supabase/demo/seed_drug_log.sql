-- Drug log seed data for the demo Supabase project.
-- Run AFTER create_drug_log_for_demo.sql (tables must exist first).
-- Safe to re-run — uses ON CONFLICT DO NOTHING.

-- ── Drug Inventory ────────────────────────────────────────────────────────────

-- Clear existing demo inventory first to avoid duplicates on re-seed
DELETE FROM drug_inventory WHERE bottle_number IN ('BTL-001','BTL-002');

INSERT INTO drug_inventory (
  drug_name, dea_schedule, manufacturer, lot_number, bottle_number,
  concentration, bottle_size_ml, quantity_remaining_ml,
  date_received, received_from, received_by, expiration_date, bottle_status, notes
) VALUES
(
  'Euthasol (Pentobarbital Sodium)', 'Schedule II',
  'Merck Animal Health', 'LOT-2026-001', 'BTL-001',
  '390 mg/mL', 100, 67.5,
  '2026-04-01', 'MWI Veterinary Supply', 'Demo Administrator',
  '2027-04-01', 'Active',
  'Received via DEA Form 222. Current balance reflects 23.9 mL used across 3 euthanasia events plus additional unreported field use.'
),
(
  'Telazol', 'Schedule III',
  'Zoetis', 'LOT-2026-002', 'BTL-002',
  '100 mg/mL', 50, 42.0,
  '2026-03-15', 'MWI Veterinary Supply', 'Demo Administrator',
  '2027-03-15', 'Active',
  'Pre-sedation agent. Used as needed prior to pentobarbital administration.'
);

-- ── Euthanasia Log ────────────────────────────────────────────────────────────
-- Balances calculated sequentially from 100 mL starting quantity.
-- Entry 1: 100.0 - 9.0 = 91.0  remaining
-- Entry 2:  91.0 - 1.4 = 89.6  remaining
-- Entry 3:  89.6 - 13.5 = 76.1 remaining  (matches 67.5 + ~8.6 additional use)

DELETE FROM euthanasia_log WHERE log_number IN ('EL-2026-0001','EL-2026-0002','EL-2026-0003');

-- Fetch the BTL-001 inventory id dynamically
DO $$
DECLARE
  v_inv_id UUID;
BEGIN
  SELECT id INTO v_inv_id FROM drug_inventory WHERE bottle_number = 'BTL-001' LIMIT 1;

  INSERT INTO euthanasia_log (
    log_number, log_date, log_time,
    animal_name, species, breed, sex, weight,
    reason,
    drug_inventory_id, drug_name, lot_number, bottle_id,
    route, dosage_drawn_ml, dosage_administered_ml, dosage_wasted_ml, running_balance_ml,
    death_verification, time_of_death,
    body_disposition, owner_present,
    administered_by_name, witness_name,
    notes
  ) VALUES
  (
    'EL-2026-0001', '2026-05-10', '09:15:00',
    'Unknown', 'Dog', 'Mixed Breed', 'Male', '45 lbs',
    'Medical — Suffering / Quality of Life',
    v_inv_id, 'Euthasol (Pentobarbital Sodium)', 'LOT-2026-001', 'BTL-001',
    'IV — Intravenous', 9.0, 9.0, 0.0, 91.0,
    'All of the above', '09:17:00',
    'Pickup by rendering', false,
    'Demo Administrator', 'Demo Officer 1',
    'Stray male dog, approximate 3-4 years old. Found severely injured on highway. No microchip. Humane destruction authorized per field officer report.'
  ),
  (
    'EL-2026-0002', '2026-05-18', '14:30:00',
    'Unknown', 'Cat', 'Domestic Shorthair', 'Female', '7 lbs',
    'Medical — Untreatable Condition',
    v_inv_id, 'Euthasol (Pentobarbital Sodium)', 'LOT-2026-001', 'BTL-001',
    'IP — Intraperitoneal', 1.4, 1.4, 0.0, 89.6,
    'All of the above', '14:32:00',
    'Pickup by rendering', false,
    'Demo Administrator', 'Demo Officer 1',
    'Stray female cat, advanced feline leukemia confirmed by FeLV positive test. No viable treatment option. Shelter euthanasia authorized by medical staff.'
  ),
  (
    'EL-2026-0003', '2026-05-28', '10:45:00',
    'Unknown', 'Dog', 'Pit Bull Mix', 'Male', '68 lbs',
    'Dangerous Animal Declaration',
    v_inv_id, 'Euthasol (Pentobarbital Sodium)', 'LOT-2026-001', 'BTL-001',
    'IV — Intravenous', 13.5, 13.5, 0.0, 76.1,
    'All of the above', '10:48:00',
    'Owner claimed', false,
    'Demo Administrator', 'Demo Officer 1',
    'Court-ordered destruction following dangerous dog hearing. Animal responsible for multiple bite incidents. Owner notified and present for return of remains.'
  );
END $$;

-- Verify
SELECT log_number, log_date, animal_name || ' (' || species || ')' AS animal,
       drug_name, dosage_administered_ml AS "admin_mL", running_balance_ml AS "balance_mL",
       administered_by_name AS "by", witness_name AS "witness"
FROM euthanasia_log
WHERE log_number LIKE 'EL-2026-%'
ORDER BY log_date;

SELECT bottle_number, drug_name, quantity_remaining_ml AS "remaining_mL", bottle_status
FROM drug_inventory
WHERE bottle_number IN ('BTL-001','BTL-002');
