"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import CitationModal from "./CitationModal";
import DispositionModal, { CitationStatusBadge, CITATION_STATUSES } from "./DispositionModal";
import { fetchCitations, fetchCalls, fetchCourtSettings, markCitationNotified } from "@/lib/data";
import type { Citation, CourtSettings } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { MCAS_SEAL_LOGO } from "@/lib/mcasLogo";
import { openCourtEmail } from "@/lib/courtEmail";
import { useAuth } from "@/app/providers";

function printCitation(cit: Citation) {
  const w = window.open("", "_blank", "width=700,height=900");
  if (!w) return;
  const courtAddr = cit.court_type === "Magistrate" ? "149 E Jefferson St, Covington, GA" : "118 N Main St, Covington, GA";
  const formalName = cit.violator_last
    ? [cit.violator_last, (cit.violator_first || "") + (cit.violator_middle ? ` ${cit.violator_middle.charAt(0).toUpperCase()}.` : "")].filter(Boolean).join(", ")
    : (cit.violator_name || "—");
  const violatorSigHtml = cit.violator_signature
    ? `<img src="${cit.violator_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #aaa"></div>`;
  const officerSigHtml = cit.officer_signature
    ? `<img src="${cit.officer_signature}" style="width:200px;height:50px;object-fit:contain;display:block;margin-bottom:4px" />`
    : `<div style="width:200px;height:50px;border-bottom:1px solid #aaa"></div>`;
  const signedLine = cit.signed_at ? `<div style="font-size:10px;color:#555">Signed: ${cit.signed_at}</div>` : "";
  w.document.write(`
    <html><head><title>Citation ${cit.citation_number}</title>
    <style>
      body{font-family:serif;font-size:11px;padding:20px;margin:0}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #000;padding:4px 6px}
      .section{margin:8px 0;font-weight:bold;font-size:11px;border-bottom:2px solid #000;padding-bottom:2px;text-transform:uppercase}
      @media print{body{padding:12px}}
    </style></head>
    <body>
      <!-- MCAS Header -->
      <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:10px">
        <img src="${MCAS_SEAL_LOGO}" alt="MCAS Seal" style="width:80px;height:80px;object-fit:contain;flex-shrink:0" />
        <div style="flex:1">
          <div style="font-size:16px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px">Morgan County Animal Services</div>
          <div style="font-size:11px;margin-top:2px">2392 Athens Hwy, Madison, GA 30650</div>
          <div style="font-size:11px;margin-top:1px">State of Georgia</div>
          <div style="font-size:12px;font-weight:700;margin-top:4px;font-style:italic">Uniform Citation, Summons, Accusation / Warning</div>
        </div>
        <div style="text-align:right;font-size:11px;flex-shrink:0">
          <div><b>Citation #:</b> ${cit.citation_number || "—"}</div>
          <div style="margin-top:3px"><b>Animal Impound #:</b> ${cit.animal_impound || "—"}</div>
          ${cit.citation_type === "Digital" ? `<div style="margin-top:4px;font-size:10px;color:#1d4ed8">Digital${cit.violator_email ? `<br>${cit.violator_email}` : ""}</div>` : ""}
        </div>
      </div>
      <div class="section">VIOLATOR INFORMATION</div>
      <table>
        <tr><td><b>Name:</b> ${formalName}</td><td><b>DL:</b> ${cit.violator_dl || "—"}</td></tr>
        <tr><td colspan="2"><b>Address:</b> ${[cit.violator_address, cit.violator_city, cit.violator_state, cit.violator_zip].filter(Boolean).join(", ") || "—"}</td></tr>
        <tr><td><b>Phone:</b> ${cit.violator_phone || "—"}</td><td><b>DOB:</b> ${cit.violator_dob || "—"}</td></tr>
        ${cit.violator_email ? `<tr><td colspan="2"><b>Email:</b> ${cit.violator_email}</td></tr>` : ""}
        <tr><td><b>Hair:</b> ${cit.desc_hair || "—"}</td><td><b>Eyes:</b> ${cit.desc_eyes || "—"}</td></tr>
        <tr><td><b>Weight:</b> ${cit.desc_weight || "—"}</td><td><b>Height:</b> ${cit.desc_height || "—"}</td></tr>
      </table>
      <div class="section">VIOLATIONS</div>
      <table>
        <tr><th style="width:55px;text-align:center">Count</th><th style="width:130px">Code Section</th><th>Description</th></tr>
        ${(cit.violations || []).map((v: {code: string; description: string; count: number}) => `<tr><td style="text-align:center;font-weight:bold;font-size:13px">×${v.count ?? 1}</td><td style="font-family:monospace">§ ${v.code}</td><td>${v.description}</td></tr>`).join("")}
      </table>
      <div class="section">ANIMAL DESCRIPTION</div>
      <div>${cit.animal_desc || "—"}</div>
      <div class="section">REMARKS</div>
      <div>${cit.remarks || "—"}</div>
      <div class="section">COURT INFORMATION</div>
      <div><b>Court:</b> ${cit.court_type} Court — ${courtAddr}</div>
      <div><b>Date/Time:</b> ${cit.court_date || "—"} at ${cit.court_time || "—"} ${cit.court_am_pm || ""}</div>
      <div><b>Fine:</b> $${cit.fine_amount || "0.00"} &nbsp; <b>Due:</b> ${cit.due_date || "—"}</div>
      <div class="section">OFFICER</div>
      <div><b>Issuing Officer:</b> ${cit.issuing_officer || "—"} &nbsp; <b>Badge:</b> ${cit.badge_number || "—"}</div>
      <div><b>Served By:</b> ${cit.served_by || "—"} &nbsp; <b>Date:</b> ${cit.date || "—"} &nbsp; <b>Time:</b> ${cit.time || "—"}</div>
      <div style="margin-top:16px;font-size:10px;font-style:italic">My signature acknowledges service of this Summons. I promise to appear in court on the date and time shown above or properly dispose of this case as provided by law.</div>
      <div style="margin-top:12px;width:260px">
        ${violatorSigHtml}
        <div style="border-top:1px solid #000;padding-top:4px">Violator Signature</div>
        ${signedLine}
      </div>
      <div style="margin-top:20px;padding:10px;border:2px solid #000;text-align:center;font-size:11px">
        Failure to appear in court or properly dispose of this case will result in a <b><u>BENCH WARRANT</u></b> being issued for <b><u>CONTEMPT OF COURT</u></b>.
      </div>
      <div style="margin-top:18px;text-align:center;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #000;padding-bottom:4px">Officer's Certification</div>
      <div style="margin-top:8px;font-size:10px">I, the undersigned officer, certify that I personally served the above-named violator with a copy of this Citation and Summons on the date and at the location specified above, and that the foregoing is true and correct to the best of my knowledge and belief.</div>
      <div style="margin-top:14px;display:flex;gap:40px;flex-wrap:wrap">
        <div style="width:220px">
          ${officerSigHtml}
          <div style="border-top:1px solid #000;padding-top:4px">Officer Signature</div>
        </div>
        <div style="min-width:160px">
          <div style="font-size:11px;margin-bottom:4px"><b>Badge #:</b> ${cit.badge_number || "___________"}</div>
          <div style="font-size:11px;margin-bottom:4px"><b>Date:</b> ${cit.date || "___________"}</div>
          <div style="font-size:11px;margin-bottom:4px"><b>Time:</b> ${cit.time || "___________"}</div>
          <div style="font-size:11px"><b>Served By:</b> ${cit.served_by || "___________"}</div>
        </div>
      </div>
    </body></html>
  `);
  w.document.close();
  w.print();
}

const NOTIFY_ROLES = ["Administrator", "Officer", "Field Officer", "Shelter Manager"];

export default function CitationsPage() {
  const { user } = useAuth();
  const [citations, setCitations]     = useState<Citation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
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
    const email = courtType === "Municipal" ? courtSettings.municipal_email : courtSettings.magistrate_email;
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

  const handleCitationSaved = (cit: Citation) => {
    setCitations((prev) => [cit, ...prev]);
    setShowForm(false);
  };

  const handleDispositionSaved = (updated: Citation) => {
    setCitations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setDispCitation(null);
  };

  return (
    <>
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
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewCitation(null)}>Close</button>
              <button className="btn btn-secondary" onClick={() => printCitation(viewCitation)}>🖨 Print</button>
              <button className="btn btn-primary" onClick={() => { setDispCitation(viewCitation); setViewCitation(null); }}>⚖️ Update Disposition</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
