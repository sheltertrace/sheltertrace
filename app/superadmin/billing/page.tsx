"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/app/providers";
import { fetchCustomers, logAuditAction } from "@/lib/superAdminData";
import { fetchPayments, createPayment, type PlatformPayment } from "@/lib/superAdminData";
import type { PlatformCustomer } from "@/lib/superAdminTypes";
import { STATUS_COLORS } from "@/lib/superAdminTypes";
import DateInput from "@/components/ui/DateInput";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<PlatformCustomer[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [payCustomerId, setPayCustomerId] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Check");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchPayments()]).then(([c, p]) => { setCustomers(c); setPayments(p); }).finally(() => setLoading(false));
  }, []);

  const active = customers.filter((c) => c.status === "active");
  const mrr = active.reduce((sum, c) => sum + (c.billing_cycle === "annual" ? (c.billing_amount || 0) / 12 : (c.billing_amount || 0)), 0);
  const arr = mrr * 12;
  const payingCount = active.filter((c) => c.billing_amount).length;

  const planBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    active.forEach((c) => { const p = c.billing_plan || "none"; m[p] = (m[p] || 0) + (c.billing_amount || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const today = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const trialsExpiring = customers.filter((c) => c.status === "trial" && c.trial_end && c.trial_end >= today && c.trial_end <= thirtyDays);

  const custMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const handleRecordPayment = async () => {
    if (!payCustomerId || !payAmount || !user?.id) return;
    setSaving(true);
    try {
      const p = await createPayment({ customer_id: payCustomerId, payment_date: payDate, amount: parseFloat(payAmount), payment_method: payMethod, notes: payNotes.trim() || undefined, recorded_by: user.id });
      setPayments((prev) => [p, ...prev]);
      await logAuditAction(user.id, "Payment Recorded", "customer", payCustomerId, { amount: payAmount, method: payMethod });
      setShowPayment(false);
      setPayAmount(""); setPayNotes("");
    } catch (err: unknown) { alert(`Failed: ${(err as { message?: string }).message}`); }
    finally { setSaving(false); }
  };

  const openPayFor = (custId: string) => { setPayCustomerId(custId); setShowPayment(true); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>💳 Billing & Revenue</h1>
        <button className="btn btn-primary" onClick={() => { setPayCustomerId(""); setShowPayment(true); }}>+ Record Payment</button>
      </div>

      {/* Revenue stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "MRR", value: `$${Math.round(mrr).toLocaleString()}`, color: "#15803d", bg: "#f0fdf4", icon: "💰" },
          { label: "ARR", value: `$${Math.round(arr).toLocaleString()}`, color: "#0369a1", bg: "#f0f9ff", icon: "📊" },
          { label: "Paying Customers", value: payingCount, color: "#6366f1", bg: "#eef2ff", icon: "🏢" },
          { label: "Trials Expiring", value: trialsExpiring.length, color: trialsExpiring.length ? "#dc2626" : "#64748b", bg: trialsExpiring.length ? "#fef2f2" : "#f8fafc", icon: "⏳" },
        ].map((c) => (
          <div key={c.label} className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{c.icon}</div>
            <div><div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{loading ? "—" : c.value}</div><div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{c.label}</div></div>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      {planBreakdown.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Revenue by Plan</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {planBreakdown.map(([plan, amount]) => (
              <div key={plan} style={{ fontSize: 13 }}><span style={{ textTransform: "capitalize", fontWeight: 600 }}>{plan}:</span> <span style={{ color: "#15803d" }}>${amount.toLocaleString()}/mo</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Customer billing table */}
      <div className="card" style={{ padding: 0, overflow: "auto", marginBottom: 20 }}>
        <table className="data-table">
          <thead><tr><th>Account</th><th>Type</th><th>Plan</th><th>Amount</th><th>Cycle</th><th>Status</th><th>Trial End</th><th>Last Payment</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => {
              const sc = STATUS_COLORS[c.status] || STATUS_COLORS.trial;
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.account_name}</td>
                  <td style={{ fontSize: 12, textTransform: "capitalize" }}>{c.account_type?.replace("_", " ")}</td>
                  <td style={{ fontSize: 12, textTransform: "capitalize" }}>{c.billing_plan || "—"}</td>
                  <td style={{ fontSize: 12 }}>{c.billing_amount ? `$${c.billing_amount}` : "—"}</td>
                  <td style={{ fontSize: 12, textTransform: "capitalize" }}>{c.billing_cycle || "—"}</td>
                  <td><span className="badge" style={{ background: sc.bg, color: sc.color, textTransform: "capitalize" }}>{c.status}</span></td>
                  <td style={{ fontSize: 12 }}>{c.trial_end || "—"}</td>
                  <td style={{ fontSize: 12 }}>{c.last_payment_date || "—"}</td>
                  <td><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openPayFor(c.id)}>💳 Pay</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Recent payments */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>Recent Payments</div>
        {payments.length === 0 ? <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>No payments recorded yet.</div> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Customer</th><th>Amount</th><th>Method</th><th>Notes</th></tr></thead>
            <tbody>
              {payments.slice(0, 20).map((p) => (
                <tr key={p.id}>
                  <td style={{ fontSize: 12 }}>{p.payment_date}</td>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{custMap.get(p.customer_id)?.account_name || p.customer_id.slice(0, 8)}</td>
                  <td style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>${p.amount.toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{p.payment_method || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><span className="modal-title">Record Payment</span><button className="btn btn-ghost btn-sm" onClick={() => setShowPayment(false)}>✕</button></div>
            <div className="modal-body">
              <F label="Customer *">
                <select className="form-select" value={payCustomerId} onChange={(e) => setPayCustomerId(e.target.value)}>
                  <option value="">— Select —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.account_name}</option>)}
                </select>
              </F>
              <F label="Payment Date"><DateInput className="form-input" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></F>
              <F label="Amount ($)"><input className="form-input" type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></F>
              <F label="Method">
                <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {["Check", "ACH", "Credit Card", "Wire", "Other"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </F>
              <F label="Notes"><input className="form-input" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional" /></F>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayment(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRecordPayment} disabled={saving || !payCustomerId || !payAmount}>{saving ? "Saving…" : "Record Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
