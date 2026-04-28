"use client";
import type { ShelterForm } from "@/lib/types";
import { reprintShelterForm, emailShelterForm } from "@/lib/reprintForm";

interface Props {
  form: ShelterForm;
  personEmail?: string;
  onNavigate?: () => void;
}

export default function ReprintFormButton({ form, personEmail, onNavigate }: Props) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <button
        className="btn btn-secondary btn-sm"
        title="Reprint this form"
        onClick={(e) => {
          e.stopPropagation();
          reprintShelterForm(form);
        }}
        style={{ fontSize: 11, padding: "2px 8px" }}
      >
        🖨
      </button>
      <button
        className="btn btn-secondary btn-sm"
        title="Email this form"
        onClick={(e) => {
          e.stopPropagation();
          emailShelterForm(form, personEmail);
        }}
        style={{ fontSize: 11, padding: "2px 8px" }}
      >
        ✉
      </button>
      {onNavigate && (
        <button
          className="btn btn-ghost btn-sm"
          title="View on Forms page"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          style={{ fontSize: 11, padding: "2px 8px", color: "var(--text-secondary)" }}
        >
          ↗
        </button>
      )}
    </div>
  );
}
