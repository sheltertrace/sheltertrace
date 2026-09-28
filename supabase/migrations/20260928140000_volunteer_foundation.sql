-- VOLUNTEER PWA — Phase 1 foundation: data model only. No RPCs, no public
-- entry points yet (those come with their own phases/migrations, tested and
-- reviewed the same way the security hotfix was). Every table below is
-- created the same way staff_credentials was: RLS on, no policies, REVOKE ALL
-- FROM anon/authenticated. Nothing here is reachable by the browser today —
-- reachability is added deliberately, phase by phase, not by this file.
--
-- Org model: this app already has an organization concept (platform_customers,
-- used today for clinic/city tenants). Rather than invent a parallel table,
-- animals.organization_id points at the SAME table. The one existing
-- account_type='shelter' row ("Morgan County Animal Services") is used for the
-- backfill below — nothing here hardcodes MCAS by name or literal id.
--
-- Naming note: staff_accounts already has an unrelated role literally called
-- "Volunteer" (paid/regular staff whose job title is Volunteer Coordinator
-- support, etc.) and a separate `volunteer_sessions` kiosk-hours table. The
-- `volunteers` table below is a DIFFERENT identity entirely — community
-- members who sign in with an emailed code, never a staff_accounts row.
-- `volunteer_login_sessions` (this file) is likewise distinct from the
-- existing `volunteer_sessions` table — do not confuse the two.

SET search_path = public, extensions;

-- == animals: organization scoping + volunteer gating =========================
ALTER TABLE animals ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES platform_customers(id);
ALTER TABLE animals ADD COLUMN IF NOT EXISTS volunteer_level_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS volunteer_notes TEXT;
CREATE INDEX IF NOT EXISTS idx_animals_organization_id ON animals(organization_id);

DO $$
DECLARE shelter_org_count int;
BEGIN
  SELECT count(*) INTO shelter_org_count FROM platform_customers WHERE account_type = 'shelter';
  IF shelter_org_count <> 1 THEN
    RAISE WARNING 'Expected exactly one account_type=shelter platform_customers row for the animals.organization_id backfill, found %. Backfill applied to the earliest one; review manually if this is wrong.', shelter_org_count;
  END IF;
  UPDATE animals SET organization_id = (
    SELECT id FROM platform_customers WHERE account_type = 'shelter' ORDER BY created_at LIMIT 1
  ) WHERE organization_id IS NULL;
END $$;

-- organization_id stays nullable here: it becomes NOT NULL once every insert
-- path (intake wizard, transfers-in, etc.) sets it — tracked in the lockdown
-- scope, not this migration.

-- == manage_volunteers: backfill onto existing accounts that should have it ===
-- New accounts already get this for free: permsForRole('Administrator') already
-- returns ["all"], which satisfies any manage_volunteers check via the wildcard
-- (see hasPermission()). This only needs to reach EXISTING accounts that predate
-- that convention or whose title is Volunteer Coordinator without already
-- holding 'all'. Checked the live account list before writing this (2026-09-28):
-- both existing Administrator-role accounts already hold "all"; the only real
-- gap was a Volunteer-Coordinator-titled account without it. Matches by
-- substring, not exact string, because the real role text is a compound title
-- ("Auxiliary Officer / Volunteer Coordinator"), not the literal words
-- "Volunteer Coordinator" alone.
UPDATE staff_accounts
   SET permissions = permissions || '["manage_volunteers"]'::jsonb
 WHERE NOT (coalesce(permissions, '[]'::jsonb) ? 'manage_volunteers')
   AND NOT (coalesce(permissions, '[]'::jsonb) ? 'all')
   AND role ILIKE '%volunteer coordinator%';

-- == Per-organization volunteer program settings ==============================
CREATE TABLE IF NOT EXISTS volunteer_settings (
  organization_id                      uuid PRIMARY KEY REFERENCES platform_customers(id),
  geofence_lat                         NUMERIC(10, 7),
  geofence_lng                         NUMERIC(10, 7),
  geofence_radius_meters               INTEGER NOT NULL DEFAULT 200,
  min_age                              INTEGER NOT NULL DEFAULT 16,
  require_guardian_signature_under_age INTEGER NOT NULL DEFAULT 18,
  auto_close_shift_after_hours         NUMERIC NOT NULL DEFAULT 8,
  config                               JSONB NOT NULL DEFAULT '{}'::jsonb,   -- room for future settings without another migration
  updated_at                           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- == Volunteers (community members — NOT staff_accounts) ======================
CREATE TABLE IF NOT EXISTS volunteers (
  id              TEXT PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
  organization_id UUID NOT NULL REFERENCES platform_customers(id),
  email           TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  phone           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'rejected')),
  handling_level  INTEGER NOT NULL DEFAULT 1,
  volunteer_since DATE,
  staff_notes     TEXT,   -- internal only; never shown to the volunteer
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS idx_volunteers_org_status ON volunteers(organization_id, status);

-- Org-defined handling levels (e.g. 1=New, 2=Trained, 3=Advanced) that
-- animals.volunteer_level_required and volunteers.handling_level both point at.
CREATE TABLE IF NOT EXISTS volunteer_handling_levels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES platform_customers(id),
  level           INTEGER NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  UNIQUE (organization_id, level)
);

CREATE TABLE IF NOT EXISTS volunteer_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES platform_customers(id),
  name            TEXT NOT NULL,
  description     TEXT,
  active          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS volunteer_onboarding_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  step          TEXT NOT NULL,   -- 'application' | 'orientation' | 'waiver' | 'shadow_shift' | ...
  completed_at  TIMESTAMPTZ,
  completed_by  TEXT REFERENCES staff_accounts(id),
  notes         TEXT,
  UNIQUE (volunteer_id, step)
);

-- == Waivers — immutable once signed ===========================================
CREATE TABLE IF NOT EXISTS waiver_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES platform_customers(id),
  version_label   TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT REFERENCES staff_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No UPDATE/DELETE grant is given to anyone (not even staff) below — a signed
-- waiver is a legal record and must never be editable after the fact. A
-- correction means signing a new version, not changing this row.
CREATE TABLE IF NOT EXISTS waiver_signatures (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id             TEXT NOT NULL REFERENCES volunteers(id),
  waiver_version_id        UUID NOT NULL REFERENCES waiver_versions(id),
  signed_name              TEXT NOT NULL,
  signature_data           TEXT NOT NULL,
  guardian_name            TEXT,             -- set when the volunteer is a minor
  guardian_signature_data  TEXT,
  signed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address               TEXT
);

-- == Hours ledger ===============================================================
-- source='app' is a real clock-in from the volunteer's own session; source='kiosk'
-- is imported from the legacy volunteer_sessions kiosk table by staff. Either way,
-- `verified` (not `source`) is what makes a shift count toward a court/school
-- letter — matches the approved decision that even app-originated hours are
-- staff-approved, not auto-trusted.
CREATE TABLE IF NOT EXISTS volunteer_shifts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id      TEXT NOT NULL REFERENCES volunteers(id),
  organization_id   UUID NOT NULL REFERENCES platform_customers(id),
  clock_in          TIMESTAMPTZ NOT NULL,
  clock_out         TIMESTAMPTZ,
  duration_minutes  INTEGER GENERATED ALWAYS AS (
                       CASE WHEN clock_out IS NOT NULL
                            THEN round(extract(epoch FROM (clock_out - clock_in)) / 60)::int
                            ELSE NULL END
                     ) STORED,
  source            TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'kiosk')),
  verified          BOOLEAN NOT NULL DEFAULT false,
  verified_by       TEXT REFERENCES staff_accounts(id),
  verified_at       TIMESTAMPTZ,
  clock_in_lat      NUMERIC(10, 7),
  clock_in_lng      NUMERIC(10, 7),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_volunteer ON volunteer_shifts(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_shifts_open ON volunteer_shifts(volunteer_id) WHERE clock_out IS NULL;

-- == Animal activity logging (Phase 4 UI; schema laid down now since the
-- other Phase-1..3 tables already reference the volunteer/shift shape) =========
CREATE TABLE IF NOT EXISTS animal_volunteer_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     TEXT NOT NULL REFERENCES animals(id),
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id),
  shift_id      UUID REFERENCES volunteer_shifts(id),
  activity_type TEXT NOT NULL,
  notes         TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_animal_volunteer_activities_animal ON animal_volunteer_activities(animal_id);

CREATE TABLE IF NOT EXISTS animal_volunteer_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     TEXT NOT NULL REFERENCES animals(id),
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id),
  activity_id   UUID REFERENCES animal_volunteer_activities(id),
  photo_url     TEXT NOT NULL,
  caption       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- == Volunteer login (server-side only — see lib/volunteerAuth.ts once it ships)
-- Codes and sessions are written/read exclusively by Next.js server routes
-- using the service-role key (which bypasses these grants entirely). The
-- browser never gets a Supabase client for any of this, so there is no RPC to
-- grant here at all — unlike staff_login, which anon must be able to call.
CREATE TABLE IF NOT EXISTS volunteer_login_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  salt        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  request_ip  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_volunteer_login_codes_email ON volunteer_login_codes(email, created_at DESC);

CREATE TABLE IF NOT EXISTS volunteer_login_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id  TEXT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

-- == Lock every table above ====================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'volunteer_settings', 'volunteers', 'volunteer_handling_levels', 'volunteer_programs',
    'volunteer_onboarding_progress', 'waiver_versions', 'waiver_signatures', 'volunteer_shifts',
    'animal_volunteer_activities', 'animal_volunteer_photos',
    'volunteer_login_codes', 'volunteer_login_sessions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
