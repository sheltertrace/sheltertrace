"use client";
import { useState, useEffect } from "react";
import { createForm, fetchOfficers } from "@/lib/data";
import { today, nowTime } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import { MCAS_SEAL_LOGO } from "@/lib/mcasLogo";
import type { ShelterForm, Officer, FormPreFill } from "@/lib/types";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";

const CHECKS = [
  { id: "complaint",   label: "We have received a complaint about your animal." },
  { id: "impounded",   label: "Your animal(s) are impounded." },
  { id: "abandoned",   label: "We have had a complaint that your animal(s) have been abandoned. You must contact our office by _____ or they may be subject to impoundment." },
  { id: "control",     label: "Domestic animals must be under control at all times." },
  { id: "rabies",      label: "Animals must have current rabies inoculations and wear a rabies tag at all times. Animals without tags are subject to impoundment." },
  { id: "service_done",   label: "We were here to answer your call for service, and have taken care of the problem." },
  { id: "service_away",   label: "We were here to answer your call for service, but no one was home." },
  { id: "service_clear",  label: "We were here to answer your call for service, and no violation was seen." },
  { id: "contact",     label: "Please contact our office ASAP." },
] as const;

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printDoorKnocker(data: Record<string, unknown>, logo: string) {
  const w = window.open("", "_blank", "width=700,height=900");
  if (!w) return;
  const checks = (data.checkboxes || {}) as Record<string, boolean>;
  const checkRow = (id: string, label: string) =>
    `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px;">
      <div style="width:14px;height:14px;border:1.5px solid #000;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:11px;">${checks[id] ? "✓" : ""}</div>
      <div style="font-size:11px;line-height:1.4">${label}</div>
    </div>`;
  w.document.write(`<html><head><title>Door Knocker</title>
  <style>body{font-family:Arial,sans-serif;font-size:11px;padding:24px;margin:0}
  .line{border-bottom:1px solid #000;display:inline-block;min-width:120px;}
  @media print{body{padding:14px}}</style></head><body>
  <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:14px">
    <img src="${logo}" style="width:70px;height:70px;object-fit:contain;flex-shrink:0" />
    <div>
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.5px">Morgan County Animal Services</div>
      <div style="font-size:11px;margin-top:2px">2392 Athens Hwy Madison, GA 30650 &nbsp;|&nbsp; 706.752.1195</div>
      <div style="font-size:14px;font-weight:800;margin-top:6px;letter-spacing:.3px">DOOR KNOCKER NOTICE</div>
    </div>
  </div>
  <div style="display:flex;gap:24px;margin-bottom:14px;font-size:11px">
    <span><b>To:</b> <span class="line" style="min-width:200px">&nbsp;${data.to || ""}&nbsp;</span></span>
    <span><b>On:</b> <span class="line">&nbsp;${data.date || ""}&nbsp;</span></span>
    <span><b>At:</b> <span class="line">&nbsp;${data.time || ""}&nbsp;</span> ${data.am_pm || ""}</span>
  </div>
  ${CHECKS.map((c) => checkRow(c.id, c.label)).join("")}
  <div style="margin-top:14px">
    <b>Remarks:</b><br/>
    <div style="border:1px solid #aaa;min-height:50px;padding:6px;margin-top:4px;font-size:11px">${data.remarks || ""}</div>
  </div>
  <div style="display:flex;gap:40px;margin-top:16px;font-size:11px">
    <span><b>Officer:</b> <span class="line" style="min-width:160px">&nbsp;${data.officer || ""}&nbsp;</span></span>
    <span><b>AC:</b> <span class="line" style="min-width:80px">&nbsp;${data.badge || ""}&nbsp;</span></span>
  </div>
  </body></html>`);
  w.document.close();
  w.print();
}

export default function DoorKnockerForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [to, setTo] = useState(prefill ? [prefill.person_first, prefill.person_last].filter(Boolean).join(" ") : "");
  const [date, setDate] = useState(prefill?.call_date || today());
  const [time, setTime] = useState(nowTime());
  const [amPm, setAmPm] = useState("AM");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState("");
  const [officer, setOfficer] = useState(prefill?.call_officer || (user ? `${user.firstName} ${user.lastName}`.trim() : ""));
  const [badge, setBadge] = useState(user?.badge || "");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [saving, setSaving] = useState(false);
  const [linkIds, setLinkIds] = useState<LinkIds>({
    call_id: prefill?.call_id,
    animal_id: prefill?.animal_id,
    person_id: prefill?.person_id,
  });

  useEffect(() => { fetchOfficers().then(setOfficers); }, []);

  const toggleCheck = (id: string) => setChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleOfficerSelect = (name: string) => {
    setOfficer(name);
    const off = officers.find((o) => o.name === name);
    if (off?.badge) setBadge(off.badge);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = { to, date, time, am_pm: amPm, checkboxes: checks, remarks, officer, badge };
      const saved = await createForm({
        form_type: "door_knocker",
        form_data: formData as unknown as Record<string, unknown>,
        linked_call_id: linkIds.call_id,
        linked_animal_id: linkIds.animal_id,
        linked_person_id: linkIds.person_id,
        officer,
        created_by: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      });
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as { message?: string }).message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Door Knocker Notice</div>
            {linkIds.call_id && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Linked to call</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="grid-3" style={{ gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0, gridColumn: "1 / -1" }}>
              <label className="form-label">To (Resident Name)</label>
              <input className="form-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Resident name" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Time</label>
              <input className="form-input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="HH:MM" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">AM / PM</label>
              <select className="form-select" value={amPm} onChange={(e) => setAmPm(e.target.value)}>
                <option>AM</option><option>PM</option>
              </select>
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 8 }}>Notice Reason (check all that apply)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {CHECKS.map((c) => (
              <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={!!checks[c.id]} onChange={() => toggleCheck(c.id)} style={{ marginTop: 3, flexShrink: 0, width: 15, height: 15 }} />
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{c.label}</span>
              </label>
            ))}
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Remarks</label>
            <textarea className="form-textarea" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional notes…" />
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Officer</label>
              <select className="form-select" value={officer} onChange={(e) => handleOfficerSelect(e.target.value)}>
                <option value="">— Select officer —</option>
                {officers.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Badge / AC #</label>
              <input className="form-input" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge #" />
            </div>
          </div>
          <LinkToSection value={linkIds} onChange={setLinkIds} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => printDoorKnocker({ to, date, time, am_pm: amPm, checkboxes: checks, remarks, officer, badge }, MCAS_SEAL_LOGO)}>
            🖨 Print Preview
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save & Print"}
          </button>
        </div>
      </div>
    </div>
  );
}
