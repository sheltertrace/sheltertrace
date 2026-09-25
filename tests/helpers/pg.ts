// Shared PGlite (in-process Postgres + pgcrypto) helpers for migration tests.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const MIGRATIONS = {
  credentials: readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260925155410_staff_credentials_hardening.sql"), "utf8"),
  writeLockdown: readFileSync(path.resolve(__dirname, "../../supabase/migrations/20260925170000_staff_accounts_write_lockdown.sql"), "utf8"),
};

export async function newDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
  `);
  return db;
}

/** staff_accounts as production has it: schema.sql + the later ALTERs, with Supabase's default open grants. */
export async function resetStaffTables(db: PGlite): Promise<void> {
  await db.exec(`
    DROP TABLE IF EXISTS staff_admin_audit CASCADE;
    DROP TABLE IF EXISTS staff_credentials CASCADE;
    DROP TABLE IF EXISTS staff_accounts CASCADE;
    CREATE TABLE staff_accounts (
      id text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
      username text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      first_name text, last_name text, role text, email text, phone text, badge text,
      permissions jsonb DEFAULT '[]', active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      account_type text NOT NULL DEFAULT 'shelter',
      platform_customer_id text,
      is_super_admin boolean DEFAULT false,
      signature_data text,
      theme_preference text DEFAULT 'light',
      current_field_status text DEFAULT 'Off Duty',
      last_location_lat numeric, last_location_lng numeric,
      last_status_update timestamptz,
      tracking_active boolean DEFAULT false
    );
    GRANT ALL ON staff_accounts TO anon, authenticated;   -- as in production: wide open
  `);
}
