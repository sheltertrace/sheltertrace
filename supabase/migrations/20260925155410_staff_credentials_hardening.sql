-- SECURITY HOTFIX (1 of 2): staff passwords were stored in plaintext in
-- staff_accounts.password_hash and readable by anyone holding the public anon
-- key (and the source repository was public, so the default passwords were
-- published too). This moves credentials into a locked table as bcrypt hashes,
-- moves the password check into the database, throttles guessing, and
-- invalidates EVERY existing password.
--
-- After this runs NO existing password works - not even to reach a reset
-- screen. The old passwords were publicly readable, so anyone could hold a
-- copy. An administrator issues each person a temporary password:
--
--     select staff_issue_temp_password('username');   -- SQL editor only
--
-- A temporary password is single-use in the sense that matters: it can only be
-- exchanged for a new password of the person's own choosing (no session is
-- ever granted on it), it expires 24 hours after it is issued, and it is
-- replaced the moment the person sets their own.
--
-- ORDER OF OPERATIONS: deploy the app code first, then run this file, then
-- 20260925170000_staff_accounts_write_lockdown.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- pgcrypto is normally in the `extensions` schema on Supabase; resolve it either way.
SET search_path = public, extensions;

-- == Locked credentials table =================================================
CREATE TABLE IF NOT EXISTS staff_credentials (
  staff_id            TEXT PRIMARY KEY,           -- staff_accounts.id (no FK: see delete trigger below)
  password_hash       TEXT,                       -- bcrypt; NULL = no usable password until an admin issues one
  must_reset          BOOLEAN NOT NULL DEFAULT true,
  temp_expires_at     TIMESTAMPTZ,                -- a temporary password stops working at this time
  failed_attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE staff_credentials ENABLE ROW LEVEL SECURITY;   -- and deliberately NO policies
REVOKE ALL ON TABLE staff_credentials FROM PUBLIC, anon, authenticated;

-- staff_accounts.password_hash may be NOT NULL in production (schema.sql says so)
ALTER TABLE staff_accounts ALTER COLUMN password_hash DROP NOT NULL;

-- == Invalidate every existing password =======================================
-- The plaintext passwords were publicly readable, so they are treated as
-- compromised and are NOT carried over - not even hashed. Every account starts
-- with no usable password and must_reset = true.
INSERT INTO staff_credentials (staff_id, password_hash, must_reset)
SELECT id, NULL, true FROM staff_accounts
ON CONFLICT (staff_id) DO NOTHING;   -- idempotent: re-running never wipes passwords people have since chosen

UPDATE staff_accounts SET password_hash = NULL WHERE password_hash IS NOT NULL;

-- == Safety net for SQL-editor / service-role writes ===========================
-- If anything writes a value into staff_accounts.password_hash it is captured as
-- a 24-hour temporary password (hashed, must_reset = true) and the column is
-- blanked, so plaintext can never be stored again.
CREATE OR REPLACE FUNCTION staff_accounts_capture_password() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL AND NEW.password_hash <> ''
     AND (TG_OP = 'INSERT' OR NEW.password_hash IS DISTINCT FROM OLD.password_hash) THEN
    INSERT INTO staff_credentials (staff_id, password_hash, must_reset, temp_expires_at, password_changed_at)
    VALUES (NEW.id, crypt(NEW.password_hash, gen_salt('bf', 10)), true, now() + interval '24 hours', now())
    ON CONFLICT (staff_id) DO UPDATE SET
      password_hash = EXCLUDED.password_hash, must_reset = true, temp_expires_at = EXCLUDED.temp_expires_at,
      failed_attempts = 0, locked_until = NULL, password_changed_at = now(), updated_at = now();
  END IF;
  NEW.password_hash := NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION staff_accounts_capture_password() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_staff_accounts_capture_password ON staff_accounts;
CREATE TRIGGER trg_staff_accounts_capture_password
  BEFORE INSERT OR UPDATE ON staff_accounts
  FOR EACH ROW EXECUTE FUNCTION staff_accounts_capture_password();

CREATE OR REPLACE FUNCTION staff_accounts_drop_credentials() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM staff_credentials WHERE staff_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION staff_accounts_drop_credentials() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_staff_accounts_drop_credentials ON staff_accounts;
CREATE TRIGGER trg_staff_accounts_drop_credentials
  AFTER DELETE ON staff_accounts
  FOR EACH ROW EXECUTE FUNCTION staff_accounts_drop_credentials();

-- == Password policy (single source of truth) =================================
CREATE OR REPLACE FUNCTION staff__password_problem(p_new text, p_username text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT CASE
    WHEN p_new IS NULL OR length(p_new) < 10            THEN 'Password must be at least 10 characters.'
    WHEN p_new !~ '[A-Za-z]' OR p_new !~ '[0-9]'        THEN 'Password must contain at least one letter and one number.'
    WHEN lower(p_new) = lower(coalesce(p_username, '')) THEN 'Password cannot be the same as your username.'
    ELSE NULL END
$$;
REVOKE EXECUTE ON FUNCTION staff__password_problem(text, text) FROM PUBLIC, anon, authenticated;

-- == Login: verify inside the database; the hash never leaves it ==============
-- Returns {ok:true, must_reset, account:{...staff row minus password_hash}} or
-- {ok:false, error:'invalid'|'locked'|'reset_expired', retry_after_seconds?}.
-- must_reset = true means "right password, but it is a temporary one": the app
-- must send the person to the change-password step and must NOT start a session.
-- Five wrong passwords on an account lock it for 15 minutes; ten, for an hour.
CREATE OR REPLACE FUNCTION staff_login(p_username text, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  sa staff_accounts%ROWTYPE;
  c  staff_credentials%ROWTYPE;
  uname text := trim(coalesce(p_username, ''));
BEGIN
  SELECT * INTO sa FROM staff_accounts
   WHERE lower(username) = lower(uname)
   ORDER BY (username = uname) DESC LIMIT 1;

  IF NOT FOUND OR sa.active IS FALSE THEN
    PERFORM crypt(coalesce(p_password, ''), gen_salt('bf', 10));   -- equalize timing
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  SELECT * INTO c FROM staff_credentials WHERE staff_id = sa.id FOR UPDATE;
  IF NOT FOUND OR c.password_hash IS NULL THEN
    PERFORM crypt(coalesce(p_password, ''), gen_salt('bf', 10));
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  IF c.locked_until IS NOT NULL AND c.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked',
             'retry_after_seconds', ceil(extract(epoch FROM (c.locked_until - now())))::int);
  END IF;

  IF crypt(coalesce(p_password, ''), c.password_hash) = c.password_hash THEN
    -- Right password, but a temporary password past its 24 hours: an
    -- administrator must issue a new one. (Checked only AFTER the password
    -- matches so a stranger can't probe which accounts are expired.)
    IF c.must_reset AND c.temp_expires_at IS NOT NULL AND c.temp_expires_at < now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reset_expired');
    END IF;
    UPDATE staff_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE staff_id = sa.id;
    RETURN jsonb_build_object('ok', true, 'must_reset', c.must_reset,
             'account', to_jsonb(sa) - 'password_hash');
  END IF;

  UPDATE staff_credentials
     SET failed_attempts = failed_attempts + 1,
         locked_until = CASE WHEN failed_attempts + 1 >= 10 THEN now() + interval '1 hour'
                             WHEN failed_attempts + 1 >= 5  THEN now() + interval '15 minutes'
                             ELSE NULL END,
         updated_at = now()
   WHERE staff_id = sa.id;
  RETURN jsonb_build_object('ok', false, 'error', 'invalid');
END $$;

-- == Change password: proves the old (or temporary) password first ============
-- This is what consumes a temporary password: the hash is replaced, must_reset
-- and the expiry are cleared, so the temporary password can never be used again.
CREATE OR REPLACE FUNCTION staff_change_password(p_username text, p_old_password text, p_new_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  login_result jsonb;
  sa_id text;
  problem text;
BEGIN
  login_result := staff_login(p_username, p_old_password);
  IF NOT (login_result->>'ok')::boolean THEN
    RETURN login_result;            -- invalid / locked / reset_expired, same throttling as login
  END IF;
  sa_id := login_result->'account'->>'id';

  problem := staff__password_problem(p_new_password, login_result->'account'->>'username');
  IF problem IS NULL AND p_new_password = p_old_password THEN
    problem := 'Choose a new password that is different from your current one.';
  END IF;
  IF problem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'weak', 'message', problem);
  END IF;

  UPDATE staff_credentials
     SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
         must_reset = false, temp_expires_at = NULL,
         failed_attempts = 0, locked_until = NULL,
         password_changed_at = now(), updated_at = now()
   WHERE staff_id = sa_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- == Temporary passwords ======================================================
-- Internal: generate a random temporary password for a staff id and store its
-- hash with must_reset = true and a 24-hour expiry. Returns the plaintext once.
CREATE OR REPLACE FUNCTION staff__issue_temp(p_staff_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  bytes bytea := gen_random_bytes(14);
  temp text := '';
  i int;
BEGIN
  FOR i IN 0..13 LOOP
    temp := temp || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  END LOOP;
  temp := temp || 'a7';   -- guarantees a letter and a digit (policy: 10+ chars, letter + number)
  INSERT INTO staff_credentials (staff_id, password_hash, must_reset, temp_expires_at, password_changed_at)
  VALUES (p_staff_id, crypt(temp, gen_salt('bf', 10)), true, now() + interval '24 hours', now())
  ON CONFLICT (staff_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash, must_reset = true, temp_expires_at = EXCLUDED.temp_expires_at,
    failed_attempts = 0, locked_until = NULL, password_changed_at = now(), updated_at = now();
  RETURN temp;
END $$;
REVOKE EXECUTE ON FUNCTION staff__issue_temp(text) FROM PUBLIC, anon, authenticated;

-- Administrator-issued temporary password (run from the Supabase SQL editor only):
--   select staff_issue_temp_password('username');
CREATE OR REPLACE FUNCTION staff_issue_temp_password(p_username text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE sa_id text;
BEGIN
  SELECT id INTO sa_id FROM staff_accounts WHERE lower(username) = lower(trim(p_username)) LIMIT 1;
  IF sa_id IS NULL THEN RAISE EXCEPTION 'No staff account with username %', p_username; END IF;
  RETURN staff__issue_temp(sa_id);
END $$;

-- Only login and change-password are callable from the app; everything else is
-- internal or SQL-editor-only.
REVOKE EXECUTE ON FUNCTION staff_login(text, text)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_change_password(text, text, text)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_issue_temp_password(text)          FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_login(text, text)                  TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_change_password(text, text, text)  TO anon, authenticated;
