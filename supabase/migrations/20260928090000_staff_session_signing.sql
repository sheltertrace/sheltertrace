-- SECURITY FIX (narrow — see the note below): staff identity (role,
-- permissions, is_super_admin) was read straight out of a client-writable
-- sessionStorage object, with zero server verification. Concretely:
--   - the Super Admin portal (cross-tenant customers, billing, audit log)
--     gates only on that object's is_super_admin field
--   - /admin has no role check of its own at all
--   - court-packet rendering/email trust a client-supplied x-staff-id header,
--     checked only for "does an active row with this id exist" — and staff
--     ids are readable via plain SELECT on staff_accounts, so that header was
--     not an authentication mechanism
-- Anyone could open dev tools, write an Administrator/super-admin object into
-- sessionStorage, and reload, to reach any of the above.
--
-- WHAT THIS DOES NOT FIX: anon still has full read/write on almost every other
-- table (citations, animals, platform_customers, medical_records, ...). That
-- is the table-by-table RLS lockdown, a separate and much larger project. This
-- migration only closes "the app's own UI can be tricked into trusting a
-- forged identity" — it does nothing for someone who skips the UI entirely
-- and calls Supabase directly with the anon key, because those tables do not
-- check any session, signed or not. Do not read this as "the app is secure."
--
-- MECHANISM: staff_login() now also returns a signed session token
-- (HMAC-SHA256 over staff_id|issued_at|expires_at, keyed by a secret in a
-- locked table anon cannot read). staff_verify_session() checks the signature
-- and expiry, then re-reads the CURRENT staff_accounts row — so a deactivated
-- account, or a role/permission change, takes effect on the very next
-- verification, not after the token's full life. The token is 8 hours and is
-- NOT stored server-side, so it cannot be revoked early; logout only clears it
-- client-side. That is an accepted limit of this narrow fix — real early
-- revocation needs a stored session, which is part of the fuller lockdown.
--
-- ORDER OF OPERATIONS: deploy the app code first, then run this file. Unlike
-- the very first hotfix (where old code compared passwords against a column
-- this kind of migration blanks, so running the migration first locked
-- everyone out), the new client code here has a fallback for
-- staff_verify_session() not existing yet, identical in shape to the fallback
-- already shipped for staff_login() — so old-code-new-db and new-code-old-db
-- are BOTH safe, and nothing about existing logins changes until this file
-- actually runs. Deploy-then-migrate is still the recommended order, for
-- consistency with the other two migrations and because it means nothing
-- changes for anyone until you run this.
--
-- ONE VISIBLE SIDE EFFECT once this is live: anyone whose session was created
-- by the OLD client code (no token in sessionStorage) will be signed out on
-- their next reload and asked to log in again — sessions here are per-tab
-- sessionStorage, not long-lived, so this is a one-time "please sign in
-- again," not a lockout. Logging back in works immediately.

SET search_path = public, extensions;

-- == Locked signing secret ====================================================
CREATE TABLE IF NOT EXISTS staff_session_secret (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),   -- singleton row
  secret     BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE staff_session_secret ENABLE ROW LEVEL SECURITY;   -- and deliberately NO policies
REVOKE ALL ON TABLE staff_session_secret FROM PUBLIC, anon, authenticated;

INSERT INTO staff_session_secret (id, secret)
SELECT true, gen_random_bytes(32)
WHERE NOT EXISTS (SELECT 1 FROM staff_session_secret);

CREATE OR REPLACE FUNCTION staff__session_secret() RETURNS bytea
LANGUAGE sql STABLE SET search_path = public, extensions, pg_temp AS $$
  SELECT secret FROM staff_session_secret WHERE id = true
$$;
REVOKE EXECUTE ON FUNCTION staff__session_secret() FROM PUBLIC, anon, authenticated;

-- == Mint a signed token: staff_id|issued_at|expires_at, HMAC-SHA256 ==========
CREATE OR REPLACE FUNCTION staff__issue_session(p_staff_id text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public, extensions, pg_temp AS $$
DECLARE
  issued  bigint := extract(epoch FROM now())::bigint;
  expires bigint := issued + 8 * 3600;   -- 8 hours; no server-side revocation before this
  payload bytea  := convert_to(p_staff_id || '|' || issued || '|' || expires, 'UTF8');
BEGIN
  RETURN encode(payload, 'base64') || '.' || encode(hmac(payload, staff__session_secret(), 'sha256'), 'hex');
END $$;
REVOKE EXECUTE ON FUNCTION staff__issue_session(text) FROM PUBLIC, anon, authenticated;

-- == staff_login: unchanged behavior, plus a session token on a real login ====
-- A must_reset login (temporary password) gets no token — the client never
-- starts a session in that case, it goes straight to the change-password step.
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
    IF c.must_reset AND c.temp_expires_at IS NOT NULL AND c.temp_expires_at < now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reset_expired');
    END IF;
    UPDATE staff_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE staff_id = sa.id;
    RETURN jsonb_build_object('ok', true, 'must_reset', c.must_reset,
             'account', to_jsonb(sa) - 'password_hash',
             'session_token', CASE WHEN c.must_reset THEN NULL ELSE staff__issue_session(sa.id) END);
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

-- == staff_verify_session: the single source of truth for identity from here on
-- Returns {ok:true, account:{...current staff row minus password_hash}} or
-- {ok:false, error:'invalid'|'expired'}. Re-reads staff_accounts fresh on every
-- call — nothing about role/permissions/active is trusted from the token.
CREATE OR REPLACE FUNCTION staff_verify_session(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  payload_b64 text;
  mac_hex     text;
  payload     bytea;
  expected    text;
  parts       text[];
  staff_id    text;
  expires     bigint;
  sa staff_accounts%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9+/=]+\.[0-9a-f]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  payload_b64 := split_part(p_token, '.', 1);
  mac_hex     := split_part(p_token, '.', 2);

  BEGIN
    payload := decode(payload_b64, 'base64');
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END;

  expected := encode(hmac(payload, staff__session_secret(), 'sha256'), 'hex');
  IF mac_hex IS DISTINCT FROM expected THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  parts := string_to_array(convert_from(payload, 'UTF8'), '|');
  IF array_length(parts, 1) <> 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;
  staff_id := parts[1];
  expires  := parts[3]::bigint;

  IF extract(epoch FROM now())::bigint > expires THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO sa FROM staff_accounts WHERE id = staff_id;
  IF NOT FOUND OR sa.active IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid');
  END IF;

  RETURN jsonb_build_object('ok', true, 'account', to_jsonb(sa) - 'password_hash');
END $$;

REVOKE EXECUTE ON FUNCTION staff_verify_session(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION staff_verify_session(text) TO anon, authenticated;
