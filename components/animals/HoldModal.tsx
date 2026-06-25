"use client";
import { useState } from "react";
import DateInput from "@/components/ui/DateInput";
import { getCurrentUser } from "@/lib/auth";
import { today } from "@/lib/utils";

const HOLD_TYPES = ["Adoption Hold", "Stray Hold", "Legal Hold", "Medical Hold", "Rescue Hold", "Owner Hold", "Behavioral Hold", "Other"];

export interface HoldData {
  hold_type: string;
  hold_start_date: string;
  hold_end_date: string;
  hold_reason: string;
  hold_placed_by: string;
  hold_adopter_info?: { first_name: string; last_name: string; phone: string; email: string; address: string; city: string; state: string; zip: string; notes: string; application_on_file: boolean; application_date: string };
  hold_rescue_info?: { rescue_name: string; contact_person: string; contact_phone: string; expected_pickup: string };
  hold_legal_info?: { case_number: string; issuing_authority: string; court_date: string };
}

interface Props {
  animalName: string;
  onSave: (data: HoldData) => void;
  onClose: () => void;
}

function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <div className="form-group"><label className="form-label">{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</label>{children}</div>;
}

export default function HoldModal({ animalName, onSave, onClose }: Props) {
  const cu = getCurrentUser();
  const staffName = cu ? `${cu.firstName || cu.first_name || ""} ${cu.lastName || cu.last_name || ""}`.trim() : "";

  const [holdType, setHoldType] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [placedBy, setPlacedBy] = useState(staffName);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [adFn, setAdFn] = useState(""); const [adLn, setAdLn] = useState(""); const [adPh, setAdPh] = useState(""); const [adEm, setAdEm] = useState("");
  const [adAddr, setAdAddr] = useState(""); const [adCity, setAdCity] = useState(""); const [adSt, setAdSt] = useState("GA"); const [adZip, setAdZip] = useState("");
  const [adNotes, setAdNotes] = useState(""); const [adApp, setAdApp] = useState(false); const [adAppDate, setAdAppDate] = useState("");

  const [resName, setResName] = useState(""); const [resCon, setResCon] = useState(""); const [resPh, setResPh] = useState(""); const [resPickup, setResPickup] = useState("");

  const [legCase, setLegCase] = useState(""); const [legAuth, setLegAuth] = useState(""); const [legCourt, setLegCourt] = useState("");

  const isAdoption = holdType === "Adoption Hold";
  const isRescue = holdType === "Rescue Hold";
  const isLegal = holdType === "Legal Hold";

  const validate = (): string[] => {
    const e: string[] = [];
    if (!holdType) e.push("Hold type is required");
    if (!startDate) e.push("Start date is required");
    if (!reason.trim() || reason.trim().length < 20) e.push("Reason must be at least 20 characters");
    if (!placedBy.trim()) e.push("Placed by is required");
    if (isAdoption && (!adFn.trim() || !adLn.trim() || !adPh.trim())) e.push("Adopter first name, last name, and phone are required");
    return e;
  };

  const handleSave = () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setSaving(true);
    const data: HoldData = {
      hold_type: holdType, hold_start_date: startDate, hold_end_date: endDate,
      hold_reason: reason.trim(), hold_placed_by: placedBy.trim(),
    };
    if (isAdoption) data.hold_adopter_info = { first_name: adFn, last_name: adLn, phone: adPh, email: adEm, address: adAddr, city: adCity, state: adSt, zip: adZip, notes: adNotes, application_on_file: adApp, application_date: adAppDate };
    if (isRescue) data.hold_rescue_info = { rescue_name: resName, contact_person: resCon, contact_phone: resPh, expected_pickup: resPickup };
    if (isLegal) data.hold_legal_info = { case_number: legCase, issuing_authority: legAuth, court_date: legCourt };
    onSave(data);
  };

  const handleClose = () => {
    if (reason.trim().length > 0 || holdType) {
      if (!confirm("Are you sure? The status will not be changed if you cancel.")) return;
    }
    onClose();
  };

  const holdColor = { "Adoption Hold": "#0d9488", "Stray Hold": "#2563eb", "Legal Hold": "#dc2626", "Medical Hold": "#f59e0b", "Rescue Hold": "#7c3aed", "Owner Hold": "#ca8a04", "Behavioral Hold": "#6366f1" }[holdType] || "#475569";

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 680, maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ background: holdColor, color: "#fff" }}>
          <span className="modal-title" style={{ color: "#fff" }}>🔒 Place Hold — {animalName}</span>
          <button className="btn btn-ghost btn-sm" style={{ color: "#fff" }} onClick={handleClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <F label="Hold Type" required>
              <select className="form-select" value={holdType} onChange={(e) => setHoldType(e.target.value)}>
                <option value="">— Select —</option>
                {HOLD_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </F>
            <F label="Placed By" required><input className="form-input" value={placedBy} onChange={(e) => setPlacedBy(e.target.value)} /></F>
            <F label="Hold Start Date" required><DateInput className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></F>
            <F label="Hold End Date">
              <DateInput className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {!endDate && <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>⚠ No end date — consider setting one</div>}
            </F>
          </div>
          <F label="Reason / Notes" required>
            <textarea className="form-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the reason for the hold and any relevant details." />
            <div style={{ fontSize: 11, color: reason.trim().length >= 20 ? "#15803d" : "var(--text-muted)", marginTop: 2 }}>{reason.trim().length} / 20 min</div>
          </F>

          {/* Adoption Hold — adopter info */}
          {isAdoption && (
            <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: 14, marginTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0d9488", marginBottom: 10 }}>🤝 Interested Adopter</div>
              <div className="grid-2">
                <F label="First Name" required><input className="form-input" value={adFn} onChange={(e) => setAdFn(e.target.value)} /></F>
                <F label="Last Name" required><input className="form-input" value={adLn} onChange={(e) => setAdLn(e.target.value)} /></F>
                <F label="Phone" required><input className="form-input" type="tel" value={adPh} onChange={(e) => setAdPh(e.target.value)} /></F>
                <F label="Email"><input className="form-input" type="email" value={adEm} onChange={(e) => setAdEm(e.target.value)} /></F>
                <F label="Address"><input className="form-input" value={adAddr} onChange={(e) => setAdAddr(e.target.value)} /></F>
                <F label="City"><input className="form-input" value={adCity} onChange={(e) => setAdCity(e.target.value)} /></F>
                <F label="State"><input className="form-input" value={adSt} onChange={(e) => setAdSt(e.target.value)} style={{ maxWidth: 70 }} /></F>
                <F label="Zip"><input className="form-input" value={adZip} onChange={(e) => setAdZip(e.target.value)} style={{ maxWidth: 100 }} /></F>
              </div>
              <F label="Notes"><textarea className="form-textarea" rows={2} value={adNotes} onChange={(e) => setAdNotes(e.target.value)} placeholder="e.g. Has existing dog, wants to meet first" /></F>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginTop: 4 }}>
                <input type="checkbox" checked={adApp} onChange={(e) => setAdApp(e.target.checked)} /> Application on file?
              </label>
              {adApp && <div style={{ marginTop: 6 }}><F label="Application Date"><DateInput className="form-input" value={adAppDate} onChange={(e) => setAdAppDate(e.target.value)} /></F></div>}
            </div>
          )}

          {/* Rescue Hold */}
          {isRescue && (
            <div style={{ background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: 14, marginTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#7c3aed", marginBottom: 10 }}>🚐 Rescue Group</div>
              <div className="grid-2">
                <F label="Rescue Group Name"><input className="form-input" value={resName} onChange={(e) => setResName(e.target.value)} /></F>
                <F label="Contact Person"><input className="form-input" value={resCon} onChange={(e) => setResCon(e.target.value)} /></F>
                <F label="Contact Phone"><input className="form-input" type="tel" value={resPh} onChange={(e) => setResPh(e.target.value)} /></F>
                <F label="Expected Pickup"><DateInput className="form-input" value={resPickup} onChange={(e) => setResPickup(e.target.value)} /></F>
              </div>
            </div>
          )}

          {/* Legal Hold */}
          {isLegal && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 14, marginTop: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 10 }}>⚖️ Legal Hold</div>
              <div className="grid-2">
                <F label="Case Number"><input className="form-input" value={legCase} onChange={(e) => setLegCase(e.target.value)} /></F>
                <F label="Issuing Authority"><input className="form-input" value={legAuth} onChange={(e) => setLegAuth(e.target.value)} /></F>
                <F label="Court Date"><DateInput className="form-input" value={legCourt} onChange={(e) => setLegCourt(e.target.value)} /></F>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
              {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: "#dc2626", marginBottom: 2 }}>• {e}</div>)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: holdColor, borderColor: holdColor }}>
            {saving ? "Saving…" : "🔒 Save Hold"}
          </button>
        </div>
      </div>
    </div>
  );
}
