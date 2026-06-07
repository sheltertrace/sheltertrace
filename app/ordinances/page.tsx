"use client";
import { useState, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { getOrdinances, COURT_MAGISTRATE, COURT_STATE, COUNTY_NAME } from "@/lib/shelterInfo";
import type { MorganCountyOrdinance } from "@/lib/constants";

// Group ordinances by article
const ARTICLES = Array.from(new Set(getOrdinances().map((o) => o.article)));

function OrdinanceCard({ ord, highlight }: { ord: MorganCountyOrdinance; highlight?: string }) {
  const [expanded, setExpanded] = useState(false);

  const hl = (text: string) => {
    if (!highlight) return text;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) + "‹" + text.slice(idx, idx + highlight.length) + "›" + text.slice(idx + highlight.length);
  };

  return (
    <div
      style={{
        border: `1px solid ${ord.citable ? "#bfdbfe" : "var(--border)"}`,
        borderRadius: 8,
        marginBottom: 8,
        overflow: "hidden",
        background: "var(--card)",
      }}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <span style={{
          fontFamily: "monospace", fontWeight: 800, fontSize: 13,
          background: ord.citable ? "#1d4ed8" : "#6b7280",
          color: "#fff", padding: "2px 8px", borderRadius: 4, flexShrink: 0,
        }}>
          {ord.code}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{ord.title}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 1 }}>{ord.description}</div>
        </div>
        {ord.citable && (
          <span style={{ fontSize: 10, fontWeight: 800, background: "#dbeafe", color: "#1d4ed8", padding: "2px 7px", borderRadius: 10, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Citable
          </span>
        )}
        <span style={{ color: "var(--text-muted)", fontSize: 14, transition: "transform .15s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
      </div>
      {expanded && (
        <div style={{ padding: "12px 16px 14px", borderTop: "1px solid var(--border)", background: "#f8fafc" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Full Text</div>
          <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0, color: "#374151", whiteSpace: "pre-wrap" }}>{hl(ord.fullText)}</p>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Section: <strong>{ord.section}</strong></span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Code: <strong style={{ fontFamily: "monospace" }}>{ord.code}</strong></span>
            {ord.citable && <span style={{ fontSize: 11, color: "#1d4ed8" }}>✓ May be cited on a citation form</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdinancesPage() {
  const [search, setSearch] = useState("");
  const [filterCitable, setFilterCitable] = useState<"all" | "citable" | "reference">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return getOrdinances().filter((o) => {
      const matchQ = !q
        || o.code.toLowerCase().includes(q)
        || o.title.toLowerCase().includes(q)
        || o.description.toLowerCase().includes(q)
        || o.fullText.toLowerCase().includes(q)
        || o.article.toLowerCase().includes(q);
      const matchFilter = filterCitable === "all" || (filterCitable === "citable" ? o.citable : !o.citable);
      return matchQ && matchFilter;
    });
  }, [search, filterCitable]);

  const filteredArticles = useMemo(
    () => ARTICLES.filter((a) => filtered.some((o) => o.article === a)),
    [filtered],
  );

  const citableCount = getOrdinances().filter((o) => o.citable).length;

  return (
    <AppShell title="${COUNTY_NAME} Animal Ordinances">
      {/* Header banner */}
      <div style={{ background: "#1e3a5f", color: "#fff", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>📖</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Chapter 10 — Animals</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>${COUNTY_NAME}, Georgia Code of Ordinances · {getOrdinances().length} sections · {citableCount} citable violations</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Reference last updated</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Municode Chapter 10</div>
        </div>
      </div>

      {/* Search & filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search-bar" style={{ flex: "1 1 300px", maxWidth: 460 }}>
          <span className="search-icon">🔍</span>
          <input
            className="form-input"
            style={{ paddingLeft: 36, fontSize: 14, padding: "9px 12px 9px 38px" }}
            placeholder="Search by code, title, or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        {(["all", "citable", "reference"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterCitable(f)}
            className={`btn btn-sm ${filterCitable === f ? "btn-primary" : "btn-secondary"}`}
          >
            {f === "all" ? "All Sections" : f === "citable" ? "Citable Only" : "Reference Only"}
          </button>
        ))}
        {search && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ background: "#1d4ed8", color: "#fff", fontFamily: "monospace", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>10-7(l)</span>
          Citable — may appear on a citation form
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ background: "#6b7280", color: "#fff", fontFamily: "monospace", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>10-1</span>
          Reference only — administrative / procedural
        </span>
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 600 }}>No sections match "{search}"</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Try searching by section number, keyword, or article name.</div>
        </div>
      )}

      {/* Articles + sections */}
      {filteredArticles.map((article) => {
        const sections = filtered.filter((o) => o.article === article);
        return (
          <div key={article} style={{ marginBottom: 28 }}>
            <div style={{
              padding: "8px 14px", background: "#f1f5f9", border: "1px solid var(--border)",
              borderRadius: "8px 8px 0 0", borderBottom: "2px solid #0f2942",
              fontWeight: 800, fontSize: 14, color: "#0f2942",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span>{article}</span>
              <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}>
                {sections.length} section{sections.length !== 1 ? "s" : ""}
                {sections.filter((s) => s.citable).length > 0 && ` · ${sections.filter((s) => s.citable).length} citable`}
              </span>
            </div>
            <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 10px 2px" }}>
              {sections.map((ord) => (
                <OrdinanceCard key={ord.code} ord={ord} highlight={search.trim().length >= 2 ? search.trim() : undefined} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div style={{ padding: "14px 18px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e", marginTop: 8 }}>
        <strong>Note:</strong> This is a reference tool only. Always consult the official ${COUNTY_NAME} Code of Ordinances on Municode for authoritative text. Chapter 10 violations are misdemeanors under § 1-9 unless otherwise specified. Each continuing day is a separate offense (§ 10-18).
      </div>
    </AppShell>
  );
}
