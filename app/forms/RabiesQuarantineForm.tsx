"use client";
import { useState, useEffect } from "react";
import { createForm, fetchOfficers, fetchAnimals, updateAnimal } from "@/lib/data";
import { today } from "@/lib/utils";
import { useAuth } from "@/app/providers";
import { AGENCY_SEAL_LOGO, AGENCY_NAME, AGENCY_ADDRESS, AGENCY_PHONE, AGENCY_PHONE_DOTS, AGENCY_SHORT } from "@/lib/shelterInfo";
import type { ShelterForm, Officer, Animal, FormPreFill } from "@/lib/types";
import SignaturePad from "@/components/ui/SignaturePad";
import LinkToSection, { type LinkIds } from "@/components/forms/LinkToSection";
import DateInput from "@/components/ui/DateInput";

const REQUIREMENTS = [
  "Animal(s) in quarantine must be isolated from other animals. The animal(s) in quarantine cannot have ANY contact with other animals either inside or outside the home.",
  "Animal(s) in quarantine must be isolated from children under the age of 18. The animal(s) in quarantine cannot have ANY contact with children under the age of 18 either inside or outside the home.",
  "Only one (1) or at most two (2) responsible adults over the age of 18 are to have contact with the animal(s) in quarantine. This includes feeding, walking, playing, veterinarian appointments, or any other contact with the animal(s) in quarantine.",
  "When the animal(s) in quarantine are outside they MUST be on a leash. The leash must be physically held at AT ALL TIMES by one of the adults responsible for the quarantine and for the entire time the animal(s) are outside. If any other animals or humans approach the quarantined animal(s) the responsible adult must ensure there is no contact between the animals or humans and the quarantined animal(s).",
  "If the animal(s) in quarantine display any signs of being sick, especially any neurological symptoms, behavioral changes, or changes in temperament, they should be taken to a licensed veterinarian by the responsible adult. The veterinarian's staff must be notified that the animal(s) are in a rabies quarantine that is being monitored by ${AGENCY_NAME}. The responsible adult must also contact ${AGENCY_NAME} with the veterinarian's information and the reason the animal(s) were taken there.",
  "If the animal(s) escape or must be moved from the approved location ${AGENCY_NAME} must be notified immediately.",
];

interface Props {
  onSave: (form: ShelterForm) => void;
  onClose: () => void;
  prefill?: FormPreFill;
}

export function printRabiesQuarantine(data: Record<string, unknown>, logo: string) {
  const w = window.open("", "_blank", "width=750,height=1050");
  if (!w) return;
  const sigHtml = data.signature
    ? `<img src="${data.signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px"/>`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #000"></div>`;
  w.document.write(`<html><head><title>Home Rabies Quarantine Acknowledgement</title>
  <style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}body{font-family:Arial,sans-serif;font-size:10.5px;padding:22px;margin:0;line-height:1.45}
  ol li{margin-bottom:7px}
  @media print{body{padding:14px}}</style></head><body>
  <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:12px">
    <img src="${logo}" style="width:70px;height:70px;object-fit:contain;flex-shrink:0" />
    <div>
      <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.5px">${AGENCY_NAME}</div>
      <div style="font-size:11px;margin-top:2px">${AGENCY_ADDRESS} &nbsp;|&nbsp; ${AGENCY_PHONE_DOTS}</div>
      <div style="font-size:14px;font-weight:800;margin-top:6px">HOME RABIES QUARANTINE ACKNOWLEDGEMENT</div>
    </div>
  </div>
  ${data.animal_name ? `<div style="font-size:11px;margin-bottom:8px;padding:4px 8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px"><b>Animal:</b> ${data.animal_name} (ID: ${data.animal_id || "—"})</div>` : ""}
  <p style="margin-bottom:10px">The undersigned acknowledges that they have accepted the responsibility of performing a home rabies quarantine with the animal(s) that were or may have been involved in a bite incident. The undersigned affirms that they have read and understand the conditions of this rabies quarantine and will follow the protocol completely and for the entire length of the quarantine as required by ${AGENCY_NAME}.</p>
  <div style="font-weight:800;font-size:11px;margin:10px 0 6px;text-decoration:underline">Home Rabies Quarantine Requirements:</div>
  <ol style="margin:0;padding-left:18px">
    ${REQUIREMENTS.map((r) => `<li>${r}</li>`).join("")}
  </ol>
  <p style="margin-top:12px;font-weight:700">I fully understand the requirements of the home rabies quarantine and agree to comply with the requirements as stipulated above. I also understand that ${AGENCY_NAME} may do periodic checks at my home, with or without prior notification, to ensure that I am in compliance with the requirements. I acknowledge that ${AGENCY_NAME} will impound my animal(s) for any non-compliance and my animal(s) will complete the rabies quarantine at the ${AGENCY_NAME}.</p>
  <div style="display:flex;gap:30px;margin-top:18px;flex-wrap:wrap">
    <div>
      <div style="font-size:10px;margin-bottom:3px"><b>Printed Name:</b></div>
      <div style="border-bottom:1px solid #000;min-width:200px;padding-bottom:2px">${data.printed_name || ""}</div>
    </div>
    <div>
      <div style="font-size:10px;margin-bottom:3px"><b>Date:</b></div>
      <div style="border-bottom:1px solid #000;min-width:120px;padding-bottom:2px">${data.date || ""}</div>
    </div>
  </div>
  <div style="margin-top:14px">
    <div style="font-size:10px;margin-bottom:4px"><b>Signature:</b></div>
    ${sigHtml}
  </div>
  <div style="margin-top:14px;font-size:10px">
    <b>Officer Name &amp; Badge:</b>
    <span style="border-bottom:1px solid #000;display:inline-block;min-width:200px;margin-left:6px">${data.officer || ""}${data.badge ? ` · Badge #${data.badge}` : ""}</span>
  </div>
  <div style="border-top:1.5px solid #000;margin-top:24px;padding-top:8px;font-size:10px;text-align:center;color:#444">
    ${AGENCY_NAME} / ${AGENCY_ADDRESS} / ${AGENCY_PHONE_DOTS}
  </div>
  </body></html>`);
  w.document.close();
  w.print();
}

export default function RabiesQuarantineForm({ onSave, onClose, prefill }: Props) {
  const { user } = useAuth();
  const [printedName, setPrintedName] = useState(prefill ? [prefill.person_first, prefill.person_last].filter(Boolean).join(" ") : "");
  const [signature, setSignature] = useState<string | null>(null);
  const [date, setDate] = useState(prefill?.call_date || today());
  const [officer, setOfficer] = useState(prefill?.call_officer || (user ? `${user.firstName} ${user.lastName}`.trim() : ""));
  const [badge, setBadge] = useState(user?.badge || "");
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalSearch, setAnimalSearch] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [sigTimestamp, setSigTimestamp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkIds, setLinkIds] = useState<LinkIds>({
    call_id: prefill?.call_id,
    person_id: prefill?.person_id,
  });

  useEffect(() => {
    Promise.all([fetchOfficers(), fetchAnimals()]).then(([offs, anis]) => {
      setOfficers(offs);
      const filtered = anis.filter((a) => !["Adopted", "Euthanized"].includes(a.status));
      setAnimals(filtered);
      if (prefill?.animal_id) {
        const match = filtered.find((a) => a.id === prefill.animal_id);
        if (match) setSelectedAnimal(match);
      }
    });
  }, [prefill?.animal_id]);

  const filteredAnimals = animalSearch
    ? animals.filter((a) => a.name.toLowerCase().includes(animalSearch.toLowerCase()) || a.id.toLowerCase().includes(animalSearch.toLowerCase()))
    : [];

  const handleOfficerSelect = (name: string) => {
    setOfficer(name);
    const off = officers.find((o) => o.name === name);
    if (off?.badge) setBadge(off.badge);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = {
        printed_name: printedName,
        signature: signature || undefined,
        date,
        officer,
        badge,
        animal_id: selectedAnimal?.id,
        animal_name: selectedAnimal?.name,
      };
      const saved = await createForm({
        form_type: "rabies_quarantine",
        form_data: formData as unknown as Record<string, unknown>,
        linked_call_id: linkIds.call_id,
        linked_animal_id: selectedAnimal?.id,
        linked_person_id: linkIds.person_id,
        officer,
        created_by: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      });
      // Auto-set animal to Quarantine status
      if (selectedAnimal) {
        await updateAnimal(selectedAnimal.id, { status: "Quarantine", sub_status: "Bite Quarantine" });
      }
      onSave(saved);
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as { message?: string }).message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}>
        <div className="modal-header">
          <div className="modal-title">Home Rabies Quarantine Acknowledgement</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* Pre-printed intro */}
          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border-light)", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            The undersigned acknowledges that they have accepted the responsibility of performing a home rabies quarantine with the animal(s) that were or may have been involved in a bite incident. The undersigned affirms that they have read and understand the conditions of this rabies quarantine and will follow the protocol completely and for the entire length of the quarantine as required by ${AGENCY_NAME}.
          </div>

          {/* Requirements (read-only) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, textDecoration: "underline", marginBottom: 8 }}>Home Rabies Quarantine Requirements:</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {REQUIREMENTS.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
            </ol>
          </div>

          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, fontWeight: 700, lineHeight: 1.6 }}>
            I fully understand the requirements of the home rabies quarantine and agree to comply with the requirements as stipulated above. I also understand that ${AGENCY_NAME} may do periodic checks at my home, with or without prior notification, to ensure that I am in compliance with the requirements. I acknowledge that ${AGENCY_NAME} will impound my animal(s) for any non-compliance and my animal(s) will complete the rabies quarantine at the ${AGENCY_NAME}.
          </div>

          {/* Animal link */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Linked Animal (optional — will be set to Quarantine status)</label>
            {selectedAnimal ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6 }}>
                <span style={{ fontWeight: 700 }}>{selectedAnimal.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{selectedAnimal.species} · {selectedAnimal.id}</span>
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => setSelectedAnimal(null)}>✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input className="form-input" placeholder="Search animal by name or ID…" value={animalSearch} onChange={(e) => setAnimalSearch(e.target.value)} />
                {filteredAnimals.length > 0 && (
                  <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 160, overflowY: "auto" }}>
                    {filteredAnimals.slice(0, 8).map((a) => (
                      <div key={a.id} onClick={() => { setSelectedAnimal(a); setAnimalSearch(""); }} style={{ padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>{a.name}</span> <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.species} · {a.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Printed Name</label>
              <input className="form-input" value={printedName} onChange={(e) => setPrintedName(e.target.value)} placeholder="Owner's printed name" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Date</label>
              <DateInput className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <SignaturePad
              label="Owner Signature"
              value={signature}
              timestamp={sigTimestamp}
              onAccept={(data, ts) => { setSignature(data); setSigTimestamp(ts); }}
              onClear={() => { setSignature(null); setSigTimestamp(null); }}
            />
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
              <label className="form-label">Badge #</label>
              <input className="form-input" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Badge #" />
            </div>
          </div>
          <LinkToSection value={linkIds} onChange={setLinkIds} exclude={["animal"]} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => printRabiesQuarantine({ printed_name: printedName, signature, date, officer, badge, animal_id: selectedAnimal?.id, animal_name: selectedAnimal?.name }, AGENCY_SEAL_LOGO)}>
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
