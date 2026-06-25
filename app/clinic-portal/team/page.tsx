"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { fetchClinicEmployees, createClinicEmployee, updateClinicEmployee } from "@/lib/clinicData";
import type { StaffAccount } from "@/lib/types";
import { genId } from "@/lib/utils";

function genPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const CLINIC_ROLES = ["Veterinarian", "Vet Tech", "Clinic Staff", "Receptionist"];

interface EmpForm {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
}

const EMPTY: EmpForm = { first_name: "", last_name: "", username: "", email: "", phone: "", role: "Vet Tech", active: true };

export default function ClinicTeamPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);
  const [form, setForm] = useState<EmpForm>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const custId = user?.platform_customer_id;

  useEffect(() => {
    if (!custId) { setLoading(false); return; }
    fetchClinicEmployees(custId).then(setEmployees).finally(() => setLoading(false));
  }, [custId]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setTempPassword(null); setShowModal(true); };
  const openEdit = (e: StaffAccount) => {
    setEditing(e);
    setForm({
      first_name: e.first_name || e.firstName || "",
      last_name: e.last_name || e.lastName || "",
      username: e.username,
      email: e.email || "",
      phone: e.phone || "",
      role: e.role,
      active: e.active !== false,
    });
    setTempPassword(null);
    setShowModal(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.username.trim() || !custId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateClinicEmployee(editing.id, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          active: form.active,
        });
        setEmployees((prev) => prev.map((e) => e.id === editing.id ? { ...e, first_name: form.first_name, last_name: form.last_name, firstName: form.first_name, lastName: form.last_name, username: form.username, email: form.email, phone: form.phone, role: form.role, active: form.active } : e));
        setShowModal(false);
      } else {
        const pw = genPassword();
        const created = await createClinicEmployee({
          id: genId(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          password_hash: pw,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          account_type: "clinic",
          platform_customer_id: custId,
          permissions: [],
          active: true,
        });
        setEmployees((prev) => [...prev, created]);
        setTempPassword(pw);
      }
    } catch (err: unknown) {
      alert(`Save failed: ${(err as { message?: string }).message || "Unknown"}`);
    } finally { setSaving(false); }
  }, [form, editing, custId]);

  const handleResetPw = async (empId: string) => {
    const pw = genPassword();
    await updateClinicEmployee(empId, { password_hash: pw });
    setResetPw(pw);
  };

  const handleToggle = async (e: StaffAccount) => {
    const newActive = e.active === false;
    await updateClinicEmployee(e.id, { active: newActive });
    setEmployees((prev) => prev.map((x) => x.id === e.id ? { ...x, active: newActive } : x));
  };

  const copyPw = (pw: string) => {
    navigator.clipboard.writeText(pw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>👥 My Team</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> :
        !custId ? <div className="card" style={{ padding: 20, color: "var(--text-muted)" }}>Your account is not linked to a clinic customer. Contact your administrator.</div> :
        employees.length === 0 ? <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>No team members yet. Click "+ Add Employee" to get started.</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {employees.map((e) => {
            const name = `${e.first_name || e.firstName || ""} ${e.last_name || e.lastName || ""}`.trim();
            const isMe = e.id === user?.id;
            return (
              <div key={e.id} className="card" style={{ padding: 16, opacity: e.active === false ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{name || "—"}{isMe && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--teal)", fontWeight: 600 }}>(you)</span>}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>@{e.username}</div>
                  </div>
                  <span className="badge" style={{ background: e.active !== false ? "#dcfce7" : "#fee2e2", color: e.active !== false ? "#15803d" : "#dc2626", fontSize: 10, alignSelf: "flex-start" }}>
                    {e.active !== false ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  <span className="badge" style={{ background: "#ede9fe", color: "#6d28d9", fontSize: 10 }}>{e.role}</span>
                </div>
                {e.email && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{e.email}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(e)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handleResetPw(e.id)}>🔑 Reset</button>
                  {!isMe && (
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: e.active !== false ? "#dc2626" : "#15803d" }} onClick={() => handleToggle(e)}>
                      {e.active !== false ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { if (!tempPassword) setShowModal(false); }}>
          <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{tempPassword ? "✅ Employee Created" : editing ? "Edit Employee" : "Add Employee"}</span>
              {!tempPassword && <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>}
            </div>
            {tempPassword ? (
              <div className="modal-body" style={{ textAlign: "center", padding: "24px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔑</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Employee created successfully</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>Temporary password for <strong>@{form.username}</strong>:</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "2px solid var(--border)", borderRadius: 8, padding: "12px 20px", marginBottom: 8 }}>
                  <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>{tempPassword}</code>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyPw(tempPassword)}>{copied ? "✓ Copied" : "📋 Copy"}</button>
                </div>
                <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 8 }}>Copy this now — it will not be shown again.</div>
                <div style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={() => { setShowModal(false); setTempPassword(null); }}>Done</button></div>
              </div>
            ) : (
              <>
                <div className="modal-body">
                  <div className="grid-2">
                    <F label="First Name *"><input className="form-input" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></F>
                    <F label="Last Name *"><input className="form-input" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></F>
                    <F label="Username *"><input className="form-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></F>
                    <F label="Role">
                      <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                        {CLINIC_ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </F>
                    <F label="Email"><input className="form-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></F>
                    <F label="Phone"><input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></F>
                  </div>
                  {editing && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
                      <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Account is active
                    </label>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !form.username.trim()}>
                    {saving ? "Saving…" : editing ? "Save Changes" : "Create Employee"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetPw && (
        <div className="modal-overlay" onClick={() => setResetPw(null)}>
          <div className="modal" style={{ maxWidth: 420, textAlign: "center", padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Password Reset</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#f8fafc", border: "2px solid var(--border)", borderRadius: 8, padding: "12px 20px", marginBottom: 8 }}>
              <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>{resetPw}</code>
              <button className="btn btn-secondary btn-sm" onClick={() => copyPw(resetPw)}>{copied ? "✓ Copied" : "📋 Copy"}</button>
            </div>
            <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, marginTop: 6, marginBottom: 16 }}>Copy this now — it will not be shown again.</div>
            <button className="btn btn-primary" onClick={() => setResetPw(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
