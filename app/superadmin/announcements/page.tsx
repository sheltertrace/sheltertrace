"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { fetchAnnouncements, createAnnouncement, updateAnnouncement, logAuditAction } from "@/lib/superAdminData";
import type { PlatformAnnouncement } from "@/lib/superAdminTypes";
import { ANNOUNCEMENT_TYPES } from "@/lib/superAdminTypes";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  info:        { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  warning:     { bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
  maintenance: { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  feature:     { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
};

const EMPTY: Partial<PlatformAnnouncement> = { title: "", body: "", type: "info", target_account_types: ["shelter", "clinic"], active: true };

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlatformAnnouncement | null>(null);
  const [form, setForm] = useState<Partial<PlatformAnnouncement>>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => { fetchAnnouncements().then(setAnnouncements).finally(() => setLoading(false)); }, []);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY }); setShowPreview(false); setShowModal(true); };
  const openEdit = (a: PlatformAnnouncement) => { setEditing(a); setForm({ ...a }); setShowPreview(false); setShowModal(true); };

  const handleSave = async () => {
    if (!form.title?.trim() || !form.body?.trim() || !user?.id) return;
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, form);
        setAnnouncements((prev) => prev.map((a) => a.id === editing.id ? { ...a, ...form } as PlatformAnnouncement : a));
        await logAuditAction(user.id, "Announcement Updated", "announcement", editing.id, { title: form.title });
      } else {
        const created = await createAnnouncement({ ...form, created_by: user.id } as Omit<PlatformAnnouncement, "id" | "created_at">);
        setAnnouncements((prev) => [created, ...prev]);
        await logAuditAction(user.id, "Announcement Created", "announcement", created.id, { title: form.title });
      }
      setShowModal(false);
    } catch (err: unknown) { alert(`Failed: ${(err as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const handleToggle = async (a: PlatformAnnouncement) => {
    await updateAnnouncement(a.id, { active: !a.active });
    setAnnouncements((prev) => prev.map((x) => x.id === a.id ? { ...x, active: !x.active } : x));
  };

  const now = new Date().toISOString();
  const getStatus = (a: PlatformAnnouncement) => {
    if (!a.active) return { label: "Inactive", bg: "#f1f5f9", color: "#64748b" };
    if (a.show_from && a.show_from > now) return { label: "Scheduled", bg: "#dbeafe", color: "#1d4ed8" };
    if (a.show_until && a.show_until < now) return { label: "Expired", bg: "#f1f5f9", color: "#64748b" };
    return { label: "Active", bg: "#dcfce7", color: "#15803d" };
  };

  const tc = TYPE_COLORS[form.type || "info"] || TYPE_COLORS.info;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>📢 Announcements</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Announcement</button>
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Title</th><th>Type</th><th>Target</th><th>Status</th><th>Show From</th><th>Show Until</th><th></th></tr></thead>
            <tbody>
              {announcements.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No announcements</td></tr>
              ) : announcements.map((a) => {
                const atc = TYPE_COLORS[a.type] || TYPE_COLORS.info;
                const st = getStatus(a);
                return (
                  <tr key={a.id} style={{ opacity: a.active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td><span className="badge" style={{ background: atc.bg, color: atc.color, textTransform: "capitalize" }}>{a.type}</span></td>
                    <td style={{ fontSize: 12 }}>{(a.target_account_types || []).join(", ") || "all"}</td>
                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ fontSize: 12 }}>{a.show_from ? new Date(a.show_from).toLocaleDateString() : "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.show_until ? new Date(a.show_until).toLocaleDateString() : "No expiry"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(a)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: a.active ? "#dc2626" : "#15803d" }} onClick={() => handleToggle(a)}>{a.active ? "Deactivate" : "Activate"}</button>
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
          <div className="modal modal-lg" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{editing ? "Edit Announcement" : "New Announcement"}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              {showPreview && (
                <div style={{ background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: tc.color }}>{form.title}</div>
                  <div style={{ fontSize: 13, color: tc.color, marginTop: 4 }}>{form.body}</div>
                </div>
              )}
              <F label="Title *"><input className="form-input" value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></F>
              <F label="Body *"><textarea className="form-textarea" rows={3} value={form.body || ""} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></F>
              <div className="grid-2">
                <F label="Type">
                  <select className="form-select" value={form.type || "info"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {ANNOUNCEMENT_TYPES.map((t) => <option key={t} value={t} style={{ textTransform: "capitalize" }}>{t}</option>)}
                  </select>
                </F>
                <F label="Target">
                  <select className="form-select" value={(form.target_account_types || []).join(",")} onChange={(e) => setForm((f) => ({ ...f, target_account_types: e.target.value ? e.target.value.split(",") : [] }))}>
                    <option value="shelter,clinic">All Users</option>
                    <option value="shelter">Shelter Only</option>
                    <option value="clinic">Clinic Only</option>
                  </select>
                </F>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginTop: 8 }}>
                <input type="checkbox" checked={form.active !== false} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active
              </label>
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-secondary" onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Hide Preview" : "Preview"}</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title?.trim() || !form.body?.trim()}>{saving ? "Saving…" : editing ? "Save" : "Create"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
