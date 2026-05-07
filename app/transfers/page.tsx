"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchRescueGroups, createRescueGroup, updateRescueGroup, deleteRescueGroup,
  fetchTransfers, fetchAnimals, fetchMedical,
} from "@/lib/data";
import type { RescueGroup, Transfer, Animal, MedicalRecord } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";
import TransferWizard, { printTransferReceipt } from "@/components/transfers/TransferWizard";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];

function licenseStatus(group: RescueGroup): { label: string; color: string } | null {
  if (!group.license_expiration) return null;
  const days = Math.floor((new Date(group.license_expiration).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "EXPIRED", color: "#dc2626" };
  if (days <= 30) return { label: `Expires in ${days}d`, color: "#f59e0b" };
  return null;
}

const EMPTY_GROUP: Partial<RescueGroup> = { organization_name: "", contact_person: "", phone: "", email: "", address: "", city: "", state: "GA", zip: "", license_number: "", license_expiration: "" };

export default function TransfersPage() {
  const [tab, setTab] = useState<"groups" | "history">("groups");
  const [groups, setGroups] = useState<RescueGroup[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [medicalByAnimal, setMedicalByAnimal] = useState<Record<string, MedicalRecord[]>>({});
  const [loading, setLoading] = useState(true);

  // Group form
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RescueGroup | null>(null);
  const [groupForm, setGroupForm] = useState<Partial<RescueGroup>>(EMPTY_GROUP);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // Transfer wizard
  const [showWizard, setShowWizard] = useState(false);
  const [wizardGroup, setWizardGroup] = useState<string | null>(null);

  // History
  const [historySearch, setHistorySearch] = useState("");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  const load = useCallback(async () => {
    try {
      const [g, t, a] = await Promise.all([fetchRescueGroups(), fetchTransfers(), fetchAnimals()]);
      setGroups(g);
      setTransfers(t);
      setAnimals(a);
      // Build medical index for transfer sheet printing
      const allMed = await fetchMedical();
      const byAnimal: Record<string, MedicalRecord[]> = {};
      allMed.forEach((m) => {
        if (!byAnimal[m.animal_id]) byAnimal[m.animal_id] = [];
        byAnimal[m.animal_id].push(m);
      });
      setMedicalByAnimal(byAnimal);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.toLowerCase();
    return groups.filter((g) => !q || g.organization_name.toLowerCase().includes(q) || (g.contact_person || "").toLowerCase().includes(q) || (g.city || "").toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    return transfers.filter((t) => !q || (t.rescue_group_name || "").toLowerCase().includes(q) || t.transfer_number.toLowerCase().includes(q));
  }, [transfers, historySearch]);

  const openAddGroup = () => { setEditingGroup(null); setGroupForm({ ...EMPTY_GROUP }); setShowGroupModal(true); };
  const openEditGroup = (g: RescueGroup) => { setEditingGroup(g); setGroupForm({ ...g }); setShowGroupModal(true); };

  const handleSaveGroup = async () => {
    if (!groupForm.organization_name?.trim()) return;
    setSavingGroup(true);
    try {
      if (editingGroup) {
        const updated = await updateRescueGroup(editingGroup.id, groupForm);
        setGroups((prev) => prev.map((g) => g.id === updated.id ? updated : g));
      } else {
        const created = await createRescueGroup(groupForm as Omit<RescueGroup, "id" | "created_at" | "updated_at">);
        setGroups((prev) => [...prev, created].sort((a, b) => a.organization_name.localeCompare(b.organization_name)));
      }
      setShowGroupModal(false);
    } catch (err: unknown) {
      alert(`Save failed: ${(err as { message?: string }).message || "Unknown error"}`);
    } finally { setSavingGroup(false); }
  };

  const handleDeleteGroup = async (g: RescueGroup) => {
    if (!confirm(`Delete "${g.organization_name}"? This will not affect existing transfer records.`)) return;
    try {
      await deleteRescueGroup(g.id);
      setGroups((prev) => prev.filter((x) => x.id !== g.id));
    } catch (err: unknown) {
      alert(`Delete failed: ${(err as { message?: string }).message || "Unknown error"}`);
    }
  };

  const handleTransferComplete = (transfer: Transfer, transferredAnimals: Animal[]) => {
    setTransfers((prev) => [transfer, ...prev]);
    setAnimals((prev) => prev.map((a) => {
      const t = transferredAnimals.find((x) => x.id === a.id);
      if (!t) return a;
      return { ...a, status: "Transferred", transferred_to: transfer.rescue_group_name, transfer_date: transfer.date };
    }));
    setShowWizard(false);
  };

  const handlePrintTransfer = (t: Transfer) => {
    const group = groups.find((g) => g.id === t.rescue_group_id);
    const tAnimals = animals.filter((a) => t.animal_ids.includes(a.id));
    if (!group) { alert("Rescue group not found"); return; }
    printTransferReceipt(t, group, tAnimals, medicalByAnimal);
  };

  const gf = (label: string, field: keyof RescueGroup, type = "text", opts?: string[]) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {opts ? (
        <select className="form-select" value={(groupForm[field] as string) || ""} onChange={(e) => setGroupForm((p) => ({ ...p, [field]: e.target.value }))}>
          <option value="">—</option>
          {opts.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input className="form-input" type={type} value={(groupForm[field] as string) || ""}
          onChange={(e) => setGroupForm((p) => ({ ...p, [field]: e.target.value }))} />
      )}
    </div>
  );

  if (loading) return <AppShell title="Transfers"><div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div></AppShell>;

  return (
    <AppShell
      title="Transfers & Rescue Groups"
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={openAddGroup}>+ Add Rescue Group</button>
          <button className="btn btn-primary" onClick={() => { setWizardGroup(null); setShowWizard(true); }}>🚌 New Transfer</button>
        </div>
      }
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
        {(["groups", "history"] as const).map((t) => (
          <button key={t} className="btn btn-ghost"
            style={{ borderRadius: "6px 6px 0 0", borderBottom: tab === t ? "2px solid var(--teal)" : "2px solid transparent", marginBottom: -2, fontWeight: tab === t ? 700 : 400, color: tab === t ? "var(--teal)" : "var(--text-secondary)" }}
            onClick={() => setTab(t)}>
            {t === "groups" ? `Rescue Groups (${groups.length})` : `Transfer History (${transfers.length})`}
          </button>
        ))}
      </div>

      {/* ── Rescue Groups tab ── */}
      {tab === "groups" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <div className="search-bar" style={{ flex: "1 1 240px", maxWidth: 320 }}>
              <span className="search-icon">🔍</span>
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search name, contact, city…" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
            </div>
            {groups.some((g) => licenseStatus(g)) && (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 700 }}>
                ⚠️ {groups.filter((g) => { const s = licenseStatus(g); return s?.color === "#dc2626"; }).length} expired / {groups.filter((g) => { const s = licenseStatus(g); return s?.color === "#f59e0b"; }).length} expiring soon
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Organization</th><th>Contact</th><th>Phone / Email</th><th>Location</th><th>License #</th><th>License Expires</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredGroups.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No rescue groups on file. Add one to get started.</td></tr>
                ) : filteredGroups.map((g) => {
                  const ws = licenseStatus(g);
                  const txCount = transfers.filter((t) => t.rescue_group_id === g.id).length;
                  return (
                    <tr key={g.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{g.organization_name}</div>
                        {txCount > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{txCount} transfer{txCount !== 1 ? "s" : ""}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{g.contact_person || "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        <div>{g.phone || "—"}</div>
                        <div style={{ color: "var(--text-muted)" }}>{g.email || ""}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{[g.city, g.state].filter(Boolean).join(", ") || "—"}</td>
                      <td style={{ fontSize: 12, fontFamily: "monospace" }}>{g.license_number || "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {g.license_expiration ? (
                          <span style={{ color: ws ? ws.color : "inherit", fontWeight: ws ? 700 : 400 }}>
                            {ws ? "⚠️ " : ""}{formatDate(g.license_expiration)}{ws ? ` (${ws.label})` : ""}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => { setWizardGroup(g.id); setShowWizard(true); }}>Transfer Animals</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditGroup(g)}>Edit</button>
                          <button className="btn btn-sm" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }} onClick={() => handleDeleteGroup(g)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Transfer History tab ── */}
      {tab === "history" && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div className="search-bar" style={{ maxWidth: 320 }}>
              <span className="search-icon">🔍</span>
              <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search agency, transfer #…" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Transfer #</th><th>Date</th><th>Receiving Agency</th><th>Animals</th><th>Officer</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={7} className="empty-state">No transfers on record.</td></tr>
                ) : filteredHistory.map((t) => (
                  <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => setSelectedTransfer(selectedTransfer?.id === t.id ? null : t)}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>{t.transfer_number}</td>
                    <td style={{ fontSize: 12 }}>{formatDate(t.date)}</td>
                    <td style={{ fontWeight: 600 }}>{t.rescue_group_name || "—"}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{t.animal_ids.length} animal{t.animal_ids.length !== 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(t.animal_names || []).slice(0, 3).join(", ")}{(t.animal_names || []).length > 3 ? "…" : ""}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{t.officer || "—"}</td>
                    <td style={{ fontSize: 12, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.notes || "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handlePrintTransfer(t)}>🖨 Print Sheet</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expanded detail row */}
          {selectedTransfer && (() => {
            const t = selectedTransfer;
            const tAnimals = animals.filter((a) => t.animal_ids.includes(a.id));
            const group = groups.find((g) => g.id === t.rescue_group_id);
            return (
              <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#1e3a5f", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700 }}>Transfer Details — {t.transfer_number}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: "rgba(255,255,255,0.6)" }} onClick={() => setSelectedTransfer(null)}>✕</button>
                </div>
                <div style={{ padding: 16 }}>
                  {group && (
                    <div style={{ marginBottom: 12, fontSize: 13 }}>
                      <strong>{group.organization_name}</strong> · {group.contact_person} · {group.phone} · {[group.city, group.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {t.notes && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary)", background: "var(--surface-2)", padding: "8px 12px", borderRadius: 6 }}>{t.notes}</div>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {tAnimals.map((a) => (
                      <div key={a.id} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, padding: "6px 12px", fontSize: 12 }}>
                        <strong>{a.name}</strong> <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{a.id}</span> · {a.species} · {a.breed}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── Add/Edit Group Modal ── */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editingGroup ? "Edit Rescue Group" : "Add Rescue Group"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGroupModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Organization Name *</label>
                  <input className="form-input" value={groupForm.organization_name || ""} onChange={(e) => setGroupForm((p) => ({ ...p, organization_name: e.target.value }))} placeholder="e.g. Humane Society of Metro Atlanta" />
                </div>
                {gf("Contact Person", "contact_person")}
                {gf("Phone", "phone", "tel")}
                {gf("Email", "email", "email")}
                {gf("Address", "address")}
                {gf("City", "city")}
                {gf("State", "state", "text", US_STATES)}
                {gf("Zip", "zip")}
                {gf("Agency License Number", "license_number")}
                {gf("License Expiration", "license_expiration", "date")}
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={groupForm.notes || ""} onChange={(e) => setGroupForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any special notes about this organization…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveGroup} disabled={savingGroup || !groupForm.organization_name?.trim()}>
                {savingGroup ? "Saving…" : editingGroup ? "Save Changes" : "Add Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Wizard ── */}
      {showWizard && (
        <TransferWizard
          animals={animals}
          medicalByAnimal={medicalByAnimal}
          rescueGroups={groups}
          initialGroupId={wizardGroup || undefined}
          onComplete={handleTransferComplete}
          onClose={() => setShowWizard(false)}
        />
      )}
    </AppShell>
  );
}
