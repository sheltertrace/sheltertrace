-- Fix demo staff account permissions so the full sidebar and all modules
-- are accessible. Run in the DEMO Supabase project SQL editor.
--
-- The app's sidebar uses: user.permissions.includes("all")
-- The normalizeAccount function expects permissions as a JSON ARRAY ["all"],
-- NOT an object {"all": true}. Always use array format.

UPDATE staff_accounts
SET
  permissions = '["all"]'::jsonb,
  role = 'Admin',
  active = true
WHERE id = 'demo-admin';

UPDATE staff_accounts
SET
  permissions = '["dispatch","animals","citations","reports","dashboard","medical","people","kennels"]'::jsonb,
  role = 'Officer',
  active = true
WHERE id = 'demo-officer1';

UPDATE staff_accounts
SET
  permissions = '["animals","adoptions","receipts","people","medical","reports","dashboard","kennels","foster","volunteers"]'::jsonb,
  role = 'Front Desk',
  active = true
WHERE id = 'demo-staff';

-- Verify
SELECT id, role, active, permissions FROM staff_accounts WHERE id IN ('demo-admin','demo-officer1','demo-staff');
