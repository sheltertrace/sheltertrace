"use client";
import { useState, useRef, useEffect } from "react";
import type { ShelterForm, FormPreFill, FormType } from "@/lib/types";
import DoorKnockerForm from "@/app/forms/DoorKnockerForm";
import RabiesQuarantineForm from "@/app/forms/RabiesQuarantineForm";
import RequestForComplianceForm from "@/app/forms/RequestForComplianceForm";
import GdaFosterAgreementForm from "@/app/forms/GdaFosterAgreementForm";
import GdaFosterInspectionForm from "@/app/forms/GdaFosterInspectionForm";
import GdaAnimalInventoryForm from "@/app/forms/GdaAnimalInventoryForm";
import AdoptionApplicationForm from "@/app/forms/AdoptionApplicationForm";

const FORM_OPTIONS: Array<{ type: FormType; label: string; icon: string }> = [
  { type: "door_knocker", label: "Door Knocker Notice", icon: "🚪" },
  { type: "rabies_quarantine", label: "Home Rabies Quarantine", icon: "💉" },
  { type: "request_for_compliance", label: "Request for Compliance", icon: "📋" },
  { type: "gda_foster_agreement", label: "GDA Foster Agreement", icon: "🤝" },
  { type: "gda_foster_inspection", label: "GDA Foster Inspection", icon: "🔍" },
  { type: "gda_animal_inventory", label: "GDA Animal Inventory", icon: "📦" },
  { type: "adoption_application", label: "Adoption Application", icon: "🐾" },
];

interface Props {
  prefill?: FormPreFill;
  onSaved?: (form: ShelterForm) => void;
  label?: string;
  size?: "sm" | "md";
}

export default function GenerateFormButton({ prefill = {}, onSaved, label = "Generate Form", size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState<FormType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (type: FormType) => {
    setOpen(false);
    setActiveType(type);
  };

  const handleSaved = (form: ShelterForm) => {
    setActiveType(null);
    onSaved?.(form);
  };

  return (
    <>
      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        <button
          className={`btn btn-primary${size === "sm" ? " btn-sm" : ""}`}
          onClick={() => setOpen((o) => !o)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          📝 {label} <span style={{ fontSize: 10 }}>▼</span>
        </button>
        {open && (
          <div style={{ position: "absolute", top: "100%", left: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, zIndex: 300, boxShadow: "0 8px 24px rgba(0,0,0,.15)", minWidth: 220, overflow: "hidden", marginTop: 4 }}>
            {FORM_OPTIONS.map((opt) => (
              <div
                key={opt.type}
                onClick={() => handleSelect(opt.type)}
                style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}
              >
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeType === "door_knocker" && (
        <DoorKnockerForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "rabies_quarantine" && (
        <RabiesQuarantineForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "request_for_compliance" && (
        <RequestForComplianceForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "gda_foster_agreement" && (
        <GdaFosterAgreementForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "gda_foster_inspection" && (
        <GdaFosterInspectionForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "gda_animal_inventory" && (
        <GdaAnimalInventoryForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
      {activeType === "adoption_application" && (
        <AdoptionApplicationForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveType(null)} />
      )}
    </>
  );
}
