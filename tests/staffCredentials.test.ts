// Runs the REAL hotfix migration against an in-process Postgres (PGlite + pgcrypto)
// and exercises it the way the browser does: as the `anon` role.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { newDb, resetStaffTables, MIGRATIONS } from "./helpers/pg";

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
const issueTemp = async (u: string) => (await db.query<{ t: string }>(`SELECT staff_issue_temp_password($1) AS t`, [u])).rows[0].t;

async function credRow(username: string) {
  return (await db.query<Record<string, unknown>>(
    `SELECT c.* FROM staff_credentials c JOIN staff_accounts a ON a.id = c.staff_id WHERE a.username = $1`, [username])).rows[0];
}

beforeAll(async () => { db = await newDb(); });

beforeEach(async () => {
  // Fresh PRE-migration world each time: plaintext passwords in staff_accounts.
  await resetStaffTables(db);
  await db.exec(`
    INSERT INTO staff_accounts (id, username, password_hash, first_name, role, permissions) VALUES
      ('S-1', 'admin',   'admin123', 'Alex',  'Administrator', '["all"]'),
      ('S-2', 'jsmith',  'pass123',  'Jamie', 'Shelter Manager', '["animals"]'),
      ('S-3', 'blank',   '',         'Nopw',  'Officer', '[]');
    INSERT INTO staff_accounts (id, username, password_hash, first_name, role, active)
      VALUES ('S-4', 'gone', 'oldpass99', 'Off', 'Officer', false);
  `);
  await db.exec(MIGRATIONS.credentials);
});

describe("invalidating the old (publicly readable) passwords", () => {
  it("leaves no plaintext and no usable password for anyone", async () => {
    const left = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM staff_accounts WHERE password_hash IS NOT NULL`);
    expect(left.rows[0].n).toBe(0);
    const creds = (await db.query<{ password_hash: string | null; must_reset: boolean }>(`SELECT password_hash, must_reset FROM staff_credentials`)).rows;
    expect(creds).toHaveLength(4);
    expect(creds.every((c) => c.password_hash === null && c.must_reset)).toBe(true);   // not even hashed
  });

  it("the old password cannot log in and cannot reach the reset screen", async () => {
    expect(await login("admin", "admin123")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("jsmith", "pass123")).toMatchObject({ ok: false, error: "invalid" });
    expect((await change("admin", "admin123", "BrandNewPass1")).ok).toBe(false);
  });

  it("is safe to run twice (never wipes passwords people chose since)", async () => {
    const temp = await issueTemp("admin");
    expect((await change("admin", temp, "Correct-Horse-9")).ok).toBe(true);
    await db.exec(MIGRATIONS.credentials);
    expect((await login("admin", "Correct-Horse-9")).ok).toBe(true);
  });
});

describe("temporary passwords", () => {
  it("logs in only far enough to reach the forced change, and never returns the hash", async () => {
    const temp = await issueTemp("admin");
    expect(temp.length).toBeGreaterThanOrEqual(10);
    expect(temp).toMatch(/[A-Za-z]/);
    expect(temp).toMatch(/[0-9]/);
    const r = await login("admin", temp);
    expect(r).toMatchObject({ ok: true, must_reset: true });
    expect(r.account).toMatchObject({ id: "S-1", username: "admin", role: "Administrator" });
    expect(r.account).not.toHaveProperty("password_hash");
    expect(JSON.stringify(r)).not.toContain("$2");
  });

  it("expires 24 hours after issue", async () => {
    await issueTemp("admin");
    const row = await db.query<{ hours: number }>(
      `SELECT extract(epoch FROM (temp_expires_at - now())) / 3600 AS hours FROM staff_credentials WHERE staff_id = 'S-1'`);
    expect(Number(row.rows[0].hours)).toBeGreaterThan(23.9);
    expect(Number(row.rows[0].hours)).toBeLessThanOrEqual(24);
  });

  it("stops working after 24 hours (reset_expired), without leaking that to wrong guesses", async () => {
    const temp = await issueTemp("admin");
    await db.exec(`UPDATE staff_credentials SET temp_expires_at = now() - interval '1 minute' WHERE staff_id = 'S-1'`);
    expect(await login("admin", temp)).toMatchObject({ ok: false, error: "reset_expired" });
    expect(await login("admin", "wrong-guess-1")).toMatchObject({ ok: false, error: "invalid" });
    expect((await change("admin", temp, "Correct-Horse-9")).error).toBe("reset_expired");
  });

  it("is consumed by choosing a new password: cannot be used again, and the account then signs in normally", async () => {
    const temp = await issueTemp("admin");
    expect((await change("admin", temp, "Correct-Horse-9")).ok).toBe(true);
    const row = await credRow("admin");
    expect(row.must_reset).toBe(false);
    expect(row.temp_expires_at).toBeNull();
    expect(await login("admin", temp)).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("admin", "Correct-Horse-9")).toMatchObject({ ok: true, must_reset: false });
  });

  it("issuing a new one replaces the old one and clears a lockout", async () => {
    const first = await issueTemp("jsmith");
    for (let i = 0; i < 5; i++) await login("jsmith", "bad" + i);
    expect((await login("jsmith", first)).error).toBe("locked");
    const second = await issueTemp("jsmith");
    expect(await login("jsmith", first)).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("jsmith", second)).toMatchObject({ ok: true, must_reset: true });
  });

  it("rejects unknown usernames", async () => {
    await expect(db.query(`SELECT staff_issue_temp_password('nobody')`)).rejects.toThrow(/No staff account/);
  });
});

describe("staff_login", () => {
  beforeEach(async () => {
    for (const u of ["admin", "jsmith"]) await change(u, await issueTemp(u), u === "admin" ? "Admin-Pass-2026" : "Smith-Pass-2026");
  });

  it("is case-insensitive on username and rejects wrong passwords / unknown / inactive / blank", async () => {
    expect((await login("ADMIN", "Admin-Pass-2026")).ok).toBe(true);
    expect(await login("admin", "wrong")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("nobody", "x")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("gone", "oldpass99")).toMatchObject({ ok: false, error: "invalid" });
    expect(await login("blank", "")).toMatchObject({ ok: false, error: "invalid" });
  });

  it("locks after 5 failures, even for the right password, and unlocks after the window", async () => {
    for (let i = 0; i < 5; i++) expect((await login("jsmith", "bad" + i)).error).toBe("invalid");
    const locked = await login("jsmith", "Smith-Pass-2026");
    expect(locked).toMatchObject({ ok: false, error: "locked" });
    expect(locked.retry_after_seconds).toBeGreaterThan(800);
    await db.exec(`UPDATE staff_credentials SET locked_until = now() - interval '1 second' WHERE staff_id = 'S-2'`);
    expect((await login("jsmith", "Smith-Pass-2026")).ok).toBe(true);
  });

  it("a successful login resets the failure counter", async () => {
    for (let i = 0; i < 4; i++) await login("jsmith", "bad");
    await login("jsmith", "Smith-Pass-2026");
    expect((await credRow("jsmith")).failed_attempts).toBe(0);
  });
});

describe("staff_change_password", () => {
  it("requires the current/temporary password and enforces the policy", async () => {
    const temp = await issueTemp("admin");
    expect(await change("admin", "wrong", "BrandNewPass1")).toMatchObject({ ok: false, error: "invalid" });
    for (const bad of ["short1", "alllettersonly", "1234567890123", "admin"]) {
      const r = await change("admin", temp, bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error, bad).toBe("weak");
    }
    expect((await change("admin", temp, temp)).error).toBe("weak");   // must differ from the current one
    expect((await credRow("admin")).must_reset).toBe(true);           // nothing above consumed the temp
  });
});

describe("safety net for SQL-editor writes to password_hash", () => {
  it("captures plaintext as a 24-hour temporary password and blanks the column", async () => {
    await db.exec(`INSERT INTO staff_accounts (id, username, password_hash, role) VALUES ('S-9', 'newbie', 'TempPass123', 'Volunteer')`);
    expect((await db.query<{ password_hash: string | null }>(`SELECT password_hash FROM staff_accounts WHERE id='S-9'`)).rows[0].password_hash).toBeNull();
    expect(await login("newbie", "TempPass123")).toMatchObject({ ok: true, must_reset: true });
    const h = await db.query<{ hours: number }>(`SELECT extract(epoch FROM (temp_expires_at - now())) / 3600 AS hours FROM staff_credentials WHERE staff_id='S-9'`);
    expect(Number(h.rows[0].hours)).toBeGreaterThan(23.9);
  });

  it("updating other columns does not touch the credential; deleting an account deletes it", async () => {
    await change("admin", await issueTemp("admin"), "Correct-Horse-9");
    const before = (await credRow("admin")).password_hash;
    await db.exec(`UPDATE staff_accounts SET phone = '555' WHERE id='S-1'`);
    expect((await credRow("admin")).password_hash).toBe(before);
    await db.exec(`DELETE FROM staff_accounts WHERE id='S-2'`);
    expect((await db.query(`SELECT 1 FROM staff_credentials WHERE staff_id='S-2'`)).rows).toHaveLength(0);
  });
});

describe("what the anon key can and cannot do (migration 1 alone)", () => {
  it("cannot read or write staff_credentials", async () => {
    await expect(asAnon(() => db.query(`SELECT * FROM staff_credentials`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`UPDATE staff_credentials SET must_reset = false`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`DELETE FROM staff_credentials`))).rejects.toThrow(/permission denied/i);
  });

  it("cannot call the admin-only or internal functions", async () => {
    await expect(asAnon(() => db.query(`SELECT staff_issue_temp_password('admin')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT staff__issue_temp('S-1')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT staff_accounts_capture_password()`))).rejects.toThrow();
    await expect(asAnon(() => db.query(`SELECT staff__password_problem('x','y')`))).rejects.toThrow(/permission denied/i);
  });

  it("staff_accounts no longer exposes any password to select *", async () => {
    const rows = await asAnon(async () => (await db.query<Record<string, unknown>>(`SELECT * FROM staff_accounts`)).rows);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.password_hash === null)).toBe(true);
  });
});
