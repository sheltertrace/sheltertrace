"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { fetchAllUsers, createUser, updateUser, fetchCustomers, logAuditAction } from "@/lib/superAdminData";
import type { StaffAccount } from "@/lib/types";
import type { PlatformCustomer } from "@/lib/superAdminTypes";
import { genId } from "@/lib/utils";

function genPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function F({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className="form-group" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-label">{label}</label>{children}
    </div>
  );
}

const SHELTER_ROLES = ["Administrator", "Shelter Manager", "Officer", "Dispatcher", "Vet Tech", "Front Desk", "Court Clerk", "Volunteer"];
const CLINIC_ROLES = ["Veterinarian", "Clinic Staff", "Clinic Admin"];
const CITY_ROLES = ["City Clerk", "Animal Control Liaison", "City Administrator"];

interface UserForm {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  account_type: string;
  platform_customer_id: string;
  active: boolean;
}

const EMPTY_FORM: UserForm = {
  first_name: "", last_name: "", username: "", email: "", phone: "",
  role: "Officer", account_type: "shelter", platform_customer_id: "", active: true,
};

export default function SuperAdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<StaffAccount[]>([]);
  const [customers, setCustomers] = useState<PlatformCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState<UserForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showResetPw, setShowResetPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([fetchAllUsers(), fetchCustomers()])
      .then(([u, c]) => { setUsers(u); setCustomers(c); })
      .finally(() => setLoading(false));
  }, []);

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers.forEach((c) => m.set(c.id, c.account_name));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    let list = users;
    if (filterType !== "all") list = list.filter((u) => (u.account_type || "shelter") === filterType);
    if (filterStatus !== "all") list = list.filter((u) => filterStatus === "active" ? u.active !== false : u.active === false);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        `${u.first_name || u.firstName || ""} ${u.last_name || u.lastName || ""}`.toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, filterType, filterStatus]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setTempPassword(null);
    setShowModal(true);
  };

  const openEdit = (u: StaffAccount) => {
    setEditing(u);
    setForm({
      first_name: u.first_name || u.firstName || "",
      last_name: u.last_name || u.lastName || "",
      username: u.username,
      email: u.email || "",
      phone: u.phone || "",
      role: u.role,
      account_type: u.account_type || "shelter",
      platform_customer_id: u.platform_customer_id || "",
      active: u.active !== false,
    });
    setTempPassword(null);
    setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.username.trim() || !me?.id) return;
    setSaving(true);
    try {
      if (editing) {
        const updates: Record<string, unknown> = {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          account_type: form.account_type,
          platform_customer_id: form.platform_customer_id || null,
          active: form.active,
        };
        await updateUser(editing.id, updates);
        setUsers((prev) => prev.map((u) => u.id === editing.id ? { ...u, ...updates, firstName: form.first_name, lastName: form.last_name } as StaffAccount : u));
        await logAuditAction(me.id, "Updated User", "user", editing.id, { username: form.username });
        setShowModal(false);
      } else {
        const pw = genPassword();
        const rec: Record<string, unknown> = {
          id: genId(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          password_hash: pw,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          account_type: form.account_type,
          platform_customer_id: form.platform_customer_id || null,
          permissions: form.role === "Administrator" ? ["all"] : [],
          active: true,
        };
        const created = await createUser(rec);
        setUsers((prev) => [created, ...prev]);
        await logAuditAction(me.id, "Created User", "user", created.id, { username: form.username });
        setTempPassword(pw);
      }
    } catch (err: unknown) {
      alert(`Save failed: ${(err as { message?: string }).message || "Unknown"}`);
    } finally { setSaving(false); }
  }, [form, editing, me?.id]);

  const handleResetPassword = async (userId: string) => {
    const pw = genPassword();
    await updateUser(userId, { password_hash: pw });
    if (me?.id) await logAuditAction(me.id, "Reset Password", "user", userId);
    setShowResetPw(pw);
  };

  const handleToggleActive = async (u: StaffAccount) => {
    const newActive = u.active === false;
    await updateUser(u.id, { active: newActive });
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, active: newActive } : x));
    if (me?.id) await logAuditAction(me.id, newActive ? "Activated User" : "Deactivated User", "user", u.id);
  };

  const roleOptions = form.account_type === "clinic" ? CLINIC_ROLES : form.account_type === "city" ? CITY_ROLES : SHELTER_ROLES;

  const copyPw = (pw: string) => {
    navigator.clipboard.writeText(pw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>👤 Platform Users</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input className="form-input" placeholder="Search name, username, email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="form-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ maxWidth: 140 }}>
          <option value="all">All Types</option>
          <option value="shelter">Shelter</option>
          <option value="clinic">Clinic</option>
          <option value="city">City</option>
        </select>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 130 }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No users found</td></tr>
              ) : filtered.map((u) => {
                const name = `${u.first_name || u.firstName || ""} ${u.last_name || u.lastName || ""}`.trim();
                const custName = u.platform_customer_id ? customerMap.get(u.platform_customer_id) || "—" : "—";
                const isActive = u.active !== false;
                return (
                  <tr key={u.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                    <td style={{ fontWeight: 600 }}>
                      {name || "—"}
                      {u.is_super_admin && <span style={{ marginLeft: 6, fontSize: 10, background: "#f59e0b", color: "#fff", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>SUPER</span>}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>@{u.username}</td>
                    <td style={{ fontSize: 12 }}>{u.email || "—"}</td>
                    <td style={{ fontSize: 12 }}>{u.role}</td>
                    <td><span className="badge" style={{ background: (u.account_type || "shelter") === "clinic" ? "#ede9fe" : "#e0f2fe", color: (u.account_type || "shelter") === "clinic" ? "#6d28d9" : "#0369a1", textTransform: "capitalize", fontSize: 10 }}>{u.account_type || "shelter"}</span></td>
                    <td style={{ fontSize: 12 }}>{custName}</td>
                    <td><span className="badge" style={{ background: isActive ? "#dcfce7" : "#fee2e2", color: isActive ? "#15803d" : "#dc2626", fontSize: 10 }}>{isActive ? "Active" : "Inactive"}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(u)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handleResetPassword(u.id)}>🔑</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: isActive ? "#dc2626" : "#15803d" }} onClick={() => handleToggleActive(u)}>
                          {isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { if (!tempPassword) setShowModal(false); }}>
          <div className="modal modal-lg" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{tempPassword ? "✅ User Created" : editing ? `Edit — ${editing.first_name || editing.firstName} ${editing.last_name || editing.lastName}` : "Add New User"}</span>
              {!tempPassword && <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>}
            </div>

            {tempPassword ? (
              <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>User created successfully</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Temporary password for <strong>@{form.username}</strong>:
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "2px solid var(--border)", borderRadius: 8, padding: "12px 20px", marginBottom: 8 }}>
                  <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1, color: "#0f172a" }}>{tempPassword}</code>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyPw(tempPassword)} style={{ fontSize: 12 }}>
                    {copied ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 8 }}>
                  Copy this now — it will not be shown again.
                </div>
                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-primary" onClick={() => { setShowModal(false); setTempPassword(null); }}>Done</button>
                </div>
              </div>
            ) : (
              <>
                <div className="modal-body">
                  <div className="grid-2">
                    <F label="Customer / Account" span>
                      <select className="form-select" value={form.platform_customer_id} onChange={(e) => setForm((f) => ({ ...f, platform_customer_id: e.target.value }))}>
                        <option value="">— No customer (platform-level) —</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{c.account_name} ({c.account_type})</option>)}
                      </select>
                    </F>
                    <F label="First Name *"><input className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></F>
                    <F label="Last Name *"><input className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></F>
                    <F label="Username *"><input className="form-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></F>
                    <F label="Email"><input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></F>
                    <F label="Phone"><input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></F>
                    <F label="Account Type">
                      <select className="form-select" value={form.account_type} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value, role: e.target.value === "clinic" ? "Veterinarian" : e.target.value === "city" ? "City Clerk" : "Officer" }))}>
                        <option value="shelter">Shelter Staff</option>
                        <option value="clinic">Clinic / Veterinarian</option>
                        <option value="city">City of Madison Staff</option>
                      </select>
                    </F>
                    <F label="Role">
                      <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                        {roleOptions.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </F>
                  </div>
                  {editing && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                        Account is active
                      </label>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !form.username.trim()}>
                    {saving ? "Saving…" : editing ? "Save Changes" : "Create User"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Password Reset Dialog */}
      {showResetPw && (
        <div className="modal-overlay" onClick={() => setShowResetPw(null)}>
          <div className="modal" style={{ maxWidth: 420, textAlign: "center", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Password Reset</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "2px solid var(--border)", borderRadius: 8, padding: "12px 20px", marginBottom: 8 }}>
              <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>{showResetPw}</code>
              <button className="btn btn-secondary btn-sm" onClick={() => copyPw(showResetPw)} style={{ fontSize: 12 }}>
                {copied ? "✓ Copied" : "📋 Copy"}
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 6, marginBottom: 16 }}>
              Copy this now — it will not be shown again.
            </div>
            <button className="btn btn-primary" onClick={() => setShowResetPw(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
