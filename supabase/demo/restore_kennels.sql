-- Restore demo animal kennel assignments and statuses to seed defaults.
-- Run this in the demo Supabase SQL editor if kennels are wrong after a reset,
-- OR this is automatically included in full_demo_reset() — just re-run that function.

-- ── Kennel assignments ────────────────────────────────────────────────────────

UPDATE animals SET kennel = 'D-1'   WHERE id = '26-04-001';  -- Buddy  (Dog, Available)
UPDATE animals SET kennel = 'C-1'   WHERE id = '26-04-002';  -- Luna   (Cat, Available)
UPDATE animals SET kennel = 'D-2'   WHERE id = '26-04-003';  -- Max    (Dog, Medical Hold)
UPDATE animals SET kennel = 'C-2'   WHERE id = '26-04-004';  -- Daisy  (Cat, Available)
UPDATE animals SET kennel = 'ISO-1' WHERE id = '26-04-005';  -- Rex    (Dog, Quarantine)
UPDATE animals SET kennel = 'C-3'   WHERE id = '26-04-006';  -- Coco   (Cat, Available)
UPDATE animals SET kennel = 'D-3'   WHERE id = '26-05-001';  -- Charlie(Dog, Available)
UPDATE animals SET kennel = NULL    WHERE id = '26-05-002';  -- Molly  (Dog, Foster - no kennel)
UPDATE animals SET kennel = 'D-4'   WHERE id = '26-05-003';  -- Rocky  (Dog, Available)
UPDATE animals SET kennel = 'C-4'   WHERE id = '26-05-004';  -- Stella (Cat, Available)
UPDATE animals SET kennel = 'D-5'   WHERE id = '26-05-005';  -- Duke   (Dog, Medical Hold)
UPDATE animals SET kennel = 'C-5'   WHERE id = '26-05-006';  -- Bella  (Cat, Available)
UPDATE animals SET kennel = 'D-6'   WHERE id = '26-05-007';  -- Cooper (Dog, Pending)
UPDATE animals SET kennel = 'C-6'   WHERE id = '26-05-008';  -- Lily   (Cat, Available)
UPDATE animals SET kennel = 'D-7'   WHERE id = '26-05-009';  -- Zeus   (Dog, Available)
UPDATE animals SET kennel = 'D-8'   WHERE id = '26-05-010';  -- Nala   (Dog, Available)
UPDATE animals SET kennel = 'C-7'   WHERE id = '26-05-011';  -- Milo   (Cat, Available)
UPDATE animals SET kennel = 'D-9'   WHERE id = '26-05-012';  -- Sadie  (Dog, Available)
UPDATE animals SET kennel = 'D-10'  WHERE id = '26-05-013';  -- Bear   (Dog, Available)
UPDATE animals SET kennel = 'C-8'   WHERE id = '26-05-014';  -- Penny  (Cat, Available)

-- ── Status restoration ────────────────────────────────────────────────────────

UPDATE animals SET status = 'Available' WHERE id IN (
  '26-04-001','26-04-002','26-04-004','26-04-006',
  '26-05-001','26-05-003','26-05-004','26-05-006',
  '26-05-008','26-05-009','26-05-010','26-05-011',
  '26-05-012','26-05-013','26-05-014'
);
UPDATE animals SET status = 'Medical Hold' WHERE id IN ('26-04-003','26-05-005');
UPDATE animals SET status = 'Quarantine'   WHERE id = '26-04-005';
UPDATE animals SET status = 'Foster'       WHERE id = '26-05-002';
UPDATE animals SET status = 'Pending'      WHERE id = '26-05-007';

-- Verify
SELECT id, name, species, kennel, status FROM animals ORDER BY id;
