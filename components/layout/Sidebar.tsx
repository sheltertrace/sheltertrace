"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useAuth, useTheme } from "@/app/providers";
import { hasPermission } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard", perm: "dashboard", icon: "⊞" },
  { href: "/animals", label: "Animals", perm: "animals", icon: "🐾" },
  { href: "/adoptions", label: "Adoptions", perm: "adoptions", icon: "🏡" },
  { href: "/foster", label: "Foster Care", perm: "foster", icon: "❤️" },
  { href: "/medical", label: "Medical", perm: "medical", icon: "💊" },
  { href: "/dispatch", label: "Dispatch", perm: "dispatch", icon: "📡" },
  { href: "/kennels", label: "Kennels", perm: "kennels", icon: "🏠" },
  { href: "/people", label: "Search", perm: "people", icon: "🔍" },
  { href: "/receipts", label: "Receipts", perm: "receipts", icon: "🧾" },
  { href: "/citations", label: "Citations", perm: "dispatch", icon: "📋" },
  { href: "/ordinances", label: "Ordinances", perm: "dispatch", icon: "📖" },
  { href: "/forms", label: "Forms", perm: "dispatch", icon: "📝" },
  { href: "/court", label: "Court Portal", perm: "court", icon: "⚖️" },
  { href: "/reports", label: "Reports", perm: "reports", icon: "📊" },
  { href: "/volunteers", label: "Volunteers", perm: "volunteers", icon: "🙋" },
  { href: "/admin", label: "Admin", perm: "admin", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  console.log("[Sidebar] user.role:", user.role, "| user.permissions:", user.permissions);
  const isAdmin = user.permissions.includes("all");

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <Image src="/logo.jpg" alt="ShelterTrace" width={44} height={44} style={{ borderRadius: 8, background: "#ececec", padding: 3 }} />
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">ShelterTrace</div>
          <div className="sidebar-brand-sub">Shelter Data Systems</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV.filter((item) => {
          if (item.perm === "admin") return isAdmin;
          if (item.perm === "dashboard") return true;
          return hasPermission(user, item.perm);
        }).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? " active" : ""}`}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </Link>
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
