-- Update demo shelter config to use a generic demo identity.
-- Run in the DEMO Supabase project SQL editor.

INSERT INTO shelter_config (id, config_data)
VALUES (1, '{
  "shelter_name": "Maplewood Animal Services",
  "shelter_address": "123 Demo Street, Maplewood, GA 30650",
  "shelter_phone": "(555) 000-9999",
  "gda_license_number": "GDA-DEMO-0000"
}'::jsonb)
ON CONFLICT (id) DO UPDATE
  SET config_data = EXCLUDED.config_data;

-- Verify
SELECT config_data FROM shelter_config WHERE id = 1;
