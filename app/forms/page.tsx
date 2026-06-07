"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchForms } from "@/lib/data";
import type { ShelterForm, FormType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import DoorKnockerForm from "./DoorKnockerForm";
import RabiesQuarantineForm from "./RabiesQuarantineForm";
import RequestForComplianceForm from "./RequestForComplianceForm";
import GdaFosterAgreementForm from "./GdaFosterAgreementForm";
import GdaFosterInspectionForm from "./GdaFosterInspectionForm";
import GdaAnimalInventoryForm from "./GdaAnimalInventoryForm";
import AdoptionApplicationForm from "./AdoptionApplicationForm";
import ReprintFormButton from "@/components/forms/ReprintFormButton";

const FORM_CARDS: Array<{
  type: FormType;
  title: string;
  description: string;
  icon: string;
  color: string;
  bg: string;
}> = [
  {
    type: "door_knocker",
    title: "Door Knocker Notice",
    description: "Left at a resident's door when the officer visits and no one is home. Records the reason for the visit and any required action.",
    icon: "🚪",
    color: "#1d4ed8",
    bg: "#eff6ff",
  },
  {
    type: "rabies_quarantine",
    title: "Home Rabies Quarantine Acknowledgement",
    description: "Owner accepts responsibility for a home rabies quarantine after a bite incident. Includes all required conditions and owner signature.",
    icon: "💉",
    color: "#dc2626",
    bg: "#fff1f2",
  },
  {
    type: "request_for_compliance",
    title: "Request for Compliance",
    description: "Warning notice issued before a formal citation. Documents ordinance violations and gives the owner a deadline to achieve compliance.",
    icon: "📋",
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    type: "gda_foster_agreement",
    title: "GDA Foster Home Agreement",
    description: "Georgia Department of Agriculture foster home/animal shelter agent agreement. Records consent to comply with all GDA requirements.",
    icon: "🤝",
    color: "#047857",
    bg: "#f0fdf4",
  },
  {
    type: "gda_foster_inspection",
    title: "GDA Foster Home Inspection Report",
    description: "13-point GDA inspection checklist for foster homes. Records Pass/Fail/N/A per item, overall result, and inspector signatures.",
    icon: "🔍",
    color: "#0f766e",
    bg: "#f0fdfa",
  },
  {
    type: "gda_animal_inventory",
    title: "GDA Foster Home Animal Inventory",
    description: "Tracks which animals are placed at a foster home. Records animal ID, date in/out, and links to contact and animal records.",
    icon: "📦",
    color: "#7c3aed",
    bg: "#faf5ff",
  },
  {
    type: "adoption_application",
    title: "Pet Adoption Application",
    description: "Full ${AGENCY_SHORT} two-page adoption application. Includes animal and adopter info, household details, care plan, agreement terms, fees, and signatures.",
    icon: "🐾",
    color: "#be185d",
    bg: "#fdf2f8",
  },
];

const TYPE_LABELS: Record<FormType, string> = {
  door_knocker: "Door Knocker",
  rabies_quarantine: "Rabies Quarantine",
  request_for_compliance: "Request for Compliance",
  gda_foster_agreement: "GDA Foster Agreement",
  gda_foster_inspection: "GDA Foster Inspection",
  gda_animal_inventory: "GDA Animal Inventory",
  adoption_application: "Adoption Application",
  volunteer_application: "Volunteer Application",
  volunteer_agreement: "Volunteer Agreement & Release",
  volunteer_confidentiality: "Volunteer Confidentiality Agreement",
};

const BADGE_COLORS: Record<FormType, { bg: string; color: string }> = {
  door_knocker: { bg: "#eff6ff", color: "#1d4ed8" },
  rabies_quarantine: { bg: "#fff1f2", color: "#dc2626" },
  request_for_compliance: { bg: "#fffbeb", color: "#d97706" },
  gda_foster_agreement: { bg: "#f0fdf4", color: "#047857" },
  gda_foster_inspection: { bg: "#f0fdfa", color: "#0f766e" },
  gda_animal_inventory: { bg: "#faf5ff", color: "#7c3aed" },
  adoption_application: { bg: "#fdf2f8", color: "#be185d" },
  volunteer_application: { bg: "#eef2ff", color: "#6366f1" },
  volunteer_agreement: { bg: "#e0f2fe", color: "#0284c7" },
  volunteer_confidentiality: { bg: "#f0f9ff", color: "#0f2942" },
};

export default function FormsPage() {
  const [forms, setForms] = useState<ShelterForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFormType, setActiveFormType] = useState<FormType | null>(null);
  const [historyFilter, setHistoryFilter] = useState<FormType | "all">("all");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const f = await fetchForms();
      setForms(f);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-highlight from URL param ?id=
  useEffect(() => {
    if (typeof window === "undefined" || loading || forms.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (!idParam) return;
    const found = forms.find((f) => f.id === idParam);
    if (found) {
      setHistoryFilter("all");
      setHighlightId(idParam);
      setTimeout(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      setTimeout(() => setHighlightId(null), 4000);
    }
  }, [forms, loading]);

  const handleFormSaved = (saved: ShelterForm) => {
    setForms((prev) => [saved, ...prev]);
    setActiveFormType(null);
  };

  const displayed = historyFilter === "all" ? forms : forms.filter((f) => f.form_type === historyFilter);

  const getFormSummary = (f: ShelterForm): string => {
    const d = f.form_data as Record<string, unknown>;
    switch (f.form_type) {
      case "door_knocker":
        return `To: ${d.to || "—"} · ${d.date || ""}`;
      case "rabies_quarantine":
        return `${d.printed_name || "—"}${d.animal_name ? ` · ${d.animal_name}` : ""}`;
      case "request_for_compliance":
        return `${[d.name_first, d.name_last].filter(Boolean).join(" ") || "—"} · ${d.address || ""}`;
      case "gda_foster_agreement":
        return `${d.foster_name || "—"} · ${d.effective_date || ""}`;
      case "gda_foster_inspection":
        return `${d.foster_name || "—"} · ${d.inspection_date || ""} · ${d.overall || ""}`;
      case "gda_animal_inventory":
        return `${d.foster_name || "—"} · ${d.report_date || ""}`;
      case "adoption_application":
        return `${[d.adopter_first, d.adopter_last].filter(Boolean).join(" ") || "—"} · ${d.animal_name || ""}`;
      default:
        return "";
    }
  };

  return (
    <AppShell title="${AGENCY_SHORT} Forms">
      {/* Form type cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        {FORM_CARDS.map((card) => (
          <div
            key={card.type}
            className="card"
            style={{ padding: 20, borderTop: `4px solid ${card.color}`, cursor: "default" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                {card.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 5, lineHeight: 1.5 }}>{card.description}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ flex: 1, background: card.color, borderColor: card.color }}
                onClick={() => setActiveFormType(card.type)}
              >
                + New {card.title.replace("Acknowledgement", "").trim()}
              </button>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {forms.filter((f) => f.form_type === card.type).length} saved
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div ref={historyRef} className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Form History</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              className={`btn btn-sm ${historyFilter === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setHistoryFilter("all")}
            >
              All Forms
            </button>
            {FORM_CARDS.map((c) => (
              <button
                key={c.type}
                className={`btn btn-sm ${historyFilter === c.type ? "btn-primary" : "btn-secondary"}`}
                style={historyFilter === c.type ? { background: c.color, borderColor: c.color } : {}}
                onClick={() => setHistoryFilter(c.type)}
              >
                {c.icon} {c.title.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>{displayed.length} record{displayed.length !== 1 ? "s" : ""}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Form Type</th>
              <th>Summary</th>
              <th>Officer</th>
              <th>Linked</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="empty-state">Loading…</td></tr>
            ) : displayed.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No forms yet. Click a card above to create one.</td></tr>
            ) : (
              displayed.map((f) => {
                const bc = BADGE_COLORS[f.form_type] || { bg: "#f3f4f6", color: "#374151" };
                const isHighlighted = f.id === highlightId;
                return (
                  <tr
                    key={f.id}
                    style={{
                      cursor: "pointer",
                      background: isHighlighted ? "#fef9c3" : undefined,
                      outline: isHighlighted ? "2px solid #eab308" : undefined,
                      transition: "background 0.5s",
                    }}
                    onClick={() => {
                      setHighlightId(f.id);
                      setTimeout(() => setHighlightId(null), 3000);
                    }}
                  >
                    <td>
                      <span className="badge" style={{ background: bc.bg, color: bc.color }}>
                        {TYPE_LABELS[f.form_type]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getFormSummary(f)}
                    </td>
                    <td style={{ fontSize: 12 }}>{f.officer || f.created_by || "—"}</td>
                    <td style={{ fontSize: 11 }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {f.linked_call_id && <span className="badge" style={{ background: "#f0fdf4", color: "#15803d" }}>Call</span>}
                        {f.linked_animal_id && <span className="badge" style={{ background: "#fdf4ff", color: "#9333ea" }}>Animal</span>}
                        {f.linked_person_id && <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8" }}>Person</span>}
                        {!f.linked_call_id && !f.linked_animal_id && !f.linked_person_id && <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>{f.created_at ? formatDate(f.created_at) : "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <ReprintFormButton form={f} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Form modals */}
      {activeFormType === "door_knocker" && (
        <DoorKnockerForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "rabies_quarantine" && (
        <RabiesQuarantineForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "request_for_compliance" && (
        <RequestForComplianceForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "gda_foster_agreement" && (
        <GdaFosterAgreementForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "gda_foster_inspection" && (
        <GdaFosterInspectionForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "gda_animal_inventory" && (
        <GdaAnimalInventoryForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
      {activeFormType === "adoption_application" && (
        <AdoptionApplicationForm onSave={handleFormSaved} onClose={() => setActiveFormType(null)} />
      )}
    </AppShell>
  );
}
