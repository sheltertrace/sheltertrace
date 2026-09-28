"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { StaffAccount } from "@/lib/types";
import { getCurrentUser, login as authLogin, logout as authLogout, demoLoginById, verifySession } from "@/lib/auth";
import { IS_DEMO } from "@/lib/demo";
import PasswordPromptHost from "@/components/PasswordPromptHost";
import { updateStaffTheme, fetchShelterConfig, kennelLabelsFromConfig, fetchStaffOptions } from "@/lib/data";

// ── Theme ─────────────────────────────────────────────────────────────────────
type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: StaffAccount | null;
  login: (username: string, password: string) => Promise<StaffAccount | null>;
  demoLogin: (accountId: string) => Promise<StaffAccount | null>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => null,
  demoLogin: async () => null,
  logout: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── Staff ─────────────────────────────────────────────────────────────────────
interface StaffContextType {
  staffOptions: string[];
  refreshStaff: () => Promise<void>;
}

const StaffContext = createContext<StaffContextType>({
  staffOptions: [],
  refreshStaff: async () => {},
});

export function useStaff() {
  return useContext(StaffContext);
}

// ── Kennels ───────────────────────────────────────────────────────────────────
interface KennelContextType {
  kennelLabels: string[];
  refreshKennels: () => Promise<void>;
}

const KennelContext = createContext<KennelContextType>({
  kennelLabels: [],
  refreshKennels: async () => {},
});

export function useKennels() {
  return useContext(KennelContext);
}

// ── Combined Provider ─────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]     = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>("light");
  const [kennelLabels, setKennelLabels] = useState<string[]>([]);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);

  // Apply theme to <html> element
  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // On mount: restore from sessionStorage, but treat its role/permissions/
  // is_super_admin as unverified until staff_verify_session confirms them
  // against the database — that object is client-writable and proves nothing
  // on its own (see the 2026-09-28 session-signing fix). A genuinely invalid
  // or expired session logs the tab out; a network hiccup or the RPC not
  // being deployed yet just keeps the locally-cached copy for this load
  // rather than punishing everyone for a transient error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getCurrentUser();
      if (!stored) { setLoading(false); return; }

      let effective: StaffAccount | null = stored;
      if (!IS_DEMO) {
        const v = await verifySession();
        if (cancelled) return;
        if (v.status === "ok") effective = v.account;
        else if (v.status === "invalid") {
          authLogout();
          effective = null;
        }
        // "unavailable": keep the locally-cached copy for this page load.
      }

      setUser(effective);
      setLoading(false);

      const savedTheme = (localStorage.getItem("sheltertrace_theme") as Theme) ||
                         effective?.theme_preference ||
                         "light";
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    })();
    return () => { cancelled = true; };
  }, [applyTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("sheltertrace_theme", t);
    // Persist to DB in the background (best-effort)
    setUser((prev) => {
      if (prev?.id) updateStaffTheme(prev.id, t).catch(() => {});
      return prev ? { ...prev, theme_preference: t } : prev;
    });
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      applyTheme(next);
      localStorage.setItem("sheltertrace_theme", next);
      setUser((u) => {
        if (u?.id) updateStaffTheme(u.id, next).catch(() => {});
        return u ? { ...u, theme_preference: next } : u;
      });
      return next;
    });
  }, [applyTheme]);

  const refreshKennels = useCallback(async () => {
    try {
      const raw = await fetchShelterConfig();
      setKennelLabels(kennelLabelsFromConfig(raw));
    } catch {
      setKennelLabels([]);
    }
  }, []);

  const refreshStaff = useCallback(async () => {
    try {
      setStaffOptions(await fetchStaffOptions());
    } catch {
      setStaffOptions([]);
    }
  }, []);

  // Fetch kennel list and staff list whenever user logs in
  useEffect(() => {
    if (user) {
      refreshKennels();
      refreshStaff();
    }
  }, [user, refreshKennels, refreshStaff]);

  const login = useCallback(async (username: string, password: string): Promise<StaffAccount | null> => {
    const account = await authLogin(username, password);
    if (account) {
      setUser(account);
      const t = account.theme_preference || (localStorage.getItem("sheltertrace_theme") as Theme) || "light";
      setThemeState(t);
      applyTheme(t);
      localStorage.setItem("sheltertrace_theme", t);
    }
    return account;
  }, [applyTheme]);

  const demoLogin = useCallback(async (accountId: string): Promise<StaffAccount | null> => {
    const account = await demoLoginById(accountId);
    if (account) {
      setUser(account);
      const t = account.theme_preference || (localStorage.getItem("sheltertrace_theme") as Theme) || "light";
      setThemeState(t);
      applyTheme(t);
      localStorage.setItem("sheltertrace_theme", t);
    }
    return account;
  }, [applyTheme]);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    // Keep theme on logout (localStorage persists)
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <AuthContext.Provider value={{ user, login, demoLogin, logout, loading }}>
        <KennelContext.Provider value={{ kennelLabels, refreshKennels }}>
          <StaffContext.Provider value={{ staffOptions, refreshStaff }}>
            {children}
            <PasswordPromptHost />
          </StaffContext.Provider>
        </KennelContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
