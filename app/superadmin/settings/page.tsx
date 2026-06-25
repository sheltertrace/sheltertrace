"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { fetchPlatformSettings, savePlatformSettings, fetchSuperAdmins, updateUser, logAuditAction, type PlatformSettingsData } from "@/lib/superAdminData";
import { FEATURE_FLAGS } from "@/lib/superAdminTypes";
import type { StaffAccount } from "@/lib/types";

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>{children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

const NOTIF_KEYS = [
  { key: "new_customer", label: "New customer created" },
  { key: "trial_7_days", label: "Trial expiring in 7 days" },
  { key: "trial_1_day", label: "Trial expiring in 1 day" },
  { key: "payment_overdue", label: "Payment overdue (35+ days)" },
  { key: "account_suspended", label: "Account suspended" },
  { key: "new_user", label: "New user created" },
  { key: "error_alerts", label: "Error/crash alerts" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSettingsData | null>(null);
  const [superAdmins, setSuperAdmins] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchPlatformSettings(), fetchSuperAdmins()]).then(([s, a]) => { setSettings(s); setSuperAdmins(a); }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings || !user?.id) return;
    setSaving(true);
    try {
      await savePlatformSettings(settings, user.id);
      await logAuditAction(user.id, "Settings Updated", "settings", "platform");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const handleRemoveSuperAdmin = async (adminId: string) => {
    if (adminId === user?.id) { alert("Cannot remove your own super admin access."); return; }
    if (!confirm("Remove super admin access for this user?")) return;
    await updateUser(adminId, { is_super_admin: false });
    setSuperAdmins((prev) => prev.filter((a) => a.id !== adminId));
    if (user?.id) await logAuditAction(user.id, "Super Admin Removed", "user", adminId);
  };

  const toggleFlag = (key: string) => {
    if (!settings) return;
    const flags = { ...settings.default_feature_flags };
    flags[key] = !flags[key];
    setSettings((s) => s ? { ...s, default_feature_flags: flags } : s);
  };

  const toggleNotif = (key: string) => {
    if (!settings) return;
    const prefs = { ...settings.notification_preferences };
    prefs[key] = !prefs[key];
    setSettings((s) => s ? { ...s, notification_preferences: prefs } : s);
  };

  if (loading || !settings) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>⚙️ Platform Settings</h1>

      {/* Platform Info */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 14 }}>Platform Configuration</div>
        <div className="grid-2">
          <F label="Platform Name"><input className="form-input" value={settings.platform_name} onChange={(e) => setSettings((s) => s ? { ...s, platform_name: e.target.value } : s)} /></F>
          <F label="Support Email"><input className="form-input" type="email" value={settings.support_email} onChange={(e) => setSettings((s) => s ? { ...s, support_email: e.target.value } : s)} /></F>
          <F label="Website"><input className="form-input" value={settings.platform_website} onChange={(e) => setSettings((s) => s ? { ...s, platform_website: e.target.value } : s)} /></F>
          <F label="Default Trial Period (days)"><input className="form-input" type="number" min="0" value={settings.default_trial_days} onChange={(e) => setSettings((s) => s ? { ...s, default_trial_days: parseInt(e.target.value) || 0 } : s)} style={{ maxWidth: 100 }} /></F>
        </div>
      </div>

      {/* Default Feature Flags */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 8 }}>Default Feature Flags</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>New accounts will have these modules enabled by default.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FEATURE_FLAGS.map((ff) => {
            const on = !!settings.default_feature_flags[ff.key];
            return (
              <button key={ff.key} type="button" onClick={() => toggleFlag(ff.key)} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1px solid ${on ? "var(--teal)" : "var(--border)"}`,
                background: on ? "#f0fdfa" : "#fff", color: on ? "var(--teal)" : "var(--text-secondary)",
                fontWeight: on ? 700 : 400,
              }}>
                {on ? "✓ " : ""}{ff.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Branding */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 14 }}>Platform Branding</div>
        <div className="grid-2">
          <F label="Primary Color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={settings.branding.primary_color || "#1B3A5C"} onChange={(e) => setSettings((s) => s ? { ...s, branding: { ...s.branding, primary_color: e.target.value } } : s)} />
              <input className="form-input" value={settings.branding.primary_color || "#1B3A5C"} onChange={(e) => setSettings((s) => s ? { ...s, branding: { ...s.branding, primary_color: e.target.value } } : s)} style={{ maxWidth: 100 }} />
            </div>
          </F>
          <F label="Secondary Color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={settings.branding.secondary_color || "#2E86AB"} onChange={(e) => setSettings((s) => s ? { ...s, branding: { ...s.branding, secondary_color: e.target.value } } : s)} />
              <input className="form-input" value={settings.branding.secondary_color || "#2E86AB"} onChange={(e) => setSettings((s) => s ? { ...s, branding: { ...s.branding, secondary_color: e.target.value } } : s)} style={{ maxWidth: 100 }} />
            </div>
          </F>
        </div>
      </div>

      {/* Notifications */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 8 }}>Email Notifications</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Alerts sent to {settings.support_email}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {NOTIF_KEYS.map((n) => (
            <label key={n.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={!!settings.notification_preferences[n.key]} onChange={() => toggleNotif(n.key)} />
              {n.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</button>
        {saved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* Super Admins */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b", marginBottom: 14 }}>Super Admin Accounts</div>
        {superAdmins.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No super admins found.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {superAdmins.map((a) => {
              const name = `${a.first_name || a.firstName || ""} ${a.last_name || a.lastName || ""}`.trim();
              const isMe = a.id === user?.id;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f8fafc", borderRadius: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{name}{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "#f59e0b" }}>(you)</span>}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{a.username} · {a.email || "no email"}</div>
                  </div>
                  {!isMe && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#dc2626" }} onClick={() => handleRemoveSuperAdmin(a.id)}>Remove Access</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>To add a new super admin, edit any user in the Users module and set is_super_admin = true.</div>
      </div>
    </div>
  );
}
