"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicInvoices, createClinicInvoice, updateClinicInvoice, generateInvoiceNumber, fetchClinicSettings } from "@/lib/clinicData";
import type { ClinicInvoice, ClinicInvoiceLineItem, ClinicSettings } from "@/lib/clinicTypes";
import { INVOICE_STATUSES } from "@/lib/clinicTypes";
import DateInput from "@/components/ui/DateInput";
import { today } from "@/lib/utils";
import { printClinicInvoice } from "@/lib/clinicInvoicePrint";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:    { bg: "#f1f5f9", color: "#64748b" },
  Sent:     { bg: "#dbeafe", color: "#1d4ed8" },
  Paid:     { bg: "#dcfce7", color: "#15803d" },
  Overdue:  { bg: "#fee2e2", color: "#dc2626" },
};

function dueDate(): string {
  const d = new Date(Date.now() + 30 * 86400000);
  return d.toISOString().split("T")[0];
}

function InvoicesContent() {
  const { user } = useAuth();
  const { selectedClientId, clients } = useClinic();
  const params = useSearchParams();
  const [invoices, setInvoices] = useState<ClinicInvoice[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!params.get("add"));
  const [showPay, setShowPay] = useState<ClinicInvoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [payForm, setPayForm] = useState({ date: today(), amount: "", method: "Check", ref: "", notes: "" });

  const [form, setForm] = useState<Partial<ClinicInvoice>>({
    invoice_date: today(), due_date: dueDate(), status: "Draft",
    line_items: [], subtotal: 0, tax: 0, total: 0,
    client_id: selectedClientId || undefined,
  });

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicInvoices(user.id, selectedClientId || undefined),
      fetchClinicSettings(user.id),
    ]).then(([inv, s]) => { setInvoices(inv); setSettings(s); }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (filterStatus !== "all") list = list.filter((i) => i.status === filterStatus);
    return list;
  }, [invoices, filterStatus]);

  const totalOutstanding = invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + (i.total || 0), 0);
  const paidThisMonth = invoices.filter((i) => i.status === "Paid" && (i.invoice_date || "").startsWith(today().slice(0, 7))).reduce((s, i) => s + (i.total || 0), 0);
  const overdueCount = invoices.filter((i) => i.status === "Overdue" || (i.status === "Sent" && i.due_date && i.due_date < today())).length;

  const recalc = (items: ClinicInvoiceLineItem[], taxRate: number) => {
    const sub = items.reduce((s, i) => s + (i.total || 0), 0);
    const tax = sub * (taxRate / 100);
    return { subtotal: sub, tax, total: sub + tax };
  };

  const addLine = () => {
    const items = [...(form.line_items as ClinicInvoiceLineItem[] || []), { description: "", quantity: 1, unit_price: 0, total: 0 }];
    setForm((f) => ({ ...f, line_items: items }));
  };

  const updateLine = (i: number, key: keyof ClinicInvoiceLineItem, val: string | number) => {
    const items = [...(form.line_items as ClinicInvoiceLineItem[])];
    items[i] = { ...items[i], [key]: val };
    if (key === "quantity" || key === "unit_price") items[i].total = (Number(items[i].quantity) || 0) * (Number(items[i].unit_price) || 0);
    const totals = recalc(items, 0);
    setForm((f) => ({ ...f, line_items: items, ...totals }));
  };

  const removeLine = (i: number) => {
    const items = (form.line_items as ClinicInvoiceLineItem[]).filter((_, idx) => idx !== i);
    const totals = recalc(items, 0);
    setForm((f) => ({ ...f, line_items: items, ...totals }));
  };

  const handleSave = async (status = "Draft") => {
    if (!form.client_id || !user?.id) return;
    setSaving(true);
    try {
      const invNumber = form.invoice_number || await generateInvoiceNumber(user.id);
      const created = await createClinicInvoice({ ...form, clinic_account_id: user.id, invoice_number: invNumber, status } as Omit<ClinicInvoice, "id" | "created_at">);
      setInvoices((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const handleMarkPaid = async () => {
    if (!showPay) return;
    const updated = await updateClinicInvoice(showPay.id, { status: "Paid", paid_date: payForm.date, payment_method: payForm.method, notes: payForm.notes });
    setInvoices((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    setShowPay(null);
  };

  const clientName = (id?: string) => clients.find((c) => c.id === id)?.county_name || "—";
  const clientObj = (id?: string) => clients.find((c) => c.id === id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>💰 Invoicing & Billing</h1>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ invoice_date: today(), due_date: dueDate(), status: "Draft", line_items: [], subtotal: 0, tax: 0, total: 0, client_id: selectedClientId || undefined }); setShowForm(true); }}>+ Create Invoice</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Outstanding", value: `$${totalOutstanding.toFixed(2)}`, color: "#dc2626", bg: "#fef2f2", icon: "💸" },
          { label: "Paid This Month", value: `$${paidThisMonth.toFixed(2)}`, color: "#15803d", bg: "#f0fdf4", icon: "✅" },
          { label: "Overdue", value: overdueCount, color: overdueCount > 0 ? "#dc2626" : "#64748b", bg: "#fef2f2", icon: "⚠️" },
          { label: "Total Invoices", value: invoices.length, color: "#6366f1", bg: "#eef2ff", icon: "📋" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div><div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", ...INVOICE_STATUSES].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? "btn-primary" : "btn-secondary"}`} style={{ textTransform: "capitalize" }}>
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      {loading ? <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div> : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>No invoices yet.</td></tr> :
                filtered.map((inv) => {
                  const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.Draft;
                  const isOD = inv.status === "Sent" && inv.due_date && inv.due_date < today();
                  return (
                    <tr key={inv.id} style={{ background: isOD ? "#fff5f5" : undefined }}>
                      <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{inv.invoice_number}</td>
                      <td style={{ fontSize: 12 }}>{clientName(inv.client_id)}</td>
                      <td style={{ fontSize: 12 }}>{inv.invoice_date}</td>
                      <td style={{ fontSize: 12, color: isOD ? "#dc2626" : "inherit", fontWeight: isOD ? 700 : 400 }}>{inv.due_date}</td>
                      <td style={{ fontWeight: 700 }}>${(inv.total || 0).toFixed(2)}</td>
                      <td><span className="badge" style={{ background: isOD ? "#fee2e2" : sc.bg, color: isOD ? "#dc2626" : sc.color, fontSize: 10 }}>{isOD ? "Overdue" : inv.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => settings && printClinicInvoice(inv, settings, clientObj(inv.client_id))}>🖨</button>
                          {inv.status !== "Paid" && <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#15803d" }} onClick={() => { setShowPay(inv); setPayForm({ date: today(), amount: String(inv.total || ""), method: "Check", ref: "", notes: "" }); }}>💳 Pay</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" style={{ maxWidth: 680, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Create Invoice</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="grid-2">
                <F label="County Client *">
                  <select className="form-select" value={form.client_id || ""} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                    <option value="">— Select —</option>
                    {clients.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.county_name}</option>)}
                  </select>
                </F>
                <F label="Invoice Date"><DateInput className="form-input" value={form.invoice_date || today()} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))} /></F>
                <F label="Due Date"><DateInput className="form-input" value={form.due_date || dueDate()} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} /></F>
              </div>

              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", margin: "12px 0 8px" }}>Line Items</div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead><tr style={{ background: "#f8fafc" }}><th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>Description</th><th style={{ padding: "6px 8px", width: 60, fontSize: 11 }}>Qty</th><th style={{ padding: "6px 8px", width: 90, fontSize: 11 }}>Unit Price</th><th style={{ padding: "6px 8px", width: 80, fontSize: 11 }}>Total</th><th style={{ width: 28 }}></th></tr></thead>
                <tbody>
                  {(form.line_items as ClinicInvoiceLineItem[] || []).map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: "4px 4px" }}><input className="form-input" style={{ fontSize: 12 }} value={item.description} onChange={(e) => updateLine(i, "description", e.target.value)} /></td>
                      <td style={{ padding: "4px 4px" }}><input className="form-input" style={{ fontSize: 12, textAlign: "right" }} type="number" min="1" value={item.quantity} onChange={(e) => updateLine(i, "quantity", Number(e.target.value))} /></td>
                      <td style={{ padding: "4px 4px" }}><input className="form-input" style={{ fontSize: 12, textAlign: "right" }} type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateLine(i, "unit_price", Number(e.target.value))} /></td>
                      <td style={{ padding: "4px 8px", fontWeight: 700, fontSize: 12 }}>${(item.total || 0).toFixed(2)}</td>
                      <td><button onClick={() => removeLine(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14 }}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost btn-sm" onClick={addLine} style={{ fontSize: 12 }}>+ Add Line Item</button>

              <div style={{ marginTop: 12, textAlign: "right" }}>
                <div style={{ fontSize: 12 }}>Subtotal: <strong>${(form.subtotal || 0).toFixed(2)}</strong></div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>Total: <strong>${(form.total || 0).toFixed(2)}</strong></div>
              </div>

              <div style={{ marginTop: 10 }}>
                <F label="Notes / Payment Instructions"><textarea className="form-textarea" rows={2} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: "space-between" }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => handleSave("Draft")} disabled={saving || !form.client_id}>Save Draft</button>
                <button className="btn btn-primary" onClick={() => handleSave("Sent")} disabled={saving || !form.client_id}>{saving ? "Saving…" : "Send Invoice"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {showPay && (
        <div className="modal-overlay" onClick={() => setShowPay(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Record Payment — {showPay.invoice_number}</span><button className="btn btn-ghost btn-sm" onClick={() => setShowPay(null)}>✕</button></div>
            <div className="modal-body">
              <F label="Payment Date"><DateInput className="form-input" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} /></F>
              <F label="Amount"><input className="form-input" type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></F>
              <F label="Method">
                <select className="form-select" value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
                  {["Check","ACH","Credit Card","Wire","Other"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </F>
              <F label="Reference #"><input className="form-input" value={payForm.ref} onChange={(e) => setPayForm((f) => ({ ...f, ref: e.target.value }))} placeholder="Check number, etc." /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPay(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "#15803d", borderColor: "#15803d" }} onClick={handleMarkPaid}>Mark as Paid</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() { return <Suspense><InvoicesContent /></Suspense>; }
