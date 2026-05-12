"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import { fetchPeople, fetchCalls, fetchAnimals, fetchCitations, createPerson } from "@/lib/data";
import type { Person, DispatchCall, Animal, Citation } from "@/lib/types";
import { PERSON_ROLES } from "@/lib/constants";
import { formatDate, today } from "@/lib/utils";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import type { AamvaData } from "@/lib/parseAamva";

type Tab = "people" | "address" | "animals" | "calls";

// ── Address lookup result shape ───────────────────────────────────────────────
interface AddrResult {
  kind: "person" | "call" | "animal" | "citation";
  id: string;
  label: string;
  sub: string;
  href: string;
  date?: string;
  badge?: string;
  badgeColor?: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("people");

  // ── People tab ──────────────────────────────────────────────────────────────
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [peoplePage, setPeoplePage] = useState(1);
  const perPage = 15;
  const [showAdd, setShowAdd] = useState(false);
  const [npFirst, setNpFirst] = useState("");
  const [npMid, setNpMid] = useState("");
  const [npLast, setNpLast] = useState("");
  const [npRole, setNpRole] = useState("Contact");
  const [npPhone, setNpPhone] = useState("");
  const [npEmail, setNpEmail] = useState("");
  const [npAddress, setNpAddress] = useState("");
  const [npCity, setNpCity] = useState("");
  const [npState, setNpState] = useState("GA");
  const [npZip, setNpZip] = useState("");
  const [saving, setSaving] = useState(false);
  const [npScanSuccess, setNpScanSuccess] = useState(false);

  const loadPeople = useCallback(async () => {
    if (peopleLoaded) return;
    setPeopleLoading(true);
    try { const p = await fetchPeople(); setPeople(p); setPeopleLoaded(true); }
    finally { setPeopleLoading(false); }
  }, [peopleLoaded]);

  useEffect(() => { if (tab === "people") loadPeople(); }, [tab, loadPeople]);
  useEffect(() => setPeoplePage(1), [search, filterRole]);

  const hasPeopleSearch = search.trim().length > 0 || filterRole !== "All";
  const filteredPeople = useMemo(() => {
    if (!hasPeopleSearch) return [];
    return people.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
        || (p.phone || "").includes(q)
        || (p.email || "").toLowerCase().includes(q)
        || (p.pid || "").toLowerCase().includes(q);
      return matchSearch && (filterRole === "All" || p.role === filterRole);
    });
  }, [people, search, filterRole, hasPeopleSearch]);
  const pagedPeople = filteredPeople.slice((peoplePage - 1) * perPage, peoplePage * perPage);
  const existingRoles = useMemo(() => ["All", ...Array.from(new Set(people.map((p) => p.role).filter(Boolean)))], [people]);

  const handleAdd = async () => {
    if (!npFirst.trim() || !npLast.trim()) return;
    setSaving(true);
    try {
      const p = await createPerson({ first_name: npFirst.trim(), middle_name: npMid.trim() || undefined, last_name: npLast.trim(), role: npRole, phone: npPhone, email: npEmail, address: npAddress, city: npCity, state: npState, zip: npZip, date_added: today() });
      setPeople((prev) => [p, ...prev]);
      setShowAdd(false);
      setNpFirst(""); setNpMid(""); setNpLast(""); setNpPhone(""); setNpEmail(""); setNpAddress(""); setNpCity(""); setNpZip("");
    } catch { } finally { setSaving(false); }
  };

  // ── Address lookup tab ──────────────────────────────────────────────────────
  const [addrQuery, setAddrQuery] = useState("");
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrResults, setAddrResults] = useState<AddrResult[] | null>(null);
  const [allCalls, setAllCalls] = useState<DispatchCall[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [allCitations, setAllCitations] = useState<Citation[]>([]);
  const [addrDataLoaded, setAddrDataLoaded] = useState(false);

  const loadAddrData = useCallback(async () => {
    if (addrDataLoaded) return;
    setAddrLoading(true);
    try {
      const [p, c, a, cit] = await Promise.all([fetchPeople(), fetchCalls(), fetchAnimals(), fetchCitations()]);
      setPeople(p); setPeopleLoaded(true);
      setAllCalls(c); setAllAnimals(a); setAllCitations(cit);
      setAddrDataLoaded(true);
    } finally { setAddrLoading(false); }
  }, [addrDataLoaded]);

  useEffect(() => { if (tab === "address") loadAddrData(); }, [tab, loadAddrData]);

  const handleAddrSearch = () => {
    const q = addrQuery.trim().toLowerCase();
    if (q.length < 3) return;
    const results: AddrResult[] = [];

    people.filter((p) => (p.address || "").toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q)).forEach((p) => {
      results.push({
        kind: "person", id: p.id,
        label: `${p.first_name} ${p.last_name}`,
        sub: [p.address, p.city, p.state].filter(Boolean).join(", "),
        href: `/people/${p.id}`,
        date: p.date_added,
        badge: p.role, badgeColor: "#f1f5f9",
      });
    });

    allCalls.filter((c) => (c.address || "").toLowerCase().includes(q) || (c.city || "").toLowerCase().includes(q)).forEach((c) => {
      results.push({
        kind: "call", id: c.id,
        label: `${c.type} — ${c.id}`,
        sub: [c.address, c.city].filter(Boolean).join(", "),
        href: `/dispatch/${c.id}`,
        date: c.date_reported,
        badge: c.status, badgeColor: "#e0f2fe",
      });
    });

    allAnimals.filter((a) => (a.found_address || "").toLowerCase().includes(q) || (a.found_city || "").toLowerCase().includes(q)).forEach((a) => {
      results.push({
        kind: "animal", id: a.id,
        label: `${a.name || "Unnamed"} (${a.species || "Animal"}) — ${a.id}`,
        sub: [a.found_address, a.found_city].filter(Boolean).join(", ") || "No address on file",
        href: `/animals/${a.id}`,
        date: a.intake_date,
        badge: a.status, badgeColor: "#f0fdf4",
      });
    });

    allCitations.filter((c) => (c.location || "").toLowerCase().includes(q) || (c.violator_address || "").toLowerCase().includes(q)).forEach((c) => {
      results.push({
        kind: "citation", id: String(c.id),
        label: `Citation ${c.citation_number || c.id} — ${c.violator_name || "Unknown"}`,
        sub: c.location || [c.violator_address, c.violator_city].filter(Boolean).join(", ") || "No location",
        href: `/citations`,
        date: c.date,
        badge: c.status, badgeColor: "#fef9c3",
      });
    });

    setAddrResults(results);
  };

  // ── Animal lookup tab ───────────────────────────────────────────────────────
  const [animalQuery, setAnimalQuery] = useState("");
  const [animalsLoaded, setAnimalsLoaded] = useState(false);

  useEffect(() => {
    if (tab === "animals" && !animalsLoaded && !addrDataLoaded) {
      fetchAnimals().then((a) => { setAllAnimals(a); setAnimalsLoaded(true); });
    } else if (tab === "animals" && addrDataLoaded) {
      setAnimalsLoaded(true);
    }
  }, [tab, animalsLoaded, addrDataLoaded]);

  const filteredAnimals = useMemo(() => {
    const q = animalQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return allAnimals.filter((a) =>
      (a.id || "").toLowerCase().includes(q)
      || (a.name || "").toLowerCase().includes(q)
      || (a.microchip || "").toLowerCase().includes(q)
      || (a.rabies_tag || "").toLowerCase().includes(q)
    );
  }, [allAnimals, animalQuery]);

  // ── Call lookup tab ──────────────────────────────────────────────────────────
  const [callQuery, setCallQuery] = useState("");
  const [callDateFrom, setCallDateFrom] = useState("");
  const [callDateTo, setCallDateTo] = useState("");
  const [callsLoaded, setCallsLoaded] = useState(false);

  useEffect(() => {
    if (tab === "calls" && !callsLoaded && !addrDataLoaded) {
      fetchCalls().then((c) => { setAllCalls(c); setCallsLoaded(true); });
    } else if (tab === "calls" && addrDataLoaded) {
      setCallsLoaded(true);
    }
  }, [tab, callsLoaded, addrDataLoaded]);

  const filteredCalls = useMemo(() => {
    const q = callQuery.trim().toLowerCase();
    if (!q && !callDateFrom && !callDateTo) return [];
    return allCalls.filter((c) => {
      const matchQ = !q
        || (c.id || "").toLowerCase().includes(q)
        || (c.address || "").toLowerCase().includes(q)
        || (c.caller || "").toLowerCase().includes(q)
        || (c.type || "").toLowerCase().includes(q);
      const matchFrom = !callDateFrom || (c.date_reported || "") >= callDateFrom;
      const matchTo = !callDateTo || (c.date_reported || "") <= callDateTo;
      return matchQ && matchFrom && matchTo;
    });
  }, [allCalls, callQuery, callDateFrom, callDateTo]);

  // ── Shared UI helpers ─────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "people", label: "People & Contacts", icon: "👥" },
    { id: "address", label: "Address Lookup", icon: "📍" },
    { id: "animals", label: "Animal Lookup", icon: "🐾" },
    { id: "calls", label: "Call Lookup", icon: "📡" },
  ];

  const KIND_ICONS: Record<string, string> = { person: "👤", call: "📡", animal: "🐾", citation: "📋" };
  const KIND_LABELS: Record<string, string> = { person: "Person", call: "Dispatch Call", animal: "Animal", citation: "Citation" };

  return (
    <AppShell
      title="Search & Lookup"
      action={tab === "people" ? <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Contact</button> : undefined}
    >
      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <div key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </div>
        ))}
      </div>

      {/* ── TAB 1: People ─────────────────────────────────────────────────────── */}
      {tab === "people" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div className="search-bar" style={{ flex: "1 1 300px", maxWidth: 400 }}>
              <span className="search-icon">🔍</span>
              <input
                className="form-input"
                style={{ paddingLeft: 32, fontSize: 15, padding: "10px 12px 10px 36px" }}
                placeholder="Search by name, PID, phone, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {existingRoles.map((r) => (
              <button key={r} onClick={() => setFilterRole(r)} className={`btn btn-sm ${filterRole === r ? "btn-primary" : "btn-secondary"}`}>{r}</button>
            ))}
          </div>

          {!hasPeopleSearch ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Search to find contacts</div>
              <div style={{ fontSize: 13 }}>Type a name, PID, phone number, or email to search the contacts database.</div>
              {peopleLoaded && <div style={{ fontSize: 12, marginTop: 12 }}>{people.length} total contacts on record</div>}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>PID</th><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Address</th><th style={{ textAlign: "center" }}>Photo ID</th><th>Date Added</th></tr></thead>
                  <tbody>
                    {peopleLoading ? (
                      <tr><td colSpan={8} className="empty-state">Loading…</td></tr>
                    ) : pagedPeople.length === 0 ? (
                      <tr><td colSpan={8} className="empty-state">No contacts match your search</td></tr>
                    ) : pagedPeople.map((p) => (
                      <tr key={p.id} onClick={() => router.push(`/people/${p.id}`)} style={{ cursor: "pointer" }}>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{p.pid}</td>
                        <td style={{ fontWeight: 700 }}>{p.first_name} {p.last_name}</td>
                        <td><span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>{p.role}</span></td>
                        <td style={{ fontSize: 12 }}>{p.phone || "—"}</td>
                        <td style={{ fontSize: 12 }}>{p.email || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{[p.address, p.city, p.state].filter(Boolean).join(", ") || "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          {p.photo_id_url
                            ? <span title="Photo ID on file" style={{ fontSize: 16, cursor: "default" }}>🪪</span>
                            : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                          }
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(p.date_added)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "8px 12px" }}>
                <Pagination total={filteredPeople.length} perPage={perPage} current={peoplePage} onChange={setPeoplePage} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Address Lookup ─────────────────────────────────────────────── */}
      {tab === "address" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 560 }}>
              <span className="search-icon">📍</span>
              <input
                className="form-input"
                style={{ paddingLeft: 36, fontSize: 15, padding: "10px 12px 10px 40px" }}
                placeholder="Type a street address, city, or zip code…"
                value={addrQuery}
                onChange={(e) => setAddrQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddrSearch()}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={handleAddrSearch} disabled={addrQuery.trim().length < 3 || addrLoading}>
              {addrLoading ? "Loading…" : "Search"}
            </button>
          </div>

          {addrResults === null ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Address History Lookup</div>
              <div style={{ fontSize: 13, maxWidth: 460, margin: "0 auto" }}>
                Search any address to see all people, dispatch calls, animals, and citations linked to that location.
              </div>
            </div>
          ) : addrResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontWeight: 600 }}>No records found for "{addrQuery}"</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Try a partial address or street name.</div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14, fontSize: 13, color: "var(--text-secondary)" }}>
                <strong>{addrResults.length} record{addrResults.length !== 1 ? "s" : ""}</strong> found for "{addrQuery}"
                {" · "}
                {(["person","call","animal","citation"] as const).map((k) => {
                  const n = addrResults.filter((r) => r.kind === k).length;
                  return n > 0 ? <span key={k} style={{ marginRight: 10 }}>{KIND_ICONS[k]} {n} {KIND_LABELS[k]}{n !== 1 ? "s" : ""}</span> : null;
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {addrResults.map((r) => (
                  <div
                    key={`${r.kind}-${r.id}`}
                    onClick={() => router.push(r.href)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
                    className="table-row-hover"
                  >
                    <div style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{KIND_ICONS[r.kind]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>{r.sub}</div>
                    </div>
                    {r.badge && (
                      <span className="badge" style={{ background: r.badgeColor || "#f1f5f9", color: "#374151", flexShrink: 0 }}>{r.badge}</span>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                      {r.kind === "person" ? "Person" : r.kind === "call" ? "Dispatch Call" : r.kind === "animal" ? "Animal" : "Citation"}
                      {r.date ? ` · ${formatDate(r.date)}` : ""}
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 16 }}>→</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── TAB 3: Animal Lookup ──────────────────────────────────────────────── */}
      {tab === "animals" && (
        <>
          <div className="search-bar" style={{ maxWidth: 500, marginBottom: 16 }}>
            <span className="search-icon">🐾</span>
            <input
              className="form-input"
              style={{ paddingLeft: 36, fontSize: 15, padding: "10px 12px 10px 40px" }}
              placeholder="Search by ID, name, microchip #, or rabies tag…"
              value={animalQuery}
              onChange={(e) => setAnimalQuery(e.target.value)}
              autoFocus
            />
          </div>

          {animalQuery.trim().length < 2 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Animal Lookup</div>
              <div style={{ fontSize: 13 }}>Search by animal ID, name, microchip number, or rabies tag.</div>
              {allAnimals.length > 0 && <div style={{ fontSize: 12, marginTop: 12 }}>{allAnimals.length} animals on record</div>}
            </div>
          ) : filteredAnimals.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>No animals match "{animalQuery}"</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>ID</th><th>Name</th><th>Species</th><th>Breed</th><th>Microchip</th><th>Rabies Tag</th><th>Status</th><th>Kennel</th></tr></thead>
                <tbody>
                  {filteredAnimals.map((a) => (
                    <tr key={a.id} onClick={() => router.push(`/animals/${a.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.id}</td>
                      <td style={{ fontWeight: 700 }}>{a.name || "Unnamed"}</td>
                      <td style={{ fontSize: 12 }}>{a.species}</td>
                      <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                      <td style={{ fontSize: 12, fontFamily: "monospace" }}>{a.microchip || "—"}</td>
                      <td style={{ fontSize: 12 }}>{a.rabies_tag || "—"}</td>
                      <td><span className="badge" style={{ background: "#f1f5f9", color: "#475569" }}>{a.status}</span></td>
                      <td style={{ fontSize: 12 }}>{a.kennel || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB 4: Call Lookup ────────────────────────────────────────────────── */}
      {tab === "calls" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="search-bar" style={{ flex: "1 1 260px", maxWidth: 400 }}>
              <span className="search-icon">📡</span>
              <input
                className="form-input"
                style={{ paddingLeft: 36, fontSize: 15, padding: "10px 12px 10px 40px" }}
                placeholder="Call #, address, caller name, or type…"
                value={callQuery}
                onChange={(e) => setCallQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>From Date</label>
              <input className="form-input" type="date" value={callDateFrom} onChange={(e) => setCallDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>To Date</label>
              <input className="form-input" type="date" value={callDateTo} onChange={(e) => setCallDateTo(e.target.value)} />
            </div>
            {(callQuery || callDateFrom || callDateTo) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setCallQuery(""); setCallDateFrom(""); setCallDateTo(""); }}>Clear</button>
            )}
          </div>

          {!callQuery && !callDateFrom && !callDateTo ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Call Lookup</div>
              <div style={{ fontSize: 13 }}>Search by call number, address, caller name, or filter by date range.</div>
              {allCalls.length > 0 && <div style={{ fontSize: 12, marginTop: 12 }}>{allCalls.length} calls on record</div>}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>No calls match the search criteria</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>Call #</th><th>Type</th><th>Address</th><th>Jurisdiction</th><th>Caller</th><th>Status</th><th>Officers</th><th>Date</th></tr></thead>
                <tbody>
                  {filteredCalls.map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/dispatch/${c.id}`)} style={{ cursor: "pointer" }}>
                      <td style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{c.id}</td>
                      <td style={{ fontWeight: 600 }}>{c.type}</td>
                      <td style={{ fontSize: 12 }}>{c.address || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.city || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.caller || "Anonymous"}</td>
                      <td><span className="badge" style={{ background: "#e0f2fe", color: "#0369a1" }}>{c.status}</span></td>
                      <td style={{ fontSize: 12 }}>{(c.assigned_officers || []).map((o) => o.name).join(", ") || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.date_reported)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Add Contact Modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Contact</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <ScanLicenseButton
                  label="📷 Scan Driver's License"
                  style={{ fontSize: 14, padding: "8px 16px" }}
                  onScan={(d: AamvaData) => {
                    if (d.firstName)  setNpFirst(d.firstName);
                    if (d.middleName) setNpMid(d.middleName);
                    if (d.lastName)   setNpLast(d.lastName);
                    if (d.address)    setNpAddress(d.address);
                    if (d.city)       setNpCity(d.city);
                    if (d.state)      setNpState(d.state);
                    if (d.zip)        setNpZip(d.zip);
                    setNpScanSuccess(true);
                    setTimeout(() => setNpScanSuccess(false), 6000);
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>or fill in manually below</span>
              </div>
              {npScanSuccess && (
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 13, color: "#15803d", display: "flex", alignItems: "center", gap: 8 }}>
                  ✓ License scanned successfully — please verify the information below
                </div>
              )}
              <div className="grid-2">
                <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={npFirst} onChange={(e) => setNpFirst(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Middle Name</label><input className="form-input" value={npMid} onChange={(e) => setNpMid(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Last Name *</label><input className="form-input" value={npLast} onChange={(e) => setNpLast(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={npRole} onChange={(e) => setNpRole(e.target.value)}>{PERSON_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={npEmail} onChange={(e) => setNpEmail(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={npAddress} onChange={(e) => setNpAddress(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={npCity} onChange={(e) => setNpCity(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">State</label><input className="form-input" value={npState} onChange={(e) => setNpState(e.target.value)} maxLength={2} /></div>
                <div className="form-group"><label className="form-label">ZIP</label><input className="form-input" value={npZip} onChange={(e) => setNpZip(e.target.value)} maxLength={10} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !npFirst.trim() || !npLast.trim()}>
                {saving ? "Saving…" : "Create Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
