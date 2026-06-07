"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { useAuth } from "@/app/providers";
import { IS_DEMO } from "@/lib/demo";
import DateInput from "@/components/ui/DateInput";
import {
  fetchDrugInventory,
  fetchEuthanasiaLog,
  fetchDrugReconciliations,
  createDrugInventory,
  updateDrugInventory,
  createDrugReconciliation,
  fetchStaffOptions,
} from "@/lib/data";
import type { DrugInventory, EuthanasiaLog, DrugReconciliation } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import { AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_DOTS, AGENCY_SHORT, COUNTY_NAME, COUNTY_STATE } from "@/lib/shelterInfo";

// ── Signature adapter ─────────────────────────────────────────────────────────
// The existing SignaturePad uses { value, timestamp, onAccept, onClear }
// We need a wrapper that exposes the simpler { value: string, onChange } API

interface SimpleSigPadProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function SimpleSigPad({ label, value, onChange, disabled }: SimpleSigPadProps) {
  const [ts, setTs] = useState<string | null>(null);
  if (disabled && value) {
    return (
      <div style={{ border: "1px solid #86efac", borderRadius: 8, padding: 14, background: "#f0fdf4" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8, textTransform: "uppercase" }}>
          ✓ {label}
        </div>
        <img src={value} alt="Signature" style={{ display: "block", maxWidth: "100%", height: 80, objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 4, padding: 4 }} />
      </div>
    );
  }
  return (
    <SignaturePad
      label={label}
      value={value || null}
      timestamp={ts}
      onAccept={(data, stamp) => { setTs(stamp); onChange(data); }}
      onClear={() => { setTs(null); onChange(""); }}
    />
  );
}

// ── Print helper ──────────────────────────────────────────────────────────────

function printLogEntry(entry: EuthanasiaLog) {
  const sig = (src: string | undefined) =>
    src ? `<img src="${src}" style="height:60px;border:1px solid #ccc;padding:4px;background:#fff;" alt="signature"/>` : "<em>Not provided</em>";

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Drug Log Entry ${entry.log_number}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #000; }
    h1 { font-size: 18px; margin: 0; }
    h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 12px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 48px; color: rgba(0,0,0,0.07); white-space: nowrap; pointer-events: none; z-index: 0; font-weight: 900; letter-spacing: 4px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 8px; vertical-align: top; }
    td:first-child { font-weight: bold; width: 40%; color: #333; }
    .row { display: flex; gap: 24px; }
    .col { flex: 1; }
    @media print { .watermark { display: block; } }
  </style></head><body>
  <div class="watermark">CONTROLLED SUBSTANCE RECORD — CONFIDENTIAL</div>
  <div class="header">
    <div>
      <h1>${AGENCY_NAME}</h1>
      <div>Controlled Substance Euthanasia Log</div>
      <div style="margin-top:4px;font-size:11px;">GDA License · DEA Compliant</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:16px;font-weight:900;">Entry # ${entry.log_number}</div>
      <div>Date: ${entry.log_date || ""} &nbsp; Time: ${entry.log_time || ""}</div>
    </div>
  </div>
  <h2>Animal Information</h2>
  <table>
    <tr><td>Animal ID</td><td>${entry.animal_id || ""}</td><td>Name</td><td>${entry.animal_name || ""}</td></tr>
    <tr><td>Species</td><td>${entry.species || ""}</td><td>Breed</td><td>${entry.breed || ""}</td></tr>
    <tr><td>Sex</td><td>${entry.sex || ""}</td><td>Weight</td><td>${entry.weight || ""}</td></tr>
    <tr><td>Reason</td><td colspan="3">${entry.reason || ""}</td></tr>
  </table>
  <h2>Drug Administration</h2>
  <table>
    <tr><td>Drug</td><td>${entry.drug_name || ""}</td><td>Lot #</td><td>${entry.lot_number || ""}</td></tr>
    <tr><td>Bottle #</td><td style="font-weight:bold">${entry.bottle_id || ""}</td><td>Route</td><td>${entry.route || ""}</td></tr>
    <tr><td>Dosage Drawn (mL)</td><td>${entry.dosage_drawn_ml ?? ""}</td><td>Dosage Administered (mL)</td><td>${entry.dosage_administered_ml ?? ""}</td></tr>
    <tr><td>Dosage Wasted (mL)</td><td>${entry.dosage_wasted_ml ?? ""}</td><td>Running Balance (mL)</td><td>${entry.running_balance_ml ?? ""}</td></tr>
    ${entry.pre_sedation_drug ? `
    <tr style="background:#f0f9ff"><td colspan="4" style="font-weight:800;color:#0369a1;padding-top:8px;">PRE-SEDATION DRUG</td></tr>
    <tr><td>Drug</td><td>${entry.pre_sedation_drug}</td><td>DEA Schedule</td><td>${entry.pre_sedation_dea_schedule || ""}</td></tr>
    <tr><td>Lot #</td><td>${entry.pre_sedation_lot_number || ""}</td><td>Bottle #</td><td style="font-weight:bold">${entry.pre_sedation_bottle_id || ""}</td></tr>
    <tr><td>Concentration</td><td>${entry.pre_sedation_concentration || ""}</td><td>Route</td><td>${entry.pre_sedation_route || ""}</td></tr>
    <tr><td>Drawn (mL)</td><td>${entry.pre_sedation_dosage_drawn_ml ?? ""}</td><td>Administered (mL)</td><td>${entry.pre_sedation_dosage_administered_ml ?? ""}</td></tr>
    <tr><td>Wasted (mL)</td><td>${entry.pre_sedation_dosage_wasted_ml ?? ""}</td><td>Running Balance (mL)</td><td>${entry.pre_sedation_running_balance_ml ?? ""}</td></tr>
    ` : ""}
  </table>
  <h2>Verification</h2>
  <table>
    <tr><td>Death Verification</td><td>${entry.death_verification || ""}</td><td>Time of Death</td><td>${entry.time_of_death || ""}</td></tr>
    <tr><td>Body Disposition</td><td>${entry.body_disposition || ""}</td><td>Owner Present</td><td>${entry.owner_present ? "Yes" : "No"}</td></tr>
    ${entry.complications ? `<tr><td>Complications</td><td colspan="3">${entry.complications}</td></tr>` : ""}
    ${entry.notes ? `<tr><td>Notes</td><td colspan="3">${entry.notes}</td></tr>` : ""}
    ${entry.is_correction ? `<tr><td>Correction Entry</td><td colspan="3">Corrects Log # ${entry.corrects_log_id || ""} — ${entry.correction_reason || ""}</td></tr>` : ""}
  </table>
  <h2>Signatures</h2>
  <div class="row" style="margin-top:10px;">
    <div class="col">
      <div style="font-weight:bold;margin-bottom:6px;">Administering Staff: ${entry.administered_by_name || ""}</div>
      ${sig(entry.administered_by_signature)}
    </div>
    <div class="col">
      <div style="font-weight:bold;margin-bottom:6px;">Witness: ${entry.witness_name || ""}</div>
      ${sig(entry.witness_signature)}
    </div>
  </div>
  <div style="margin-top:30px;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:8px;">
    ${AGENCY_NAME} · CONTROLLED SUBSTANCE RECORD — CONFIDENTIAL · Generated ${new Date().toLocaleString()}
  </div>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  w.document.close();
}

function printReport(title: string, html: string) {
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 13px; margin: 16px 0 6px; border-bottom: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f2942; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 40px; color: rgba(0,0,0,0.06); white-space: nowrap; pointer-events: none; font-weight: 900; }
    .header { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 10px; }
  </style></head><body>
  <div class="watermark">CONTROLLED SUBSTANCE RECORD — CONFIDENTIAL</div>
  <div class="header">
    <div><h1>${AGENCY_NAME}</h1><div>${title}</div></div>
    <div style="text-align:right;font-size:11px;">Generated: ${new Date().toLocaleString()}</div>
  </div>
  ${html}
  <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  w.document.close();
}

// ── Bottle modal ───────────────────────────────────────────────────────────────

interface BottleModalProps {
  onClose: () => void;
  onSave: (entry: Partial<DrugInventory>) => Promise<void>;
}

function BottleModal({ onClose, onSave }: BottleModalProps) {
  const [form, setForm] = useState<Partial<DrugInventory>>({ dea_schedule: "Schedule II", bottle_status: "Active" });
  const [receiverSig, setReceiverSig] = useState("");
  const [witnessSig, setWitnessSig] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const f = (k: keyof DrugInventory, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit() {
    if (!form.drug_name) { setErr("Drug name is required."); return; }
    if (!receiverSig) { setErr("Receiver signature is required."); return; }
    if (!witnessSig) { setErr("Witness signature is required."); return; }
    setSaving(true);
    try {
      await onSave({ ...form, receiver_signature: receiverSig, witness_signature: witnessSig });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--card-bg,#fff)", borderRadius: 12, width: "100%", maxWidth: 700, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border,#e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Receive New Bottle</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label>
              <div className="form-label">Drug Name *</div>
              <input className="form-control" value={form.drug_name || ""} onChange={(e) => f("drug_name", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Bottle Number *</div>
              <input className="form-control" value={form.bottle_number || ""} onChange={(e) => f("bottle_number", e.target.value)}
                placeholder="e.g. FP-003, K-001" />
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Staff-assigned identifier for this physical bottle</div>
            </label>
            <label>
              <div className="form-label">DEA Schedule</div>
              <select className="form-control" value={form.dea_schedule || ""} onChange={(e) => f("dea_schedule", e.target.value)}>
                {["Schedule II","Schedule III","Schedule IV","Schedule V"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <div className="form-label">NDC Number</div>
              <input className="form-control" value={form.ndc_number || ""} onChange={(e) => f("ndc_number", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Manufacturer</div>
              <input className="form-control" value={form.manufacturer || ""} onChange={(e) => f("manufacturer", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Lot Number</div>
              <input className="form-control" value={form.lot_number || ""} onChange={(e) => f("lot_number", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Concentration</div>
              <input className="form-control" value={form.concentration || ""} onChange={(e) => f("concentration", e.target.value)} placeholder="e.g. 390 mg/mL" />
            </label>
            <label>
              <div className="form-label">Bottle Size (mL)</div>
              <input className="form-control" type="number" step="0.1" value={form.bottle_size_ml ?? ""} onChange={(e) => f("bottle_size_ml", parseFloat(e.target.value) || undefined)} />
            </label>
            <label>
              <div className="form-label">Quantity Remaining (mL)</div>
              <input className="form-control" type="number" step="0.1" value={form.quantity_remaining_ml ?? ""} onChange={(e) => f("quantity_remaining_ml", parseFloat(e.target.value) || undefined)} />
            </label>
            <label>
              <div className="form-label">Date Received</div>
              <DateInput className="form-control" value={form.date_received || ""} onChange={(e) => f("date_received", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Expiration Date</div>
              <DateInput className="form-control" value={form.expiration_date || ""} onChange={(e) => f("expiration_date", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Received From</div>
              <input className="form-control" value={form.received_from || ""} onChange={(e) => f("received_from", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Distributor DEA #</div>
              <input className="form-control" value={form.distributor_dea_number || ""} onChange={(e) => f("distributor_dea_number", e.target.value)} />
            </label>
            <label>
              <div className="form-label">DEA Form 222 #</div>
              <input className="form-control" value={form.dea_form_222_number || ""} onChange={(e) => f("dea_form_222_number", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Received By</div>
              <input className="form-control" value={form.received_by || ""} onChange={(e) => f("received_by", e.target.value)} />
            </label>
            <label>
              <div className="form-label">Witness Name</div>
              <input className="form-control" value={form.witness_name || ""} onChange={(e) => f("witness_name", e.target.value)} />
            </label>
            <label style={{ gridColumn: "1/-1" }}>
              <div className="form-label">Notes</div>
              <textarea className="form-control" rows={2} value={form.notes || ""} onChange={(e) => f("notes", e.target.value)} />
            </label>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Receiver Signature *</div>
              <SimpleSigPad label="Receiver Signature" value={receiverSig} onChange={setReceiverSig} />
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 6 }}>Witness Signature *</div>
              <SimpleSigPad label="Witness Signature" value={witnessSig} onChange={setWitnessSig} />
            </div>
          </div>

          {err && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", color: "#dc2626", marginTop: 14, fontSize: 13 }}>{err}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save Bottle Record"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reconciliation modal ───────────────────────────────────────────────────────

interface ReconcileModalProps {
  inventory: DrugInventory[];
  logs: EuthanasiaLog[];
  onClose: () => void;
  onSave: () => Promise<void>;
}

function ReconcileModal({ inventory, logs, onClose, onSave }: ReconcileModalProps) {
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [month, setMonth] = useState(lastMonth);
  const [year, setYear] = useState(lastMonthYear);
  const [performedBy, setPerformedBy] = useState("");
  const [performerSig, setPerformerSig] = useState("");
  const [witnessedBy, setWitnessedBy] = useState("");
  const [witnessSig, setWitnessSig] = useState("");
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchStaffOptions().then(setStaffOptions).catch(() => {});
  }, []);

  const periodStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const periodEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const activeBottles = inventory.filter((b) => b.bottle_status === "Active");

  function getUsedInPeriod(bottleId: string): number {
    return logs
      .filter((l) => l.drug_inventory_id === bottleId && l.log_date && l.log_date >= periodStart && l.log_date <= periodEnd)
      .reduce((sum, l) => sum + (l.dosage_administered_ml || 0), 0);
  }

  function getStartingQty(bottle: DrugInventory): number {
    const usedAfterPeriod = logs
      .filter((l) => l.drug_inventory_id === bottle.id && l.log_date && l.log_date > periodEnd)
      .reduce((sum, l) => sum + (l.dosage_administered_ml || 0), 0);
    return (bottle.quantity_remaining_ml || 0) + usedAfterPeriod;
  }

  async function handleSave() {
    if (!performedBy) { setErr("Performed by is required."); return; }
    if (!performerSig) { setErr("Performer signature is required."); return; }
    if (!witnessedBy) { setErr("Witness is required."); return; }
    if (!witnessSig) { setErr("Witness signature is required."); return; }
    if (performedBy === witnessedBy) { setErr("Witness must be a different person than the performer."); return; }
    setSaving(true);
    try {
      for (const bottle of activeBottles) {
        const startQty = getStartingQty(bottle);
        const totalUsed = getUsedInPeriod(bottle.id);
        const expectedRemaining = startQty - totalUsed;
        const actualRemaining = parseFloat(actuals[bottle.id] || String(expectedRemaining));
        const discrepancy = Math.abs(actualRemaining - expectedRemaining);
        await createDrugReconciliation({
          reconciliation_date: new Date().toISOString().split("T")[0],
          period_start: periodStart,
          period_end: periodEnd,
          drug_inventory_id: bottle.id,
          drug_name: bottle.drug_name,
          lot_number: bottle.lot_number,
          starting_quantity_ml: startQty,
          total_used_ml: totalUsed,
          expected_remaining_ml: expectedRemaining,
          actual_remaining_ml: actualRemaining,
          discrepancy_ml: discrepancy,
          discrepancy_flag: discrepancy > 0.5,
          performed_by: performedBy,
          performer_signature: performerSig,
          witnessed_by: witnessedBy,
          witness_signature: witnessSig,
        });
      }
      await onSave();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--card-bg,#fff)", borderRadius: 12, width: "100%", maxWidth: 800, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border,#e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>New Monthly Reconciliation</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <label>
              <div className="form-label">Month</div>
              <select className="form-control" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </label>
            <label>
              <div className="form-label">Year</div>
              <select className="form-control" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Period: {periodStart} to {periodEnd}
          </div>

          {activeBottles.length === 0 && (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No active bottles to reconcile.</div>
          )}

          {activeBottles.map((bottle) => {
            const startQty = getStartingQty(bottle);
            const totalUsed = getUsedInPeriod(bottle.id);
            const expectedRemaining = startQty - totalUsed;
            const actualRaw = actuals[bottle.id];
            const actual = actualRaw !== undefined ? parseFloat(actualRaw) : expectedRemaining;
            const discrepancy = isNaN(actual) ? 0 : Math.abs(actual - expectedRemaining);
            const flagged = discrepancy > 0.5;

            return (
              <div key={bottle.id} style={{ border: `1px solid ${flagged ? "#fca5a5" : "var(--border,#e2e8f0)"}`, borderRadius: 8, padding: 14, marginBottom: 12, background: flagged ? "#fef2f2" : "var(--bg-subtle,#f8fafc)" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  {bottle.drug_name} — Lot #{bottle.lot_number || "N/A"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Starting Qty (mL)</div>
                    <div style={{ fontWeight: 600 }}>{startQty.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Total Used (mL)</div>
                    <div style={{ fontWeight: 600 }}>{totalUsed.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Expected Remaining (mL)</div>
                    <div style={{ fontWeight: 600 }}>{expectedRemaining.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Actual Remaining (mL) *</div>
                    <input
                      className="form-control"
                      type="number"
                      step="0.01"
                      value={actualRaw ?? String(expectedRemaining.toFixed(2))}
                      onChange={(e) => setActuals((p) => ({ ...p, [bottle.id]: e.target.value }))}
                      style={{ padding: "4px 8px", height: 32 }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>Discrepancy (mL)</div>
                    <div style={{ fontWeight: 700, color: flagged ? "#dc2626" : "#16a34a" }}>
                      {discrepancy.toFixed(2)}
                      {flagged && <span style={{ marginLeft: 6, fontSize: 10, background: "#dc2626", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>REQUIRES INVESTIGATION</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label>
                <div className="form-label">Performed By *</div>
                <select className="form-control" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)}>
                  <option value="">— Select Staff —</option>
                  {staffOptions.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <div style={{ marginTop: 12 }}>
                <SimpleSigPad label="Performer Signature" value={performerSig} onChange={setPerformerSig} />
              </div>
            </div>
            <div>
              <label>
                <div className="form-label">Witnessed By *</div>
                <select className="form-control" value={witnessedBy} onChange={(e) => setWitnessedBy(e.target.value)}>
                  <option value="">— Select Staff —</option>
                  {staffOptions.filter((s) => s !== performedBy).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <div style={{ marginTop: 12 }}>
                <SimpleSigPad label="Witness Signature" value={witnessSig} onChange={setWitnessSig} />
              </div>
            </div>
          </div>

          {err && <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: "10px 14px", color: "#dc2626", marginTop: 14, fontSize: 13 }}>{err}</div>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Reconciliation"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function BottleStatusBadge({ status }: { status?: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    Active: { bg: "#dcfce7", color: "#15803d" },
    Empty: { bg: "#f3f4f6", color: "#6b7280" },
    Expired: { bg: "#fef2f2", color: "#dc2626" },
    Disposed: { bg: "#f3f4f6", color: "#6b7280" },
  };
  const style = colors[status || ""] || { bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ ...style, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
      {status || "Unknown"}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DrugLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"overview"|"log"|"inventory"|"reconciliation"|"reports">("overview");
  const [inventory, setInventory] = useState<DrugInventory[]>([]);
  const [logs, setLogs] = useState<EuthanasiaLog[]>([]);
  const [reconciliations, setReconciliations] = useState<DrugReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBottleModal, setShowBottleModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("All");

  const canAccess = user?.permissions?.includes("all") || user?.permissions?.includes("admin");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, lg, rec] = await Promise.all([
        fetchDrugInventory(),
        fetchEuthanasiaLog(),
        fetchDrugReconciliations(),
      ]);
      setInventory(inv);
      setLogs(lg);
      setReconciliations(rec);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function applyFilters() {
    setLoading(true);
    try {
      const filtered = await fetchEuthanasiaLog({
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
        species: filterSpecies !== "All" ? filterSpecies : undefined,
      });
      setLogs(filtered);
    } finally {
      setLoading(false);
    }
  }

  if (!canAccess) {
    return (
      <AppShell title="Drug Log — Controlled Substances">
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Access Denied</div>
          <div style={{ color: "var(--text-muted)" }}>You do not have permission to view controlled substance records.</div>
        </div>
      </AppShell>
    );
  }

  // ── Computed alert data ─────────────────────────────────────────────────────
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().split("T")[0];

  const expiring = inventory.filter((b) => b.bottle_status === "Active" && b.expiration_date && b.expiration_date <= in30Str && b.expiration_date >= todayStr);
  const lowInventory = inventory.filter((b) => b.bottle_status === "Active" && (b.quantity_remaining_ml || 0) < 20);

  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
  const reconcileNeeded = today.getDate() >= 5 && !reconciliations.some((r) => r.period_start === lastMonthStart || (r.period_start && r.period_start >= lastMonthStart && r.period_start <= lastMonthEnd));

  const missingSigs = logs.filter((l) => !l.administered_by_signature || !l.witness_signature);

  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const thisMonthLogs = logs.filter((l) => l.log_date && l.log_date >= thisMonthStart);
  const activeBottles = inventory.filter((b) => b.bottle_status === "Active");
  const recentFive = [...logs].slice(0, 5);

  // ── Reports ─────────────────────────────────────────────────────────────────

  function reportUsage() {
    const rows = logs.map((l) => `
      <tr>
        <td>${l.log_number}</td><td>${l.log_date || ""}</td><td>${l.animal_name || ""}</td>
        <td>${l.species || ""}</td><td>${l.drug_name || ""}</td>
        <td>${l.dosage_administered_ml ?? ""}</td><td>${l.administered_by_name || ""}</td>
        <td>${l.witness_name || ""}</td>
      </tr>`).join("");
    printReport("Usage Report — Euthanasia Log", `
      <table>
        <thead><tr><th>Log #</th><th>Date</th><th>Animal</th><th>Species</th><th>Drug</th><th>Admin (mL)</th><th>By</th><th>Witness</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  function reportInventory() {
    const rows = inventory.map((b) => `
      <tr>
        <td>${b.drug_name}</td><td>${b.ndc_number || ""}</td><td>${b.lot_number || ""}</td>
        <td>${b.date_received || ""}</td><td>${b.bottle_size_ml ?? ""}</td>
        <td>${b.quantity_remaining_ml ?? ""}</td><td>${b.expiration_date || ""}</td><td>${b.bottle_status || ""}</td>
      </tr>`).join("");
    printReport("Drug Inventory Report", `
      <table>
        <thead><tr><th>Drug Name</th><th>NDC</th><th>Lot #</th><th>Received</th><th>Size (mL)</th><th>Remaining (mL)</th><th>Expires</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  function reportMonthlySummary() {
    const speciesCounts: Record<string, number> = {};
    const totalAdministered = thisMonthLogs.reduce((s, l) => s + (l.dosage_administered_ml || 0), 0);
    thisMonthLogs.forEach((l) => { if (l.species) speciesCounts[l.species] = (speciesCounts[l.species] || 0) + 1; });
    const speciesRows = Object.entries(speciesCounts).map(([sp, cnt]) => `<tr><td>${sp}</td><td>${cnt}</td></tr>`).join("");
    printReport(`Monthly Summary — ${today.toLocaleString("default", { month: "long", year: "numeric" })}`, `
      <table>
        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Total Entries This Month</td><td>${thisMonthLogs.length}</td></tr>
          <tr><td>Total mL Administered</td><td>${totalAdministered.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <h2>By Species</h2>
      <table>
        <thead><tr><th>Species</th><th>Count</th></tr></thead>
        <tbody>${speciesRows}</tbody>
      </table>`);
  }

  function reportDEA() {
    const rows = inventory.map((b) => `
      <tr>
        <td>${b.drug_name}</td><td>${b.dea_schedule || ""}</td><td>${b.ndc_number || ""}</td>
        <td>${b.lot_number || ""}</td><td>${b.bottle_size_ml ?? ""}</td>
        <td>${b.quantity_remaining_ml ?? ""}</td><td>${b.expiration_date || ""}</td>
        <td>${b.distributor_dea_number || ""}</td><td>${b.dea_form_222_number || ""}</td>
      </tr>`).join("");
    printReport("DEA Biennial Inventory", `
      <p style="font-style:italic;margin-bottom:12px;">Prepared for DEA biennial inventory inspection. All Schedule II substances listed.</p>
      <table>
        <thead><tr><th>Drug Name</th><th>Schedule</th><th>NDC</th><th>Lot #</th><th>Size (mL)</th><th>Qty Remaining</th><th>Expires</th><th>Distributor DEA #</th><th>Form 222 #</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  // ── TAB RENDER ───────────────────────────────────────────────────────────────

  return (
    <AppShell title="Drug Log — Controlled Substances">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid var(--border,#e2e8f0)", paddingBottom: 0 }}>
        {(["overview","log","inventory","reconciliation","reports"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 18px", fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "#0f2942" : "var(--text-muted)",
              borderBottom: tab === t ? "3px solid #0f2942" : "3px solid transparent",
              fontSize: 14, marginBottom: -2, textTransform: "capitalize",
            }}
          >
            {t === "log" ? "Euthanasia Log" : t === "reconciliation" ? "Reconciliation" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>}

      {/* OVERVIEW */}
      {!loading && tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Active Bottles", value: activeBottles.length, color: "#16a34a" },
              { label: "Total Log Entries", value: logs.length, color: "#0f2942" },
              { label: "This Month", value: thisMonthLogs.length, color: "#1a8a8a" },
              { label: "Alerts", value: expiring.length + lowInventory.length + (reconcileNeeded ? 1 : 0) + (missingSigs.length > 0 ? 1 : 0), color: "#dc2626" },
            ].map((c) => (
              <div key={c.label} style={{ background: "var(--card-bg,#fff)", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", borderLeft: `4px solid ${c.color}` }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {(expiring.length > 0 || lowInventory.length > 0 || reconcileNeeded || missingSigs.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Alerts</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {expiring.map((b) => (
                  <div key={b.id} style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>
                      <strong>{b.drug_name}</strong> (Lot #{b.lot_number}) expires {b.expiration_date} — within 30 days.
                    </div>
                  </div>
                ))}
                {lowInventory.map((b) => (
                  <div key={b.id} style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>
                      <strong>{b.drug_name}</strong> (Lot #{b.lot_number}) has only {b.quantity_remaining_ml} mL remaining (low inventory).
                    </div>
                  </div>
                ))}
                {reconcileNeeded && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>Monthly reconciliation for {lastMonthDate.toLocaleString("default", { month: "long", year: "numeric" })} has not been completed.</div>
                  </div>
                )}
                {missingSigs.length > 0 && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <div>{missingSigs.length} log {missingSigs.length === 1 ? "entry" : "entries"} missing required signatures.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Recent Entries</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#0f2942", color: "#fff" }}>
                    {["Log #","Date","Animal","Species","Drug","By","Witness"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentFive.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border,#e2e8f0)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>{l.log_number}</td>
                      <td style={{ padding: "8px 12px" }}>{l.log_date}</td>
                      <td style={{ padding: "8px 12px" }}>{l.animal_name}</td>
                      <td style={{ padding: "8px 12px" }}>{l.species}</td>
                      <td style={{ padding: "8px 12px" }}>{l.drug_name}</td>
                      <td style={{ padding: "8px 12px" }}>{l.administered_by_name}</td>
                      <td style={{ padding: "8px 12px" }}>{l.witness_name}</td>
                    </tr>
                  ))}
                  {recentFive.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No entries yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EUTHANASIA LOG */}
      {!loading && tab === "log" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ flex: "0 0 auto" }}>
              <div className="form-label">Date From</div>
              <DateInput className="form-control" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ width: 150 }} />
            </label>
            <label style={{ flex: "0 0 auto" }}>
              <div className="form-label">Date To</div>
              <DateInput className="form-control" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ width: 150 }} />
            </label>
            <label style={{ flex: "0 0 auto" }}>
              <div className="form-label">Species</div>
              <select className="form-control" value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)}>
                {["All","Dog","Cat","Rabbit","Bird","Other"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <button className="btn btn-secondary" onClick={applyFilters} style={{ alignSelf: "flex-end" }}>Generate</button>
            <button className="btn btn-primary" style={{ marginLeft: "auto", alignSelf: "flex-end" }} onClick={() => router.push("/drug-log/new")}>
              + New Entry
            </button>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 6, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            ⚠ Controlled substance records are immutable. To correct an entry, create a new entry with &ldquo;Is Correction&rdquo; checked.
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0f2942", color: "#fff" }}>
                  {["Log #","Date","Time","Animal","Species","Wt","Drug","Bottle #","Drawn","Admin","Wasted","Balance","Pre-Sed","By","Witness","Print"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border,#e2e8f0)", background: l.is_correction ? "#fef9c3" : undefined }}>
                    <td style={{ padding: "7px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{l.log_number}</td>
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{l.log_date}</td>
                    <td style={{ padding: "7px 10px" }}>{l.log_time}</td>
                    <td style={{ padding: "7px 10px" }}>{l.animal_name}</td>
                    <td style={{ padding: "7px 10px" }}>{l.species}</td>
                    <td style={{ padding: "7px 10px" }}>{l.weight}</td>
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{l.drug_name}</td>
                    <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0369a1" }}>{l.bottle_id || "—"}</td>
                    <td style={{ padding: "7px 10px" }}>{l.dosage_drawn_ml}</td>
                    <td style={{ padding: "7px 10px" }}>{l.dosage_administered_ml}</td>
                    <td style={{ padding: "7px 10px" }}>{l.dosage_wasted_ml}</td>
                    <td style={{ padding: "7px 10px" }}>{l.running_balance_ml}</td>
                    <td style={{ padding: "7px 10px", fontSize: 11 }}>
                      {l.pre_sedation_drug
                        ? <span title={`${l.pre_sedation_drug} — Bottle ${l.pre_sedation_bottle_id || "?"} — ${l.pre_sedation_dosage_administered_ml ?? "?"} mL`} style={{ cursor: "help", borderBottom: "1px dashed var(--text-muted)" }}>
                            {l.pre_sedation_drug.split(" ")[0]}
                          </span>
                        : "—"}
                    </td>
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{l.administered_by_name}</td>
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{l.witness_name}</td>
                    <td style={{ padding: "7px 10px" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => printLogEntry(l)} title="Print entry">🖨️</button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={14} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No entries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-subtle,#f8fafc)", borderRadius: 6, fontSize: 13, color: "var(--text-secondary)" }}>
            This period: <strong>{logs.length}</strong> entries ·{" "}
            <strong>{logs.reduce((s, l) => s + (l.dosage_administered_ml || 0), 0).toFixed(2)}</strong> mL total administered ·{" "}
            <strong>{[...new Set(logs.map((l) => l.species).filter(Boolean))].join(", ") || "—"}</strong> species
          </div>
        </div>
      )}

      {/* INVENTORY */}
      {!loading && tab === "inventory" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowBottleModal(true)}>+ Receive New Bottle</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f2942", color: "#fff" }}>
                  {["Drug Name","Bottle #","NDC","Lot #","Received","Size (mL)","Remaining (mL)","Expires","Status",""].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((b) => {
                  const isExpiring = b.expiration_date && b.expiration_date <= in30Str && b.expiration_date >= todayStr && b.bottle_status === "Active";
                  return (
                    <tr key={b.id} style={{ borderBottom: "1px solid var(--border,#e2e8f0)", background: isExpiring ? "#fffbeb" : undefined }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{b.drug_name}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0369a1" }}>{b.bottle_number || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>{b.ndc_number}</td>
                      <td style={{ padding: "8px 12px" }}>{b.lot_number}</td>
                      <td style={{ padding: "8px 12px" }}>{b.date_received}</td>
                      <td style={{ padding: "8px 12px" }}>{b.bottle_size_ml}</td>
                      <td style={{ padding: "8px 12px" }}>{b.quantity_remaining_ml}</td>
                      <td style={{ padding: "8px 12px" }}>{b.expiration_date}</td>
                      <td style={{ padding: "8px 12px" }}><BottleStatusBadge status={b.bottle_status} /></td>
                      <td style={{ padding: "8px 12px" }}>
                        {b.bottle_status === "Active" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={async () => {
                              await updateDrugInventory(b.id, { bottle_status: "Empty" });
                              loadAll();
                            }}
                          >
                            Mark Empty
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {inventory.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No bottles recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECONCILIATION */}
      {!loading && tab === "reconciliation" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowReconcileModal(true)}>+ New Reconciliation</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#0f2942", color: "#fff" }}>
                  {["Period","Drug","Lot #","Expected (mL)","Actual (mL)","Discrepancy (mL)","Status","By","Witness"].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border,#e2e8f0)" }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{r.period_start} – {r.period_end}</td>
                    <td style={{ padding: "8px 12px" }}>{r.drug_name}</td>
                    <td style={{ padding: "8px 12px" }}>{r.lot_number}</td>
                    <td style={{ padding: "8px 12px" }}>{r.expected_remaining_ml}</td>
                    <td style={{ padding: "8px 12px" }}>{r.actual_remaining_ml}</td>
                    <td style={{ padding: "8px 12px", color: r.discrepancy_flag ? "#dc2626" : "#16a34a", fontWeight: 700 }}>
                      {r.discrepancy_ml}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {r.discrepancy_flag
                        ? <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Discrepancy</span>
                        : <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>OK</span>
                      }
                    </td>
                    <td style={{ padding: "8px 12px" }}>{r.performed_by}</td>
                    <td style={{ padding: "8px 12px" }}>{r.witnessed_by}</td>
                  </tr>
                ))}
                {reconciliations.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>No reconciliations on record.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORTS */}
      {!loading && tab === "reports" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {[
              { label: "Usage Report", desc: "Print table of all log entries with dosages and staff", action: reportUsage },
              { label: "Inventory Report", desc: "Print current inventory status for all bottles", action: reportInventory },
              { label: "Monthly Summary", desc: "Print monthly stats: totals by species and drug", action: reportMonthlySummary },
              { label: "DEA Biennial Inventory", desc: "Print DEA-formatted schedule II substance inventory", action: reportDEA },
            ].map((r) => (
              <div key={r.label} style={{ background: "var(--card-bg,#fff)", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", cursor: "pointer", border: "1px solid var(--border,#e2e8f0)" }}
                onClick={r.action}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{r.label}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{r.desc}</div>
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); r.action(); }}>🖨️ Print</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBottleModal && (
        <BottleModal
          onClose={() => setShowBottleModal(false)}
          onSave={async (entry) => {
            await createDrugInventory(entry);
            await loadAll();
          }}
        />
      )}

      {showReconcileModal && (
        <ReconcileModal
          inventory={inventory}
          logs={logs}
          onClose={() => setShowReconcileModal(false)}
          onSave={async () => { await loadAll(); }}
        />
      )}
    </AppShell>
  );
}
