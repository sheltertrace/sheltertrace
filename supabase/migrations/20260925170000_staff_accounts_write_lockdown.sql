-- SECURITY HOTFIX (2 of 2): the public anon key could INSERT / UPDATE / DELETE
-- rows in staff_accounts, so anyone could make themselves an Administrator,
-- disable other people, or set a password they know on any account and sign in
-- as that person.
--
-- This removes every direct write path to staff_accounts for anon/authenticated
-- and replaces the legitimate ones with database functions that verify the
-- caller's PASSWORD on every call (same lockout as login):
--
--   staff_admin_create / _update / _delete / _reset_password
--        -> caller must be a manager (super admin, "all" permission, Administrator,
--           Clinic Admin, City Administrator), within their own organisation.
--   staff_update_profile / staff_set_signature
--        -> caller changes only their OWN name/email/phone or signature.
--
-- Still directly writable by anon (column-level grant, nothing that grants
-- access): theme_preference and the officer duty/GPS heartbeat columns. Those
-- columns become function-only in the full lockdown project.
--
-- There is no separate roles/permissions table in this schema: roles and
-- permissions are the `role`, `permissions` and `is_super_admin` columns of
-- staff_accounts, covered by the revoke below. staff_credentials was already
-- locked by 20260925155410.
--
-- Run AFTER 20260925155410_staff_credentials_hardening.sql, and only after the
-- matching app release is live (older builds write staff_accounts directly).

SET search_path = public, extensions;

-- == 1. Remove every direct write path ========================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE staff_accounts FROM PUBLIC, anon, authenticated;

-- Benign self-service columns that the officer app / theme switch still write.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['theme_preference','current_field_status','last_location_lat',
                             'last_location_lng','last_status_update','tracking_active'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'staff_accounts' AND column_name = col) THEN
      EXECUTE format('GRANT UPDATE (%I) ON TABLE staff_accounts TO anon, authenticated', col);
    END IF;
  END LOOP;
END $$;

-- == 2. Audit trail for account administration (locked; nobody reads it via the API)
CREATE TABLE IF NOT EXISTS staff_admin_audit (
  id         BIGSERIAL PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  target_id  TEXT,
  detail     JSONB
);
ALTER TABLE staff_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE staff_admin_audit FROM PUBLIC, anon, authenticated;

-- == 3. Internal helpers (not callable from the API) ==========================
-- Verify a caller's password. Returns {ok:true,id} on success, otherwise the
-- login result ({ok:false,error:'invalid'|'locked'|'reset_expired'|'reset_required'}).
CREATE OR REPLACE FUNCTION staff__actor(p_username text, p_password text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE r jsonb;
BEGIN
  r := staff_login(p_username, p_password);
  IF NOT (r->>'ok')::boolean THEN RETURN r; END IF;
  IF (r->>'must_reset')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reset_required');
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', r->'account'->>'id');
END $$;

-- Super admin, or holds the "all" permission, or one of the administrator roles.
CREATE OR REPLACE FUNCTION staff__is_manager(a staff_accounts) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT a.active IS NOT FALSE AND (
    coalesce(a.is_super_admin, false)
    OR coalesce(a.permissions, '[]'::jsonb) ? 'all'
    OR a.role IN ('Administrator', 'Clinic Admin', 'City Administrator'))
$$;

-- Can hand out "all" permission / the Administrator role.
CREATE OR REPLACE FUNCTION staff__is_full_admin(a staff_accounts) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT a.active IS NOT FALSE AND (
    coalesce(a.is_super_admin, false)
    OR coalesce(a.permissions, '[]'::jsonb) ? 'all'
    OR a.role = 'Administrator')
$$;

-- A manager may only touch accounts of their own organisation, and never a super admin.
CREATE OR REPLACE FUNCTION staff__in_scope(actor staff_accounts, target staff_accounts) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(actor.is_super_admin, false)
      OR ( coalesce(actor.account_type, 'shelter') = coalesce(target.account_type, 'shelter')
           AND actor.platform_customer_id IS NOT DISTINCT FROM target.platform_customer_id
           AND NOT coalesce(target.is_super_admin, false) )
$$;

REVOKE EXECUTE ON FUNCTION staff__actor(text, text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION staff__is_manager(staff_accounts)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION staff__is_full_admin(staff_accounts)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION staff__in_scope(staff_accounts, staff_accounts) FROM PUBLIC, anon, authenticated;

-- == 4. Administration functions ==============================================
CREATE OR REPLACE FUNCTION staff_admin_create(p_admin_username text, p_admin_password text, p_user jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  actor staff_accounts; err jsonb;
  allowed_keys text[] := ARRAY['username','first_name','last_name','role','email','phone','badge','permissions'];
  clean jsonb;
  uname text; new_id text; nr staff_accounts; temp text; perms jsonb;
BEGIN
  err := staff__actor(p_admin_username, p_admin_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  IF NOT staff__is_manager(actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;

  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO clean
    FROM jsonb_each(coalesce(p_user, '{}'::jsonb)) AS t(k, v) WHERE k = ANY (allowed_keys);

  uname := trim(coalesce(clean->>'username', ''));
  IF uname = '' OR length(uname) > 60 OR trim(coalesce(clean->>'first_name','')) = ''
     OR trim(coalesce(clean->>'last_name','')) = '' OR trim(coalesce(clean->>'role','')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF EXISTS (SELECT 1 FROM staff_accounts WHERE lower(username) = lower(uname)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'username_taken');
  END IF;

  perms := coalesce(clean->'permissions', '[]'::jsonb);
  IF jsonb_typeof(perms) <> 'array' THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_input'); END IF;
  IF NOT staff__is_full_admin(actor) AND (perms ? 'all' OR clean->>'role' = 'Administrator') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  new_id := replace(gen_random_uuid()::text, '-', '');
  clean := clean || jsonb_build_object(
    'id', new_id, 'username', uname, 'permissions', perms, 'active', true, 'created_at', now(),
    'is_super_admin', false,
    'account_type', coalesce(actor.account_type, 'shelter'),
    'platform_customer_id', to_jsonb(actor.platform_customer_id));
  IF coalesce(actor.is_super_admin, false) THEN
    -- Super admins choose the organisation (and may create other super admins).
    clean := clean
      || jsonb_build_object('account_type', coalesce(nullif(p_user->>'account_type', ''), 'shelter'))
      || jsonb_build_object('platform_customer_id', to_jsonb(nullif(p_user->>'platform_customer_id', '')))
      || jsonb_build_object('is_super_admin', coalesce((p_user->>'is_super_admin')::boolean, false));
  END IF;

  nr := jsonb_populate_record(NULL::staff_accounts, clean);
  -- explicit columns: anything else keeps its table default
  INSERT INTO staff_accounts (id, username, first_name, last_name, role, email, phone, badge,
                              permissions, active, account_type, platform_customer_id, is_super_admin)
  VALUES (nr.id, nr.username, trim(nr.first_name), trim(nr.last_name), trim(nr.role),
          nullif(trim(coalesce(nr.email, '')), ''), nullif(trim(coalesce(nr.phone, '')), ''),
          nullif(trim(coalesce(nr.badge, '')), ''), nr.permissions, true, nr.account_type,
          nr.platform_customer_id, coalesce(nr.is_super_admin, false));
  temp := staff__issue_temp(new_id);

  INSERT INTO staff_admin_audit (actor_id, action, target_id, detail)
  VALUES (actor.id, 'create', new_id, jsonb_build_object('username', uname, 'role', clean->>'role'));

  RETURN jsonb_build_object('ok', true, 'temp_password', temp,
           'account', (SELECT to_jsonb(s) - 'password_hash' FROM staff_accounts s WHERE s.id = new_id));
END $$;

CREATE OR REPLACE FUNCTION staff_admin_update(p_admin_username text, p_admin_password text, p_target_id text, p_updates jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE
  actor staff_accounts; err jsonb; tgt staff_accounts; nr staff_accounts;
  allowed_keys text[] := ARRAY['username','first_name','last_name','role','email','phone','badge','permissions','active'];
  clean jsonb; uname text;
BEGIN
  err := staff__actor(p_admin_username, p_admin_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  IF NOT staff__is_manager(actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;

  SELECT * INTO tgt FROM staff_accounts WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT staff__in_scope(actor, tgt) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;

  IF coalesce(actor.is_super_admin, false) THEN
    allowed_keys := allowed_keys || ARRAY['account_type','platform_customer_id','is_super_admin'];
  END IF;
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO clean
    FROM jsonb_each(coalesce(p_updates, '{}'::jsonb)) AS t(k, v) WHERE k = ANY (allowed_keys);
  -- empty strings mean "clear" for the optional columns
  IF clean ? 'platform_customer_id' AND clean->>'platform_customer_id' = '' THEN
    clean := jsonb_set(clean, '{platform_customer_id}', 'null'::jsonb);
  END IF;

  nr := jsonb_populate_record(tgt, clean);

  IF clean ? 'username' THEN
    uname := trim(coalesce(nr.username, ''));
    IF uname = '' OR length(uname) > 60 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_input'); END IF;
    IF EXISTS (SELECT 1 FROM staff_accounts WHERE lower(username) = lower(uname) AND id <> tgt.id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'username_taken');
    END IF;
    nr.username := uname;
  END IF;
  IF trim(coalesce(nr.first_name, '')) = '' OR trim(coalesce(nr.last_name, '')) = '' OR trim(coalesce(nr.role, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF jsonb_typeof(coalesce(nr.permissions, '[]'::jsonb)) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  IF NOT staff__is_full_admin(actor) AND
     ((coalesce(nr.permissions, '[]'::jsonb) ? 'all' AND NOT (coalesce(tgt.permissions, '[]'::jsonb) ? 'all'))
      OR (nr.role = 'Administrator' AND tgt.role IS DISTINCT FROM 'Administrator')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Nobody changes their own privileges or status here (prevents self-escalation and self-lockout).
  IF tgt.id = actor.id AND (
       nr.role IS DISTINCT FROM tgt.role OR nr.permissions IS DISTINCT FROM tgt.permissions
    OR nr.active IS DISTINCT FROM tgt.active OR nr.is_super_admin IS DISTINCT FROM tgt.is_super_admin
    OR nr.account_type IS DISTINCT FROM tgt.account_type
    OR nr.platform_customer_id IS DISTINCT FROM tgt.platform_customer_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self');
  END IF;

  UPDATE staff_accounts SET
    username = nr.username, first_name = nr.first_name, last_name = nr.last_name, role = nr.role,
    email = nullif(trim(coalesce(nr.email, '')), ''), phone = nullif(trim(coalesce(nr.phone, '')), ''),
    badge = nullif(trim(coalesce(nr.badge, '')), ''), permissions = coalesce(nr.permissions, '[]'::jsonb),
    active = nr.active, account_type = nr.account_type,
    platform_customer_id = nr.platform_customer_id, is_super_admin = nr.is_super_admin
  WHERE id = tgt.id;

  INSERT INTO staff_admin_audit (actor_id, action, target_id, detail)
  VALUES (actor.id, 'update', tgt.id, jsonb_build_object('fields', (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(clean) k)));

  RETURN jsonb_build_object('ok', true,
           'account', (SELECT to_jsonb(s) - 'password_hash' FROM staff_accounts s WHERE s.id = tgt.id));
END $$;

CREATE OR REPLACE FUNCTION staff_admin_delete(p_admin_username text, p_admin_password text, p_target_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE actor staff_accounts; err jsonb; tgt staff_accounts;
BEGIN
  err := staff__actor(p_admin_username, p_admin_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  IF NOT staff__is_manager(actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  SELECT * INTO tgt FROM staff_accounts WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT staff__in_scope(actor, tgt) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF tgt.id = actor.id THEN RETURN jsonb_build_object('ok', false, 'error', 'self'); END IF;

  DELETE FROM staff_accounts WHERE id = tgt.id;
  INSERT INTO staff_admin_audit (actor_id, action, target_id, detail)
  VALUES (actor.id, 'delete', tgt.id, jsonb_build_object('username', tgt.username, 'role', tgt.role));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Issues a new 24-hour temporary password for someone else; they must choose their own at next sign-in.
CREATE OR REPLACE FUNCTION staff_admin_reset_password(p_admin_username text, p_admin_password text, p_target_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE actor staff_accounts; err jsonb; tgt staff_accounts; temp text;
BEGIN
  err := staff__actor(p_admin_username, p_admin_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  IF NOT staff__is_manager(actor) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  SELECT * INTO tgt FROM staff_accounts WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF NOT staff__in_scope(actor, tgt) THEN RETURN jsonb_build_object('ok', false, 'error', 'forbidden'); END IF;
  IF tgt.id = actor.id THEN RETURN jsonb_build_object('ok', false, 'error', 'self'); END IF;

  temp := staff__issue_temp(tgt.id);
  INSERT INTO staff_admin_audit (actor_id, action, target_id, detail)
  VALUES (actor.id, 'reset_password', tgt.id, jsonb_build_object('username', tgt.username));
  RETURN jsonb_build_object('ok', true, 'temp_password', temp);
END $$;

-- == 5. Self-service functions ================================================
CREATE OR REPLACE FUNCTION staff_update_profile(p_username text, p_password text, p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE actor staff_accounts; err jsonb; f jsonb;
BEGIN
  err := staff__actor(p_username, p_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO f
    FROM jsonb_each(coalesce(p_fields, '{}'::jsonb)) AS t(k, v)
   WHERE k IN ('first_name', 'last_name', 'email', 'phone');
  IF (f ? 'first_name' AND trim(coalesce(f->>'first_name', '')) = '')
     OR (f ? 'last_name' AND trim(coalesce(f->>'last_name', '')) = '')
     OR length(f::text) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  UPDATE staff_accounts SET
    first_name = CASE WHEN f ? 'first_name' THEN trim(f->>'first_name') ELSE first_name END,
    last_name  = CASE WHEN f ? 'last_name'  THEN trim(f->>'last_name')  ELSE last_name  END,
    email      = CASE WHEN f ? 'email'      THEN nullif(trim(f->>'email'), '') ELSE email END,
    phone      = CASE WHEN f ? 'phone'      THEN nullif(trim(f->>'phone'), '') ELSE phone END
  WHERE id = actor.id;
  RETURN jsonb_build_object('ok', true,
           'account', (SELECT to_jsonb(s) - 'password_hash' FROM staff_accounts s WHERE s.id = actor.id));
END $$;

-- The vet signature is used on rabies certificates, so it is only ever changed by its owner, with their password.
CREATE OR REPLACE FUNCTION staff_set_signature(p_username text, p_password text, p_data text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE actor staff_accounts; err jsonb;
BEGIN
  err := staff__actor(p_username, p_password);
  IF NOT (err->>'ok')::boolean THEN RETURN err; END IF;
  SELECT * INTO actor FROM staff_accounts WHERE id = err->>'id';
  IF coalesce(p_data, '') <> '' AND (p_data !~ '^data:image/(png|jpeg);base64,' OR length(p_data) > 700000) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  UPDATE staff_accounts SET signature_data = nullif(coalesce(p_data, ''), '') WHERE id = actor.id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- == 6. Grants: only the entry points are callable ============================
REVOKE EXECUTE ON FUNCTION staff_admin_create(text, text, jsonb)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_update(text, text, text, jsonb)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_delete(text, text, text)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_admin_reset_password(text, text, text)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_update_profile(text, text, jsonb)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION staff_set_signature(text, text, text)          FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION staff_admin_create(text, text, jsonb)          TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_admin_update(text, text, text, jsonb)    TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_admin_delete(text, text, text)           TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_admin_reset_password(text, text, text)   TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_update_profile(text, text, jsonb)        TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION staff_set_signature(text, text, text)          TO anon, authenticated;
