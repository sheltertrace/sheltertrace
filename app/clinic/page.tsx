"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { fetchClinicVisits, updateAnimal, fetchPeople, fetchMedical, type ClinicVisitRecord } from "@/lib/data";
import type { Person, MedicalRecord } from "@/lib/types";
import { today, formatDate, displayAge } from "@/lib/utils";
import { AGENCY_NAME } from "@/lib/shelterInfo";
import { printVisitSummary as printVisitDoc } from "@/lib/visitSummaryPrint";
import ClinicWizard from "@/components/clinic/ClinicWizard";
import CheckoutModal from "@/components/clinic/CheckoutModal";
import DateInput from "@/components/ui/DateInput";

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUEUE_STATUSES = ["Waiting", "In Progress", "Checked Out"] as const;
type QueueStatus = (typeof QUEUE_STATUSES)[number];

const QUEUE_STYLES: Record<QueueStatus, { bg: string; color: string; border: string }> = {
  "Waiting":     { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  "In Progress": { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" },
  "Checked Out": { bg: "#dcfce7", color: "#166534", border: "#86efac" },
};

function elapsed(createdAt?: string): string {
  if (!createdAt) return "";
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function formatDateDisplay(d: string) {
  const dt = new Date(`${d}T12:00:00`);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ── Visit Card ────────────────────────────────────────────────────────────────
function VisitCard({
  visit,
  onUpdateStatus,
  onCheckout,
}: {
  visit: ClinicVisitRecord;
  onUpdateStatus: (v: ClinicVisitRecord, status: QueueStatus) => void;
  onCheckout: (v: ClinicVisitRecord) => void;
}) {
  const queueStatus = (visit.sub_status as QueueStatus) ?? "Waiting";
  const style = QUEUE_STYLES[queueStatus] ?? QUEUE_STYLES["Waiting"];
  const emoji = visit.species === "Dog" ? "🐕" : visit.species === "Cat" ? "🐈" : "🐾";
  const services = visit.services ?? [];

  return (
    <div style={{
      background: "var(--card-bg)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Status bar */}
      <div style={{ height: 4, background: style.border }} />

      <div style={{ padding: "14px 18px" }}>
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 32 }}>{emoji}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text)", lineHeight: 1.2 }}>{visit.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {visit.species} · {visit.breed || "Unknown breed"} · {visit.sex}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {visit.id} · checked in {elapsed(visit.created_at)}
              </div>
            </div>
          </div>
          <span style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
            background: style.bg, color: style.color, border: `1px solid ${style.border}`,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {queueStatus}
          </span>
        </div>

        {/* Owner */}
        {visit.ownerName && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8, color: "var(--text)" }}>
            <span style={{ color: "var(--text-secondary)" }}>👤</span>
            <strong>{visit.ownerName}</strong>
            {visit.ownerPhone && <span style={{ color: "var(--text-secondary)" }}>· {visit.ownerPhone}</span>}
          </div>
        )}

        {/* Services */}
        {services.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {services.map((s) => (
              <span key={s.id} style={{
                padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: "#f0fdfa", color: "#0d9488", border: "1px solid #99f6e4",
              }}>
                {s.description || s.type}
              </span>
            ))}
          </div>
        )}

        {/* Chief complaint */}
        {visit.injuries && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, fontStyle: "italic" }}>
            "{visit.injuries}"
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border-light)", paddingTop: 10 }}>
          {queueStatus === "Waiting" && (
            <button
              className="btn btn-sm"
              style={{ background: "#2563eb", borderColor: "#2563eb", color: "#fff" }}
              onClick={() => onUpdateStatus(visit, "In Progress")}
            >
              ▶ Start Visit
            </button>
          )}
          {queueStatus === "In Progress" && (
            <>
              <button
                className="btn btn-sm"
                style={{ background: "#0d9488", borderColor: "#0d9488", color: "#fff" }}
                onClick={() => onCheckout(visit)}
              >
                🧾 Complete &amp; Checkout
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onUpdateStatus(visit, "Waiting")}
              >
                ← Back to Waiting
              </button>
            </>
          )}
          {queueStatus === "Checked Out" && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onCheckout(visit)}
            >
              🧾 View / Reprint Receipt
            </button>
          )}
          <a
            href={`/animals/${visit.id}`}
            style={{ marginLeft: "auto", color: "var(--teal)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}
          >
            View Record →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const APPT_TYPES = ["Wellness", "Surgery", "Dental", "Spay/Neuter", "Vaccination", "Follow-up", "Other"];
const PAST_PAGE_SIZE = 25;

function fmtD(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return m && day ? `${m}/${day}/${y}` : d;
}

export default function ClinicPage() {
  const [tab, setTab] = useState<"queue" | "past">("queue");
  const [date, setDate] = useState<string>(today());
  const [visits, setVisits] = useState<ClinicVisitRecord[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<ClinicVisitRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState<QueueStatus | "All">("All");

  // Past visits state
  const [pastVisits, setPastVisits] = useState<ClinicVisitRecord[]>([]);
  const [pastMedical, setPastMedical] = useState<MedicalRecord[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastSearch, setPastSearch] = useState("");
  const [pastTypeFilter, setPastTypeFilter] = useState("all");
  const [pastDateFrom, setPastDateFrom] = useState("");
  const [pastDateTo, setPastDateTo] = useState("");
  const [pastSort, setPastSort] = useState<"recent" | "name" | "type">("recent");
  const [pastPage, setPastPage] = useState(0);
  const [pastDetail, setPastDetail] = useState<ClinicVisitRecord | null>(null);

  const load = useCallback(async () => {
    const [v, p] = await Promise.all([
      fetchClinicVisits(date),
      people.length === 0 ? fetchPeople() : Promise.resolve(people),
    ]);
    setVisits(v);
    if (people.length === 0) setPeople(p);
    setLoading(false);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Load past visits when tab changes
  useEffect(() => {
    if (tab !== "past" || pastVisits.length > 0) return;
    setPastLoading(true);
    Promise.all([
      (async () => {
        const allDates: ClinicVisitRecord[] = [];
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
        for (let d = new Date(); d.toISOString().split("T")[0] >= ninetyDaysAgo; d.setDate(d.getDate() - 1)) {
          const ds = d.toISOString().split("T")[0];
          const v = await fetchClinicVisits(ds);
          allDates.push(...v.filter((x) => x.sub_status === "Checked Out"));
        }
        return allDates;
      })(),
      fetchMedical(),
    ]).then(([pv, med]) => {
      setPastVisits(pv);
      setPastMedical(med);
    }).finally(() => setPastLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const pastFiltered = useMemo(() => {
    let list = pastVisits;
    if (pastSearch.trim()) {
      const q = pastSearch.toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q) || (v.breed || "").toLowerCase().includes(q));
    }
    if (pastDateFrom) list = list.filter((v) => (v.intake_date || "") >= pastDateFrom);
    if (pastDateTo) list = list.filter((v) => (v.intake_date || "") <= pastDateTo);
    if (pastSort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (pastSort === "type") list = [...list].sort((a, b) => (a.species || "").localeCompare(b.species || ""));
    return list;
  }, [pastVisits, pastSearch, pastTypeFilter, pastDateFrom, pastDateTo, pastSort]);

  const pastPaged = pastFiltered.slice(pastPage * PAST_PAGE_SIZE, (pastPage + 1) * PAST_PAGE_SIZE);
  const pastTotalPages = Math.ceil(pastFiltered.length / PAST_PAGE_SIZE);

  function getMedForVisit(v: ClinicVisitRecord): MedicalRecord[] {
    return pastMedical.filter((m) => m.animal_id === v.id && m.date === v.intake_date).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  function printPastVisitSummary(v: ClinicVisitRecord) {
    const med = getMedForVisit(v);
    printVisitDoc({
      clinicName: AGENCY_NAME,
      clinicSubtitle: "Clinic Visit Summary",
      animalName: v.name,
      animalDetail: `${v.species || "—"} · ${v.breed || "—"} · ${v.sex || "—"} · ${displayAge(v.age)}`,
      animalId: v.id,
      visitDate: v.intake_date || "",
      medRecords: med,
    });
  }

  async function handleUpdateStatus(visit: ClinicVisitRecord, status: QueueStatus) {
    await updateAnimal(visit.id, { sub_status: status });
    setVisits((prev) => prev.map((v) => v.id === visit.id ? { ...v, sub_status: status } : v));
  }

  // Status counts
  const counts = {
    "Waiting":     visits.filter((v) => v.sub_status === "Waiting").length,
    "In Progress": visits.filter((v) => v.sub_status === "In Progress").length,
    "Checked Out": visits.filter((v) => v.sub_status === "Checked Out").length,
  };

  const displayVisits = filterStatus === "All"
    ? visits
    : visits.filter((v) => v.sub_status === filterStatus);

  const isToday = date === today();

  return (
    <AppShell
      title="Clinic"
      action={
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowWizard(true)}
          style={{ background: "#0d9488", borderColor: "#0d9488" }}
        >
          + New Check-In
        </button>
      }
    >
      <div style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
          {([["queue", "💉 Today's Queue"], ["past", "🗂️ Past Visits"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 18px", border: "none", background: "none", fontSize: 13, cursor: "pointer",
              fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--teal)" : "var(--text-secondary)",
              borderBottom: tab === id ? "2px solid var(--teal)" : "2px solid transparent",
            }}>{label}</button>
          ))}
        </div>

        {tab === "queue" && <>
        {/* Date picker */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() - 1); setDate(d.toISOString().split("T")[0]); }}
            >
              ←
            </button>
            <DateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: 14, background: "var(--bg)" }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]); }}
            >
              →
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
            {formatDateDisplay(date)}{isToday ? " — Today" : ""}
          </div>
          {!isToday && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(today())}>Jump to Today</button>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {(["Waiting", "In Progress", "Checked Out"] as QueueStatus[]).map((s) => {
            const st = QUEUE_STYLES[s];
            return (
              <div
                key={s}
                onClick={() => setFilterStatus((prev) => prev === s ? "All" : s)}
                style={{
                  background: filterStatus === s ? st.bg : "var(--bg-alt)",
                  border: `2px solid ${filterStatus === s ? st.border : "var(--border)"}`,
                  borderRadius: 10, padding: "12px 20px", cursor: "pointer", minWidth: 120,
                  textAlign: "center", transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 800, color: filterStatus === s ? st.color : "var(--text)" }}>
                  {counts[s]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: filterStatus === s ? st.color : "var(--text-secondary)" }}>{s}</div>
              </div>
            );
          })}
          <div style={{ background: "var(--bg-alt)", border: "2px solid var(--border)", borderRadius: 10, padding: "12px 20px", minWidth: 90, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>{visits.length}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Total</div>
          </div>
        </div>

        {/* Queue */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💉</div>
            <div>Loading…</div>
          </div>
        ) : visits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
              No clinic visits {isToday ? "today" : `for ${formatDate(date)}`}
            </div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>
              {isToday ? "Use the \"New Check-In\" button to add the first visit." : "No records found for this date."}
            </div>
            {isToday && (
              <button
                className="btn btn-primary"
                onClick={() => setShowWizard(true)}
                style={{ background: "#0d9488", borderColor: "#0d9488" }}
              >
                + New Check-In
              </button>
            )}
          </div>
        ) : displayVisits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 14 }}>
            No visits with status &ldquo;{filterStatus}&rdquo; — <button className="btn btn-ghost btn-sm" onClick={() => setFilterStatus("All")}>Show all</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Group by queue status */}
            {(["In Progress", "Waiting", "Checked Out"] as QueueStatus[]).map((s) => {
              const group = displayVisits.filter((v) => (v.sub_status ?? "Waiting") === s);
              if (group.length === 0) return null;
              const st = QUEUE_STYLES[s];
              return (
                <div key={s}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: st.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    {s} ({group.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {group.map((v) => (
                      <VisitCard
                        key={v.id}
                        visit={v}
                        onUpdateStatus={handleUpdateStatus}
                        onCheckout={setCheckoutVisit}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>}

        {tab === "past" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input className="form-input" placeholder="Search animal name or ID…" value={pastSearch} onChange={(e) => { setPastSearch(e.target.value); setPastPage(0); }} style={{ maxWidth: 260 }} />
              <DateInput className="form-input" value={pastDateFrom} onChange={(e) => { setPastDateFrom(e.target.value); setPastPage(0); }} style={{ maxWidth: 130 }} />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>to</span>
              <DateInput className="form-input" value={pastDateTo} onChange={(e) => { setPastDateTo(e.target.value); setPastPage(0); }} style={{ maxWidth: 130 }} />
              <select className="form-select" value={pastSort} onChange={(e) => setPastSort(e.target.value as typeof pastSort)} style={{ maxWidth: 130 }}>
                <option value="recent">Most Recent</option>
                <option value="name">Animal Name</option>
                <option value="type">Species</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPastSearch(""); setPastDateFrom(""); setPastDateTo(""); setPastSort("recent"); setPastPage(0); }}>Clear</button>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pastFiltered.length} visit{pastFiltered.length !== 1 ? "s" : ""}</span>
            </div>

            {pastLoading ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading past visits…</div> : (
              <div className="card" style={{ padding: 0, overflow: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Animal</th><th>Species / Breed</th><th>Services</th><th></th></tr></thead>
                  <tbody>
                    {pastPaged.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>No completed visits found</td></tr>
                    ) : pastPaged.map((v) => {
                      const med = getMedForVisit(v);
                      const svc = med.length > 0 ? med.slice(0, 2).map((m) => m.description || m.type).join(", ") + (med.length > 2 ? ` +${med.length - 2}` : "") : "—";
                      return (
                        <tr key={`${v.id}-${v.intake_date}`}>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtD(v.intake_date)}</td>
                          <td><a href={`/animals/${v.id}`} style={{ fontWeight: 700, color: "var(--teal)", textDecoration: "none" }}>{v.name}</a></td>
                          <td style={{ fontSize: 12 }}>{v.species || "—"} · {v.breed || "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{svc}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setPastDetail(v)}>View</button>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printPastVisitSummary(v)}>🖨</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pastTotalPages > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
                <button className="btn btn-ghost btn-sm" disabled={pastPage === 0} onClick={() => setPastPage((p) => p - 1)}>← Prev</button>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Page {pastPage + 1} of {pastTotalPages}</span>
                <button className="btn btn-ghost btn-sm" disabled={pastPage >= pastTotalPages - 1} onClick={() => setPastPage((p) => p + 1)}>Next →</button>
              </div>
            )}

            {/* Detail modal */}
            {pastDetail && (() => {
              const med = getMedForVisit(pastDetail);
              return (
                <div className="modal-overlay" onClick={() => setPastDetail(null)}>
                  <div className="modal modal-lg" style={{ maxWidth: 560, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <span className="modal-title">Visit — {pastDetail.name} ({fmtD(pastDetail.intake_date)})</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => setPastDetail(null)}>✕</button>
                    </div>
                    <div className="modal-body">
                      <div className="grid-2" style={{ marginBottom: 12 }}>
                        <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Animal</div><div style={{ fontWeight: 700, fontSize: 14 }}>{pastDetail.name}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{pastDetail.species} · {pastDetail.breed} · {pastDetail.sex} · {displayAge(pastDetail.age)}</div></div>
                        <div><div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Visit Date</div><div style={{ fontWeight: 700, fontSize: 14 }}>{fmtD(pastDetail.intake_date)}</div><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>ID: {pastDetail.id}</div></div>
                      </div>
                      {med.length > 0 ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)", marginBottom: 6 }}>💊 Services ({med.length})</div>
                          {med.map((m) => (
                            <div key={m.id} style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                              <div><span style={{ fontWeight: 600 }}>{m.type}</span> — {m.description || "—"}{m.test_result ? ` → ${m.test_result}` : ""}</div>
                              <span style={{ color: "var(--text-muted)" }}>{m.vet || "—"}</span>
                            </div>
                          ))}
                        </div>
                      ) : <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 16, fontSize: 13 }}>No medical records for this visit.</div>}
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={() => printPastVisitSummary(pastDetail)}>🖨 Print</button>
                      <button className="btn btn-secondary" onClick={() => setPastDetail(null)}>Close</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Modals */}
      {showWizard && (
        <ClinicWizard
          people={people}
          onComplete={() => { setShowWizard(false); load(); }}
          onClose={() => setShowWizard(false)}
        />
      )}
      {checkoutVisit && (
        <CheckoutModal
          visit={checkoutVisit}
          onComplete={() => { setCheckoutVisit(null); load(); }}
          onClose={() => setCheckoutVisit(null)}
        />
      )}
    </AppShell>
  );
}
