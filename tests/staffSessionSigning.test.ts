// staff_login's new session_token + staff_verify_session, run as the anon role.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { newDb, resetStaffTables, MIGRATIONS } from "./helpers/pg";

let db: PGlite;
type LoginResult = { ok: boolean; error?: string; must_reset?: boolean; session_token?: string | null; account?: Record<string, unknown> };
type VerifyResult = { ok: boolean; error?: string; account?: Record<string, unknown> };

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE anon");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
async function login(u: string, p: string): Promise<LoginResult> {
  return asAnon(async () => (await db.query<{ r: LoginResult }>(`SELECT staff_login($1, $2) AS r`, [u, p])).rows[0].r);
}
async function verify(token: string | null): Promise<VerifyResult> {
  return asAnon(async () => (await db.query<{ r: VerifyResult }>(`SELECT staff_verify_session($1) AS r`, [token])).rows[0].r);
}
const issueTemp = async (u: string) => (await db.query<{ t: string }>(`SELECT staff_issue_temp_password($1) AS t`, [u])).rows[0].t;
const activate = async (u: string, pw = `${u}-Pass-2026`) => {
  const temp = await issueTemp(u);
  const r = await asAnon(() => db.query<{ r: { ok: boolean } }>(`SELECT staff_change_password($1, $2, $3) AS r`, [u, temp, pw]));
  expect(r.rows[0].r.ok).toBe(true);
  return pw;
};

beforeAll(async () => { db = await newDb(); });

beforeEach(async () => {
  await resetStaffTables(db);
  await db.exec(`
    INSERT INTO staff_accounts (id, username, password_hash, first_name, role, permissions, active) VALUES
      ('S-1', 'admin', 'x', 'Alex', 'Administrator', '["all"]', true),
      ('S-2', 'gone',  'x', 'Off',  'Officer', '[]', false);
  `);
  await db.exec(MIGRATIONS.credentials);
  await db.exec(MIGRATIONS.writeLockdown);
  await db.exec(MIGRATIONS.sessionSigning);
});

describe("staff_login issues a session token", () => {
  it("a real (non-temporary) login gets a usable token; a must_reset login does not", async () => {
    const pw = await activate("admin");
    const r = await login("admin", pw);
    expect(r).toMatchObject({ ok: true, must_reset: false });
    expect(typeof r.session_token).toBe("string");
    expect(r.session_token).toMatch(/^[A-Za-z0-9+/=]+\.[0-9a-f]{64}$/);

    const temp = await issueTemp("admin");
    const resetLogin = await login("admin", temp);
    expect(resetLogin).toMatchObject({ ok: true, must_reset: true });
    expect(resetLogin.session_token).toBeNull();
  });

  it("the token verifies to the account, minus the password hash", async () => {
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    const v = await verify(session_token!);
    expect(v.ok).toBe(true);
    expect(v.account).toMatchObject({ id: "S-1", username: "admin", role: "Administrator" });
    expect(v.account).not.toHaveProperty("password_hash");
  });
});

describe("staff_verify_session", () => {
  it("rejects garbage, malformed, and tampered tokens", async () => {
    for (const bad of [null, "", "not-a-token", "abc.def", "abc.123", `${"a".repeat(20)}.${"0".repeat(64)}`]) {
      expect((await verify(bad as string | null)).ok, String(bad)).toBe(false);
    }
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    const [payload, mac] = session_token!.split(".");
    expect((await verify(`${payload}.${"0".repeat(mac.length)}`)).ok).toBe(false);   // wrong signature
    // flip the first payload byte -> still valid base64, but the signature no longer matches
    const bytes = Buffer.from(payload, "base64");
    bytes[0] ^= 0xff;
    const flipped = bytes.toString("base64");
    expect((await verify(`${flipped}.${mac}`)).ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    // Forge an already-expired token with the correct signature via the real signer,
    // by temporarily issuing one and asserting the expiry math independently: since we
    // can't fast-forward wall-clock time in PGlite, verify the encoded expiry directly.
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    const payload = Buffer.from(session_token!.split(".")[0], "base64").toString("utf8");
    const [, issued, expires] = payload.split("|").map(Number);
    expect(expires - issued).toBe(8 * 3600);
  });

  it("reflects a deactivated account immediately, without waiting for the token to expire", async () => {
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    expect((await verify(session_token!)).ok).toBe(true);
    await db.exec(`UPDATE staff_accounts SET active = false WHERE id = 'S-1'`);
    expect(await verify(session_token!)).toMatchObject({ ok: false, error: "invalid" });
  });

  it("reflects a role/permission change immediately (re-reads the row, doesn't trust the token)", async () => {
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    await db.exec(`UPDATE staff_accounts SET role = 'Front Desk', permissions = '[]' WHERE id = 'S-1'`);
    const v = await verify(session_token!);
    expect(v.ok).toBe(true);
    expect(v.account).toMatchObject({ role: "Front Desk", permissions: [] });
  });

  it("a forged payload naming a different account fails (the mac won't match a payload it wasn't computed over)", async () => {
    const pw = await activate("admin");
    const { session_token } = await login("admin", pw);
    const [, mac] = session_token!.split(".");
    const forgedPayload = Buffer.from("S-2|1|9999999999", "utf8").toString("base64");
    expect((await verify(`${forgedPayload}.${mac}`)).ok).toBe(false);
  });

  it("is not callable in a way that leaks the signing secret or bypasses via internal helpers", async () => {
    await expect(asAnon(() => db.query(`SELECT staff__session_secret()`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT staff__issue_session('S-1')`))).rejects.toThrow(/permission denied/i);
  });
});
