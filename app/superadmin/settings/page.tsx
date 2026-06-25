"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/providers";
import { fetchPlatformSettings, savePlatformSettings, fetchSuperAdmins, updateUser, logAuditAction, type PlatformSettingsData } from "@/lib/superAdminData";
import { FEATURE_FLAGS } from "@/lib/superAdminTypes";
import type { StaffAccount } from "@/lib/types";
import { supabase } from "@/lib/supabase";

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
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([fetchPlatformSettings(), fetchSuperAdmins()]).then(([s, a]) => {
      setSettings(s);
      setSuperAdmins(a);
      persistBranding(s.branding);
    }).finally(() => setLoading(false));
  }, []);

  function persistBranding(b: PlatformSettingsData["branding"]) {
    try {
      localStorage.setItem("st_branding", JSON.stringify(b));
      window.dispatchEvent(new Event("st-branding-update"));
    } catch { }
  }

  const handleSave = async () => {
    if (!settings || !user?.id) return;
    setSaving(true);
    try {
      await savePlatformSettings(settings, user.id);
      await logAuditAction(user.id, "Settings Updated", "settings", "platform");
      persistBranding(settings.branding);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    setLogoUploading(true);
    try {
      const path = `branding/logo-${Date.now()}.${file.name.split(".").pop() || "png"}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      setSettings((s) => s ? { ...s, branding: { ...s.branding, logo_url: urlData.publicUrl } } : s);
    } catch (err: unknown) {
      alert(`Upload failed: ${(err as { message?: string }).message}`);
    } finally { setLogoUploading(false); }
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b" }}>Platform Branding</div>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => {
            const def = { primary_color: "#1B3A5C", secondary_color: "#2E86AB", logo_url: "" };
            setSettings((s) => s ? { ...s, branding: def } : s);
            persistBranding(def);
          }}>Reset to Defaults</button>
        </div>

        {/* Logo */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Platform Logo</div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {settings.branding.logo_url ? (
              <div style={{ position: "relative" }}>
                <img src={settings.branding.logo_url} alt="Logo" style={{ height: 48, borderRadius: 6, border: "1px solid var(--border)" }} />
                <button onClick={() => setSettings((s) => s ? { ...s, branding: { ...s.branding, logo_url: "" } } : s)}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 6, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "var(--text-muted)" }}>📷</div>
            )}
            <div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                {logoUploading ? "Uploading…" : settings.branding.logo_url ? "Replace Logo" : "Upload Logo"}
                <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/svg+xml,image/webp" style={{ display: "none" }} onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>JPG, PNG, SVG, or WebP</div>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="grid-2">
          <F label="Primary Color" hint="Sidebar background color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={settings.branding.primary_color || "#1B3A5C"} onChange={(e) => {
                const v = e.target.value;
                setSettings((s) => { if (!s) return s; const b = { ...s.branding, primary_color: v }; persistBranding(b); return { ...s, branding: b }; });
              }} style={{ width: 40, height: 32, border: "none", padding: 0, cursor: "pointer" }} />
              <input className="form-input" value={settings.branding.primary_color || "#1B3A5C"} onChange={(e) => {
                const v = e.target.value;
                setSettings((s) => { if (!s) return s; const b = { ...s.branding, primary_color: v }; if (/^#[0-9a-fA-F]{6}$/.test(v)) persistBranding(b); return { ...s, branding: b }; });
              }} style={{ maxWidth: 100, fontFamily: "monospace" }} />
              <div style={{ width: 24, height: 24, borderRadius: 4, background: settings.branding.primary_color || "#1B3A5C", border: "1px solid var(--border)" }} />
            </div>
          </F>
          <F label="Secondary Color" hint="Accent / active indicator color">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={settings.branding.secondary_color || "#2E86AB"} onChange={(e) => {
                const v = e.target.value;
                setSettings((s) => { if (!s) return s; const b = { ...s.branding, secondary_color: v }; persistBranding(b); return { ...s, branding: b }; });
              }} style={{ width: 40, height: 32, border: "none", padding: 0, cursor: "pointer" }} />
              <input className="form-input" value={settings.branding.secondary_color || "#2E86AB"} onChange={(e) => {
                const v = e.target.value;
                setSettings((s) => { if (!s) return s; const b = { ...s.branding, secondary_color: v }; if (/^#[0-9a-fA-F]{6}$/.test(v)) persistBranding(b); return { ...s, branding: b }; });
              }} style={{ maxWidth: 100, fontFamily: "monospace" }} />
              <div style={{ width: 24, height: 24, borderRadius: 4, background: settings.branding.secondary_color || "#2E86AB", border: "1px solid var(--border)" }} />
            </div>
          </F>
        </div>

        {/* Live Preview — mini sidebar mockup */}
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "#f8fafc" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>Live Preview</div>
          <div style={{ display: "flex", gap: 16 }}>
            {/* Mini sidebar */}
            <div style={{ width: 160, borderRadius: 8, overflow: "hidden", background: settings.branding.primary_color || "#1B3A5C", color: "#fff", fontSize: 10 }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", gap: 6 }}>
                {settings.branding.logo_url && <img src={settings.branding.logo_url} alt="" style={{ height: 16, borderRadius: 2 }} />}
                <span style={{ fontWeight: 800, fontSize: 11 }}>ShelterTrace</span>
              </div>
              <div style={{ padding: "4px 0" }}>
                <div style={{ padding: "4px 10px", borderLeft: `2px solid ${settings.branding.secondary_color || "#2E86AB"}`, background: "rgba(255,255,255,0.12)", fontWeight: 700 }}>Dashboard</div>
                <div style={{ padding: "4px 10px", color: "rgba(255,255,255,0.5)" }}>Customers</div>
                <div style={{ padding: "4px 10px", color: "rgba(255,255,255,0.5)" }}>Users</div>
              </div>
              <div style={{ padding: "6px 10px", borderTop: "1px solid rgba(255,255,255,0.15)", color: settings.branding.secondary_color || "#2E86AB", fontSize: 9, fontWeight: 700 }}>Super Admin</div>
            </div>
            {/* Mini button */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
              <button type="button" style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: settings.branding.secondary_color || "#2E86AB", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "default" }}>Accent Button</button>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Colors update the sidebar in real time.<br />Click "Save Settings" to persist.</div>
            </div>
          </div>
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
