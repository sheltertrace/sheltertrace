"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import CitationModal from "./CitationModal";
import DispositionModal, { CitationStatusBadge, CITATION_STATUSES } from "./DispositionModal";
import { fetchCitations, fetchCalls, fetchCourtSettings, markCitationNotified, markCitationEmailSent } from "@/lib/data";
import type { Citation, CourtSettings } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { COURT_MAGISTRATE, COURT_MAGISTRATE_ADDR, COURT_STATE, COURT_STATE_ADDR } from "@/lib/shelterInfo";
import { openCourtEmail } from "@/lib/courtEmail";
import { buildCitationHTML } from "@/lib/citationPrint";
import { useAuth } from "@/app/providers";

function printCitation(cit: Citation) {
  const w = window.open("", "_blank", "width=700,height=900");
  if (!w) return;
  w.document.write(buildCitationHTML(cit));
  w.document.close();
  w.print();
}

const NOTIFY_ROLES = ["Administrator", "Officer", "Field Officer", "Shelter Manager"];

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

export default function CitationsPage() {
  const { user } = useAuth();
  const [citations, setCitations]     = useState<Citation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast, setToast]             = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult]   = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [sortByDate, setSortByDate]   = useState(false);
  const [page, setPage]               = useState(1);
  const [showForm, setShowForm]       = useState(false);
  const [dispCitation, setDispCitation] = useState<Citation | null>(null);
  const [viewCitation, setViewCitation] = useState<Citation | null>(null);
  const [courtSettings, setCourtSettings] = useState<CourtSettings>({ magistrate_email: "", municipal_email: "", portal_url: "https://sheltertrace.com/court" });
  const [notifying, setNotifying]     = useState<string | null>(null);
  const perPage = 15;

  const canNotify = user && (NOTIFY_ROLES.includes(user.role) || (user.permissions as string[])?.includes("admin"));

  const load = useCallback(async () => {
    try {
      const [c, , cs] = await Promise.all([fetchCitations(), fetchCalls(), fetchCourtSettings()]);
      setCitations(c);
      setCourtSettings(cs);
    } catch { } finally { setLoading(false); }
  }, []);

  // Auto-open from URL param ?id=
  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id");
    if (idParam && citations.length > 0) {
      const found = citations.find((c) => c.id === idParam);
      if (found) setViewCitation(found);
    }
  }, [citations, loading]);

  const handleNotifyCourt = useCallback(async (cit: Citation) => {
    const courtType = cit.court_type || "Magistrate";
    const email = (courtType === "State" || courtType === "Municipal") ? courtSettings.municipal_email : courtSettings.magistrate_email;
    if (!email) {
      alert(`No ${courtType} Court email configured. Go to Admin → Court Settings to add one.`);
      return;
    }
    setNotifying(cit.id);
    const opened = openCourtEmail(cit, courtSettings);
    if (opened) {
      await markCitationNotified(cit.id);
      setCitations((prev) => prev.map((c) => c.id === cit.id ? { ...c, court_notified: true, court_notified_at: new Date().toISOString() } : c));
    }
    setNotifying(null);
  }, [courtSettings]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = citations.filter((c) => {
      const matchSearch = !q
        || (c.citation_number || "").toLowerCase().includes(q)
        || (c.violator_name || "").toLowerCase().includes(q)
        || (c.violator_last || "").toLowerCase().includes(q)
        || (c.issuing_officer || "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sortByDate) {
      list = [...list].sort((a, b) => {
        if (!a.court_date && !b.court_date) return 0;
        if (!a.court_date) return 1;
        if (!b.court_date) return -1;
        return a.court_date < b.court_date ? -1 : 1;
      });
    }
    return list;
  }, [citations, search, statusFilter, sortByDate]);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const handleCitationSaved = (cit: Citation) => {
    setCitations((prev) => [cit, ...prev]);
    setShowForm(false);
    showToast(`Citation ${cit.citation_number} issued successfully`);
  };

  const handleDispositionSaved = (updated: Citation) => {
    setCitations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    if (viewCitation?.id === updated.id) setViewCitation(updated);
    setDispCitation(null);
    showToast("Disposition updated");
  };

  const handleSendViolatorEmail = async (cit: Citation) => {
    if (!cit.violator_email) return;
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const courtAddr = cit.court_type === "Magistrate"
        ? COURT_MAGISTRATE_ADDR
        : COURT_STATE_ADDR;
      const courtName = cit.court_type === "Magistrate"
        ? COURT_MAGISTRATE
        : COURT_STATE;
      const res = await fetch("/api/send-citation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          violatorEmail: cit.violator_email,
          violatorName: [cit.violator_last, cit.violator_first].filter(Boolean).join(", ") || cit.violator_name || "",
          citationNumber: cit.citation_number,
          citationDate: cit.date || "",
          violations: cit.violations || [],
          fineAmount: cit.fine_amount,
          dueDate: cit.due_date,
          courtName,
          courtAddress: courtAddr,
          courtDate: cit.court_date,
          courtTime: cit.court_time,
          courtAmPm: cit.court_am_pm,
          officerName: cit.issuing_officer,
          officerBadge: cit.badge_number,
          animalInfo: cit.animal_desc,
          remarks: cit.remarks,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setEmailResult({ id: cit.id, ok: false, msg: json.error || "Email service not configured. Use Print instead." });
      } else {
        await markCitationEmailSent(cit.id);
        setCitations((prev) => prev.map((c) => c.id === cit.id
          ? { ...c, email_sent: true, email_sent_at: new Date().toISOString() } : c));
        if (viewCitation?.id === cit.id) {
          setViewCitation((prev) => prev ? { ...prev, email_sent: true, email_sent_at: new Date().toISOString() } : prev);
        }
        setEmailResult({ id: cit.id, ok: true, msg: "Email sent to " + cit.violator_email });
        showToast("Email sent to " + cit.violator_email);
      }
    } catch (e) {
      setEmailResult({ id: cit.id, ok: false, msg: (e as Error).message || "Failed to send email." });
    } finally { setSendingEmail(false); }
  };

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#16a34a", color: "#fff", borderRadius: 8, padding: "12px 20px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.18)", zIndex: 9999 }}>
          ✓ {toast}
        </div>
      )}
      <AppShell title="Citations" action={<button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Issue Citation</button>}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input className="form-input" style={{ maxWidth: 260 }} placeholder="Search citations…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="form-select" style={{ maxWidth: 160 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="All">All Statuses</option>
            {CITATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button
            className={`btn btn-sm ${sortByDate ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSortByDate((v) => !v)}
            title="Sort by court date"
          >
            📅 Sort by Court Date
          </button>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Issue Citation</button>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Citation #</th><th>Date</th><th>Violator</th><th>Violations</th>
                <th>Officer</th><th>Fine</th><th>Court Date</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={9} className="empty-state">Loading…</td></tr>
                : paged.length === 0
                ? <tr><td colSpan={9} className="empty-state">No citations</td></tr>
                : paged.map((c) => (
                  <tr key={String(c.id)} style={{ cursor: "pointer" }} onClick={() => setViewCitation(c)}>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{c.citation_number}</td>
                    <td style={{ fontSize: 12 }}>{formatDate(c.date)}</td>
                    <td style={{ fontWeight: 600 }}>
                      {c.violator_last
                        ? [c.violator_last, c.violator_first].filter(Boolean).join(", ")
                        : (c.violator_name || "—")}
                    </td>
                    <td style={{ fontSize: 12 }}>{(c.violations || []).length} violation{(c.violations || []).length !== 1 ? "s" : ""}</td>
                    <td style={{ fontSize: 12 }}>{c.issuing_officer || "—"}</td>
                    <td style={{ fontSize: 12, fontWeight: 600 }}>{c.fine_amount ? `$${c.fine_amount}` : "—"}</td>
                    <td style={{ fontSize: 12 }}>{c.court_date ? formatDate(c.court_date) : "—"}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                        <CitationStatusBadge status={c.status || "Issued"} />
                        {c.court_notified && (
                          <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: 10 }} title={c.court_notified_at ? `Notified ${new Date(c.court_notified_at).toLocaleString()}` : undefined}>
                            ✉ Court Notified
                          </span>
                        )}
                        {c.email_sent && (
                          <span className="badge" style={{ background: "#f0fdf4", color: "#15803d", fontSize: 10 }} title={c.email_sent_at ? `Emailed ${new Date(c.email_sent_at).toLocaleString()}` : undefined}>
                            ✉ Violator Emailed
                          </span>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Update Disposition" onClick={() => setDispCitation(c)}>⚖️</button>
                        <button className="btn btn-ghost btn-sm" title="Print Citation" onClick={() => printCitation(c)}>🖨</button>
                        {canNotify && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title={c.court_notified ? "Re-send court notification" : "Notify court"}
                            style={{ color: c.court_notified ? "#6b7280" : "#1d4ed8" }}
                            onClick={() => handleNotifyCourt(c)}
                            disabled={notifying === c.id}
                          >
                            {notifying === c.id ? "…" : "📧"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div style={{ padding: "8px 12px" }}>
            <Pagination total={filtered.length} perPage={perPage} current={page} onChange={setPage} />
          </div>
        </div>
      </AppShell>

      {showForm && <CitationModal onSave={handleCitationSaved} onClose={() => setShowForm(false)} />}
      {dispCitation && (
        <DispositionModal
          citation={dispCitation}
          onSave={handleDispositionSaved}
          onClose={() => setDispCitation(null)}
        />
      )}

      {viewCitation && (
        <div className="modal-overlay" onClick={() => setViewCitation(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Citation #{viewCitation.citation_number}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <CitationStatusBadge status={viewCitation.status || "Issued"} />
                  {viewCitation.issuing_officer && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Officer: {viewCitation.issuing_officer}</span>}
                  {viewCitation.date && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(viewCitation.date)}</span>}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewCitation(null)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              {/* Violator */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Violator Information</div>
                <div className="grid-3" style={{ gap: 8 }}>
                  {[
                    ["Name", [viewCitation.violator_last, viewCitation.violator_first].filter(Boolean).join(", ") || viewCitation.violator_name || "—"],
                    ["DL / ID", viewCitation.violator_dl || "—"],
                    ["DOB", viewCitation.violator_dob || "—"],
                    ["Phone", viewCitation.violator_phone || "—"],
                    ["Email", viewCitation.violator_email || "—"],
                    ["Sex", viewCitation.violator_sex || "—"],
                    ["Hair", viewCitation.desc_hair || "—"],
                    ["Eyes", viewCitation.desc_eyes || "—"],
                    ["Height", viewCitation.desc_height || "—"],
                    ["Weight", viewCitation.desc_weight || "—"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: 13 }}>{v}</div>
                    </div>
                  ))}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Address</div>
                    <div style={{ fontSize: 13 }}>{[viewCitation.violator_address, viewCitation.violator_city, viewCitation.violator_state, viewCitation.violator_zip].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Violations */}
              {(viewCitation.violations?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Violations ({viewCitation.violations!.length})
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Code</th><th>Description</th><th>Count</th></tr></thead>
                    <tbody>
                      {viewCitation.violations!.map((v, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.code}</td>
                          <td style={{ fontSize: 13 }}>{v.description}</td>
                          <td style={{ fontSize: 12 }}>{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Court */}
              {viewCitation.court_date && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Court Information</div>
                  <div className="grid-3" style={{ gap: 8 }}>
                    {[
                      ["Court Type", viewCitation.court_type || "—"],
                      ["Court Date", viewCitation.court_date ? formatDate(viewCitation.court_date) : "—"],
                      ["Court Time", viewCitation.court_time ? `${viewCitation.court_time} ${viewCitation.court_am_pm || ""}`.trim() : "—"],
                      ["Fine Amount", viewCitation.fine_amount ? `$${viewCitation.fine_amount}` : "—"],
                      ["Amount Paid", viewCitation.fine_paid ? `$${viewCitation.fine_paid}` : "—"],
                      ["Animal Impound #", viewCitation.animal_impound || "—"],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 13 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {viewCitation.remarks && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Remarks</div>
                  <div style={{ fontSize: 13, padding: "8px 12px", background: "var(--surface-alt)", borderRadius: 6, border: "1px solid var(--border-light)" }}>{viewCitation.remarks}</div>
                </div>
              )}

              {/* Disposition history */}
              {(viewCitation.disposition_history?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Disposition History</div>
                  {viewCitation.disposition_history!.map((d, i) => (
                    <div key={i} style={{ padding: "8px 12px", border: "1px solid var(--border-light)", borderRadius: 6, marginBottom: 6, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <CitationStatusBadge status={d.status} />
                        {d.notes && <div style={{ marginTop: 4, color: "var(--text-secondary)" }}>{d.notes}</div>}
                        {d.changedBy && <div style={{ marginTop: 2, color: "var(--text-muted)", fontSize: 11 }}>By: {d.changedBy}</div>}
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: 11, flexShrink: 0 }}>{d.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Email result feedback */}
            {emailResult?.id === viewCitation.id && (
              <div style={{ padding: "10px 20px", background: emailResult.ok ? "#f0fdf4" : "#fef2f2", borderTop: "1px solid var(--border-light)", fontSize: 13, color: emailResult.ok ? "#15803d" : "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
                {emailResult.ok ? "✓" : "⚠"} {emailResult.msg}
                {!emailResult.ok && <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => printCitation(viewCitation)}>🖨 Print Instead</button>}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewCitation(null)}>Close</button>
              <button className="btn btn-secondary" onClick={() => { copyToClipboard(`${window.location.origin}/citations?id=${viewCitation.id}`); showToast("Link copied to clipboard"); }}>🔗 Copy Link</button>
              <button className="btn btn-secondary" onClick={() => printCitation(viewCitation)}>🖨 Print / Download</button>
              {viewCitation.violator_email && (
                <button className="btn btn-secondary" onClick={() => handleSendViolatorEmail(viewCitation)} disabled={sendingEmail}>
                  {sendingEmail ? "Sending…" : "✉ Email Violator"}
                </button>
              )}
              <button className="btn btn-primary" onClick={() => { setDispCitation(viewCitation); setViewCitation(null); }}>⚖️ Update Disposition</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
