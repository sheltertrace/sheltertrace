"use client";
import { useState, useEffect, useMemo } from "react";
import { fetchDepartureReceipts } from "@/lib/data";
import type { DepartureReceipt } from "@/lib/types";
import { reprintBatchAdoptionReceipts } from "@/lib/departureReceipt";
import ReprintReceiptButton from "@/components/receipts/ReprintReceiptButton";
import Pagination from "@/components/ui/Pagination";
import { getCurrentUser } from "@/lib/auth";
import { canReprintReceipt } from "@/lib/permissions";

export default function AdoptionReceiptsList() {
  const [receipts, setReceipts] = useState<DepartureReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const perPage = 15;
  const user = getCurrentUser();

  useEffect(() => {
    fetchDepartureReceipts({ departureType: "Adoption" })
      .then(setReceipts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) =>
      (r.animal_name || "").toLowerCase().includes(q) ||
      (r.person_name || "").toLowerCase().includes(q) ||
      (r.receipt_number || "").toLowerCase().includes(q) ||
      (r.animal_id || "").toLowerCase().includes(q)
    );
  }, [receipts, search]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const selectedReceipts = useMemo(
    () => receipts.filter((r) => selected.has(r.id) && canReprintReceipt(user, r)),
    [receipts, selected, user]
  );

  const toggleSelected = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleBatchReprint = async () => {
    setBatchPrinting(true);
    try {
      await reprintBatchAdoptionReceipts(selectedReceipts);
      setSelected(new Set());
    } finally {
      setBatchPrinting(false);
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
      <div style={{ padding: "12px 16px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🧾 Adoption Receipts</span>
        <input
          className="form-input"
          style={{ maxWidth: 260 }}
          placeholder="Search animal, adopter, or receipt #…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        {selectedReceipts.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={handleBatchReprint} disabled={batchPrinting} style={{ marginLeft: "auto" }}>
            {batchPrinting ? "Preparing…" : `🖨 Reprint Selected as PDF Batch (${selectedReceipts.length})`}
          </button>
        )}
        <span style={{ marginLeft: selectedReceipts.length > 0 ? 0 : "auto", fontSize: 12, color: "var(--text-muted)" }}>
          {filtered.length} receipt{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>Receipt #</th>
            <th>Animal</th>
            <th>Adopter</th>
            <th>Date</th>
            <th>Officer</th>
            <th style={{ width: 110 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} className="empty-state">Loading…</td></tr>
          ) : paged.length === 0 ? (
            <tr><td colSpan={7} className="empty-state">No adoption receipts found.</td></tr>
          ) : paged.map((r) => (
            <tr key={r.id}>
              <td>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} disabled={!canReprintReceipt(user, r)} />
              </td>
              <td style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{r.receipt_number}</td>
              <td style={{ fontWeight: 600 }}>
                {r.animal_name} <span style={{ fontFamily: "monospace", fontWeight: 400, color: "var(--text-muted)", fontSize: 11 }}>({r.animal_id})</span>
              </td>
              <td style={{ fontSize: 12 }}>{r.person_name || "—"}</td>
              <td style={{ fontSize: 12 }}>{r.departure_date ? new Date(r.departure_date).toLocaleDateString() : "—"}</td>
              <td style={{ fontSize: 12 }}>{r.officer_name || "—"}</td>
              <td>
                <ReprintReceiptButton receipt={r} className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: "4px 10px" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "8px 12px" }}>
        <Pagination total={filtered.length} perPage={perPage} current={page} onChange={setPage} />
      </div>
    </div>
  );
}
