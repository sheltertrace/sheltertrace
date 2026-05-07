"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { StaffAccount } from "@/lib/types";
import { getCurrentUser, login as authLogin, logout as authLogout } from "@/lib/auth";
import { updateStaffTheme, fetchShelterConfig, kennelLabelsFromConfig } from "@/lib/data";

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
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => null,
  logout: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
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

  // Apply theme to <html> element
  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // On mount: restore from localStorage first (instant, no flash), then user pref
  useEffect(() => {
    const stored = getCurrentUser();
    setUser(stored);
    setLoading(false);

    const savedTheme = (localStorage.getItem("sheltertrace_theme") as Theme) ||
                       stored?.theme_preference ||
                       "light";
    setThemeState(savedTheme);
    applyTheme(savedTheme);
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

  // Fetch kennel list whenever user logs in
  useEffect(() => {
    if (user) refreshKennels();
  }, [user, refreshKennels]);

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

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    // Keep theme on logout (localStorage persists)
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <AuthContext.Provider value={{ user, login, logout, loading }}>
        <KennelContext.Provider value={{ kennelLabels, refreshKennels }}>
          {children}
        </KennelContext.Provider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
