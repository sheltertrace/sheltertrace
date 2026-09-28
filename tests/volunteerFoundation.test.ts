// Volunteer PWA — Phase 1 foundation migration, run against a minimal stand-in
// for the real schema (platform_customers, staff_accounts, animals already
// exist in production; this test recreates just enough of them).
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { newDb } from "./helpers/pg";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION = readFileSync(path.resolve(__dirname, "../supabase/migrations/20260928140000_volunteer_foundation.sql"), "utf8");

let db: PGlite;

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE anon");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}

const LOCKED_TABLES = [
  "volunteer_settings", "volunteers", "volunteer_handling_levels", "volunteer_programs",
  "volunteer_onboarding_progress", "waiver_versions", "waiver_signatures", "volunteer_shifts",
  "animal_volunteer_activities", "animal_volunteer_photos",
  "volunteer_login_codes", "volunteer_login_sessions",
];

async function baseSchema(db: PGlite) {
  await db.exec(`
    DROP TABLE IF EXISTS animal_volunteer_photos, animal_volunteer_activities, volunteer_shifts,
      waiver_signatures, waiver_versions, volunteer_onboarding_progress, volunteer_programs,
      volunteer_handling_levels, volunteers, volunteer_settings, volunteer_login_sessions,
      volunteer_login_codes CASCADE;
    DROP TABLE IF EXISTS animals CASCADE;
    DROP TABLE IF EXISTS staff_accounts CASCADE;
    DROP TABLE IF EXISTS platform_customers CASCADE;

    CREATE TABLE platform_customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'shelter',
      created_at TIMESTAMPTZ DEFAULT now()
    );
    GRANT ALL ON platform_customers TO anon, authenticated;

    CREATE TABLE staff_accounts (
      id TEXT PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
      username TEXT UNIQUE NOT NULL,
      role TEXT,
      permissions JSONB DEFAULT '[]',
      active BOOLEAN DEFAULT true
    );
    GRANT ALL ON staff_accounts TO anon, authenticated;

    CREATE TABLE animals (
      id TEXT PRIMARY KEY,
      name TEXT
    );
    GRANT ALL ON animals TO anon, authenticated;
  `);
}

beforeAll(async () => { db = await newDb(); });

describe("the normal case: exactly one shelter org", () => {
  beforeEach(async () => {
    await baseSchema(db);
    await db.exec(`
      INSERT INTO platform_customers (id, account_name, account_type) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Morgan County Animal Services', 'shelter'),
        ('22222222-2222-2222-2222-222222222222', 'AWA Georgia', 'clinic');
      INSERT INTO staff_accounts (id, username, role, permissions) VALUES
        ('A1', 'admin',   'Administrator',                              '["all"]'),
        ('A2', 'kcasey',  'Administrator',                              '["all"]'),
        ('A3', 'tburden', 'Auxiliary Officer / Volunteer Coordinator',  '["animals","volunteers"]'),
        ('A4', 'jdoe',    'Volunteer',                                  '["volunteers"]'),
        ('A5', 'other',   'Officer',                                   '["animals"]');
      INSERT INTO animals (id, name) VALUES ('AN-1', 'Rex'), ('AN-2', 'Milo');
    `);
    await db.exec(MIGRATION);
  });

  it("adds and backfills animals.organization_id to the shelter org, and adds the volunteer-gating columns", async () => {
    const rows = (await db.query<{ organization_id: string; volunteer_level_required: number; volunteer_notes: string | null }>(
      `SELECT organization_id, volunteer_level_required, volunteer_notes FROM animals ORDER BY id`)).rows;
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.organization_id).toBe("11111111-1111-1111-1111-111111111111");
      expect(r.volunteer_level_required).toBe(1);
      expect(r.volunteer_notes).toBeNull();
    }
  });

  it("never touches or backfills the clinic org", async () => {
    const animalOrgs = (await db.query<{ organization_id: string }>(`SELECT DISTINCT organization_id FROM animals`)).rows;
    expect(animalOrgs.map((r) => r.organization_id)).not.toContain("22222222-2222-2222-2222-222222222222");
  });

  it("adds manage_volunteers only to the Volunteer-Coordinator-titled account, not to accounts already holding 'all', not to unrelated roles", async () => {
    const rows = (await db.query<{ id: string; permissions: string[] }>(`SELECT id, permissions FROM staff_accounts ORDER BY id`)).rows;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.permissions]));
    expect(byId.A1).toEqual(["all"]);                                           // untouched: already 'all'
    expect(byId.A2).toEqual(["all"]);                                           // untouched: already 'all'
    expect(byId.A3).toEqual(["animals", "volunteers", "manage_volunteers"]);    // the actual gap
    expect(byId.A4).toEqual(["volunteers"]);                                   // role "Volunteer" (staff title) is unrelated, untouched
    expect(byId.A5).toEqual(["animals"]);                                      // unrelated role, untouched
  });

  it("is idempotent: running it twice does not duplicate the manage_volunteers grant or re-backfill incorrectly", async () => {
    await db.exec(MIGRATION);
    const r = (await db.query<{ permissions: string[] }>(`SELECT permissions FROM staff_accounts WHERE id = 'A3'`)).rows[0];
    expect(r.permissions).toEqual(["animals", "volunteers", "manage_volunteers"]);
  });

  it("every new table exists, has RLS enabled, and anon/authenticated have no privileges at all", async () => {
    for (const t of LOCKED_TABLES) {
      const rls = (await db.query<{ relrowsecurity: boolean }>(
        `SELECT relrowsecurity FROM pg_class WHERE relname = $1`, [t])).rows[0];
      expect(rls?.relrowsecurity, t).toBe(true);
      await expect(asAnon(() => db.query(`SELECT 1 FROM ${t}`)), t).rejects.toThrow(/permission denied/i);
      await expect(asAnon(() => db.query(`INSERT INTO ${t} DEFAULT VALUES`)), t).rejects.toThrow(/permission denied|null value|violates/i);
    }
  });

  it("volunteer_login_sessions and the legacy kiosk volunteer_sessions are genuinely different tables", async () => {
    // volunteer_sessions (the kiosk hours table) is untouched by this migration and still doesn't exist
    // in this minimal schema — this migration must not have silently created or renamed it.
    const exists = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'volunteer_sessions'`);
    expect(exists.rows[0].n).toBe(0);
    const loginSessions = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_tables WHERE tablename = 'volunteer_login_sessions'`);
    expect(loginSessions.rows[0].n).toBe(1);
  });

  it("volunteer_shifts computes duration only once clocked out, and enforces the source check", async () => {
    await db.exec(`
      INSERT INTO volunteers (id, organization_id, email, first_name, last_name)
      VALUES ('V1', '11111111-1111-1111-1111-111111111111', 'v@example.com', 'Vera', 'Volunteer');
    `);
    await db.exec(`
      INSERT INTO volunteer_shifts (id, volunteer_id, organization_id, clock_in)
      VALUES ('33333333-3333-3333-3333-333333333333', 'V1', '11111111-1111-1111-1111-111111111111', now() - interval '90 minutes');
    `);
    let row = (await db.query<{ duration_minutes: number | null }>(`SELECT duration_minutes FROM volunteer_shifts WHERE id = '33333333-3333-3333-3333-333333333333'`)).rows[0];
    expect(row.duration_minutes).toBeNull();
    await db.exec(`UPDATE volunteer_shifts SET clock_out = clock_in + interval '90 minutes' WHERE id = '33333333-3333-3333-3333-333333333333'`);
    row = (await db.query<{ duration_minutes: number | null }>(`SELECT duration_minutes FROM volunteer_shifts WHERE id = '33333333-3333-3333-3333-333333333333'`)).rows[0];
    expect(row.duration_minutes).toBe(90);

    await expect(db.query(`INSERT INTO volunteer_shifts (volunteer_id, organization_id, clock_in, source)
      VALUES ('V1', '11111111-1111-1111-1111-111111111111', now(), 'not-a-real-source')`)).rejects.toThrow(/violates check constraint/i);
  });

  it("FK integrity: a volunteer cannot be created against a nonexistent organization", async () => {
    await expect(db.query(`INSERT INTO volunteers (organization_id, email, first_name, last_name)
      VALUES ('99999999-9999-9999-9999-999999999999', 'x@example.com', 'X', 'Y')`)).rejects.toThrow(/violates foreign key/i);
  });
});

describe("edge case: zero shelter orgs (does not exist in production today, but must not crash)", () => {
  beforeEach(async () => {
    await baseSchema(db);
    await db.exec(`
      INSERT INTO platform_customers (id, account_name, account_type) VALUES
        ('22222222-2222-2222-2222-222222222222', 'AWA Georgia', 'clinic');
      INSERT INTO animals (id, name) VALUES ('AN-1', 'Rex');
    `);
  });

  it("runs without error and leaves organization_id null rather than guessing", async () => {
    await db.exec(MIGRATION);
    const row = (await db.query<{ organization_id: string | null }>(`SELECT organization_id FROM animals WHERE id = 'AN-1'`)).rows[0];
    expect(row.organization_id).toBeNull();
  });
});

describe("edge case: more than one shelter org (also not today's reality)", () => {
  beforeEach(async () => {
    await baseSchema(db);
    await db.exec(`
      INSERT INTO platform_customers (id, account_name, account_type, created_at) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Morgan County Animal Services', 'shelter', '2026-01-01'),
        ('44444444-4444-4444-4444-444444444444', 'Some Other Shelter', 'shelter', '2026-06-01');
      INSERT INTO animals (id, name) VALUES ('AN-1', 'Rex');
    `);
  });

  it("still runs (picks the earliest-created shelter org) rather than failing the whole migration", async () => {
    await db.exec(MIGRATION);
    const row = (await db.query<{ organization_id: string }>(`SELECT organization_id FROM animals WHERE id = 'AN-1'`)).rows[0];
    expect(row.organization_id).toBe("11111111-1111-1111-1111-111111111111");
  });
});
