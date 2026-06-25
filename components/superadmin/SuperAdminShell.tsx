"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useTheme } from "@/app/providers";
import { fetchPlatformSettings } from "@/lib/superAdminData";

const NAV = [
  { href: "/superadmin",              label: "Dashboard",      icon: "📊" },
  { href: "/superadmin/customers",    label: "Customers",      icon: "🏢" },
  { href: "/superadmin/users",        label: "Users",          icon: "👤" },
  { href: "/superadmin/billing",      label: "Billing",        icon: "💳" },
  { href: "/superadmin/announcements", label: "Announcements", icon: "📢" },
  { href: "/superadmin/audit-log",    label: "Audit Log",      icon: "📋" },
  { href: "/superadmin/settings",     label: "Settings",       icon: "⚙️" },
];

const DEFAULT_PRIMARY   = "#1B3A5C";
const DEFAULT_SECONDARY = "#2E86AB";

function loadCachedBranding(): { primary: string; secondary: string; logo: string } {
  try {
    const raw = localStorage.getItem("st_branding");
    if (raw) {
      const b = JSON.parse(raw) as { primary_color?: string; secondary_color?: string; logo_url?: string };
      return {
        primary:   b.primary_color || DEFAULT_PRIMARY,
        secondary: b.secondary_color || DEFAULT_SECONDARY,
        logo:      b.logo_url || "",
      };
    }
  } catch { }
  return { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, logo: "" };
}

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const cached = typeof window !== "undefined" ? loadCachedBranding() : { primary: DEFAULT_PRIMARY, secondary: DEFAULT_SECONDARY, logo: "" };
  const [primary, setPrimary]     = useState(cached.primary);
  const [secondary, setSecondary] = useState(cached.secondary);
  const [logoUrl, setLogoUrl]     = useState(cached.logo);

  useEffect(() => {
    if (user && !user.is_super_admin) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    fetchPlatformSettings().then((s) => {
      const p = s.branding.primary_color || DEFAULT_PRIMARY;
      const sc = s.branding.secondary_color || DEFAULT_SECONDARY;
      const l = s.branding.logo_url || "";
      setPrimary(p);
      setSecondary(sc);
      setLogoUrl(l);
    }).catch(() => {});

    // Listen for live updates from the settings page
    const handler = (e: StorageEvent) => {
      if (e.key === "st_branding" && e.newValue) {
        try {
          const b = JSON.parse(e.newValue);
          setPrimary(b.primary_color || DEFAULT_PRIMARY);
          setSecondary(b.secondary_color || DEFAULT_SECONDARY);
          setLogoUrl(b.logo_url || "");
        } catch { }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Listen for custom event from settings page (same-tab updates)
  useEffect(() => {
    const handler = () => {
      const b = loadCachedBranding();
      setPrimary(b.primary);
      setSecondary(b.secondary);
      setLogoUrl(b.logo);
    };
    window.addEventListener("st-branding-update", handler);
    return () => window.removeEventListener("st-branding-update", handler);
  }, []);

  if (!user) { router.replace("/login"); return null; }
  if (!user.is_super_admin) return null;

  // Derived colors
  const sidebarBg = primary;
  const accentColor = secondary;
  const sidebarBorder = `${primary}88`;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, background: sidebarBg, color: "#fff", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, transition: "background 0.2s" }}>
        <div style={{ padding: "16px", borderBottom: `1px solid ${sidebarBorder}`, display: "flex", alignItems: "center", gap: 10 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" style={{ height: 32, borderRadius: 4, flexShrink: 0 }} />
          ) : null}
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5 }}>ShelterTrace</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform Admin</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "8px 0", overflow: "auto" }}>
          {NAV.map((item) => {
            const active = item.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13,
                color: active ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: active ? 700 : 400,
                background: active ? "rgba(255,255,255,0.12)" : "transparent", textDecoration: "none",
                borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
                transition: "all 0.12s",
              }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: "8px 16px", borderTop: `1px solid ${sidebarBorder}` }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            ← Back to Shelter
          </Link>
        </div>

        <div style={{ padding: "12px 16px", borderTop: `1px solid ${sidebarBorder}`, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{user.firstName} {user.lastName}</div>
            <div style={{ fontSize: 10, color: accentColor }}>Super Admin</div>
          </div>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={logout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15 }}>⏻</button>
        </div>
      </nav>

      <main style={{ flex: 1, marginLeft: 220, minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </main>
    </div>
  );
}
