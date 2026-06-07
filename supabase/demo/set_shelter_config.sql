-- Set complete demo shelter_config with all identity fields.
-- Run in the DEMO Supabase project SQL editor.

UPDATE shelter_config
SET config_data = '{
  "shelter_name": "Maplewood Animal Services",
  "shelter_short_name": "MAS",
  "address": "123 Demo Street",
  "city": "Maplewood",
  "state": "GA",
  "zip": "30650",
  "phone": "555-000-9999",
  "fax": "555-000-9998",
  "email": "info@demo.sheltertrace.com",
  "website": "demo.sheltertrace.com",
  "director": "Demo Director",
  "gda_license": "DEMO-0000",
  "county": "Demo County",
  "court_name": "Demo County Magistrate Court",
  "court_address": "456 Court Square",
  "court_city": "Maplewood",
  "court_state": "GA",
  "court_zip": "30650",
  "court_phone": "555-000-7777",
  "judge_name": "Demo Judge",
  "ordinance_title": "Demo County Animal Control Ordinance",
  "tax_id": "00-0000000",
  "logo_url": null
}'::jsonb
WHERE id = 1;

-- Verify
SELECT config_data FROM shelter_config WHERE id = 1;
