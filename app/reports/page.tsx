"use client";
import AppShell from "@/components/layout/AppShell";
import { useRouter } from "next/navigation";
import { REPORT_CONFIGS } from "@/lib/reportBuilderConfigs";

const CATEGORIES = [
  { key: "Shelter Reports", icon: "🏠", color: "#0f2942" },
  { key: "Field Reports", icon: "🚗", color: "#dc2626" },
  { key: "Outcome Reports", icon: "📤", color: "#16a34a" },
  { key: "Operations Reports", icon: "⚙️", color: "#7c3aed" },
];

const GDA_CARD = {
  id: "gda",
  title: "GDA Monthly Report",
  description: "Georgia GDA-required monthly shelter statistics, live-release rate, and annual summary",
  icon: "📊",
  category: "Shelter Reports",
};

const CATEGORY_BORDER: Record<string, string> = {
  "Shelter Reports": "#0f2942",
  "Field Reports": "#dc2626",
  "Outcome Reports": "#16a34a",
  "Operations Reports": "#7c3aed",
};

export default function ReportsIndexPage() {
  const router = useRouter();

  return (
    <AppShell title="Reports">
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
        Generate, filter, and export reports for all shelter operations.
      </p>

      {CATEGORIES.map(({ key, icon }) => {
        const configs = REPORT_CONFIGS.filter((c) => c.category === key);
        const extraCards = key === "Shelter Reports" ? [GDA_CARD] : [];
        const allCards = [...configs, ...extraCards];
        if (allCards.length === 0) return null;

        return (
          <div key={key} style={{ marginBottom: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span>{icon}</span>
              <span>{key}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {allCards.map((config) => (
                <div
                  key={config.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderLeft: `4px solid ${CATEGORY_BORDER[key] || "#0f2942"}`,
                    borderRadius: 10,
                    padding: "16px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{config.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{config.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.4 }}>{config.description}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => router.push(`/reports/${config.id}`)}
                      style={{ fontSize: 12 }}
                    >
                      Generate Report →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </AppShell>
  );
}
