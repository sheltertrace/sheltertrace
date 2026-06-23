"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import type { StaffAccount, CourtSettings, ShelterSettings } from "@/lib/types";
import { genId, today } from "@/lib/utils";
import { fetchAnimals, fetchCalls, fetchPeople, fetchCourtSettings, saveCourtSettings, fetchShelterSettings, saveShelterSettings, fetchIdexxConfig, saveIdexxConfig, fetchIdexxOrders } from "@/lib/data";
import type { Animal, DispatchCall, Person, MedicalRecord } from "@/lib/types";
import type { IdexxConfig } from "@/lib/idexx";
import { IDEXX_TEST_CODES } from "@/lib/idexx";
import { useAuth } from "@/app/providers";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE_DOTS, COURT_MAGISTRATE, COURT_STATE } from "@/lib/shelterInfo";
import { IS_DEMO } from "@/lib/demo";

const PRESET_ROLES = ["Administrator", "Shelter Manager", "Officer", "Dispatcher", "Vet Tech", "Front Desk", "Court Clerk", "Judge", "Volunteer", "Veterinarian", "Adoption Counselor", "Animal Care Tech", "Field Officer", "Volunteer Coordinator"];
const ALL_PERMS = ["animals", "dispatch", "medical", "people", "adoptions", "foster", "kennels", "receipts", "citations", "court", "reports", "volunteers", "admin"];
const PERM_LABELS: Record<string, string> = {
  animals: "Animals", dispatch: "Dispatch", medical: "Medical", people: "People",
  adoptions: "Adoptions", foster: "Foster", kennels: "Kennels", receipts: "Receipts",
  citations: "Citations", court: "Court", reports: "Reports", volunteers: "Volunteers", admin: "Admin",
};

function RoleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(!PRESET_ROLES.includes(value));
  return (
    <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
      <select className="form-select" value={custom ? "__custom__" : value} onChange={(e) => {
        if (e.target.value === "__custom__") { setCustom(true); onChange(""); }
        else { setCustom(false); onChange(e.target.value); }
      }}>
        {PRESET_ROLES.map((r) => <option key={r}>{r}</option>)}
        <option value="__custom__">— Custom role…</option>
      </select>
      {custom && (
        <input className="form-input" placeholder="Type custom role name" value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
      )}
    </div>
  );
}

const ADMIN_ROLES = ["Administrator", "Admin"];

function permsForRole(role: string): string[] | null {
  return ADMIN_ROLES.includes(role) ? ["all"] : null;
}

function PermButtons({ perms, onChange }: { perms: string[]; onChange: (p: string[]) => void }) {
  const isAll = perms.includes("all");
  const toggle = (p: string) => onChange(perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p]);
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => onChange(isAll ? [] : ["all"])}
          style={{
            padding: "4px 14px", borderRadius: 20,
            border: `2px solid ${isAll ? "#ef4444" : "var(--border)"}`,
            background: isAll ? "#fef2f2" : "#fff",
            color: isAll ? "#ef4444" : "var(--text-secondary)",
            cursor: "pointer", fontSize: 12, fontWeight: isAll ? 700 : 400,
          }}>
          {isAll ? "★ All Access (Admin)" : "☆ All Access (Admin)"}
        </button>
        {isAll && <span style={{ fontSize: 11, color: "#ef4444", marginLeft: 10, fontStyle: "italic" }}>Full admin access — overrides individual permissions</span>}
      </div>
      {!isAll && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ALL_PERMS.map((p) => {
            const active = perms.includes(p);
            return (
              <button key={p} type="button" onClick={() => toggle(p)}
                style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${active ? "var(--teal)" : "var(--border)"}`, background: active ? "#f0fdfa" : "#fff", color: active ? "var(--teal)" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400 }}>
                {PERM_LABELS[p]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const IDEXX_DEFAULTS: IdexxConfig = {
  practice_id: "", api_key: "", api_secret: "", account_number: "",
  vetconnect_username: "", vetconnect_password: "", auto_sync: true,
  use_sandbox: false, webhook_secret: "",
};

const DEMO_IDEXX_CONFIG: Partial<IdexxConfig> = {
  practice_id:         "DEMO-12345",
  api_key:             "demo-api-key-xxxx",
  api_secret:          "demo-secret-xxxx",
  account_number:      "DEMO-ACC-001",
  vetconnect_username: "demo@sheltertrace.com",
  vetconnect_password: "demo-password",
};

export default function AdminPage() {
  console.log("[AdminPage] rendering — tabs: staff | shelter | court | address | integrations");
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<"staff" | "address" | "court" | "shelter" | "integrations">("staff");
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffAccount | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<StaffAccount> & { newPassword?: string }>({});
  const [newData, setNewData] = useState({ username: "", password: "", first_name: "", last_name: "", role: "Officer", email: "", phone: "", badge: "", permissions: [] as string[] });

  // Court settings state
  const [courtSettings, setCourtSettings] = useState<CourtSettings>({ magistrate_email: "", municipal_email: "", portal_url: "https://sheltertrace.com/court" });
  const [courtSaving, setCourtSaving] = useState(false);
  const [courtSaved, setCourtSaved] = useState(false);

  // Shelter settings state
  const [shelterSettings, setShelterSettings] = useState<ShelterSettings>({ shelter_name: AGENCY_NAME, shelter_address: AGENCY_ADDRESS, shelter_phone: AGENCY_PHONE_DOTS, gda_license_number: "" });
  const [shelterSaving, setShelterSaving] = useState(false);
  const [shelterSaved, setShelterSaved] = useState(false);

  // IDEXX integration state
  const [idexxConfig, setIdexxConfig] = useState<IdexxConfig>(IS_DEMO ? { ...IDEXX_DEFAULTS, ...DEMO_IDEXX_CONFIG } : IDEXX_DEFAULTS);
  const [idexxSaving, setIdexxSaving] = useState(false);
  const [idexxSaved, setIdexxSaved] = useState(false);
  const [idexxTesting, setIdexxTesting] = useState(false);
  const [idexxTestResult, setIdexxTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [idexxOrders, setIdexxOrders] = useState<MedicalRecord[]>([]);
  const [idexxOrdersLoading, setIdexxOrdersLoading] = useState(false);
  const [idexxOrderFilter, setIdexxOrderFilter] = useState<"all" | "Pending" | "Resulted" | "Error">("all");
  const [idexxManualResult, setIdexxManualResult] = useState<{ recordId: string; value: string } | null>(null);
  const [idexxShowSecret, setIdexxShowSecret] = useState<Record<string, boolean>>({});

  // Address lookup state
  const [addrQuery, setAddrQuery] = useState("");
  const [addrAnimals, setAddrAnimals] = useState<Animal[]>([]);
  const [addrCalls, setAddrCalls] = useState<DispatchCall[]>([]);
  const [addrPeople, setAddrPeople] = useState<Person[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrSearched, setAddrSearched] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data }, cs, ss, idexx] = await Promise.all([
        supabase.from("staff_accounts").select("*").order("created_at"),
        fetchCourtSettings(),
        fetchShelterSettings(),
        fetchIdexxConfig(),
      ]);
      setStaff(((data as StaffAccount[]) || []).map((s) => ({
        ...s,
        firstName: s.first_name || s.firstName,
        lastName: s.last_name || s.lastName,
      })));
      setCourtSettings(cs);
      setShelterSettings(ss);
      if (!IS_DEMO) setIdexxConfig(idexx);
    } catch { } finally { setLoading(false); }
  }, []);

  const loadIdexxOrders = useCallback(async () => {
    setIdexxOrdersLoading(true);
    try {
      const orders = await fetchIdexxOrders();
      setIdexxOrders(orders);
    } catch { } finally { setIdexxOrdersLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "integrations") loadIdexxOrders();
  }, [tab, loadIdexxOrders]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCourtSettings = async () => {
    setCourtSaving(true);
    try {
      await saveCourtSettings(courtSettings);
      setCourtSaved(true);
      setTimeout(() => setCourtSaved(false), 3000);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to save court settings: ${err?.message || "Unknown error"}`);
    } finally { setCourtSaving(false); }
  };

  const handleSaveIdexxConfig = async () => {
    if (IS_DEMO) { alert("Demo mode — IDEXX config is read-only."); return; }
    setIdexxSaving(true);
    try {
      await saveIdexxConfig(idexxConfig);
      setIdexxSaved(true);
      setTimeout(() => setIdexxSaved(false), 3000);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to save IDEXX config: ${err?.message || "Unknown error"}`);
    } finally { setIdexxSaving(false); }
  };

  const handleTestIdexx = async () => {
    setIdexxTesting(true);
    setIdexxTestResult(null);
    try {
      const res = await fetch("/api/idexx/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: IS_DEMO ? undefined : idexxConfig }),
      });
      const result = await res.json() as { ok: boolean; message: string };
      setIdexxTestResult(result);
    } catch (e: unknown) {
      const err = e as Error;
      setIdexxTestResult({ ok: false, message: err.message || "Request failed" });
    } finally { setIdexxTesting(false); }
  };

  const handleManualResult = async (recordId: string, result: string) => {
    if (!result) return;
    try {
      await supabase.from("medical_records").update({
        test_result:   result,
        idexx_status:  "Resulted",
        idexx_resulted_at: new Date().toISOString(),
        status:        "Administered",
        updated_at:    new Date().toISOString(),
      }).eq("id", recordId);
      setIdexxOrders((prev) => prev.map((r) => r.id === recordId ? { ...r, test_result: result, idexx_status: "Resulted" } : r));
      setIdexxManualResult(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed: ${err?.message}`);
    }
  };

  const handleSaveShelterSettings = async () => {
    setShelterSaving(true);
    try {
      await saveShelterSettings(shelterSettings);
      setShelterSaved(true);
      setTimeout(() => setShelterSaved(false), 3000);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to save shelter settings: ${err?.message || "Unknown error"}`);
    } finally { setShelterSaving(false); }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Only send columns that actually exist in the staff_accounts table.
      // Spreading editData directly would include client-only fields (firstName,
      // lastName, password, avatar, department) that cause PostgREST 400 errors.
      const finalRole = editData.role || selected.role;
      const rawPerms = editData.permissions ?? selected.permissions;
      const finalPerms = permsForRole(finalRole) ?? rawPerms;
      const updates: Record<string, unknown> = {
        username: (editData.username || "").trim(),
        first_name: (editData.first_name || "").trim(),
        last_name: (editData.last_name || "").trim(),
        role: finalRole,
        email: (editData.email || "").trim() || null,
        phone: (editData.phone || "").trim() || null,
        badge: (editData.badge || "").trim() || null,
        permissions: finalPerms,
      };
      if ((editData.newPassword || "").trim()) {
        updates.password_hash = editData.newPassword!.trim();
      }
      const { error } = await supabase.from("staff_accounts").update(updates).eq("id", selected.id);
      if (error) throw error;
      setStaff((prev) => prev.map((s) => s.id === selected.id
        ? { ...s, ...updates, firstName: updates.first_name as string, lastName: updates.last_name as string }
        : s));
      setShowEdit(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to save: ${err?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  const handleAdd = async () => {
    if (!newData.username || !newData.first_name || !newData.last_name || !newData.password) return;
    setSaving(true);
    try {
      const rec = {
        id: genId(),
        username: newData.username.trim(),
        password_hash: newData.password.trim(),
        first_name: newData.first_name.trim(),
        last_name: newData.last_name.trim(),
        role: newData.role,
        email: newData.email.trim() || null,
        phone: newData.phone.trim() || null,
        badge: newData.badge.trim() || null,
        permissions: permsForRole(newData.role) ?? newData.permissions,
        active: true,
      };
      const { error } = await (supabase as any).from("staff_accounts").insert([rec]);
      if (error) throw error;
      setStaff((prev) => [...prev, { ...rec, firstName: rec.first_name, lastName: rec.last_name } as unknown as StaffAccount]);
      setShowAdd(false);
      setNewData({ username: "", password: "", first_name: "", last_name: "", role: "Officer", email: "", phone: "", badge: "", permissions: [] });
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to add staff: ${err?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (s: StaffAccount) => {
    await (supabase as any).from("staff_accounts").update({ active: !s.active }).eq("id", s.id);
    setStaff((prev) => prev.map((x) => x.id === s.id ? { ...x, active: !x.active } : x));
  };

  const handleDelete = async (s: StaffAccount) => {
    const name = `${s.first_name || s.firstName} ${s.last_name || s.lastName}`.trim();
    if (!confirm(`Are you sure you want to permanently delete ${name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("staff_accounts").delete().eq("id", s.id);
    if (error) { alert(`Failed to delete: ${error.message}`); return; }
    setStaff((prev) => prev.filter((x) => x.id !== s.id));
  };

  const handleAddressSearch = async () => {
    if (!addrQuery.trim()) return;
    setAddrLoading(true);
    setAddrSearched(true);
    const q = addrQuery.trim().toLowerCase();
    try {
      const [animals, calls, people] = await Promise.all([fetchAnimals(), fetchCalls(), fetchPeople()]);
      setAddrAnimals(animals.filter((a) => (a.found_address || "").toLowerCase().includes(q) || (a.found_city || "").toLowerCase().includes(q)));
      setAddrCalls(calls.filter((c) => (c.address || "").toLowerCase().includes(q) || (c.city || "").toLowerCase().includes(q)));
      setAddrPeople(people.filter((p) => (p.address || "").toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q)));
    } catch { } finally { setAddrLoading(false); }
  };

  const getInitials = (s: StaffAccount) => `${(s.first_name || s.firstName || "")[0] || ""}${(s.last_name || s.lastName || "")[0] || ""}`.toUpperCase();

  const roleColor = (role: string) => {
    const map: Record<string, string> = { Administrator: "#ef4444", "Shelter Manager": "#6366f1", Officer: "#3b82f6", "Field Officer": "#3b82f6", Dispatcher: "#f59e0b", "Vet Tech": "#22c55e", Veterinarian: "#22c55e", "Front Desk": "#8b5cf6", "Court Clerk": "#0ea5e9", Judge: "#64748b", Volunteer: "#f97316" };
    return map[role] || "#6366f1";
  };

  return (
    <AppShell title="Staff Administration">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {([["staff", "👤 Staff Accounts"], ["shelter", "🏛️ Shelter Settings"], ["court", "⚖️ Court Settings"], ["address", "🔍 Address Lookup"], ["integrations", "🔬 Integrations"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "8px 18px", border: "none", background: "none", fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--teal)" : "var(--text-secondary)", borderBottom: tab === id ? "2px solid var(--teal)" : "2px solid transparent", cursor: "pointer", fontSize: 13 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <>
          {/* Stats */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[
              { label: "Total Staff", value: staff.length, color: "#6366f1", icon: "👤" },
              { label: "Active", value: staff.filter((s) => s.active !== false).length, color: "#22c55e", icon: "🟢" },
              { label: "Inactive", value: staff.filter((s) => s.active === false).length, color: "#64748b", icon: "⭕" },
              { label: "Roles", value: new Set(staff.map((s) => s.role)).size, color: "#f59e0b", icon: "🏷️" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="stat-card">
                <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
                <div><div className="stat-value" style={{ color }}>{value}</div><div className="stat-label">{label}</div></div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {loading ? <div style={{ color: "var(--text-muted)", padding: 20 }}>Loading…</div>
              : staff.map((s) => (
                <div key={s.id} className="card" style={{ padding: 16, opacity: s.active === false ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: roleColor(s.role), color: "#fff", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {getInitials(s)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.first_name || s.firstName} {s.last_name || s.lastName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>@{s.username}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setSelected(s); setEditData({ ...s, newPassword: "" }); setShowEdit(true); }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: s.active === false ? "#22c55e" : "#ef4444" }} onClick={() => handleToggleActive(s)}>
                        {s.active === false ? "Enable" : "Disable"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11, color: "#ef4444" }}
                        disabled={s.id === currentUser?.id}
                        title={s.id === currentUser?.id ? "Cannot delete yourself" : `Delete ${s.first_name || s.firstName}`}
                        onClick={() => handleDelete(s)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: `${roleColor(s.role)}20`, color: roleColor(s.role), fontSize: 11 }}>{s.role}</span>
                    {s.badge && <span className="badge" style={{ background: "#f1f5f9", color: "#475569", fontSize: 11 }}>#{s.badge}</span>}
                    {s.active === false && <span className="badge" style={{ background: "#fee2e2", color: "#991b1b", fontSize: 11 }}>Inactive</span>}
                  </div>
                  {(s.email) && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{s.email}</div>}
                  {Array.isArray(s.permissions) && s.permissions.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(s.permissions as string[]).slice(0, 5).map((p) => (
                        <span key={p} style={{ fontSize: 10, background: "#f0fdfa", color: "#0f766e", padding: "1px 6px", borderRadius: 10, border: "1px solid #99f6e4" }}>{PERM_LABELS[p] || p}</span>
                      ))}
                      {(s.permissions as string[]).length > 5 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{(s.permissions as string[]).length - 5}</span>}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}

      {tab === "shelter" && (
        <div style={{ maxWidth: 640 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Shelter Settings</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            These values auto-fill on GDA forms and official documents. Update them if the shelter's license number or contact info changes.
          </p>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "var(--teal)" }}>🏛️ Shelter Identity</div>
            {([
              ["Shelter Name", "shelter_name", "text", AGENCY_NAME],
              ["Shelter Address", "shelter_address", "text", AGENCY_ADDRESS],
              ["Shelter Phone", "shelter_phone", "text", AGENCY_PHONE_DOTS],
            ] as const).map(([label, key, type, placeholder]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} placeholder={placeholder}
                  value={shelterSettings[key]} onChange={(e) => setShelterSettings((s) => ({ ...s, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, marginTop: 8, color: "var(--teal)" }}>📋 GDA Licensing</div>
            <div className="form-group">
              <label className="form-label">GDA Animal Shelter License #</label>
              <input className="form-input" placeholder="e.g. AS-1234" value={shelterSettings.gda_license_number}
                onChange={(e) => setShelterSettings((s) => ({ ...s, gda_license_number: e.target.value }))} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Auto-fills on all GDA Foster and Inspection forms.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={handleSaveShelterSettings} disabled={shelterSaving}>
                {shelterSaving ? "Saving…" : "Save Shelter Settings"}
              </button>
              {shelterSaved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
            </div>
          </div>
        </div>
      )}

      {tab === "court" && (
        <div style={{ maxWidth: 640 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Court Notification Settings</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            Configure the email addresses for each court. These are used when officers send court notification emails after issuing citations.
          </p>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "var(--teal)" }}>📧 Court Email Addresses</div>
            <div className="form-group">
              <label className="form-label">{COURT_MAGISTRATE} Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="e.g. clerk@morgancountyga.gov"
                value={courtSettings.magistrate_email}
                onChange={(e) => setCourtSettings((s) => ({ ...s, magistrate_email: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>149 E Jefferson St, Madison, GA 30650</div>  {/* production address */}
            </div>
            <div className="form-group">
              <label className="form-label">{COURT_STATE} Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="e.g. statecourt@morgancountyga.gov"
                value={courtSettings.municipal_email}
                onChange={(e) => setCourtSettings((s) => ({ ...s, municipal_email: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>118 N Main St, Madison, GA 30650</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, marginTop: 8, color: "var(--teal)" }}>🔗 Court Portal</div>
            <div className="form-group">
              <label className="form-label">Court Portal URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="https://sheltertrace.com/court"
                value={courtSettings.portal_url}
                onChange={(e) => setCourtSettings((s) => ({ ...s, portal_url: e.target.value }))}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>Included in court notification emails so clerks can access the full case details.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={handleSaveCourtSettings} disabled={courtSaving}>
                {courtSaving ? "Saving…" : "Save Court Settings"}
              </button>
              {courtSaved && (
                <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 16, marginTop: 16, background: "#fffbeb", border: "1px solid #fcd34d" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>📬 How Court Notifications Work</div>
            <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
              When an officer clicks <strong>"Notify Court"</strong> on a citation, their default email client opens with a pre-filled message addressed to the appropriate court. The officer reviews and clicks Send. The citation is then marked as <strong>"Court Notified"</strong> with a timestamp.
            </div>
          </div>
        </div>
      )}

      {tab === "address" && (
        <div style={{ maxWidth: 860 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Address Lookup</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Search by street address or city to see all linked animals, dispatch calls, and contacts.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Enter address or city (e.g. 123 Main St, Covington)" value={addrQuery} onChange={(e) => setAddrQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddressSearch()} />
              <button className="btn btn-primary" onClick={handleAddressSearch} disabled={addrLoading}>
                {addrLoading ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {addrSearched && !addrLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Animals */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
                  🐾 Animals Found at This Address ({addrAnimals.length})
                </div>
                {addrAnimals.length === 0 ? (
                  <div style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 13 }}>No animals found</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Status</th><th>Found At</th><th>Intake Date</th></tr></thead>
                    <tbody>
                      {addrAnimals.map((a) => (
                        <tr key={a.id} style={{ cursor: "pointer" }} onClick={() => window.open(`/animals/${a.id}`, "_blank")}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                          <td style={{ fontWeight: 600 }}>{a.name}</td>
                          <td>{a.species}</td>
                          <td><span className="badge">{a.status}</span></td>
                          <td style={{ fontSize: 12 }}>{[a.found_address, a.found_city].filter(Boolean).join(", ") || "—"}</td>
                          <td style={{ fontSize: 12 }}>{a.intake_date || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Dispatch Calls */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
                  📡 Dispatch Calls from This Address ({addrCalls.length})
                </div>
                {addrCalls.length === 0 ? (
                  <div style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 13 }}>No calls found</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Call ID</th><th>Type</th><th>Priority</th><th>Status</th><th>Address</th><th>Date</th></tr></thead>
                    <tbody>
                      {addrCalls.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.id}</td>
                          <td>{c.type}</td>
                          <td>{c.priority}</td>
                          <td><span className="badge">{c.status}</span></td>
                          <td style={{ fontSize: 12 }}>{[c.address, c.city].filter(Boolean).join(", ") || "—"}</td>
                          <td style={{ fontSize: 12 }}>{c.date_reported || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* People */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
                  👤 Contacts at This Address ({addrPeople.length})
                </div>
                {addrPeople.length === 0 ? (
                  <div style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: 13 }}>No contacts found</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>PID</th><th>Name</th><th>Role</th><th>Phone</th><th>Address</th></tr></thead>
                    <tbody>
                      {addrPeople.map((p) => (
                        <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => window.open(`/people/${p.id}`, "_blank")}>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.pid}</td>
                          <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                          <td>{p.role}</td>
                          <td>{p.phone || "—"}</td>
                          <td style={{ fontSize: 12 }}>{[p.address, p.city, p.state].filter(Boolean).join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "integrations" && (
        <div style={{ maxWidth: 860 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Integrations</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            Connect ShelterTrace to external laboratory and diagnostic services.
          </p>

          {/* IDEXX Configuration */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#1a3a6b", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>
                IDEXX
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>IDEXX VetConnect PLUS</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Two-way diagnostic test ordering and automatic result sync</div>
              </div>
              {IS_DEMO && (
                <span style={{ marginLeft: "auto", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                  DEMO — Read-only credentials
                </span>
              )}
            </div>

            <div className="grid-2">
              {([
                ["IDEXX Practice ID", "practice_id", "text"],
                ["IDEXX Account Number", "account_number", "text"],
                ["IDEXX API Key", "api_key", "password"],
                ["IDEXX API Secret", "api_secret", "password"],
                ["VetConnect PLUS Username", "vetconnect_username", "text"],
                ["VetConnect PLUS Password", "vetconnect_password", "password"],
              ] as [string, keyof IdexxConfig, string][]).map(([label, key, type]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="form-input"
                      type={type === "password" && !idexxShowSecret[key] ? "password" : "text"}
                      value={(idexxConfig[key] as string) || ""}
                      onChange={(e) => setIdexxConfig((c) => ({ ...c, [key]: e.target.value }))}
                      readOnly={IS_DEMO}
                      style={{ paddingRight: type === "password" ? 36 : undefined }}
                    />
                    {type === "password" && (
                      <button
                        type="button"
                        onClick={() => setIdexxShowSecret((s) => ({ ...s, [key]: !s[key] }))}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}
                        title={idexxShowSecret[key] ? "Hide" : "Show"}
                      >
                        {idexxShowSecret[key] ? "🙈" : "👁"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 24, marginTop: 4, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={idexxConfig.auto_sync}
                  onChange={(e) => setIdexxConfig((c) => ({ ...c, auto_sync: e.target.checked }))}
                  disabled={IS_DEMO}
                />
                Auto-sync results every 30 min
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={idexxConfig.use_sandbox}
                  onChange={(e) => setIdexxConfig((c) => ({ ...c, use_sandbox: e.target.checked }))}
                  disabled={IS_DEMO}
                />
                Use Sandbox (testing)
              </label>
            </div>

            {/* Webhook Secret */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Webhook Secret <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>(shared with IDEXX to verify incoming results)</span></label>
              <input
                className="form-input"
                type={idexxShowSecret.webhook_secret ? "text" : "password"}
                value={idexxConfig.webhook_secret || ""}
                onChange={(e) => setIdexxConfig((c) => ({ ...c, webhook_secret: e.target.value }))}
                readOnly={IS_DEMO}
                placeholder="Generate a random secret and share with IDEXX support"
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                Webhook URL for IDEXX to push results: <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>{typeof window !== "undefined" ? window.location.origin : ""}/api/idexx/webhook</code>
              </div>
            </div>

            {/* Test result banner */}
            {idexxTestResult && (
              <div style={{ background: idexxTestResult.ok ? "#f0fdf4" : "#fee2e2", border: `1px solid ${idexxTestResult.ok ? "#86efac" : "#fca5a5"}`, borderRadius: 7, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: idexxTestResult.ok ? "#15803d" : "#dc2626", fontWeight: 600 }}>
                {idexxTestResult.ok ? "✅" : "⚠️"} {idexxTestResult.message}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={handleTestIdexx} disabled={idexxTesting}>
                {idexxTesting ? "Testing…" : "🔌 Test Connection"}
              </button>
              {!IS_DEMO && (
                <button className="btn btn-primary" onClick={handleSaveIdexxConfig} disabled={idexxSaving}>
                  {idexxSaving ? "Saving…" : "Save IDEXX Settings"}
                </button>
              )}
              {idexxSaved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
            </div>
          </div>

          {/* Test Code Reference */}
          <div className="card" style={{ padding: 16, marginBottom: 20, background: "#f8fafc" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--teal)" }}>🧪 IDEXX SNAP Test Code Mapping</div>
            <table className="data-table">
              <thead><tr><th>ShelterTrace Test Type</th><th>IDEXX Test Code</th></tr></thead>
              <tbody>
                {Object.entries(IDEXX_TEST_CODES).map(([type, code]) => (
                  <tr key={type}><td>{type}</td><td><code style={{ background: "#e0f2fe", color: "#0369a1", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{code}</code></td></tr>
                ))}
                <tr><td style={{ color: "var(--text-muted)" }}>Fecal Test, Urinalysis</td><td style={{ color: "var(--text-muted)" }}>Manual code entry in order form</td></tr>
              </tbody>
            </table>
          </div>

          {/* Order History */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>📋 IDEXX Order History</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "Pending", "Resulted", "Error"] as const).map((f) => (
                  <button key={f} onClick={() => setIdexxOrderFilter(f)}
                    style={{ padding: "3px 12px", borderRadius: 20, border: "1px solid var(--border)", background: idexxOrderFilter === f ? "#0f2942" : "#fff", color: idexxOrderFilter === f ? "#fff" : "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: idexxOrderFilter === f ? 700 : 400 }}>
                    {f === "all" ? "All" : f}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={loadIdexxOrders} disabled={idexxOrdersLoading} style={{ fontSize: 12 }}>
                  {idexxOrdersLoading ? "Loading…" : "↻ Refresh"}
                </button>
              </div>
            </div>

            {idexxOrdersLoading ? (
              <div style={{ padding: "24px 16px", color: "var(--text-muted)", fontSize: 13 }}>Loading orders…</div>
            ) : idexxOrders.length === 0 ? (
              <div style={{ padding: "24px 16px", color: "var(--text-muted)", fontSize: 13 }}>No IDEXX orders found. Orders appear here after staff send diagnostic tests via IDEXX.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date Ordered</th>
                    <th>Animal</th>
                    <th>Test Type</th>
                    <th>Accession #</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {idexxOrders
                    .filter((r) => idexxOrderFilter === "all" || r.idexx_status === idexxOrderFilter)
                    .map((r) => {
                      const statusColor = r.idexx_status === "Resulted" ? "#15803d" : r.idexx_status === "Error" ? "#dc2626" : "#b45309";
                      const statusBg    = r.idexx_status === "Resulted" ? "#dcfce7" : r.idexx_status === "Error" ? "#fee2e2" : "#fef3c7";
                      const resultColor = r.test_result === "Positive" ? "#dc2626" : r.test_result === "Negative" ? "#15803d" : r.test_result === "Inconclusive" ? "#b45309" : "#64748b";
                      return (
                        <tr key={r.id}>
                          <td style={{ fontSize: 12 }}>{r.idexx_ordered_at ? new Date(r.idexx_ordered_at).toLocaleDateString() : "—"}</td>
                          <td>
                            <a href={`/animals/${r.animal_id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--teal)", textDecoration: "none" }}>
                              {r.animal_name}
                            </a>
                          </td>
                          <td style={{ fontSize: 12 }}>{r.type}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.idexx_accession_number || "—"}</td>
                          <td>
                            <span style={{ background: statusBg, color: statusColor, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                              {r.idexx_status || "Pending"}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: resultColor, fontSize: 12 }}>
                            {r.test_result || "—"}
                          </td>
                          <td>
                            {r.idexx_status !== "Resulted" && (
                              idexxManualResult?.recordId === r.id ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <select
                                    style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}
                                    value={idexxManualResult.value}
                                    onChange={(e) => setIdexxManualResult({ recordId: r.id, value: e.target.value })}
                                  >
                                    <option value="">— Select —</option>
                                    {["Positive","Negative","Inconclusive"].map((v) => <option key={v}>{v}</option>)}
                                  </select>
                                  <button className="btn btn-sm btn-primary" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => handleManualResult(r.id, idexxManualResult.value)}>Save</button>
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setIdexxManualResult(null)}>✕</button>
                                </div>
                              ) : (
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setIdexxManualResult({ recordId: r.id, value: "" })}>
                                  Enter Result
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {showEdit && selected && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit Staff — {selected.first_name || selected.firstName} {selected.last_name || selected.lastName}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                {([["First Name", "first_name"], ["Last Name", "last_name"], ["Username", "username"], ["Email", "email"], ["Phone", "phone"], ["Badge #", "badge"]] as const).map(([label, key]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" value={(editData[key as keyof typeof editData] as string) || ""} onChange={(e) => setEditData((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">New Password <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>(leave blank to keep current)</span></label>
                  <input className="form-input" type="password" placeholder="Enter new password" value={editData.newPassword || ""} onChange={(e) => setEditData((d) => ({ ...d, newPassword: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <RoleInput value={(editData.role as string) || ""} onChange={(v) => {
                    const autoPerms = permsForRole(v);
                    setEditData((d) => ({ ...d, role: v, ...(autoPerms ? { permissions: autoPerms } : {}) }));
                  }} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Permissions</label>
                <PermButtons perms={(editData.permissions as string[]) || []} onChange={(np) => setEditData((d) => ({ ...d, permissions: np }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Staff Account</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                {([["First Name *", "first_name"], ["Last Name *", "last_name"], ["Username *", "username"], ["Password *", "password"], ["Email", "email"], ["Phone", "phone"], ["Badge #", "badge"]] as const).map(([label, key]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" type={key === "password" ? "password" : "text"} value={newData[key as keyof typeof newData] as string || ""} onChange={(e) => setNewData((d) => ({ ...d, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <RoleInput value={newData.role} onChange={(v) => {
                    const autoPerms = permsForRole(v);
                    setNewData((d) => ({ ...d, role: v, ...(autoPerms ? { permissions: autoPerms } : {}) }));
                  }} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Permissions</label>
                <PermButtons perms={newData.permissions} onChange={(np) => setNewData((d) => ({ ...d, permissions: np }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !newData.username || !newData.password || !newData.first_name || !newData.last_name}>
                {saving ? "Adding…" : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

