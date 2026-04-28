"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

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
      <Sidebar />
      <div className="main-content">
        <div className="top-bar">
          <h1 className="top-bar-title">{title}</h1>
          {action && <div>{action}</div>}
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
