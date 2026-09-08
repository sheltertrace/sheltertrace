-- Fix clinic portal data scoping: clinic_account_id was being set to the
-- individual logged-in staff member's staff_accounts.id, siloing each
-- employee from their own coworkers. It must be the clinic's shared
-- platform_customer_id instead. Author tracking (administered_by/
-- created_by/performed_by) is untouched — that's a separate concern from
-- data scope and still correctly points at the individual who entered it.

-- clinic_clients.clinic_account_id has an inline FK to staff_accounts(id),
-- which is incompatible with storing a platform_customers.id value there —
-- drop it before backfilling.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'clinic_clients'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'clinic_clients'::regclass AND attname = 'clinic_account_id')];
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE clinic_clients DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Repoint every clinic_* table's clinic_account_id from the individual
-- staff member who happened to enter each record to their clinic's shared
-- platform_customer_id.
UPDATE clinic_clients ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_animals ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_appointments ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_medical_records ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_procedures ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_invoices ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_emails ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_people ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

UPDATE clinic_rabies_certificates ca
SET clinic_account_id = sa.platform_customer_id::text
FROM staff_accounts sa
WHERE ca.clinic_account_id = sa.id
  AND sa.platform_customer_id IS NOT NULL;

-- Clinic settings (tax rate, invoice prefix, logo, etc.) are stored as a
-- JSON blob in shelter_config keyed 'clinic-<accountId>' — same bug, same
-- fix. If more than one employee at a clinic had independently saved
-- settings under their own id, keep only the most recently updated one as
-- the new shared row; the rest are left in place, orphaned but harmless.
WITH ranked AS (
  SELECT sc.id AS old_id, sa.platform_customer_id::text AS new_id,
         ROW_NUMBER() OVER (PARTITION BY sa.platform_customer_id ORDER BY sc.updated_at DESC NULLS LAST) AS rn
  FROM shelter_config sc
  JOIN staff_accounts sa ON sc.id = 'clinic-' || sa.id
  WHERE sa.platform_customer_id IS NOT NULL
)
UPDATE shelter_config sc
SET id = 'clinic-' || r.new_id
FROM ranked r
WHERE sc.id = r.old_id AND r.rn = 1;

-- ── Verification — run after the above to confirm everything landed under
-- one id per clinic ──
-- SELECT 'clinic_clients' AS tbl, clinic_account_id, COUNT(*) FROM clinic_clients GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_animals', clinic_account_id, COUNT(*) FROM clinic_animals GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_appointments', clinic_account_id, COUNT(*) FROM clinic_appointments GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_medical_records', clinic_account_id, COUNT(*) FROM clinic_medical_records GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_procedures', clinic_account_id, COUNT(*) FROM clinic_procedures GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_invoices', clinic_account_id, COUNT(*) FROM clinic_invoices GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_emails', clinic_account_id, COUNT(*) FROM clinic_emails GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_people', clinic_account_id, COUNT(*) FROM clinic_people GROUP BY 1, 2
-- UNION ALL SELECT 'clinic_rabies_certificates', clinic_account_id, COUNT(*) FROM clinic_rabies_certificates GROUP BY 1, 2
-- ORDER BY 1, 2;

-- ── Part 4 — staff account audit: any clinic account with a NULL
-- platform_customer_id will still be invisible after this fix ──
-- SELECT id, username, account_type, platform_customer_id
-- FROM staff_accounts
-- WHERE account_type = 'clinic'
-- ORDER BY platform_customer_id NULLS FIRST, username;
