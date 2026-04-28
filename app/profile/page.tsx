"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { StaffAccount } from "@/lib/types";
import { useTheme } from "@/app/providers";

export default function ProfilePage() {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<StaffAccount | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<StaffAccount>>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    const u = getCurrentUser();
    if (u) { setUser(u); setEditData(u); }
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data } = await (supabase as any).from("staff_accounts").update(editData).eq("id", user.id).select().single();
      if (data) {
        setUser(data as StaffAccount);
        sessionStorage.setItem("shelter_user", JSON.stringify(data));
      }
      setEditing(false);
    } catch { } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (!user || !newPassword || newPassword !== confirmPassword) {
      setPwMsg(newPassword !== confirmPassword ? "Passwords do not match." : "Enter a new password.");
      return;
    }
    try {
      await (supabase as any).from("staff_accounts").update({ password_hash: newPassword }).eq("id", user.id);
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg("Password updated successfully.");
    } catch {
      setPwMsg("Failed to update password.");
    }
  };

  if (!user) return (
    <AppShell title="My Account">
      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading…</div>
    </AppShell>
  );

  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();

  const roleColors: Record<string, string> = {
    Admin: "#ef4444", Officer: "#3b82f6", Dispatcher: "#f59e0b", "Vet Tech": "#22c55e",
    "Front Desk": "#8b5cf6", "Court Clerk": "#0ea5e9", Judge: "#64748b", Volunteer: "#f97316",
  };

  return (
    <AppShell title="My Account">
      <div style={{ maxWidth: 640 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: roleColors[user.role] || "var(--teal)", color: "#fff", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{user.first_name} {user.last_name}</h2>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>@{user.username} · {user.role}</div>
            {user.badge && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Badge #{user.badge}</div>}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(!editing); if (!editing) setEditData(user); }}>
              {editing ? "Cancel" : "✏ Edit Profile"}
            </button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Account Information</div>
          {editing ? (
            <div>
              <div className="grid-2">
                {[
                  { label: "First Name", key: "first_name" as const },
                  { label: "Last Name", key: "last_name" as const },
                  { label: "Email", key: "email" as const },
                  { label: "Phone", key: "phone" as const },
                ].map(({ label, key }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" value={(editData[key] as string) || ""} onChange={(e) => setEditData((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                <button className="btn btn-secondary" onClick={() => { setEditing(false); setEditData(user); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="grid-2" style={{ gap: 12 }}>
              {[
                ["Username", user.username],
                ["Role", user.role],
                ["Email", user.email || "—"],
                ["Phone", user.phone || "—"],
                ["Badge #", user.badge || "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Permissions */}
        {Array.isArray(user.permissions) && user.permissions.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>My Permissions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(user.permissions as string[]).map((p) => (
                <span key={p} style={{ padding: "4px 12px", borderRadius: 20, background: "#f0fdfa", color: "#0f766e", border: "1px solid #99f6e4", fontSize: 12, fontWeight: 600 }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Preferences</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Theme</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Choose your display mode</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`btn btn-sm ${theme === t ? "btn-primary" : "btn-secondary"}`}
                  style={{ minWidth: 90 }}
                >
                  {t === "light" ? "☀️ Light" : "🌙 Dark"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Change Password</div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password…" style={{ maxWidth: 280 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password…" style={{ maxWidth: 280 }} />
          </div>
          {pwMsg && <div style={{ fontSize: 13, color: pwMsg.includes("success") ? "#22c55e" : "#ef4444", marginBottom: 8 }}>{pwMsg}</div>}
          <button className="btn btn-primary btn-sm" onClick={handlePasswordChange}>Update Password</button>
        </div>
      </div>
    </AppShell>
  );
}
