"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, useTheme } from "@/app/providers";

const NAV = [
  { href: "/city-portal",              label: "Dashboard",         icon: "🏠" },
  { href: "/city-portal/applications", label: "Applications",      icon: "📋" },
  { href: "/city-portal/licenses",     label: "Licenses",          icon: "🏷️" },
  { href: "/city-portal/lookup",       label: "License Lookup",    icon: "🔍" },
  { href: "/city-portal/upload",       label: "Upload Form",       icon: "📁" },
  { href: "/city-portal/payments",     label: "Payments",          icon: "💰" },
  { href: "/city-portal/reports",      label: "Reports",           icon: "📊" },
  { href: "/city-portal/settings",     label: "Settings",          icon: "⚙️" },
];

const CITY_BLUE = "#1B3A5C";
const CITY_ACCENT = "#2E86AB";

export default function CityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user && user.account_type !== "city") router.replace("/dashboard");
  }, [user, router]);

  if (!user) { router.replace("/login"); return null; }
  if (user.account_type !== "city") return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: 220, background: CITY_BLUE, color: "#fff", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>City of Madison</div>
          <div style={{ fontSize: 14, fontWeight: 900 }}>Pet Licensing Portal</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>ShelterTrace</div>
        </div>

        <div style={{ flex: 1, padding: "8px 0", overflow: "auto" }}>
          {NAV.map((item) => {
            const active = item.href === "/city-portal" ? pathname === "/city-portal" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", fontSize: 13,
                color: active ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: active ? 700 : 400,
                background: active ? "rgba(255,255,255,0.12)" : "transparent", textDecoration: "none",
                borderLeft: active ? `3px solid ${CITY_ACCENT}` : "3px solid transparent",
              }}>
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <a href="https://madison.georgia.gov" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>City of Madison, Georgia</a>
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{user.firstName} {user.lastName}</div>
            <div style={{ fontSize: 10, color: CITY_ACCENT }}>City Staff</div>
          </div>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}>{theme === "dark" ? "☀️" : "🌙"}</button>
          <button onClick={logout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15 }}>⏻</button>
        </div>
      </nav>

      <main style={{ flex: 1, marginLeft: 220, minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: CITY_BLUE, padding: "8px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>City of Madison · Dog License Administration</div>
        </div>
        <div style={{ padding: "20px 24px" }}>{children}</div>
      </main>
    </div>
  );
}
