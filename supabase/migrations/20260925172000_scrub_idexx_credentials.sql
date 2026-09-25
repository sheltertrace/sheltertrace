-- Remove IDEXX credentials from the anon-readable shelter_config table.
--
-- The app now reads them from server-only environment variables
-- (IDEXX_VETCONNECT_USERNAME / _PASSWORD, IDEXX_AGENT_USERNAME / _PASSWORD,
-- IDEXX_WEBHOOK_SECRET). RUN THIS ONLY AFTER those are set in Vercel and the
-- site has been redeployed - until then IDEXX ordering and result sync have no
-- credentials to use. The old values must also be rotated with IDEXX: they were
-- readable by anyone holding the public key.
UPDATE shelter_config
   SET config_data = config_data
         - 'agent_username' - 'agent_password'
         - 'vetconnect_username' - 'vetconnect_password'
         - 'webhook_secret' - 'api_key' - 'api_secret',
       updated_at = now()
 WHERE id = 6 AND config_data IS NOT NULL;
