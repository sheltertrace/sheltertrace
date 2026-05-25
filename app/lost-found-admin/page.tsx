"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  fetchLostFoundReports,
  updateLostFoundReport,
  fetchLostFoundMatches,
  updateLostFoundMatch,
} from "@/lib/data";
import type { LostFoundReport, LostFoundMatch } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { safeArray } from "@/lib/data";

type FilterTab = "all" | "lost" | "found" | "matched" | "reunited" | "archived";

const TAB_LABELS: Record<FilterTab, string> = {
  all:      "All",
  lost:     "Lost",
  found:    "Found",
  matched:  "Matched",
  reunited: "Reunited",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: "#dcfce7", color: "#15803d" },
  matched:  { bg: "#fef3c7", color: "#92400e" },
  reunited: { bg: "#dbeafe", color: "#1d4ed8" },
  archived: { bg: "#f1f5f9", color: "#64748b" },
};

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return formatDate(d);
}

function ScoreBadge({ score }: { score?: number }) {
  if (!score) return null;
  const label = score >= 90 ? "Likely" : score >= 70 ? "Strong" : "Potential";
  const bg    = score >= 90 ? "#dc2626" : score >= 70 ? "#f59e0b" : "#3b82f6";
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 10, background: `${bg}20`, color: bg, border: `1px solid ${bg}50` }}>
      {label} ({score})
    </span>
  );
}

export default function LostFoundAdminPage() {
  const [reports, setReports]   = useState<LostFoundReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<LostFoundReport | null>(null);
  const [matches, setMatches]   = useState<LostFoundMatch[]>([]);
  const [staffNotes, setStaffNotes] = useState("");
  const [saving, setSaving]     = useState(false);
  const [reuniteNotes, setReuniteNotes] = useState("");
  const [showReunite, setShowReunite]   = useState(false);

  const load = useCallback(async () => {
    const all = await fetchLostFoundReports({ limit: 500 });
    setReports(all);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openReport(r: LostFoundReport) {
    setSelected(r);
    setStaffNotes(r.staff_notes ?? "");
    setReuniteNotes("");
    setShowReunite(false);
    if (r.id) {
      const m = await fetchLostFoundMatches(r.id);
      setMatches(m);
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const updated = await updateLostFoundReport(selected.id, { status, staff_notes: staffNotes || undefined });
      setSelected(updated);
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } finally { setSaving(false); }
  }

  async function handleReunite() {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const updated = await updateLostFoundReport(selected.id, {
        status: "reunited",
        reunited_date: new Date().toISOString().split("T")[0],
        reunited_notes: reuniteNotes || undefined,
        staff_notes: staffNotes || undefined,
      });
      setSelected(updated);
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setShowReunite(false);
    } finally { setSaving(false); }
  }

  async function handleSaveNotes() {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const updated = await updateLostFoundReport(selected.id, { staff_notes: staffNotes });
      setSelected(updated);
      setReports((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    } finally { setSaving(false); }
  }

  const filtered = useMemo(() => {
    return reports
      .filter((r) => {
        if (filterTab === "all") return true;
        if (filterTab === "lost") return r.type === "lost" && r.status === "active";
        if (filterTab === "found") return r.type === "found" && r.status === "active";
        return r.status === filterTab;
      })
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (r.reporter_name ?? "").toLowerCase().includes(q) ||
          (r.species ?? "").toLowerCase().includes(q) ||
          (r.breed ?? "").toLowerCase().includes(q) ||
          (r.pet_name ?? "").toLowerCase().includes(q) ||
          (r.location_city ?? "").toLowerCase().includes(q)
        );
      });
  }, [reports, filterTab, search]);

  // Stats
  const stats = useMemo(() => ({
    activeLost:    reports.filter((r) => r.type === "lost"  && r.status === "active").length,
    activeFound:   reports.filter((r) => r.type === "found" && r.status === "active").length,
    reunited:      reports.filter((r) => r.status === "reunited").length,
    pendingMatches: 0, // would need a separate query
  }), [reports]);

  return (
    <AppShell
      title="Lost & Found Management"
      action={
        <a href="/lost-found" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          View Public Board →
        </a>
      }
    >
      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: "Active Lost",   value: stats.activeLost,  color: "#dc2626", icon: "🔴" },
            { label: "Active Found",  value: stats.activeFound, color: "#2563eb", icon: "🔵" },
            { label: "Reunited",      value: stats.reunited,    color: "#16a34a", icon: "🏠" },
            { label: "Total Reports", value: reports.length,    color: "#0f2942", icon: "📋" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon" style={{ background: `${color}20` }}><span style={{ fontSize: 20 }}>{icon}</span></div>
              <div>
                <div className="stat-value" style={{ color }}>{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter + Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {(Object.entries(TAB_LABELS) as [FilterTab, string][]).map(([key, label]) => {
              const count = key === "all" ? reports.length
                : key === "lost" ? reports.filter((r) => r.type === "lost" && r.status === "active").length
                : key === "found" ? reports.filter((r) => r.type === "found" && r.status === "active").length
                : reports.filter((r) => r.status === key).length;
              return (
                <div key={key} className={`tab ${filterTab === key ? "active" : ""}`} onClick={() => setFilterTab(key)}>
                  {label} ({count})
                </div>
              );
            })}
          </div>
          <input
            placeholder="Search by name, species, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ maxWidth: 280, marginBottom: 0 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 20, alignItems: "start" }}>
          {/* Report list */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Pet</th>
                  <th>Reporter</th>
                  <th>Location</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="empty-state">Loading…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={7} className="empty-state">No reports in this view</td></tr>
                : filtered.map((r) => {
                  const sc = STATUS_COLORS[r.status ?? "active"] ?? STATUS_COLORS["active"];
                  const photos = safeArray(r.photo_urls);
                  return (
                    <tr key={r.id} style={{ cursor: "pointer", background: selected?.id === r.id ? "#f0fdf4" : undefined }} onClick={() => openReport(r)}>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: r.type === "lost" ? "#fee2e2" : "#dbeafe", color: r.type === "lost" ? "#b91c1c" : "#1d4ed8" }}>
                          {r.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {photos[0] ? <img src={photos[0]} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} /> : <span style={{ fontSize: 24, flexShrink: 0 }}>{r.species === "Dog" ? "🐕" : r.species === "Cat" ? "🐈" : "🐾"}</span>}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.pet_name ? `"${r.pet_name}" · ` : ""}{r.species}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{[r.breed, r.color].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.reporter_name}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.location_city || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtDate(r.date_lost_found)}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: sc.bg, color: sc.color }}>
                          {(r.status ?? "active").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openReport(r); }}>View →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 10, background: selected.type === "lost" ? "#fee2e2" : "#dbeafe", color: selected.type === "lost" ? "#b91c1c" : "#1d4ed8", marginRight: 8 }}>
                      {selected.type.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>
                      {selected.pet_name ? `"${selected.pet_name}"` : selected.species}
                    </span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
                </div>

                {safeArray(selected.photo_urls).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    {safeArray(selected.photo_urls).map((url, i) => (
                      <img key={i} src={url} alt="" style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover" }} />
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 13, marginBottom: 12 }}>
                  {[
                    ["Species", selected.species],
                    ["Breed", selected.breed],
                    ["Color", selected.color],
                    ["Size", selected.size],
                    ["Sex", selected.sex],
                    ["Age", selected.age],
                    ["Microchip", selected.microchip],
                    ["Spayed/Neutered", selected.spayed_neutered],
                  ].map(([l, v]) => v ? (
                    <div key={l}><span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{l}</span><br /><strong>{v}</strong></div>
                  ) : null)}
                </div>

                {selected.distinguishing_features && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, fontStyle: "italic" }}>{selected.distinguishing_features}</div>
                )}

                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10, marginTop: 4, fontSize: 13 }}>
                  <div><strong>{selected.type === "lost" ? "Last seen" : "Found"}:</strong> {fmtDate(selected.date_lost_found)} {selected.time_lost_found ? `at ${selected.time_lost_found}` : ""}</div>
                  <div><strong>Location:</strong> {[selected.location_address, selected.location_city, selected.location_zip].filter(Boolean).join(", ")}</div>
                  {selected.circumstances && <div><strong>Circumstances:</strong> {selected.circumstances}</div>}
                  {selected.current_location && <div><strong>Currently:</strong> {selected.current_location}</div>}
                </div>

                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10, marginTop: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Reporter</div>
                  <div>{selected.reporter_name}</div>
                  <a href={`tel:${selected.reporter_phone}`} style={{ color: "var(--teal)", fontWeight: 700, textDecoration: "none" }}>{selected.reporter_phone}</a>
                  {selected.reporter_email && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{selected.reporter_email}</div>}
                </div>
              </div>

              {/* Matches */}
              {matches.length > 0 && (
                <div className="card">
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Potential Matches ({matches.length})</div>
                  {matches.slice(0,5).map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                      <div>
                        <ScoreBadge score={m.match_score} />
                        <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-secondary)" }}>{m.match_type?.replace(/_/g, " ")}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {m.status === "pending" && (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#16a34a" }} onClick={() => updateLostFoundMatch(m.id!, { status: "confirmed" }).then(load)}>✓ Confirm</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#dc2626" }} onClick={() => updateLostFoundMatch(m.id!, { status: "dismissed" }).then(load)}>✕</button>
                          </>
                        )}
                        {m.status !== "pending" && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.status}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Staff notes + actions */}
              <div className="card">
                <div className="form-group">
                  <label className="form-label">Staff Notes</label>
                  <textarea className="form-input" rows={3} value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} placeholder="Internal notes…" style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveNotes} disabled={saving}>Save Notes</button>
                  {selected.status === "active" && (
                    <>
                      <button className="btn btn-sm" style={{ background: "#16a34a", color: "#fff", borderColor: "#16a34a" }} onClick={() => setShowReunite(true)} disabled={saving}>🏠 Mark Reunited</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateStatus("archived")} disabled={saving}>Archive</button>
                    </>
                  )}
                  {selected.status === "archived" && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateStatus("active")} disabled={saving}>Restore</button>
                  )}
                </div>
              </div>

              {/* Reunite form */}
              {showReunite && (
                <div className="card" style={{ border: "2px solid #16a34a" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🏠 Mark as Reunited</div>
                  <div className="form-group">
                    <label className="form-label">Reunion Notes</label>
                    <textarea className="form-input" rows={2} value={reuniteNotes} onChange={(e) => setReuniteNotes(e.target.value)} placeholder="How were they reunited? Any details…" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowReunite(false)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" style={{ background: "#16a34a", borderColor: "#16a34a" }} onClick={handleReunite} disabled={saving}>
                      {saving ? "Saving…" : "Confirm Reunion"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
