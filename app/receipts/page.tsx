"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import { fetchReceipts, createReceipt, fetchPeople, createPerson } from "@/lib/data";
import type { Receipt, Person, LineItem } from "@/lib/types";
import { RECEIPT_CATEGORIES, SERVICE_ITEMS, DONATION_ITEMS, MERCH_ITEMS, PAYMENT_METHODS } from "@/lib/constants";
import { formatDate, today, currencyFmt, genReceiptId } from "@/lib/utils";

function getItems(cat: string): string[] {
  if (cat === "Services") return SERVICE_ITEMS;
  if (cat === "Donations") return DONATION_ITEMS;
  return MERCH_ITEMS;
}

function printReceipt(receipt: Receipt): void {
  const w = window.open("", "_blank", "width=500,height=600");
  if (!w) return;
  const total = receipt.line_items.reduce((s, i) => s + (i.price * i.qty), 0);
  w.document.write(`
    <html><head><title>Receipt ${receipt.id}</title>
    <style>body{font-family:sans-serif;padding:24px;max-width:420px;margin:0 auto}
    h2{font-size:18px;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{padding:5px 8px;border:1px solid #ccc;font-size:12px}th{background:#f1f5f9}
    .total{font-size:16px;font-weight:bold;text-align:right;margin-top:8px}</style></head>
    <body>
      <h2>ShelterTrace Receipt</h2>
      <div style="font-size:11px;color:#64748b">Morgan County Georgia Animal Services</div>
      <div style="font-size:12px;margin:12px 0">
        <div><b>Receipt #:</b> ${receipt.id}</div>
        <div><b>Date:</b> ${receipt.date}</div>
        <div><b>Category:</b> ${receipt.category}</div>
        <div><b>Payment:</b> ${receipt.payment_method}${receipt.check_number ? ` #${receipt.check_number}` : ""}</div>
        ${!receipt.anonymous ? `<div><b>Payee:</b> ${receipt.person_name}</div>` : "<div><b>Payee:</b> Anonymous</div>"}
      </div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
        <tbody>${receipt.line_items.map((i) => `<tr><td>${i.item}</td><td>${i.qty}</td><td>$${Number(i.price).toFixed(2)}</td><td>$${(i.qty * Number(i.price)).toFixed(2)}</td></tr>`).join("")}</tbody>
      </table>
      <div class="total">Total: $${total.toFixed(2)}</div>
      ${receipt.notes ? `<div style="font-size:11px;margin-top:8px;color:#64748b">Notes: ${receipt.notes}</div>` : ""}
      <div style="font-size:10px;margin-top:16px;text-align:center;color:#94a3b8">ShelterTrace v1.0 · Shelter Data Systems · © 2026</div>
    </body></html>
  `);
  w.document.close();
  w.print();
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"new" | "history" | "report">("new");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const perPage = 15;

  // New receipt form
  const [category, setCategory] = useState<string>("Services");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ item: SERVICE_ITEMS[0], qty: 1, price: 0 }]);
  const [payMethod, setPayMethod] = useState("Cash");
  const [checkNumber, setCheckNumber] = useState("");
  const [isAnon, setIsAnon] = useState(true);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [receiptNotes, setReceiptNotes] = useState("");
  const [receiptDate, setReceiptDate] = useState(today());
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [npFirst, setNpFirst] = useState(""); const [npMid, setNpMid] = useState(""); const [npLast, setNpLast] = useState(""); const [npPhone, setNpPhone] = useState(""); const [npEmail, setNpEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([fetchReceipts(), fetchPeople()]);
      setReceipts(r);
      setPeople(p);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-highlight from URL param ?id=
  useEffect(() => {
    if (typeof window === "undefined" || loading || receipts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const found = receipts.find((r) => r.id === idParam);
    if (found) {
      setTab("history");
      setHighlightId(idParam);
      setTimeout(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      setTimeout(() => setHighlightId(null), 4000);
    }
  }, [receipts, loading]);

  useEffect(() => {
    const items = getItems(category);
    setLineItems([{ item: items[0], qty: 1, price: 0 }]);
  }, [category]);

  const total = lineItems.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0);
  const personMatches = personSearch ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(personSearch.toLowerCase())).slice(0, 8) : [];

  const handleAddLine = () => setLineItems((prev) => [...prev, { item: getItems(category)[0], qty: 1, price: 0 }]);
  const handleRemoveLine = (i: number) => setLineItems((prev) => prev.filter((_, j) => j !== i));
  const updateLine = (i: number, field: keyof LineItem, val: string | number) => setLineItems((prev) => prev.map((l, j) => j === i ? { ...l, [field]: val } : l));

  const handleCreateNewPerson = async () => {
    if (!npFirst.trim() || !npLast.trim()) return;
    const p = await createPerson({ first_name: npFirst, middle_name: npMid || undefined, last_name: npLast, phone: npPhone, email: npEmail, role: "Donor", date_added: today() });
    setPeople((prev) => [...prev, p]);
    setSelectedPerson(p);
    setPersonSearch(`${p.first_name} ${p.last_name}`);
    setShowNewPerson(false);
    setNpFirst(""); setNpMid(""); setNpLast(""); setNpPhone(""); setNpEmail("");
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const rec = await createReceipt({
        id: genReceiptId(),
        date: receiptDate,
        category,
        line_items: lineItems,
        total,
        payment_method: payMethod,
        check_number: checkNumber || undefined,
        anonymous: isAnon,
        person_id: selectedPerson?.id,
        person_name: selectedPerson ? `${selectedPerson.first_name} ${selectedPerson.last_name}` : undefined,
        notes: receiptNotes || undefined,
      });
      setReceipts((prev) => [rec, ...prev]);
      printReceipt(rec);
      setTab("history");
      setLineItems([{ item: getItems(category)[0], qty: 1, price: 0 }]);
      setPayMethod("Cash"); setCheckNumber(""); setIsAnon(true); setSelectedPerson(null); setPersonSearch(""); setReceiptNotes("");
    } catch { } finally { setSaving(false); }
  };

  const filteredHistory = useMemo(() => {
    return receipts.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q || (r.id || "").toLowerCase().includes(q) || (r.person_name || "").toLowerCase().includes(q);
      const matchCat = filterCat === "All" || r.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [receipts, search, filterCat]);

  // Report data
  const reportData = useMemo(() => {
    const byCat: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    receipts.forEach((r) => {
      byCat[r.category] = (byCat[r.category] || 0) + r.total;
      byMethod[r.payment_method] = (byMethod[r.payment_method] || 0) + r.total;
    });
    const totalRevenue = receipts.reduce((s, r) => s + r.total, 0);
    return { byCat, byMethod, totalRevenue };
  }, [receipts]);

  return (
    <AppShell title="Receipts & Payments">
      <div className="tabs">
        <div className={`tab ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>New Receipt</div>
        <div className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>History ({receipts.length})</div>
        <div className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>Revenue Report</div>
      </div>

      {tab === "new" && (
        <div style={{ maxWidth: 700 }}>
          <div className="card">
            {/* Category */}
            <div className="form-group">
              <label className="form-label">Category</label>
              <div style={{ display: "flex", gap: 8 }}>
                {RECEIPT_CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setCategory(c)} className={`btn btn-sm ${category === c ? "btn-primary" : "btn-secondary"}`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Line items */}
            <div className="form-group">
              <label className="form-label">Line Items</label>
              {lineItems.map((line, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px 30px", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <select className="form-select" value={line.item} onChange={(e) => updateLine(i, "item", e.target.value)}>
                    {getItems(category).map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <input className="form-input" type="number" min={1} value={line.qty} onChange={(e) => updateLine(i, "qty", parseInt(e.target.value) || 1)} />
                  <input className="form-input" type="number" min={0} step={0.01} value={line.price || ""} onChange={(e) => updateLine(i, "price", parseFloat(e.target.value) || 0)} placeholder="$0.00" />
                  {lineItems.length > 1 && <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", padding: 4 }} onClick={() => handleRemoveLine(i)}>✕</button>}
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={handleAddLine}>+ Add Line</button>
            </div>

            <div style={{ textAlign: "right", fontSize: 20, fontWeight: 800, color: "var(--teal)", marginBottom: 14 }}>
              Total: {currencyFmt(total)}
            </div>

            {/* Payment */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              {payMethod === "Check" && (
                <div className="form-group">
                  <label className="form-label">Check Number</label>
                  <input className="form-input" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </div>
            </div>

            {/* Payee */}
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={isAnon} onChange={(e) => setIsAnon(e.target.checked)} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Anonymous payment</span>
              </label>
              {!isAnon && (
                <div>
                  <input className="form-input" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Search contact by name…" style={{ marginBottom: 6 }} />
                  {personMatches.length > 0 && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 7, marginBottom: 6, overflow: "hidden" }}>
                      {personMatches.map((p) => (
                        <div key={p.id} onClick={() => { setSelectedPerson(p); setPersonSearch(`${p.first_name} ${p.last_name}`); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                          <strong>{p.first_name} {p.last_name}</strong> <span style={{ color: "var(--text-secondary)" }}>{p.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!showNewPerson ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowNewPerson(true)}>+ New Contact</button>
                  ) : (
                    <div style={{ background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                      <div className="grid-2">
                        <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={npFirst} onChange={(e) => setNpFirst(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Middle Name</label><input className="form-input" value={npMid} onChange={(e) => setNpMid(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={npLast} onChange={(e) => setNpLast(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} /></div>
                        <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={npEmail} onChange={(e) => setNpEmail(e.target.value)} /></div>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={handleCreateNewPerson}>Save</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} rows={2} />
            </div>

            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || total <= 0} style={{ width: "100%", justifyContent: "center" }}>
              {saving ? "Creating…" : "🧾 Create Receipt & Print"}
            </button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div ref={historyRef}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="form-input" style={{ maxWidth: 260 }} placeholder="Search receipts…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {["All", ...RECEIPT_CATEGORIES].map((c) => (
              <button key={c} onClick={() => setFilterCat(c)} className={`btn btn-sm ${filterCat === c ? "btn-primary" : "btn-secondary"}`}>{c}</button>
            ))}
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Receipt ID</th><th>Date</th><th>Category</th><th>Items</th><th>Total</th><th>Payment</th><th>Payee</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="empty-state">Loading…</td></tr>
                  : filteredHistory.length === 0 ? <tr><td colSpan={8} className="empty-state">No receipts</td></tr>
                  : filteredHistory.slice((page - 1) * perPage, page * perPage).map((r) => {
                    const isHighlighted = r.id === highlightId;
                    return (
                      <tr
                        key={r.id}
                        style={{
                          cursor: "pointer",
                          background: isHighlighted ? "#fef9c3" : undefined,
                          outline: isHighlighted ? "2px solid #eab308" : undefined,
                          transition: "background 0.5s",
                        }}
                        onClick={() => printReceipt(r)}
                      >
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.id}</td>
                        <td style={{ fontSize: 12 }}>{formatDate(r.date)}</td>
                        <td><span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>{r.category}</span></td>
                        <td style={{ fontSize: 12 }}>{r.line_items.length} item{r.line_items.length !== 1 ? "s" : ""}</td>
                        <td style={{ fontWeight: 700, color: "#16a34a" }}>{currencyFmt(r.total)}</td>
                        <td style={{ fontSize: 12 }}>{r.payment_method}</td>
                        <td style={{ fontSize: 12 }}>{r.anonymous ? "Anonymous" : r.person_name || "—"}</td>
                        <td onClick={(e) => e.stopPropagation()}><button className="btn btn-ghost btn-sm" onClick={() => printReceipt(r)}>🖨</button></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <div style={{ padding: "8px 12px" }}>
              <Pagination total={filteredHistory.length} perPage={perPage} current={page} onChange={setPage} />
            </div>
          </div>
        </div>
      )}

      {tab === "report" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Revenue by Category</span></div>
            {Object.entries(reportData.byCat).map(([cat, amt]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontWeight: 600 }}>{cat}</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>{currencyFmt(amt)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontWeight: 800, fontSize: 15 }}>
              <span>Total Revenue</span>
              <span style={{ color: "var(--teal)" }}>{currencyFmt(reportData.totalRevenue)}</span>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Revenue by Payment Method</span></div>
            {Object.entries(reportData.byMethod).map(([method, amt]) => (
              <div key={method} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ fontWeight: 600 }}>{method}</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>{currencyFmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
