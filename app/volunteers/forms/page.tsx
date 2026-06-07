"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchForms, createForm } from "@/lib/data";
import type { ShelterForm, FormPreFill } from "@/lib/types";
import VolunteerApplicationForm from "@/app/forms/VolunteerApplicationForm";
import VolunteerAgreementForm from "@/app/forms/VolunteerAgreementForm";
import VolunteerConfidentialityForm from "@/app/forms/VolunteerConfidentialityForm";
import { reprintShelterForm } from "@/lib/reprintForm";
import { formatDate } from "@/lib/utils";
import { AGENCY_NAME, AGENCY_SHORT } from "@/lib/shelterInfo";

type VolFormType = "volunteer_application" | "volunteer_agreement" | "volunteer_confidentiality";

const FORM_TEMPLATES = [
  {
    type: "volunteer_application" as VolFormType,
    label: "Volunteer Application",
    icon: "📋",
    description: "New volunteer intake form. Collects personal information, experience, availability, and emergency contacts.",
    color: "#6366f1",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  {
    type: "volunteer_agreement" as VolFormType,
    label: "Volunteer Agreement & Release",
    icon: "🤝",
    description: "Volunteer service agreement, liability release, and code of conduct. Requires volunteer and {AGENCY_SHORT} representative signatures.",
    color: "#0284c7",
    bg: "#e0f2fe",
    border: "#bae6fd",
  },
  {
    type: "volunteer_confidentiality" as VolFormType,
    label: "Volunteer Confidentiality Agreement",
    icon: "🔒",
    description: "Confidentiality and non-disclosure agreement. Covers animal records, client information, and social media policies.",
    color: "#0f2942",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
];

const TYPE_LABELS: Record<VolFormType, string> = {
  volunteer_application: "Application",
  volunteer_agreement: "Agreement & Release",
  volunteer_confidentiality: "Confidentiality Agreement",
};

export default function VolunteerFormsPage() {
  const [forms, setForms] = useState<ShelterForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<VolFormType | null>(null);
  const [prefill] = useState<FormPreFill>({});
  const [filterType, setFilterType] = useState<VolFormType | "all">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [apps, agrs, confs] = await Promise.all([
      fetchForms("volunteer_application"),
      fetchForms("volunteer_agreement"),
      fetchForms("volunteer_confidentiality"),
    ]);
    setForms([...apps, ...agrs, ...confs].sort((a, b) =>
      (b.created_at || "").localeCompare(a.created_at || "")
    ));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (form: ShelterForm) => {
    setActiveForm(null);
    setForms((prev) => [form, ...prev]);
  };

  const filtered = forms.filter((f) => {
    if (filterType !== "all" && f.form_type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const d = f.form_data as Record<string, string>;
      const name = `${d.first_name || ""} ${d.last_name || ""}`.toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  });

  const countByType = (t: VolFormType) => forms.filter((f) => f.form_type === t).length;

  return (
    <AppShell title="Volunteer Forms">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Volunteer Forms Library</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{AGENCY_NAME} · Digital volunteer documentation</div>
        </div>
      </div>

      {/* Form templates */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {FORM_TEMPLATES.map((t) => (
          <div key={t.type} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{t.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: t.color }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{t.description}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{countByType(t.type)} filed</span>
              <button
                className="btn btn-primary btn-sm"
                style={{ background: t.color, borderColor: t.color }}
                onClick={() => setActiveForm(t.type)}
              >
                + Fill Out Form
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent submissions */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Recent Submissions ({filtered.length})</div>
          <input
            className="form-input"
            placeholder="Search by volunteer name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, fontSize: 13 }}
          />
          <select
            className="form-input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as VolFormType | "all")}
            style={{ width: 200, fontSize: 13 }}
          >
            <option value="all">All Form Types</option>
            <option value="volunteer_application">Application</option>
            <option value="volunteer_agreement">Agreement & Release</option>
            <option value="volunteer_confidentiality">Confidentiality Agreement</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {forms.length === 0 ? "No volunteer forms on file yet. Use the buttons above to fill out a form." : "No forms match your search."}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Form Type</th>
                <th>Date Filed</th>
                <th>Filed By</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const d = f.form_data as Record<string, string>;
                const name = `${d.first_name || ""} ${d.last_name || ""}`.trim() || "Unknown";
                const template = FORM_TEMPLATES.find((t) => t.type === f.form_type);
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{name}</td>
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        background: template?.bg || "#f1f5f9",
                        color: template?.color || "var(--text)",
                        border: `1px solid ${template?.border || "var(--border)"}`,
                        borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 600,
                      }}>
                        {template?.icon} {TYPE_LABELS[f.form_type as VolFormType] || f.form_type}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {f.created_at ? formatDate(f.created_at.split("T")[0]) : "—"}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{f.created_by || f.officer || "—"}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Reprint this form"
                        onClick={() => reprintShelterForm(f)}
                        style={{ fontSize: 11, padding: "2px 8px" }}
                      >
                        🖨 Print
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Form modals */}
      {activeForm === "volunteer_application" && (
        <VolunteerApplicationForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveForm(null)} />
      )}
      {activeForm === "volunteer_agreement" && (
        <VolunteerAgreementForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveForm(null)} />
      )}
      {activeForm === "volunteer_confidentiality" && (
        <VolunteerConfidentialityForm prefill={prefill} onSave={handleSaved} onClose={() => setActiveForm(null)} />
      )}
    </AppShell>
  );
}
