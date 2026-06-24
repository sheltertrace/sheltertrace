"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, useTheme } from "@/app/providers";
import { fetchClinicClients } from "@/lib/clinicData";
import type { ClinicClient } from "@/lib/clinicTypes";

interface ClinicContextValue {
  clients: ClinicClient[];
  selectedClientId: string | null;
  selectedClient: ClinicClient | null;
  setSelectedClientId: (id: string | null) => void;
  refreshClients: () => void;
}

const ClinicContext = createContext<ClinicContextValue>({
  clients: [], selectedClientId: null, selectedClient: null,
  setSelectedClientId: () => {}, refreshClients: () => {},
});

export function useClinic() { return useContext(ClinicContext); }

const NAV_ITEMS = [
  { href: "/clinic-portal",              label: "Dashboard",           icon: "🏠" },
  { href: "/clinic-portal/clients",      label: "County Clients",      icon: "🏛️" },
  { href: "/clinic-portal/animals",      label: "Animals",             icon: "🐾" },
  { href: "/clinic-portal/appointments", label: "Appointments",        icon: "📅" },
  { href: "/clinic-portal/medical",      label: "Medical Records",     icon: "💊" },
  { href: "/clinic-portal/procedures",   label: "Procedures",          icon: "🔬" },
  { href: "/clinic-portal/invoices",     label: "Invoicing & Billing", icon: "💰" },
  { href: "/clinic-portal/email",        label: "Email",               icon: "📧" },
  { href: "/clinic-portal/documents",    label: "Documents & Reports", icon: "📄" },
  { href: "/clinic-portal/settings",     label: "Clinic Settings",     icon: "⚙️" },
];

export default function ClinicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [clients, setClients] = useState<ClinicClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadClients = useCallback(async () => {
    if (!user?.id) return;
    const c = await fetchClinicClients(user.id);
    setClients(c);
  }, [user?.id]);

  useEffect(() => { loadClients(); }, [loadClients]);

  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null;

  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <ClinicContext.Provider value={{ clients, selectedClientId, selectedClient, setSelectedClientId, refreshClients: loadClients }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <nav style={{
          width: 240, background: "#1a3a6b", color: "#fff", display: "flex", flexDirection: "column",
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100,
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }} className={`clinic-sidebar${sidebarOpen ? " open" : ""}`}>
          {/* Logo */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/logo.jpg" alt="ShelterTrace" width={36} height={36} style={{ borderRadius: 6, background: "#ececec", padding: 2 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>ShelterTrace</div>
              <div style={{ fontSize: 10, color: "#93c5fd" }}>Clinic Portal</div>
            </div>
          </div>

          {/* Client Switcher */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>County Client</div>
            <select
              value={selectedClientId || ""}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontWeight: 600 }}
            >
              <option value="" style={{ color: "#000" }}>All Counties</option>
              {clients.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id} style={{ color: "#000" }}>{c.county_name}</option>
              ))}
            </select>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/clinic-portal"
                ? pathname === "/clinic-portal"
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px", fontSize: 13, fontWeight: isActive ? 700 : 400,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    textDecoration: "none", borderLeft: isActive ? "3px solid #38bdf8" : "3px solid transparent",
                    transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{user.role}</div>
            </div>
            <button onClick={toggleTheme} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }} title="Toggle theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button onClick={logout} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 15 }} title="Sign out">
              ⏻
            </button>
          </div>
        </nav>

        {/* Main */}
        <main style={{ flex: 1, marginLeft: 240, minHeight: "100vh" }}>
          {/* County banner */}
          {selectedClient && (
            <div style={{ background: "#0369a1", color: "#fff", padding: "6px 24px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🏛️</span>
              <span>{selectedClient.county_name}{selectedClient.agency_name ? ` — ${selectedClient.agency_name}` : ""}</span>
            </div>
          )}

          {/* Mobile header */}
          <div className="clinic-mobile-header" style={{ display: "none", padding: "10px 16px", background: "#1a3a6b", color: "#fff", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>☰</button>
            <span style={{ fontWeight: 700, fontSize: 14 }}>ShelterTrace Clinic</span>
            <div style={{ width: 24 }} />
          </div>

          <div style={{ padding: "20px 24px" }}>
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .clinic-sidebar { transform: translateX(-100%); transition: transform 0.2s ease; }
          .clinic-sidebar.open { transform: translateX(0) !important; }
          .clinic-mobile-header { display: flex !important; }
          main { margin-left: 0 !important; }
        }
      `}</style>
    </ClinicContext.Provider>
  );
}
