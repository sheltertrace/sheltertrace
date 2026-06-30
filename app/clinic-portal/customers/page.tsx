"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import {
  fetchClinicPeople, createClinicPerson, findDuplicateClinicPerson,
  fetchAnimalsForClinicPerson,
} from "@/lib/clinicData";
import type { ClinicPerson, ClinicAnimalPerson } from "@/lib/clinicTypes";
import { displayAge } from "@/lib/utils";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const EMPTY: Partial<ClinicPerson> = { first_name: "", last_name: "", phone: "", email: "", address: "", city: "", state: "", zip: "", notes: "" };

export default function ClinicCustomersPage() {
  const { user } = useAuth();
  const { selectedClientId, isShelterMode } = useClinic();
  const [people, setPeople] = useState<ClinicPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<ClinicPerson>>({ ...EMPTY });
  const [dupWarning, setDupWarning] = useState<ClinicPerson | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ClinicPerson | null>(null);
  const [detailAnimals, setDetailAnimals] = useState<ClinicAnimalPerson[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || isShelterMode) { setLoading(false); return; }
    setLoading(true);
    fetchClinicPeople(user.id, selectedClientId || undefined).then(setPeople).finally(() => setLoading(false));
  }, [user?.id, selectedClientId, isShelterMode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone || "").includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [people, search]);

  const openAdd = () => { setForm({ ...EMPTY }); setDupWarning(null); setShowAdd(true); };

  const handleSave = async () => {
    if (!form.first_name?.trim() || !form.last_name?.trim() || !user?.id) return;
    setSaving(true);
    try {
      const dup = await findDuplicateClinicPerson(user.id, form.phone, form.email);
      if (dup) { setDupWarning(dup); setSaving(false); return; }
      const created = await createClinicPerson({ ...form, clinic_account_id: user.id, client_id: selectedClientId || undefined } as Omit<ClinicPerson, "id" | "created_at">);
      setPeople((prev) => [...prev, created].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || "")));
      setShowAdd(false);
    } catch (err: unknown) { alert(`Failed: ${(err as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const openDetail = async (p: ClinicPerson) => {
    setDetail(p);
    setDetailLoading(true);
    try { setDetailAnimals(await fetchAnimalsForClinicPerson(p.id)); }
    finally { setDetailLoading(false); }
  };

  if (isShelterMode) {
    return (
      <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
        Customer management is specific to your own clinic clients — switch out of the linked shelter view to manage customers.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>👤 Customers</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
      </div>

      <input className="form-input" placeholder="Search by name, phone, or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320, marginBottom: 16 }} />

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> :
        filtered.length === 0 ? <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>No customers found.</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>City</th><th></th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                  <td style={{ fontSize: 12 }}>{p.phone || "—"}</td>
                  <td style={{ fontSize: 12 }}>{p.email || "—"}</td>
                  <td style={{ fontSize: 12 }}>{p.city || "—"}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openDetail(p)}>View Pets &amp; History</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Add Customer</span><button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button></div>
            <div className="modal-body">
              {dupWarning ? (
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>⚠️ Possible Duplicate</div>
                  <div style={{ fontSize: 13, marginBottom: 10 }}>A customer with this phone or email already exists: <strong>{dupWarning.first_name} {dupWarning.last_name}</strong></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(false); openDetail(dupWarning); }}>Use Existing</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setDupWarning(null)}>Create New Anyway</button>
                  </div>
                </div>
              ) : (
                <div className="grid-2">
                  <F label="First Name *"><input className="form-input" value={form.first_name || ""} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></F>
                  <F label="Last Name *"><input className="form-input" value={form.last_name || ""} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></F>
                  <F label="Phone"><input className="form-input" type="tel" value={form.phone || ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></F>
                  <F label="Email"><input className="form-input" type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></F>
                  <F label="Address"><input className="form-input" value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></F>
                  <F label="City"><input className="form-input" value={form.city || ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></F>
                </div>
              )}
            </div>
            {!dupWarning && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.first_name?.trim() || !form.last_name?.trim()}>{saving ? "Saving…" : "Add Customer"}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-lg" style={{ maxWidth: 600, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">{detail.first_name} {detail.last_name}</span><button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                {detail.phone && <div>📞 {detail.phone}</div>}
                {detail.email && <div>📧 {detail.email}</div>}
                {detail.address && <div>📍 {detail.address}{detail.city ? `, ${detail.city}` : ""}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", marginBottom: 8 }}>🐾 Pets ({detailAnimals.length})</div>
              {detailLoading ? <div style={{ color: "var(--text-muted)" }}>Loading…</div> :
                detailAnimals.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No pets linked to this customer yet.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {detailAnimals.map((da) => (
                    <div key={da.animal_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-alt)", borderRadius: 8 }}>
                      <span style={{ fontSize: 20 }}>{da.animal?.species === "Dog" ? "🐕" : da.animal?.species === "Cat" ? "🐈" : "🐾"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{da.animal?.name || "—"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{da.animal?.breed || "—"} · {displayAge(da.animal?.age)}</div>
                      </div>
                      <span className="badge" style={{ background: "#f0fdfa", color: "var(--teal)", fontSize: 10 }}>{da.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
