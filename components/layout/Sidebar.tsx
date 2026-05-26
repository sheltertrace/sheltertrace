"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useAuth, useTheme } from "@/app/providers";
import { hasPermission } from "@/lib/auth";
import { fetchUnreadCount } from "@/lib/messages";

interface NavItem {
  href: string;
  label: string;
  perm: string;
  icon: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    section: "Shelter",
    items: [
      { href: "/",         label: "Dashboard",   perm: "dashboard", icon: "⊞"  },
      { href: "/animals",  label: "Animals",     perm: "animals",   icon: "🐾" },
      { href: "/kennels",  label: "Kennels",     perm: "kennels",   icon: "🏠" },
      { href: "/medical",  label: "Medical",     perm: "medical",   icon: "💊" },
      { href: "/clinic",   label: "Clinic",      perm: "animals",   icon: "💉" },
    ],
  },
  {
    section: "Field",
    items: [
      { href: "/dispatch",   label: "Dispatch",     perm: "dispatch", icon: "📡" },
      { href: "/field-ops",  label: "Field Ops",    perm: "dispatch", icon: "🚓" },
      { href: "/citations",  label: "Citations",    perm: "dispatch", icon: "📋" },
      { href: "/court",      label: "Court Portal", perm: "court",    icon: "⚖️" },
      { href: "/ordinances", label: "Ordinances",   perm: "dispatch", icon: "📖" },
    ],
  },
  {
    section: "Outcomes",
    items: [
      { href: "/adoptions", label: "Adoptions",   perm: "adoptions", icon: "🏡" },
      { href: "/foster",    label: "Foster Care", perm: "foster",    icon: "❤️" },
      { href: "/transfers", label: "Transfers",   perm: "animals",   icon: "🚌" },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/messages",           label: "Messages",    perm: "dashboard",  icon: "💬" },
      { href: "/receipts",          label: "Receipts",    perm: "receipts",   icon: "🧾" },
      { href: "/people",            label: "Search",      perm: "people",     icon: "🔍" },
      { href: "/lost-found-admin",  label: "Lost & Found",  perm: "animals",   icon: "🔎" },
      { href: "/pet-licenses",      label: "Pet Licenses",  perm: "animals",   icon: "🪪" },
      { href: "/forms",      label: "Forms",      perm: "dispatch",   icon: "📝" },
      { href: "/volunteers", label: "Volunteers", perm: "volunteers", icon: "🙋" },
      { href: "/reports",    label: "Reports",    perm: "reports",    icon: "📊" },
      { href: "/admin",      label: "Admin",      perm: "admin",      icon: "⚙️" },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const isAdmin = user.permissions.includes("all");

  // ── Unread message count ──────────────────────────────────────────────────
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    fetchUnreadCount(user.id).then(setUnreadMsgs).catch(() => {});
    const id = setInterval(() => fetchUnreadCount(user.id).then(setUnreadMsgs).catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, [user?.id]);

  function canSee(item: NavItem): boolean {
    if (item.perm === "admin") return isAdmin;
    if (item.perm === "dashboard") return true;
    return hasPermission(user, item.perm);
  }

  return (
    <nav className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-logo">
        <Image src="/logo.jpg" alt="ShelterTrace" width={44} height={44} style={{ borderRadius: 8, background: "#ececec", padding: 3 }} />
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">ShelterTrace</div>
          <div className="sidebar-brand-sub">Shelter Data Systems</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(canSee);
          if (visible.length === 0) return null;
          return (
            <div key={group.section}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.32)",
                padding: "14px 12px 4px",
                userSelect: "none",
              }}>
                {group.section}
              </div>
              {visible.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const msgBadge = item.href === "/messages" && unreadMsgs > 0 ? unreadMsgs : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${isActive ? " active" : ""}`}
                    onClick={() => onClose?.()}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {msgBadge > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#0d9488", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 18, height: 18, padding: "0 4px" }}>
                        {msgBadge > 99 ? "99+" : msgBadge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">{user.avatar}</div>
        <div className="user-info">
          <div className="user-name">{user.firstName} {user.lastName}</div>
          <div className="user-role">{user.role}</div>
        </div>
        <button
          onClick={toggleTheme}
          className="btn btn-ghost btn-sm"
          style={{ color: "rgba(255,255,255,0.5)", padding: "4px", fontSize: 15 }}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <button
          onClick={logout}
          className="btn btn-ghost btn-sm"
          style={{ color: "rgba(255,255,255,0.5)", padding: "4px", fontSize: 16 }}
          title="Sign out"
        >
          ⏻
        </button>
      </div>
    </nav>
  );
}
