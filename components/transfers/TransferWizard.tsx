"use client";
import { useState, useMemo } from "react";
import type { Animal, RescueGroup, MedicalRecord, Transfer } from "@/lib/types";
import { createTransfer, genTransferReceiptNumber } from "@/lib/data";
import { today, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { BEHAVIOR_FLAGS } from "@/lib/constants";

interface Props {
  animals: Animal[];
  medicalByAnimal: Record<string, MedicalRecord[]>;
  rescueGroups: RescueGroup[];
  initialGroupId?: string;
  onComplete: (transfer: Transfer, selectedAnimals: Animal[]) => void;
  onClose: () => void;
}

function licenseWarning(group: RescueGroup): string | null {
  if (!group.license_expiration) return null;
  const days = Math.floor((new Date(group.license_expiration).getTime() - Date.now()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= 30) return `Expires in ${days}d`;
  return null;
}

// Accepts either a live Transfer object (from wizard) or a snapshot-reconstructed one.
// The transfer object must have officer_badge and condition_at_transfer if those were captured.
export function printTransferReceipt(
  transfer: Pick<Transfer, "transfer_number" | "date" | "notes" | "officer" | "officer_badge" | "condition_at_transfer">,
  group: RescueGroup,
  animals: Animal[],
  medicalByAnimal: Record<string, MedicalRecord[]>
) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;

  const fld = (label: string, val?: string | null) =>
    `<div style="margin-bottom:8px;"><span style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">${label}</span><div style="font-size:12px;color:#0f172a;margin-top:2px;">${val || "—"}</div></div>`;

  const warn = licenseWarning(group);
  const licColor = warn === "EXPIRED" ? "#dc2626" : warn ? "#f59e0b" : "#0f172a";

  const animalSections = animals.map((a) => {
    const med = (medicalByAnimal[a.id] || []).sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
    const flags = Object.entries(a.behavior_flags || {}).filter(([, v]) => v).map(([k]) => {
      const f = BEHAVIOR_FLAGS.find((bf) => bf.id === k);
      return f ? `${f.icon} ${f.label}` : k;
    });

    const medRows = med.length === 0
      ? `<tr><td colspan="4" style="padding:6px;color:#94a3b8;font-style:italic;font-size:10px;">No medical records on file</td></tr>`
      : med.map((m) => `
        <tr>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:10px;">${m.date}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:10px;">${m.type}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:10px;">${m.description || "—"}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;font-size:10px;">${m.vet || "—"}</td>
        </tr>`).join("");

    return `
      <div style="page-break-before:always;padding:0.5in;font-family:Arial,sans-serif;">
        <div style="background:#0f2942;color:#fff;padding:10px 16px;border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;margin-bottom:0;">
          <div>
            <div style="font-size:13px;font-weight:800;">MORGAN COUNTY ANIMAL SERVICES</div>
            <div style="font-size:9px;color:#93c5fd;">Animal Transfer Receipt · ${transfer.transfer_number}</div>
          </div>
          <div style="font-size:10px;color:#bfdbfe;">${a.name} (${a.id})</div>
        </div>
        ${a.is_dangerous ? `<div style="background:#fee2e2;border:2px solid #dc2626;padding:4px 10px;font-size:10px;font-weight:700;color:#dc2626;">🚨 DANGEROUS ANIMAL — HANDLE WITH EXTREME CAUTION</div>` : ""}
        ${a.is_cruelty_case ? `<div style="background:#fef3c7;border:2px solid #f59e0b;padding:4px 10px;font-size:10px;font-weight:700;color:#b45309;">⚠️ CRUELTY CASE — EVIDENCE HOLD</div>` : ""}
        <div style="border:1px solid #cbd5e1;border-top:none;border-radius:0 0 6px 6px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;gap:16px;">
            ${a.photo_url
              ? `<img src="${a.photo_url}" style="width:130px;height:130px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0;" />`
              : `<div style="width:130px;height:130px;border-radius:6px;border:2px dashed #cbd5e1;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:48px;flex-shrink:0;">${a.species === "Dog" ? "🐕" : a.species === "Cat" ? "🐈" : "🐾"}</div>`}
            <div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 16px;">
              ${fld("Animal ID", a.id)}
              ${fld("Name", a.name)}
              ${fld("Status", a.status)}
              ${fld("Species", a.species)}
              ${fld("Breed", a.breed)}
              ${fld("Sex", a.sex)}
              ${fld("Color", [a.color, a.secondary_color].filter(Boolean).join(" / "))}
              ${fld("Age / DOB", a.dob || a.age || "—")}
              ${fld("Weight", a.weight || "—")}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:0 16px;margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;">
            ${fld("Intake Type", a.intake_type)}
            ${fld("Intake Date", a.intake_date)}
            ${fld("Spayed / Neutered", a.fixed ? "Yes" : "No")}
            ${fld("Microchip #", a.microchip || "—")}
            ${fld("Microchip Brand", a.microchip_brand || "—")}
            ${fld("Rabies Tag", a.rabies_tag || "—")}
            ${fld("Rabies Expiry", a.rabies_expiry || "—")}
            ${fld("Shelter Tag", a.shelter_tag || "—")}
          </div>
          ${a.markings ? `<div style="margin-top:8px;border-top:1px solid #f1f5f9;padding-top:8px;">${fld("Markings / Notes", a.markings)}</div>` : ""}
          ${flags.length > 0 ? `<div style="margin-top:8px;padding:8px 10px;background:#fef3c7;border:1px solid #fde68a;border-radius:5px;font-size:10px;font-weight:700;color:#b45309;">⚠ Behavior Flags: ${flags.join("  ·  ")}</div>` : ""}
          ${a.intake_behavior ? `<div style="margin-top:6px;font-size:10px;"><strong>Intake Behavior:</strong> ${a.intake_behavior}</div>` : ""}
          ${a.injuries ? `<div style="margin-top:4px;font-size:10px;"><strong>Known Injuries:</strong> ${a.injuries}</div>` : ""}
        </div>
        <div style="margin-bottom:14px;">
          <div style="background:#1e3a5f;color:#fff;padding:5px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-radius:4px 4px 0 0;">
            Medical History (${med.length} record${med.length !== 1 ? "s" : ""})
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:4px 8px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Date</th>
                <th style="padding:4px 8px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Type</th>
                <th style="padding:4px 8px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Description</th>
                <th style="padding:4px 8px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Vet / Staff</th>
              </tr>
            </thead>
            <tbody>${medRows}</tbody>
          </table>
        </div>
      </div>`;
  }).join("");

  w.document.write(`<!DOCTYPE html><html><head><title>Transfer Receipt — ${transfer.transfer_number}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#fff;font-family:Arial,Helvetica,sans-serif;}
@page{size:letter;margin:0;}
@media print{.no-print{display:none!important;}}
</style></head><body>

<!-- Cover page -->
<div style="padding:0.6in;font-family:Arial,sans-serif;">
  <!-- Header -->
  <div style="background:#0f2942;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="font-size:18px;font-weight:900;letter-spacing:0.5px;">MORGAN COUNTY ANIMAL SERVICES</div>
      <div style="font-size:11px;color:#93c5fd;margin-top:3px;">2392 Athens Hwy, Madison, GA 30650 · ShelterTrace · Shelter Data Systems</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#bfdbfe;font-weight:700;letter-spacing:1px;">ANIMAL TRANSFER RECEIPT</div>
      <div style="font-size:26px;font-weight:900;letter-spacing:1px;font-family:monospace;">${transfer.transfer_number}</div>
      <div style="font-size:11px;color:#bfdbfe;">Date: ${formatDate(transfer.date)}</div>
    </div>
  </div>

  <!-- Receiving agency -->
  <div style="border:1px solid #cbd5e1;border-top:none;border-radius:0 0 8px 8px;padding:16px 20px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px;">Receiving Agency Information</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 24px;">
      <div style="grid-column:1/-1;margin-bottom:8px;">
        <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">Organization Name</div>
        <div style="font-size:16px;font-weight:800;color:#0f2942;margin-top:2px;">${group.organization_name}</div>
      </div>
      ${fld("Contact Person", group.contact_person)}
      ${fld("Phone", group.phone)}
      ${fld("Email", group.email)}
      ${fld("Address", [group.address, group.city, group.state, group.zip].filter(Boolean).join(", "))}
      <div style="margin-bottom:8px;">
        <span style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">Agency License #</span>
        <div style="font-size:12px;color:${licColor};font-weight:700;margin-top:2px;">${group.license_number || "—"}${warn ? `  <span style="background:${warn === "EXPIRED" ? "#fee2e2" : "#fef3c7"};color:${licColor};padding:1px 6px;border-radius:3px;font-size:9px;">⚠ ${warn}</span>` : ""}</div>
      </div>
      ${fld("License Expiration", group.license_expiration ? formatDate(group.license_expiration) : undefined)}
    </div>
  </div>

  <!-- Transferring officer -->
  <div style="border:1px solid #cbd5e1;border-radius:8px;padding:14px 20px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px;">Transferring Officer</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;">
      ${fld("Officer Name", transfer.officer)}
      ${fld("Badge / ID Number", transfer.officer_badge)}
    </div>
  </div>

  <!-- Animal summary table -->
  <div style="margin-bottom:20px;">
    <div style="background:#1e3a5f;color:#fff;padding:7px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-radius:4px 4px 0 0;">
      Animals Being Transferred (${animals.length})
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">ID</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Name</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Species</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Breed</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Sex</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Microchip</th>
          <th style="padding:5px 10px;border:1px solid #e2e8f0;font-size:9px;font-weight:700;text-align:left;text-transform:uppercase;color:#64748b;">Fixed</th>
        </tr>
      </thead>
      <tbody>
        ${animals.map((a, i) => `
          <tr style="${i % 2 === 1 ? "background:#f8fafc;" : ""}">
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;font-family:monospace;">${a.id}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:11px;font-weight:700;">${a.name}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;">${a.species}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;">${a.breed}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;">${a.sex}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;">${a.microchip || "—"}</td>
            <td style="padding:5px 10px;border:1px solid #e2e8f0;font-size:10px;">${a.fixed ? "Yes" : "No"}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>

  ${transfer.condition_at_transfer ? `
  <div style="margin-bottom:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
    <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Condition at Time of Transfer</div>
    <div style="font-size:12px;color:#0f172a;line-height:1.5;">${transfer.condition_at_transfer}</div>
  </div>` : ""}

  ${transfer.notes ? `
  <div style="margin-bottom:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
    <div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Transfer Notes / Special Instructions</div>
    <div style="font-size:12px;color:#0f172a;line-height:1.5;">${transfer.notes}</div>
  </div>` : ""}

  <!-- Terms -->
  <div style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:8px;padding:16px 20px;background:#f8fafc;">
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:#1e3a5f;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:12px;">Terms and Conditions of Transfer</div>
    <div style="font-size:11px;color:#0f172a;line-height:1.7;">
      <div style="margin-bottom:8px;">1. The receiving organization accepts full responsibility for the care and welfare of the above animal(s) effective the date and time of this transfer.</div>
      <div style="margin-bottom:8px;">2. The receiving organization agrees not to return the animal(s) to Morgan County Animal Services without prior written authorization from shelter management.</div>
      <div style="margin-bottom:8px;">3. The receiving organization agrees to provide veterinary care as needed and to comply with all applicable state and local animal welfare regulations.</div>
    </div>
  </div>

  <!-- Signatures -->
  <div style="border-top:2px solid #e2e8f0;padding-top:20px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:30px;">Transferring Officer — Morgan County Animal Services</div>
        <div style="border-bottom:1px solid #000;margin-bottom:4px;height:28px;"></div>
        <div style="font-size:10px;color:#475569;">Signature</div>
        <div style="margin-top:14px;border-bottom:1px solid #000;margin-bottom:4px;padding-bottom:2px;font-size:12px;">${transfer.officer || ""}</div>
        <div style="font-size:10px;color:#475569;">Print Name</div>
        <div style="margin-top:14px;display:flex;gap:24px;">
          <div><div style="border-bottom:1px solid #000;width:110px;height:20px;"></div><div style="font-size:10px;color:#475569;margin-top:4px;">Date</div></div>
          <div><div style="border-bottom:1px solid #000;width:110px;height:20px;padding-bottom:2px;font-size:12px;">${transfer.officer_badge || ""}</div><div style="font-size:10px;color:#475569;margin-top:4px;">Badge #</div></div>
        </div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:30px;">Receiving Organization Representative</div>
        <div style="border-bottom:1px solid #000;margin-bottom:4px;height:28px;"></div>
        <div style="font-size:10px;color:#475569;">Signature</div>
        <div style="margin-top:14px;border-bottom:1px solid #000;margin-bottom:4px;height:20px;"></div>
        <div style="font-size:10px;color:#475569;">Print Name / Title</div>
        <div style="margin-top:14px;display:flex;gap:24px;">
          <div><div style="border-bottom:1px solid #000;width:110px;height:20px;"></div><div style="font-size:10px;color:#475569;margin-top:4px;">Date</div></div>
          <div><div style="border-bottom:1px solid #000;width:150px;height:20px;"></div><div style="font-size:10px;color:#475569;margin-top:4px;">Representing Organization</div></div>
        </div>
      </div>
    </div>
  </div>
</div>

${animalSections}

<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
}

export default function TransferWizard({ animals, medicalByAnimal, rescueGroups, initialGroupId, onComplete, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [groupId, setGroupId] = useState(initialGroupId || "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [animalSearch, setAnimalSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("All");
  const [notes, setNotes] = useState("");
  const [transferDate, setTransferDate] = useState(today());
  const [officerBadge, setOfficerBadge] = useState("");
  const [conditionAtTransfer, setConditionAtTransfer] = useState("");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [completedTransfer, setCompletedTransfer] = useState<Transfer | null>(null);

  const group = rescueGroups.find((g) => g.id === groupId) || null;
  const warn = group ? licenseWarning(group) : null;

  const transferableAnimals = useMemo(() => {
    return animals.filter((a) => !["Adopted", "Euthanized", "Transferred"].includes(a.status));
  }, [animals]);

  const filtered = useMemo(() => {
    const q = animalSearch.toLowerCase();
    return transferableAnimals.filter((a) => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q);
      const matchSpecies = speciesFilter === "All" || a.species === speciesFilter;
      return matchSearch && matchSpecies;
    });
  }, [transferableAnimals, animalSearch, speciesFilter]);

  const selectedAnimals = animals.filter((a) => selectedIds.has(a.id));

  const toggleAnimal = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (filtered.every((a) => selectedIds.has(a.id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const handleConfirm = async () => {
    if (!group || selectedAnimals.length === 0) return;
    setSaving(true);
    setErrMsg("");
    const user = getCurrentUser();
    try {
      const transferNumber = await genTransferReceiptNumber();

      // Capture full snapshots at transfer time for permanent receipt storage
      const agencySnapshot = { ...group } as Record<string, unknown>;
      const animalSnapshot = selectedAnimals.map((a) => ({
        ...a,
        medical_records: medicalByAnimal[a.id] || [],
      })) as Record<string, unknown>[];

      const t = await createTransfer(
        {
          transfer_number: transferNumber,
          date: transferDate,
          rescue_group_id: group.id,
          rescue_group_name: group.organization_name,
          animal_ids: selectedAnimals.map((a) => a.id),
          animal_names: selectedAnimals.map((a) => a.name),
          notes: notes || undefined,
          officer: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
          officer_badge: officerBadge || undefined,
          condition_at_transfer: conditionAtTransfer || undefined,
          terms_accepted: true,
          animal_info_snapshot: animalSnapshot,
          agency_info_snapshot: agencySnapshot,
        },
        selectedAnimals
      );
      setCompletedTransfer(t);
      onComplete(t, selectedAnimals);
    } catch (err: unknown) {
      setErrMsg((err as { message?: string }).message || "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const stepLabel = ["", "Select Agency", "Select Animals", "Transfer Details", "Review & Confirm"];

  return (
    <div className="modal-overlay" onClick={completedTransfer ? undefined : onClose}>
      <div className="modal modal-lg" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {completedTransfer ? (
            <span className="modal-title">✓ Transfer Complete</span>
          ) : (
            <span className="modal-title">🚌 New Animal Transfer — Step {step} of 4: {stepLabel[step]}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step progress — hidden after completion */}
        {!completedTransfer && (
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {[1, 2, 3, 4].map((s) => (
              <div key={s} style={{
                flex: 1, padding: "8px 0", textAlign: "center", fontSize: 11, fontWeight: 700,
                borderBottom: step === s ? "3px solid var(--teal)" : "3px solid transparent",
                color: step === s ? "var(--teal)" : step > s ? "var(--text-secondary)" : "var(--text-muted)",
                cursor: step > s ? "pointer" : "default",
              }} onClick={() => step > s && setStep(s)}>
                {s < step ? "✓ " : ""}{stepLabel[s]}
              </div>
            ))}
          </div>
        )}

        <div className="modal-body" style={{ minHeight: completedTransfer ? "auto" : 380 }}>
          {/* ── Success state ── */}
          {completedTransfer && group && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>Transfer Recorded Successfully</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                Receipt Number: <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{completedTransfer.transfer_number}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                {selectedAnimals.length} animal{selectedAnimals.length !== 1 ? "s" : ""} transferred to <strong>{group.organization_name}</strong>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => printTransferReceipt(completedTransfer, group, selectedAnimals, medicalByAnimal)}
                style={{ fontSize: 14, padding: "10px 24px" }}
              >
                🖨 Print Transfer Receipt
              </button>
            </div>
          )}

          {/* ── Wizard steps (hidden after completion) ── */}
          {!completedTransfer && (
            <>
              {errMsg && (
                <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#dc2626" }}>
                  ⚠️ {errMsg}
                </div>
              )}

              {/* Step 1: Select rescue group */}
              {step === 1 && (
                <div>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Receiving Rescue Group / Agency *</label>
                    <select className="form-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                      <option value="">— Select agency —</option>
                      {rescueGroups.map((g) => {
                        const w = licenseWarning(g);
                        return <option key={g.id} value={g.id}>{g.organization_name}{w ? ` ⚠ ${w}` : ""}</option>;
                      })}
                    </select>
                  </div>

                  {group && (
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                      {warn && (
                        <div style={{ background: warn === "EXPIRED" ? "#fee2e2" : "#fef3c7", border: `1px solid ${warn === "EXPIRED" ? "#fca5a5" : "#fde68a"}`, borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 12, fontWeight: 700, color: warn === "EXPIRED" ? "#dc2626" : "#92400e" }}>
                          ⚠️ License {warn === "EXPIRED" ? "EXPIRED" : `expiring soon (${warn})`} — verify before transferring animals.
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 13 }}>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Contact:</span> {group.contact_person || "—"}</div>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Phone:</span> {group.phone || "—"}</div>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Email:</span> {group.email || "—"}</div>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>City/State:</span> {[group.city, group.state].filter(Boolean).join(", ") || "—"}</div>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>License #:</span> <strong>{group.license_number || "—"}</strong></div>
                        <div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Expires:</span> {group.license_expiration ? formatDate(group.license_expiration) : "—"}</div>
                      </div>
                    </div>
                  )}

                  {rescueGroups.length === 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                      No rescue groups on file. Add one on the Transfers page first.
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select animals */}
              {step === 2 && (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <input className="form-input" style={{ flex: "1 1 200px", maxWidth: 280 }} placeholder="Search name, ID, breed…" value={animalSearch} onChange={(e) => setAnimalSearch(e.target.value)} />
                    {["All", "Dog", "Cat", "Other"].map((s) => (
                      <button key={s} className={`btn btn-sm ${speciesFilter === s ? "btn-primary" : "btn-secondary"}`} onClick={() => setSpeciesFilter(s)}>{s}</button>
                    ))}
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-secondary)" }}>
                      {selectedIds.size} selected
                    </span>
                  </div>

                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 400, overflowY: "auto" }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>
                            <input type="checkbox"
                              checked={filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id))}
                              onChange={toggleAll}
                            />
                          </th>
                          <th>Name / ID</th>
                          <th>Species</th>
                          <th>Breed</th>
                          <th>Status</th>
                          <th>Kennel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.length === 0 ? (
                          <tr><td colSpan={6} className="empty-state">No animals match</td></tr>
                        ) : filtered.map((a) => (
                          <tr key={a.id} style={{ cursor: "pointer", background: selectedIds.has(a.id) ? "var(--teal-light, #f0fdfa)" : undefined }} onClick={() => toggleAnimal(a.id)}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleAnimal(a.id)} />
                            </td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.name}</div>
                              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{a.id}</div>
                            </td>
                            <td style={{ fontSize: 12 }}>{a.species}</td>
                            <td style={{ fontSize: 12 }}>{a.breed}</td>
                            <td><span className="badge" style={{ background: "#f1f5f9", color: "#475569", fontSize: 11 }}>{a.status}</span></td>
                            <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 3: Transfer details */}
              {step === 3 && (
                <div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Transfer Date *</label>
                      <input className="form-input" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Officer Badge # <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                      <input className="form-input" value={officerBadge} onChange={(e) => setOfficerBadge(e.target.value)} placeholder="e.g. 4521" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Condition at Time of Transfer <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                    <textarea className="form-textarea" rows={3} value={conditionAtTransfer} onChange={(e) => setConditionAtTransfer(e.target.value)}
                      placeholder="Describe the animal(s) physical condition at time of transfer — health status, visible injuries, temperament, weight, etc." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transfer Notes / Special Instructions <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
                    <textarea className="form-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="Reason for transfer, medical conditions to monitor, behavioral notes, follow-up requirements…" />
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && group && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--teal)" }}>Receiving Agency</div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{group.organization_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{group.contact_person} · {group.phone}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{[group.city, group.state].filter(Boolean).join(", ")}</div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>License: <strong>{group.license_number || "—"}</strong></div>
                      {warn && <div style={{ fontSize: 11, color: warn === "EXPIRED" ? "#dc2626" : "#f59e0b", fontWeight: 700, marginTop: 4 }}>⚠ License {warn}</div>}
                    </div>
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--teal)" }}>Transfer Info</div>
                      <div style={{ fontSize: 12 }}>Date: <strong>{formatDate(transferDate)}</strong></div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Animals: <strong>{selectedAnimals.length}</strong></div>
                      {officerBadge && <div style={{ fontSize: 12, marginTop: 4 }}>Badge: <strong>{officerBadge}</strong></div>}
                      {conditionAtTransfer && <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-secondary)", lineHeight: 1.4 }}><em>{conditionAtTransfer}</em></div>}
                      {notes && <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-secondary)", lineHeight: 1.4 }}>{notes}</div>}
                    </div>
                  </div>

                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ background: "#1e3a5f", color: "#fff", padding: "7px 14px", fontSize: 12, fontWeight: 700 }}>
                      Animals ({selectedAnimals.length})
                    </div>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead><tr><th>Name</th><th>ID</th><th>Species</th><th>Breed</th><th>Kennel</th><th>Microchip</th></tr></thead>
                      <tbody>
                        {selectedAnimals.map((a) => (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 700 }}>{a.name}</td>
                            <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                            <td style={{ fontSize: 12 }}>{a.species}</td>
                            <td style={{ fontSize: 12 }}>{a.breed}</td>
                            <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                            <td style={{ fontSize: 12 }}>{a.microchip || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 7, fontSize: 12, color: "#92400e" }}>
                    ⚠️ Confirming will mark all {selectedAnimals.length} animal{selectedAnimals.length !== 1 ? "s" : ""} as <strong>Transferred</strong> and record this transfer. This cannot be undone.
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          {completedTransfer ? (
            <>
              <div />
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
                {step === 1 ? "Cancel" : "← Back"}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                {step < 4 ? (
                  <button
                    className="btn btn-primary"
                    disabled={
                      (step === 1 && !groupId) ||
                      (step === 2 && selectedIds.size === 0)
                    }
                    onClick={() => setStep(step + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || selectedAnimals.length === 0}>
                    {saving ? "Processing…" : `✓ Confirm Transfer (${selectedAnimals.length} animals)`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
