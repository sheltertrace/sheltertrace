// Both hotfix migrations, exercised as the `anon` role (the public key).
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { newDb, resetStaffTables, MIGRATIONS } from "./helpers/pg";

let db: PGlite;
type R = { ok: boolean; error?: string; temp_password?: string; account?: Record<string, unknown> };

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("SET ROLE anon");
  try { return await fn(); } finally { await db.exec("RESET ROLE"); }
}
async function rpc(fn: string, ...args: unknown[]): Promise<R> {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  const params = args.map((a) => (a !== null && typeof a === "object" ? JSON.stringify(a) : a));
  return asAnon(async () => (await db.query<{ r: R }>(`SELECT ${fn}(${ph}) AS r`, params)).rows[0].r);
}
const PW: Record<string, string> = {};
async function activate(username: string, pw = `${username}-Pass-2026`) {
  const temp = (await db.query<{ t: string }>(`SELECT staff_issue_temp_password($1) AS t`, [username])).rows[0].t;
  const r = await rpc("staff_change_password", username, temp, pw);
  expect(r.ok, `activate ${username}`).toBe(true);
  PW[username] = pw;
}
const create = (as: string, user: Record<string, unknown>) => rpc("staff_admin_create", as, PW[as], user);
const update = (as: string, id: string, u: Record<string, unknown>) => rpc("staff_admin_update", as, PW[as], id, u);
const del = (as: string, id: string) => rpc("staff_admin_delete", as, PW[as], id);
const reset = (as: string, id: string) => rpc("staff_admin_reset_password", as, PW[as], id);
const row = async (id: string) => (await db.query<Record<string, unknown>>(`SELECT * FROM staff_accounts WHERE id = $1`, [id])).rows[0];

beforeAll(async () => { db = await newDb(); });

beforeEach(async () => {
  await resetStaffTables(db);
  await db.exec(`
    INSERT INTO staff_accounts (id, username, password_hash, first_name, last_name, role, permissions, account_type, platform_customer_id, is_super_admin) VALUES
      ('A1', 'admin',  'x', 'Alex',  'Admin', 'Administrator',  '["all"]',   'shelter', NULL,    false),
      ('M1', 'mgr',    'x', 'Mia',   'Mgr',   'Shelter Manager','["animals"]','shelter', NULL,    false),
      ('C1', 'cadmin', 'x', 'Cora',  'Clin',  'Clinic Admin',   '[]',        'clinic',  'cust1', false),
      ('C2', 'cvet',   'x', 'Vic',   'Vet',   'Veterinarian',   '[]',        'clinic',  'cust1', false),
      ('C3', 'other',  'x', 'Olive', 'Other', 'Clinic Admin',   '[]',        'clinic',  'cust2', false),
      ('SA', 'root',   'x', 'Sam',   'Super', 'Administrator',  '["all"]',   'shelter', NULL,    true);
  `);
  await db.exec(MIGRATIONS.credentials);
  await db.exec(MIGRATIONS.writeLockdown);
  for (const u of ["admin", "mgr", "cadmin", "cvet", "other", "root"]) await activate(u);
});

describe("direct writes to staff_accounts are gone", () => {
  it("anon cannot insert, delete, truncate, or update anything that grants access", async () => {
    await expect(asAnon(() => db.query(`INSERT INTO staff_accounts (id, username, role) VALUES ('EVIL','evil','Administrator')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`DELETE FROM staff_accounts WHERE id = 'A1'`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`TRUNCATE staff_accounts`))).rejects.toThrow(/permission denied/i);
    for (const set of [`role = 'Administrator'`, `permissions = '["all"]'`, `is_super_admin = true`, `active = false`,
                       `password_hash = 'hijack12345'`, `username = 'x'`, `account_type = 'shelter'`, `signature_data = 'forged'`, `email = 'e@x.io'`]) {
      await expect(asAnon(() => db.query(`UPDATE staff_accounts SET ${set} WHERE id = 'M1'`)), set).rejects.toThrow(/permission denied/i);
    }
    expect((await row("M1")).role).toBe("Shelter Manager");
  });

  it("the officer-app duty/GPS heartbeat and the theme switch still work", async () => {
    await asAnon(() => db.query(`UPDATE staff_accounts SET current_field_status = 'Available', tracking_active = true,
      last_location_lat = 33.5, last_location_lng = -83.4, last_status_update = now(), theme_preference = 'dark' WHERE id = 'M1'`));
    expect(await row("M1")).toMatchObject({ current_field_status: "Available", tracking_active: true, theme_preference: "dark" });
    // ...including the `.update().select()` PostgREST issues (RETURNING needs SELECT, which is kept)
    const r = await asAnon(() => db.query(`UPDATE staff_accounts SET tracking_active = false WHERE id = 'M1' RETURNING id, username`));
    expect(r.rows).toHaveLength(1);
  });

  it("reads are unchanged (lockdown of reads is the next project) but never show a password", async () => {
    const rows = await asAnon(async () => (await db.query<Record<string, unknown>>(`SELECT * FROM staff_accounts`)).rows);
    expect(rows).toHaveLength(6);
    expect(rows.every((x) => x.password_hash === null)).toBe(true);
  });

  it("anon cannot call the internal helpers or read the audit log", async () => {
    await expect(asAnon(() => db.query(`SELECT * FROM staff__actor('admin', 'x')`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT staff__is_manager(s) FROM staff_accounts s LIMIT 1`))).rejects.toThrow(/permission denied/i);
    await expect(asAnon(() => db.query(`SELECT * FROM staff_admin_audit`))).rejects.toThrow(/permission denied/i);
  });
});

describe("staff_admin_create", () => {
  it("creates an account with a generated one-time temporary password that must be changed", async () => {
    const r = await create("admin", { username: "newbie", first_name: "New", last_name: "Hire", role: "Officer", permissions: ["animals"], email: "" });
    expect(r.ok).toBe(true);
    expect(r.temp_password).toBeTruthy();
    expect(r.account).toMatchObject({ username: "newbie", role: "Officer", active: true, account_type: "shelter", email: null });
    expect(r.account).not.toHaveProperty("password_hash");
    const login = await rpc("staff_login", "newbie", r.temp_password);
    expect(login).toMatchObject({ ok: true, must_reset: true });
    expect((await rpc("staff_change_password", "newbie", r.temp_password, "My-Own-Pass-77")).ok).toBe(true);
    expect((await rpc("staff_login", "newbie", r.temp_password)).ok).toBe(false);
  });

  it("requires the caller's real password (and locks after repeated failures)", async () => {
    expect((await rpc("staff_admin_create", "admin", "wrong-password1", { username: "u1", first_name: "a", last_name: "b", role: "Officer" }))).toMatchObject({ ok: false, error: "invalid" });
    expect((await db.query(`SELECT 1 FROM staff_accounts WHERE username='u1'`)).rows).toHaveLength(0);
    for (let i = 0; i < 5; i++) await rpc("staff_admin_create", "admin", "wrong-password1", {});
    expect(await create("admin", { username: "u1", first_name: "a", last_name: "b", role: "Officer" })).toMatchObject({ ok: false, error: "locked" });
  });

  it("is refused for non-managers, and for a manager who still holds a temporary password", async () => {
    expect(await create("mgr", { username: "u2", first_name: "a", last_name: "b", role: "Officer" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await create("cvet", { username: "u2", first_name: "a", last_name: "b", role: "Clinic Staff" })).toMatchObject({ ok: false, error: "forbidden" });
    const temp = (await db.query<{ t: string }>(`SELECT staff_issue_temp_password('admin') AS t`)).rows[0].t;
    expect(await rpc("staff_admin_create", "admin", temp, { username: "u2", first_name: "a", last_name: "b", role: "Officer" })).toMatchObject({ ok: false, error: "reset_required" });
  });

  it("rejects missing fields and duplicate usernames (case-insensitive)", async () => {
    expect(await create("admin", { username: "", first_name: "a", last_name: "b", role: "Officer" })).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await create("admin", { username: "u3", first_name: "a", last_name: "b" })).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await create("admin", { username: "MGR", first_name: "a", last_name: "b", role: "Officer" })).toMatchObject({ ok: false, error: "username_taken" });
  });

  it("a shelter Administrator cannot mint super admins or clinic accounts, whatever the payload says", async () => {
    const r = await create("admin", { username: "sneaky", first_name: "a", last_name: "b", role: "Officer", is_super_admin: true, account_type: "clinic", platform_customer_id: "cust1" });
    expect(r.ok).toBe(true);
    expect(r.account).toMatchObject({ is_super_admin: false, account_type: "shelter", platform_customer_id: null });
  });

  it("a Clinic Admin creates accounts inside their own clinic only, and cannot hand out admin rights", async () => {
    const r = await create("cadmin", { username: "newvet", first_name: "a", last_name: "b", role: "Vet Tech", account_type: "shelter", platform_customer_id: "cust2", is_super_admin: true, permissions: [] });
    expect(r.ok).toBe(true);
    expect(r.account).toMatchObject({ account_type: "clinic", platform_customer_id: "cust1", is_super_admin: false });
    expect(await create("cadmin", { username: "x1", first_name: "a", last_name: "b", role: "Administrator" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await create("cadmin", { username: "x2", first_name: "a", last_name: "b", role: "Vet Tech", permissions: ["all"] })).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("a super admin can create accounts in any organisation", async () => {
    const r = await create("root", { username: "cl2", first_name: "a", last_name: "b", role: "Clinic Admin", account_type: "clinic", platform_customer_id: "cust9" });
    expect(r.account).toMatchObject({ account_type: "clinic", platform_customer_id: "cust9" });
  });

  it("records who did it", async () => {
    const r = await create("admin", { username: "audited", first_name: "a", last_name: "b", role: "Officer" });
    const a = await db.query<Record<string, unknown>>(`SELECT actor_id, action, target_id FROM staff_admin_audit`);
    expect(a.rows).toEqual([{ actor_id: "A1", action: "create", target_id: r.account!.id }]);
  });
});

describe("staff_admin_update", () => {
  it("updates whitelisted fields and normalises blanks", async () => {
    const r = await update("admin", "M1", { first_name: "Mia2", email: "  ", phone: "555-0100", badge: "", role: "Officer", permissions: ["animals", "dispatch"], active: false });
    expect(r.ok).toBe(true);
    expect(await row("M1")).toMatchObject({ first_name: "Mia2", email: null, phone: "555-0100", badge: null, role: "Officer", active: false });
  });

  it("silently ignores fields a non-super admin may not change", async () => {
    await update("admin", "M1", { is_super_admin: true, account_type: "clinic", platform_customer_id: "cust1", password_hash: "hijack12345", id: "ZZ" });
    expect(await row("M1")).toMatchObject({ is_super_admin: false, account_type: "shelter", platform_customer_id: null, id: "M1", password_hash: null });
    expect((await rpc("staff_login", "mgr", "hijack12345")).ok).toBe(false);
  });

  it("cannot touch another organisation or a super admin; a super admin can", async () => {
    expect(await update("admin", "C2", { active: false })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await update("cadmin", "M1", { active: false })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await update("cadmin", "C3", { active: false })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await update("admin", "SA", { active: false })).toMatchObject({ ok: false, error: "forbidden" });
    expect((await update("cadmin", "C2", { active: false })).ok).toBe(true);
    expect((await update("root", "C3", { role: "Clinic Admin", platform_customer_id: "cust1" })).ok).toBe(true);
    expect(await row("C3")).toMatchObject({ platform_customer_id: "cust1" });
  });

  it("nobody can escalate or lock out themselves", async () => {
    expect(await update("admin", "A1", { role: "Officer" })).toMatchObject({ ok: false, error: "self" });
    expect(await update("admin", "A1", { active: false })).toMatchObject({ ok: false, error: "self" });
    expect((await update("cadmin", "C1", { permissions: ["all"] })).ok).toBe(false);   // forbidden or self: either way refused
    expect((await update("admin", "A1", { phone: "555" })).ok).toBe(true);          // ordinary edits are fine
  });

  it("a Clinic Admin cannot promote someone to Administrator / all", async () => {
    expect(await update("cadmin", "C2", { role: "Administrator" })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await update("cadmin", "C2", { permissions: ["all"] })).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("enforces unique usernames and required fields", async () => {
    expect(await update("admin", "M1", { username: "ADMIN" })).toMatchObject({ ok: false, error: "username_taken" });
    expect(await update("admin", "M1", { first_name: "  " })).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await update("admin", "M1", { username: "mgr" })).toMatchObject({ ok: true });   // own name is not a clash
    expect(await update("admin", "NOPE", { phone: "1" })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("a super admin can revoke another super admin", async () => {
    await db.exec(`UPDATE staff_accounts SET is_super_admin = true WHERE id = 'M1'`);
    expect((await update("root", "M1", { is_super_admin: false })).ok).toBe(true);
    expect((await row("M1")).is_super_admin).toBe(false);
  });
});

describe("staff_admin_delete / staff_admin_reset_password", () => {
  it("deletes within scope (and the credential goes with it), never yourself", async () => {
    expect((await del("admin", "M1")).ok).toBe(true);
    expect(await row("M1")).toBeUndefined();
    expect((await db.query(`SELECT 1 FROM staff_credentials WHERE staff_id='M1'`)).rows).toHaveLength(0);
    expect(await del("admin", "A1")).toMatchObject({ ok: false, error: "self" });
    expect(await del("admin", "C2")).toMatchObject({ ok: false, error: "forbidden" });
    expect(await del("cvet", "C1")).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("issues a one-time temporary password that replaces the old one and forces a change", async () => {
    const r = await reset("admin", "M1");
    expect(r.ok).toBe(true);
    expect((await rpc("staff_login", "mgr", PW.mgr)).ok).toBe(false);
    expect(await rpc("staff_login", "mgr", r.temp_password)).toMatchObject({ ok: true, must_reset: true });
    expect(await reset("admin", "A1")).toMatchObject({ ok: false, error: "self" });
    expect(await reset("cadmin", "M1")).toMatchObject({ ok: false, error: "forbidden" });
    expect(await reset("cvet", "C1")).toMatchObject({ ok: false, error: "forbidden" });
  });
});

describe("staff_update_profile / staff_set_signature", () => {
  it("changes only the caller's own name/email/phone", async () => {
    const r = await rpc("staff_update_profile", "mgr", PW.mgr, { first_name: "Mimi", phone: "555-1", email: "", role: "Administrator", permissions: ["all"], id: "A1" });
    expect(r.ok).toBe(true);
    expect(await row("M1")).toMatchObject({ first_name: "Mimi", phone: "555-1", email: null, role: "Shelter Manager", id: "M1" });
    expect((await row("M1")).permissions).toEqual(["animals"]);
    expect((await row("A1")).first_name).toBe("Alex");
  });

  it("needs the caller's password and rejects blank names", async () => {
    expect(await rpc("staff_update_profile", "mgr", "wrong-password1", { first_name: "x" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await rpc("staff_update_profile", "mgr", PW.mgr, { first_name: " " })).toMatchObject({ ok: false, error: "invalid_input" });
  });

  it("stores, validates and clears a signature", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect((await rpc("staff_set_signature", "cvet", PW.cvet, png)).ok).toBe(true);
    expect((await row("C2")).signature_data).toBe(png);
    expect(await rpc("staff_set_signature", "cvet", PW.cvet, "<script>alert(1)</script>")).toMatchObject({ ok: false, error: "invalid_input" });
    expect(await rpc("staff_set_signature", "cvet", "wrong-password1", png)).toMatchObject({ ok: false, error: "invalid" });
    expect((await rpc("staff_set_signature", "cvet", PW.cvet, "")).ok).toBe(true);
    expect((await row("C2")).signature_data).toBeNull();
    expect((await row("C1")).signature_data).toBeNull();   // nobody else's changed
  });
});
