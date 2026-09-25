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

import { login, changeStaffPassword, PasswordResetRequiredError, LoginLockedError, LoginUnavailableError, CURRENT_USER_KEY } from "../lib/auth";

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
  it("stores a session (without any password) on success", async () => {
    rpc.mockResolvedValue({ data: { ok: true, must_reset: false, account: { ...account, password_hash: "SHOULD-NOT-SURVIVE" } }, error: null });
    const a = await login(" admin ", " secret12345 ");
    expect(rpc).toHaveBeenCalledWith("staff_login", { p_username: "admin", p_password: "secret12345" });
    expect(a?.username).toBe("admin");
    const saved = store.get(CURRENT_USER_KEY)!;
    expect(saved).toBeTruthy();
    expect(saved).not.toContain("SHOULD-NOT-SURVIVE");
    expect(JSON.parse(saved).password).toBe("");
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

  describe("rollout bridge (staff_login() not deployed yet)", () => {
    const missing = { code: "PGRST202", message: "Could not find the function public.staff_login" };
    it("falls back to the legacy check while plaintext still exists", async () => {
      rpc.mockResolvedValue({ data: null, error: missing });
      limit.mockResolvedValue({ data: [{ ...account, password_hash: "legacy-pw" }], error: null });
      expect((await login("admin", "legacy-pw"))?.id).toBe("S-1");
      expect(await login("admin", "wrong")).toBeNull();
    });

    it("cannot be used to log in with a blanked (post-migration) column, and has no hardcoded accounts", async () => {
      rpc.mockResolvedValue({ data: null, error: missing });
      limit.mockResolvedValue({ data: [{ ...account, password_hash: null }], error: null });
      expect(await login("admin", "")).toBeNull();
      expect(await login("admin", "admin123")).toBeNull();
      limit.mockResolvedValue({ data: [], error: null });
      expect(await login("admin", "admin123")).toBeNull();
    });
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
