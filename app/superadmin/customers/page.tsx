"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { fetchCustomers, createCustomer, updateCustomer, logAuditAction } from "@/lib/superAdminData";
import type { PlatformCustomer } from "@/lib/superAdminTypes";
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, BILLING_PLANS, BILLING_CYCLES, FEATURE_FLAGS, STATUS_COLORS } from "@/lib/superAdminTypes";
import DateInput from "@/components/ui/DateInput";

function F({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className="form-group" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <label className="form-label">{label}</label>{children}
    </div>
  );
}

const EMPTY: Partial<PlatformCustomer> = {
  account_name: "", account_type: "shelter", contact_name: "", contact_email: "", contact_phone: "",
  address: "", city: "", state: "", zip: "", county: "", status: "trial", billing_plan: "",
  billing_cycle: "monthly", notes: "", feature_flags: {},
};

export default function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<PlatformCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlatformCustomer | null>(null);
  const [form, setForm] = useState<Partial<PlatformCustomer>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCustomers().then(setCustomers).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    let list = customers;
    if (filterStatus !== "all") list = list.filter((c) => c.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.account_name.toLowerCase().includes(q) || (c.contact_name || "").toLowerCase().includes(q) || (c.contact_email || "").toLowerCase().includes(q) || (c.county || "").toLowerCase().includes(q));
    }
    return list;
  }, [customers, search, filterStatus]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setShowModal(true); };
  const openEdit = (c: PlatformCustomer) => { setEditing(c); setForm({ ...c }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.account_name?.trim() || !user?.id) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateCustomer(editing.id, form);
        setCustomers((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        await logAuditAction(user.id, "Updated Customer", "customer", editing.id, { changes: form });
      } else {
        const created = await createCustomer(form as Omit<PlatformCustomer, "id" | "created_at" | "updated_at">);
        setCustomers((prev) => [...prev, created].sort((a, b) => a.account_name.localeCompare(b.account_name)));
        await logAuditAction(user.id, "Created Customer", "customer", created.id, { account_name: created.account_name });
      }
      setShowModal(false);
    } catch (err: unknown) {
      alert(`Save failed: ${(err as { message?: string }).message || "Unknown"}`);
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (c: PlatformCustomer, newStatus: string) => {
    if (!user?.id) return;
    const updated = await updateCustomer(c.id, { status: newStatus });
    setCustomers((prev) => prev.map((x) => x.id === updated.id ? updated : x));
    await logAuditAction(user.id, `Changed Status to ${newStatus}`, "customer", c.id, { from: c.status, to: newStatus });
  };

  const flagToggle = (key: string) => {
    const flags = { ...(form.feature_flags || {}) };
    flags[key] = !flags[key];
    setForm((f) => ({ ...f, feature_flags: flags }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏢 Platform Customers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input className="form-input" placeholder="Search by name, email, county…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 300 }} />
        {["all", ...CUSTOMER_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`} style={{ textTransform: "capitalize" }}>
            {s === "all" ? "All" : s} {s !== "all" ? `(${customers.filter((c) => c.status === s).length})` : `(${customers.length})`}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Billing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No customers found</td></tr>
              ) : filtered.map((c) => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.trial;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.account_name}</div>
                      {c.county && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.county} County</div>}
                    </td>
                    <td style={{ textTransform: "capitalize", fontSize: 12 }}>{c.account_type?.replace("_", " ")}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{c.contact_name || "—"}</div>
                      {c.contact_email && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.contact_email}</div>}
                    </td>
                    <td><span className="badge" style={{ background: sc.bg, color: sc.color, textTransform: "capitalize" }}>{c.status}</span></td>
                    <td style={{ fontSize: 12, textTransform: "capitalize" }}>{c.billing_plan || "—"}</td>
                    <td style={{ fontSize: 12 }}>{c.billing_amount ? `$${c.billing_amount}/${c.billing_cycle === "annual" ? "yr" : "mo"}` : "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(c)}>Edit</button>
                        {c.status !== "suspended" && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#dc2626" }} onClick={() => handleStatusChange(c, "suspended")}>Suspend</button>
                        )}
                        {c.status === "suspended" && (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#15803d" }} onClick={() => handleStatusChange(c, "active")}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 720, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? `Edit — ${editing.account_name}` : "Add New Customer"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="Account Name *" span><input className="form-input" value={form.account_name || ""} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} /></F>
                <F label="Account Type">
                  <select className="form-select" value={form.account_type || "shelter"} onChange={(e) => setForm((f) => ({ ...f, account_type: e.target.value }))}>
                    {CUSTOMER_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t.replace("_", " ")}</option>)}
                  </select>
                </F>
                <F label="Status">
                  <select className="form-select" value={form.status || "trial"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    {CUSTOMER_STATUSES.map((s) => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
                  </select>
                </F>
                <F label="Contact Name"><input className="form-input" value={form.contact_name || ""} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} /></F>
                <F label="Contact Email"><input className="form-input" type="email" value={form.contact_email || ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} /></F>
                <F label="Contact Phone"><input className="form-input" type="tel" value={form.contact_phone || ""} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} /></F>
                <F label="Address"><input className="form-input" value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></F>
                <F label="City"><input className="form-input" value={form.city || ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></F>
                <F label="State"><input className="form-input" value={form.state || ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={{ maxWidth: 80 }} /></F>
                <F label="County"><input className="form-input" value={form.county || ""} onChange={(e) => setForm((f) => ({ ...f, county: e.target.value }))} /></F>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", margin: "16px 0 8px" }}>Billing</div>
              <div className="grid-2">
                <F label="Trial Start"><DateInput className="form-input" value={form.trial_start || ""} onChange={(e) => setForm((f) => ({ ...f, trial_start: e.target.value }))} /></F>
                <F label="Trial End"><DateInput className="form-input" value={form.trial_end || ""} onChange={(e) => setForm((f) => ({ ...f, trial_end: e.target.value }))} /></F>
                <F label="Plan">
                  <select className="form-select" value={form.billing_plan || ""} onChange={(e) => setForm((f) => ({ ...f, billing_plan: e.target.value }))}>
                    <option value="">— None —</option>
                    {BILLING_PLANS.map((p) => <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>)}
                  </select>
                </F>
                <F label="Billing Cycle">
                  <select className="form-select" value={form.billing_cycle || ""} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}>
                    {BILLING_CYCLES.map((c) => <option key={c} value={c} style={{ textTransform: "capitalize" }}>{c}</option>)}
                  </select>
                </F>
                <F label="Amount ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.billing_amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, billing_amount: e.target.value ? parseFloat(e.target.value) : undefined }))} /></F>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", margin: "16px 0 8px" }}>Feature Flags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FEATURE_FLAGS.map((ff) => {
                  const on = !!(form.feature_flags || {})[ff.key];
                  return (
                    <button key={ff.key} type="button" onClick={() => flagToggle(ff.key)} style={{
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

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.account_name?.trim()}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
