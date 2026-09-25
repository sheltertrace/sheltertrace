// Runs the REAL hotfix migration against an in-process Postgres (PGlite + pgcrypto)
// and exercises it the way the browser does: as the `anon` role.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION = readFileSync(
  path.resolve(__dirname, "../supabase/migrations/20260925155410_staff_credentials_hardening.sql"),
  "utf8",
);

let db: PGlite;

type LoginResult = {
  ok: boolean; error?: string; must_reset?: boolean; retry_after_seconds?: number; message?: string;
  account?: Record<string, unknown>;
};

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE anon");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
async function rpc(fn: string, ...args: string[]): Promise<LoginResult> {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  return asAnon(async () => (await db.query<{ r: LoginResult }>(`SELECT ${fn}(${ph}) AS r`, args)).rows[0].r);
}
const login = (u: string, p: string) => rpc("staff_login", u, p);
const change = (u: string, o: string, n: string) => rpc("staff_change_password", u, o, n);

async function credRow(username: string) {
  return (await db.query<Record<string, unknown>>(
    `SELECT c.* FROM staff_credentials c JOIN staff_accounts a ON a.id = c.staff_id WHERE a.username = $1`, [username])).rows[0];
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
  `);
});

beforeEach(async () => {
  // Fresh PRE-migration world each time: plaintext passwords in staff_accounts.
  await db.exec(`
    DROP TABLE IF EXISTS staff_credentials CASCADE;
    DROP TABLE IF EXISTS staff_accounts CASCADE;
    CREATE TABLE staff_accounts (
      id text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', ''),
      username text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      first_name text, last_name text, role text, email text, phone text, badge text,
      permissions jsonb DEFAULT '[]', active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    GRANT ALL ON staff_accounts TO anon, authenticated;   -- as in production: RLS open
    INSERT INTO staff_accounts (id, username, password_hash, first_name, role, permissions) VALUES
      ('S-1', 'admin',   'admin123', 'Alex',  'Administrator', '["all"]'),
      ('S-2', 'jsmith',  'pass123',  'Jamie', 'Shelter Manager', '["animals"]'),
      ('S-3', 'blank',   '',         'Nopw',  'Officer', '[]');
    INSERT INTO staff_accounts (id, username, password_hash, first_name, role, active)
      VALUES ('S-4', 'gone', 'oldpass99', 'Off', 'Officer', false);
  `);
  await db.exec(MIGRATION);
});

describe("backfill", () => {
  it("leaves no plaintext behind and stores bcrypt hashes", async () => {
    const left = await db.query(`SELECT count(*)::int AS n FROM staff_accounts WHERE password_hash IS NOT NULL`);
    expect((left.rows[0] as { n: number }).n).toBe(0);
    const creds = (await db.query<{ password_hash: string | null; must_reset: boolean }>(
      `SELECT password_hash, must_reset FROM staff_credentials ORDER BY staff_id`)).rows;
    expect(creds).toHaveLength(4);
    expect(creds[0].password_hash).toMatch(/^\$2[aby]\$10\$/);
    expect(creds[0].password_hash).not.toContain("admin123");
    expect(creds.every((c) => c.must_reset)).toBe(true);
    expect(creds[2].password_hash).toBeNull();   // blank legacy password → no usable password
  });

  it("is safe to run twice", async () => {
    await db.exec(MIGRATION);
    expect((await db.query(`SELECT 1 FROM staff_credentials`)).rows).toHaveLength(4);
  });
});

describe("staff_login", () => {
  it("accepts the legacy password only to reach the forced reset, and never returns the hash", async () => {
    const r = await login("admin", "admin123");
    expect(r.ok).toBe(true);
    expect(r.must_reset).toBe(true);
    expect(r.account).toMatchObject({ id: "S-1", username: "admin", role: "Administrator" });
    expect(r.account).not.toHaveProperty("password_hash");
    expect(JSON.stringify(r)).not.toContain("$2");
  });

  it("is case-insensitive on username and rejects wrong passwords / unknown users / inactive / blank", async () => {
    expect((await login("ADMIN", "admin123")).ok).toBe(true);
    expect(await login("admin", "wrong")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("nobody", "x")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("gone", "oldpass99")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("blank", "")).toMatchObject({ ok: false, error: "invalid" });
  });

  it("locks the account after 5 failures, even for the right password, and unlocks after the window", async () => {
    for (let i = 0; i < 5; i++) expect((await login("jsmith", "bad" + i)).error).toBe("invalid");
    const locked = await login("jsmith", "pass123");
    expect(locked.ok).toBe(false);
    expect(locked.error).toBe("locked");
    expect(locked.retry_after_seconds).toBeGreaterThan(800);
    await db.exec(`UPDATE staff_credentials SET locked_until = now() - interval '1 second' WHERE staff_id = 'S-2'`);
    expect((await login("jsmith", "pass123")).ok).toBe(true);
  });

  it("a successful login resets the failure counter", async () => {
    for (let i = 0; i < 4; i++) await login("jsmith", "bad");
    await login("jsmith", "pass123");
    expect((await credRow("jsmith")).failed_attempts).toBe(0);
  });

  it("legacy password stops working after the grace window (reset_expired), without leaking to wrong guesses", async () => {
    await db.exec(`UPDATE staff_credentials SET legacy_valid_until = now() - interval '1 minute'`);
    expect(await login("admin", "admin123")).toMatchObject({ ok: false, error: "reset_expired" });
    expect(await login("admin", "wrong-guess")).toMatchObject({ ok: false, error: "invalid" });
  });
});

describe("staff_change_password", () => {
  it("requires the current password", async () => {
    expect(await change("admin", "wrong", "BrandNewPass1")).toMatchObject({ ok: false, error: "invalid" });
    expect((await credRow("admin")).must_reset).toBe(true);
  });

  it("enforces the policy", async () => {
    for (const bad of ["short1", "alllettersonly", "1234567890123", "admin"]) {
      const r = await change("admin", "admin123", bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error, bad).toBe("weak");
    }
    expect((await change("admin", "admin123", "admin123")).error).toBe("weak");   // must differ from current
    expect((await change("admin", "admin123", "Admin123Admin123")).ok).toBe(true);
  });

  it("clears the forced reset and the old password stops working", async () => {
    expect((await change("admin", "admin123", "Correct-Horse-9")).ok).toBe(true);
    const row = await credRow("admin");
    expect(row.must_reset).toBe(false);
    expect(row.legacy_valid_until).toBeNull();
    expect(await login("admin", "admin123")).toMatchObject({ ok: false, error: "invalid" });
    const r = await login("admin", "Correct-Horse-9");
    expect(r).toMatchObject({ ok: true, must_reset: false });
  });

  it("can be used after the legacy window closed? No — an administrator must issue a password", async () => {
    await db.exec(`UPDATE staff_credentials SET legacy_valid_until = now() - interval '1 minute'`);
    expect((await change("admin", "admin123", "Correct-Horse-9")).error).toBe("reset_expired");
  });
});

describe("legacy writers (admin / team screens still write password_hash)", () => {
  it("INSERT with a plaintext password stores NULL and a must_reset hash", async () => {
    await asAnon(() => db.exec(`INSERT INTO staff_accounts (id, username, password_hash, role) VALUES ('S-9', 'newbie', 'TempPass123', 'Volunteer')`));
    expect((await db.query<{ password_hash: string | null }>(`SELECT password_hash FROM staff_accounts WHERE id='S-9'`)).rows[0].password_hash).toBeNull();
    const r = await login("newbie", "TempPass123");
    expect(r).toMatchObject({ ok: true, must_reset: true });
  });

  it("UPDATE of password_hash (admin reset) re-hashes, forces a reset and unlocks", async () => {
    for (let i = 0; i < 5; i++) await login("jsmith", "bad");
    await asAnon(() => db.exec(`UPDATE staff_accounts SET password_hash = 'ResetByAdmin1' WHERE id='S-2'`));
    expect((await db.query<{ password_hash: string | null }>(`SELECT password_hash FROM staff_accounts WHERE id='S-2'`)).rows[0].password_hash).toBeNull();
    expect(await login("jsmith", "ResetByAdmin1")).toMatchObject({ ok: true, must_reset: true });
    expect(await login("jsmith", "pass123")).toMatchObject({ ok: false, error: "invalid" });
  });

  it("updating other columns does not touch the credential", async () => {
    const before = (await credRow("admin")).password_hash;
    await asAnon(() => db.exec(`UPDATE staff_accounts SET phone = '555' WHERE id='S-1'`));
    expect((await credRow("admin")).password_hash).toBe(before);
  });

  it("deleting an account deletes its credential", async () => {
    await db.exec(`DELETE FROM staff_accounts WHERE id='S-2'`);
    expect((await db.query(`SELECT 1 FROM staff_credentials WHERE staff_id='S-2'`)).rows).toHaveLength(0);
  });
});

describe("what the anon key can and cannot do", () => {
  it("cannot read or write staff_credentials", async () => {
    await expect(asAnon(() => db.query(`SELECT * FROM staff_credentials`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`UPDATE staff_credentials SET must_reset = false`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`DELETE FROM staff_credentials`))).rejects.toThrow(/permission denied/i);
  });

  it("cannot call the admin-only or internal functions", async () => {
    await expect(asAnon(() => db.query(`SELECT staff_issue_temp_password('admin')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT staff_accounts_capture_password()`))).rejects.toThrow();
    await expect(asAnon(() => db.query(`SELECT staff__password_problem('x','y')`))).rejects.toThrow(/permission denied/i);
  });

  it("staff_accounts no longer exposes any password to select *", async () => {
    const rows = await asAnon(async () => (await db.query<Record<string, unknown>>(`SELECT * FROM staff_accounts`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.password_hash === null)).toBe(true);
  });
});

describe("staff_issue_temp_password (SQL editor only)", () => {
  it("issues a policy-compliant one-time password that forces a reset and clears lockout", async () => {
    for (let i = 0; i < 5; i++) await login("jsmith", "bad");
    const temp = (await db.query<{ t: string }>(`SELECT staff_issue_temp_password('jsmith') AS t`)).rows[0].t;
    expect(temp.length).toBeGreaterThanOrEqual(10);
    expect(temp).toMatch(/[A-Za-z]/);
    expect(temp).toMatch(/[0-9]/);
    expect(await login("jsmith", temp)).toMatchObject({ ok: true, must_reset: true });
    expect((await change("jsmith", temp, "MyOwnPassword42")).ok).toBe(true);
  });

  it("rejects unknown usernames", async () => {
    await expect(db.query(`SELECT staff_issue_temp_password('nobody')`)).rejects.toThrow(/No staff account/);
  });
});
