"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/providers";
import Sidebar from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export default function AppShell({ children, title, action }: AppShellProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Close drawer on any navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#64748b", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🐾</div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>Loading ShelterTrace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Mobile overlay — tap to close sidebar */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="main-content">
        <div className="top-bar">
          {/* Hamburger — visible only on mobile via CSS */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>
          <h1 className="top-bar-title">{title}</h1>
          {action && <div className="top-bar-action">{action}</div>}
        </div>
        <div className="page-content">
          {children}
        </div>
        <div className="app-footer">
          ShelterTrace v1.0 · Shelter Data Systems · © 2026
        </div>
      </div>
    </div>
  );
}
