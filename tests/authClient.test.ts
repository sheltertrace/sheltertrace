// login() / changeStaffPassword() against a mocked Supabase client.
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const limit = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ limit: (...a: unknown[]) => limit(...a) }) }) }),
  },
}));

import { login, changeStaffPassword, verifySession, getSessionToken, SESSION_TOKEN_KEY, PasswordResetRequiredError, LoginLockedError, LoginUnavailableError, CURRENT_USER_KEY } from "../lib/auth";

const store = new Map<string, string>();
beforeEach(() => {
  rpc.mockReset(); limit.mockReset(); store.clear();
  (globalThis as Record<string, unknown>).window = {};
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

const account = { id: "S-1", username: "admin", first_name: "Alex", last_name: "R", role: "Administrator", permissions: ["all"], active: true };

describe("login()", () => {
  it("stores a session (without any password) on success, plus the signed session token", async () => {
    rpc.mockResolvedValue({ data: { ok: true, must_reset: false, session_token: "abc.def", account: { ...account, password_hash: "SHOULD-NOT-SURVIVE" } }, error: null });
    const a = await login(" admin ", " secret12345 ");
    expect(rpc).toHaveBeenCalledWith("staff_login", { p_username: "admin", p_password: "secret12345" });
    expect(a?.username).toBe("admin");
    const saved = store.get(CURRENT_USER_KEY)!;
    expect(saved).toBeTruthy();
    expect(saved).not.toContain("SHOULD-NOT-SURVIVE");
    expect(JSON.parse(saved).password).toBe("");
    expect(getSessionToken()).toBe("abc.def");
  });

  it("a login with no session_token (e.g. an older server) stores no stale token", async () => {
    store.set(SESSION_TOKEN_KEY, "leftover-from-a-previous-session");
    rpc.mockResolvedValue({ data: { ok: true, must_reset: false, account }, error: null });
    await login("admin", "secret12345");
    expect(getSessionToken()).toBeNull();
  });

  it("returns null for a wrong password and stores nothing", async () => {
    rpc.mockResolvedValue({ data: { ok: false, error: "invalid" }, error: null });
    expect(await login("admin", "nope")).toBeNull();
    expect(store.size).toBe(0);
  });

  it("must_reset: throws and stores NO session", async () => {
    rpc.mockResolvedValue({ data: { ok: true, must_reset: true, account }, error: null });
    await expect(login("admin", "old")).rejects.toMatchObject({ reason: "must_reset" });
    await expect(login("admin", "old")).rejects.toBeInstanceOf(PasswordResetRequiredError);
    expect(store.size).toBe(0);
  });

  it("expired legacy password and lockout surface as typed errors", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "reset_expired" }, error: null });
    await expect(login("admin", "old")).rejects.toMatchObject({ reason: "expired" });
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "locked", retry_after_seconds: 600 }, error: null });
    await expect(login("admin", "x")).rejects.toBeInstanceOf(LoginLockedError);
  });

  it("network / server errors are 'unavailable', never a silent failure or a fallback login", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "500", message: "boom" } });
    await expect(login("admin", "x")).rejects.toBeInstanceOf(LoginUnavailableError);
    expect(limit).not.toHaveBeenCalled();
  });

  it("fails CLOSED when staff_login() is missing: no client-side password comparison, no session", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.staff_login" } });
    await expect(login("admin", "admin123")).rejects.toBeInstanceOf(LoginUnavailableError);
    expect(limit).not.toHaveBeenCalled();          // never reads staff_accounts to compare a password
    expect(store.size).toBe(0);
  });
});

describe("verifySession()", () => {
  it("no token stored -> invalid, without ever calling the RPC", async () => {
    expect(await verifySession()).toEqual({ status: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a verified token returns the CURRENT account from the database, not a cached one", async () => {
    store.set(SESSION_TOKEN_KEY, "a-real-token");
    rpc.mockResolvedValue({ data: { ok: true, account: { ...account, role: "Front Desk" } }, error: null });
    const r = await verifySession();
    expect(rpc).toHaveBeenCalledWith("staff_verify_session", { p_token: "a-real-token" });
    expect(r).toMatchObject({ status: "ok", account: { role: "Front Desk" } });
  });

  it("an invalid/expired token is 'invalid' (the caller is expected to log out)", async () => {
    store.set(SESSION_TOKEN_KEY, "stale");
    rpc.mockResolvedValue({ data: { ok: false, error: "expired" }, error: null });
    expect(await verifySession()).toEqual({ status: "invalid" });
  });

  it("a network error or a not-yet-deployed RPC degrades to 'unavailable', not a forced logout", async () => {
    store.set(SESSION_TOKEN_KEY, "a-real-token");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "500", message: "boom" } });
    expect(await verifySession()).toEqual({ status: "unavailable" });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function public.staff_verify_session" } });
    expect(await verifySession()).toEqual({ status: "unavailable" });
  });
});

describe("changeStaffPassword()", () => {
  it("maps RPC outcomes to user-facing messages", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await changeStaffPassword("admin", "a", "b")).toEqual({ ok: true });
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "weak", message: "Too short." }, error: null });
    expect(await changeStaffPassword("admin", "a", "b")).toEqual({ ok: false, error: "Too short." });
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "invalid" }, error: null });
    expect((await changeStaffPassword("admin", "a", "b")).error).toMatch(/current password is incorrect/i);
    rpc.mockResolvedValueOnce({ data: { ok: false, error: "locked", retry_after_seconds: 120 }, error: null });
    expect((await changeStaffPassword("admin", "a", "b")).error).toMatch(/too many attempts/i);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    expect((await changeStaffPassword("admin", "a", "b")).ok).toBe(false);
  });
});
