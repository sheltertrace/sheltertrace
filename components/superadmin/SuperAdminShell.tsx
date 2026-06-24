"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useTheme } from "@/app/providers";

const NAV = [
  { href: "/superadmin",              label: "Dashboard",      icon: "📊" },
  { href: "/superadmin/customers",    label: "Customers",      icon: "🏢" },
  { href: "/superadmin/users",        label: "Users",          icon: "👤" },
  { href: "/superadmin/billing",      label: "Billing",        icon: "💳" },
  { href: "/superadmin/announcements", label: "Announcements", icon: "📢" },
  { href: "/superadmin/audit-log",    label: "Audit Log",      icon: "📋" },
  { href: "/superadmin/settings",     label: "Settings",       icon: "⚙️" },
];

export default function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user && !user.is_super_admin) router.replace("/dashboard");
  }, [user, router]);

  if (!user) { router.replace("/login"); return null; }
  if (!user.is_super_admin) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, background: "#18181b", color: "#fff", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #333" }}>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5 }}>ShelterTrace</div>
          <div style={{ fontSize: 10, color: "#a1a1aa", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform Admin</div>
        </div>

        <div style={{ flex: 1, padding: "8px 0", overflow: "auto" }}>
          {NAV.map((item) => {
            const active = item.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13,
                color: active ? "#fff" : "#a1a1aa", fontWeight: active ? 700 : 400,
                background: active ? "#27272a" : "transparent", textDecoration: "none",
                borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent",
              }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid #333" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 12, color: "#71717a", textDecoration: "none" }}>
            ← Back to Shelter
          </Link>
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #333", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{user.firstName} {user.lastName}</div>
            <div style={{ fontSize: 10, color: "#f59e0b" }}>Super Admin</div>
          </div>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 14 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={logout} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 15 }}>⏻</button>
        </div>
      </nav>

      <main style={{ flex: 1, marginLeft: 220, minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </main>
    </div>
  );
}
