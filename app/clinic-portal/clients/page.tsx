"use client";
import { useState } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { createClinicClient, updateClinicClient } from "@/lib/clinicData";
import type { ClinicClient } from "@/lib/clinicTypes";
import { BILLING_TYPES } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group"><label className="form-label">{label}</label>{children}</div>
  );
}

const EMPTY: Partial<ClinicClient> = {
  county_name: "", agency_name: "", contact_person: "", contact_email: "", contact_phone: "",
  address: "", city: "", state: "GA", zip: "", billing_type: "per_visit", notes: "", active: true,
};

export default function ClinicClientsPage() {
  const { user } = useAuth();
  const { clients, refreshClients, setSelectedClientId } = useClinic();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClinicClient | null>(null);
  const [form, setForm] = useState<Partial<ClinicClient>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setShowModal(true); };
  const openEdit = (c: ClinicClient) => { setEditing(c); setForm({ ...c }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.county_name?.trim() || !user?.id) return;
    setSaving(true);
    try {
      if (editing) {
        await updateClinicClient(editing.id, form);
      } else {
        await createClinicClient({ ...form, clinic_account_id: user.id, active: true } as Omit<ClinicClient, "id" | "created_at">);
      }
      await refreshClients();
      setShowModal(false);
    } catch (err: unknown) {
      alert(`Save failed: ${(err as { message?: string }).message || "Unknown"}`);
    } finally { setSaving(false); }
  };

  const handleToggle = async (c: ClinicClient) => {
    await updateClinicClient(c.id, { active: !c.active });
    await refreshClients();
  };

  const daysUntilExpiry = (d?: string) => {
    if (!d) return null;
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏛️ County Clients</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add County Client</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {clients.map((c) => {
          const expDays = daysUntilExpiry(c.contract_end);
          const expiring = expDays !== null && expDays >= 0 && expDays <= 30;
          const expired = expDays !== null && expDays < 0;
          return (
            <div key={c.id} className="card" style={{ padding: 16, opacity: c.active ? 1 : 0.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{c.county_name}</div>
                  {c.agency_name && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.agency_name}</div>}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <span className="badge" style={{ background: c.active ? "#dcfce7" : "#fee2e2", color: c.active ? "#15803d" : "#dc2626", fontSize: 10 }}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                  {expiring && <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontSize: 10 }}>Expires soon</span>}
                  {expired && <span className="badge" style={{ background: "#fee2e2", color: "#dc2626", fontSize: 10 }}>Expired</span>}
                </div>
              </div>
              {c.contact_person && <div style={{ fontSize: 12, marginBottom: 2 }}>👤 {c.contact_person}</div>}
              {c.contact_email && <div style={{ fontSize: 12, marginBottom: 2 }}>📧 {c.contact_email}</div>}
              {c.contact_phone && <div style={{ fontSize: 12, marginBottom: 2 }}>📞 {c.contact_phone}</div>}
              {c.contract_end && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Contract ends: {c.contract_end}</div>}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedClientId(c.id); }}>Select</button>
                <button className="btn btn-ghost btn-sm" style={{ color: c.active ? "#dc2626" : "#15803d" }} onClick={() => handleToggle(c)}>
                  {c.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </div>
          );
        })}
        {clients.length === 0 && <div style={{ color: "var(--text-muted)", padding: 20 }}>No county clients yet. Click "+ Add County Client" to get started.</div>}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editing ? "Edit County Client" : "Add County Client"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">County Name *</label>
                  <input className="form-input" value={form.county_name || ""} onChange={(e) => setForm((f) => ({ ...f, county_name: e.target.value }))} placeholder="e.g. Morgan County" />
                </div>
                <F label="Agency Name"><input className="form-input" value={form.agency_name || ""} onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))} placeholder="e.g. Animal Services" /></F>
                <F label="Contact Person"><input className="form-input" value={form.contact_person || ""} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} /></F>
                <F label="Contact Email"><input className="form-input" type="email" value={form.contact_email || ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} /></F>
                <F label="Contact Phone"><input className="form-input" type="tel" value={form.contact_phone || ""} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} /></F>
                <F label="Address"><input className="form-input" value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></F>
                <F label="City"><input className="form-input" value={form.city || ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></F>
                <F label="State"><input className="form-input" value={form.state || ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} style={{ maxWidth: 80 }} /></F>
                <F label="Zip"><input className="form-input" value={form.zip || ""} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} /></F>
                <F label="Contract Start"><DateInput className="form-input" value={form.contract_start || ""} onChange={(e) => setForm((f) => ({ ...f, contract_start: e.target.value }))} /></F>
                <F label="Contract End"><DateInput className="form-input" value={form.contract_end || ""} onChange={(e) => setForm((f) => ({ ...f, contract_end: e.target.value }))} /></F>
                <F label="Contract Value ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.contract_value ?? ""} onChange={(e) => setForm((f) => ({ ...f, contract_value: e.target.value ? parseFloat(e.target.value) : undefined }))} /></F>
                <F label="Billing Rate ($)"><input className="form-input" type="number" min="0" step="0.01" value={form.billing_rate ?? ""} onChange={(e) => setForm((f) => ({ ...f, billing_rate: e.target.value ? parseFloat(e.target.value) : undefined }))} /></F>
                <F label="Billing Type">
                  <select className="form-select" value={form.billing_type || ""} onChange={(e) => setForm((f) => ({ ...f, billing_type: e.target.value }))}>
                    <option value="">— Select —</option>
                    {BILLING_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                  </select>
                </F>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.county_name?.trim()}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
