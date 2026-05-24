"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/ui/Pagination";
import { fetchPeople, fetchCalls, fetchAnimals, fetchCitations, createPerson, lookupMicrochip, upsertMicrochipRegistration, logMicrochipSearch } from "@/lib/data";
import type { Person, DispatchCall, Animal, Citation, MicrochipRegistration } from "@/lib/types";
import { PERSON_ROLES } from "@/lib/constants";
import { formatDate, today } from "@/lib/utils";
import ScanLicenseButton from "@/components/ui/ScanLicenseButton";
import type { AamvaData } from "@/lib/parseAamva";

type Tab = "people" | "address" | "animals" | "calls" | "microchip";

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
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams?.get("tab");
    return (t === "microchip" || t === "people" || t === "address" || t === "animals" || t === "calls") ? t : "people";
  });

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

  // ── Microchip lookup tab ──────────────────────────────────────────────────────
  const [chipQuery, setChipQuery] = useState(() => searchParams?.get("chip") ?? "");
  const [chipSearching, setChipSearching] = useState(false);
  const [chipResult, setChipResult] = useState<{
    registration: MicrochipRegistration | null;
    animal: Animal | null;
    searched: boolean;
  } | null>(null);
  const [clipToast, setClipToast] = useState(false);

  // Log-result form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logSource, setLogSource]         = useState("");
  const [logOwnerName, setLogOwnerName]   = useState("");
  const [logOwnerPhone, setLogOwnerPhone] = useState("");
  const [logContacted, setLogContacted]   = useState(false);
  const [logNotes, setLogNotes]           = useState("");
  const [logSaving, setLogSaving]         = useState(false);
  const [logSaved, setLogSaved]           = useState(false);

  // Auto-search if chip was passed via URL param
  useEffect(() => {
    const chip = searchParams?.get("chip");
    if (chip && chip.length >= 8) {
      setChipQuery(chip);
      handleChipSearch(chip);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChipSearch(value?: string) {
    const q = (value ?? chipQuery).trim();
    if (!q) return;
    setChipSearching(true);
    setChipResult(null);
    setShowLogForm(false);
    setLogSaved(false);
    try {
      const r = await lookupMicrochip(q);
      setChipResult({ ...r, searched: true });
      // Log to search history
      const result = r.registration ? "found_internal" : r.animal ? "found_internal" : "not_found";
      logMicrochipSearch({ chip_number: q, result, animal_id: r.animal?.id }).catch(() => {});
    } catch { setChipResult({ registration: null, animal: null, searched: true }); }
    finally { setChipSearching(false); }
  }

  function copyAndOpen(url: string) {
    navigator.clipboard.writeText(chipQuery.trim()).catch(() => {});
    setClipToast(true);
    setTimeout(() => setClipToast(false), 3000);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleLogSave() {
    if (!logSource || !chipQuery.trim()) return;
    setLogSaving(true);
    try {
      await upsertMicrochipRegistration({
        chip_number: chipQuery.trim(),
        lookup_source: logSource,
        owner_name: logOwnerName || undefined,
        owner_phone: logOwnerPhone || undefined,
        owner_contacted: logContacted,
        notes: logNotes || undefined,
        status: logSource === "Not Registered" ? "Active" : "Active",
      });
      await logMicrochipSearch({
        chip_number: chipQuery.trim(),
        result: logSource === "Not Registered" ? "not_found" : "found_national",
        source: logSource,
        notes: logNotes || undefined,
      });
      setLogSaved(true);
      setTimeout(() => setShowLogForm(false), 2000);
    } catch (e) { console.error("[logSave]", e); }
    finally { setLogSaving(false); }
  }

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
    { id: "people",    label: "People & Contacts", icon: "👥" },
    { id: "address",   label: "Address Lookup",    icon: "📍" },
    { id: "animals",   label: "Animal Lookup",     icon: "🐾" },
    { id: "calls",     label: "Call Lookup",       icon: "📡" },
    { id: "microchip", label: "Microchip Lookup",  icon: "🔬" },
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

      {/* ── MICROCHIP LOOKUP TAB ── */}
      {tab === "microchip" && (
        <div style={{ maxWidth: 700, margin: "0 auto" }}>

          {/* Clipboard toast */}
          {clipToast && (
            <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#0f2942", color: "#fff", padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
              📋 Microchip number copied — paste it on the search page
            </div>
          )}

          {/* Step 1: Input */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", marginBottom: 4 }}>🔬 Microchip Lookup</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              Plug in a USB chip scanner and scan — or type the number manually. Auto-searches at 15 digits.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: 17, fontFamily: "monospace", letterSpacing: "0.06em" }}
                value={chipQuery}
                autoFocus
                onChange={(e) => {
                  const v = e.target.value;
                  setChipQuery(v);
                  setChipResult(null);
                  setShowLogForm(false);
                  if (v.length >= 15) handleChipSearch(v);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleChipSearch(); }}
                placeholder="Scan or type microchip number…"
              />
              <button className="btn btn-primary" onClick={() => handleChipSearch()} disabled={!chipQuery.trim() || chipSearching}>
                {chipSearching ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {/* Step 2: Internal result */}
          {chipResult?.searched && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Step 1 — MCAS Internal Records</div>

              {chipResult.registration ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>✅</span>
                    <span style={{ fontWeight: 800, color: "#15803d", fontSize: 14 }}>Found in MCAS Registry</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
                    {([
                      ["Owner",    chipResult.registration.owner_name],
                      ["Phone",    chipResult.registration.owner_phone],
                      ["Email",    chipResult.registration.owner_email],
                      ["Address",  [chipResult.registration.owner_address, chipResult.registration.owner_city, chipResult.registration.owner_state].filter(Boolean).join(", ")],
                      ["Animal",   chipResult.registration.animal_name],
                      ["Species",  chipResult.registration.species],
                      ["Manufacturer", chipResult.registration.manufacturer],
                      ["Registered", chipResult.registration.registration_date],
                    ] as [string, string | undefined][]).map(([l, v]) => v ? (
                      <div key={l} style={{ fontSize: 13 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block" }}>{l}</span>
                        <strong>{v}</strong>
                      </div>
                    ) : null)}
                  </div>
                  {chipResult.registration.animal_id && (
                    <a href={`/animals/${chipResult.registration.animal_id}`} style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ View Animal Record</a>
                  )}
                </>
              ) : chipResult.animal ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>🐾</span>
                    <span style={{ fontWeight: 800, color: "#0f2942", fontSize: 14 }}>Found in Animals Table — no registry owner record</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
                    {([
                      ["Name",    chipResult.animal.name],
                      ["ID",      chipResult.animal.id],
                      ["Species", chipResult.animal.species],
                      ["Breed",   chipResult.animal.breed],
                      ["Status",  chipResult.animal.status],
                    ] as [string, string | undefined][]).map(([l, v]) => v ? (
                      <div key={l} style={{ fontSize: 13 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "block" }}>{l}</span>
                        <strong>{v}</strong>
                      </div>
                    ) : null)}
                  </div>
                  <a href={`/animals/${chipResult.animal.id}`} style={{ color: "var(--teal)", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>→ View Animal Record</a>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>❌</span>
                  <span style={{ fontWeight: 700, color: "#6b7280", fontSize: 14 }}>Not found in MCAS records — check national databases below</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: National databases (shown after any search) */}
          {chipResult?.searched && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Step 2 — National Database Lookup</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 14px" }}>
                Click any button — the chip number is copied to your clipboard automatically. Paste it on the registry site.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
                {([
                  ["AAHA Universal",  "https://www.petmicrochiplookup.org"],
                  ["HomeAgain",       "https://www.homeagain.com/microsearch.html"],
                  ["24PetWatch",      "https://www.24petwatch.com/pet-owner/lost-found-pets"],
                  ["PetLink",         "https://www.petlink.net/us/search"],
                  ["AKC Reunite",     "https://www.akcreunite.org/microchip-lookup/"],
                  ["Found.org",       "https://www.found.org/search"],
                ] as [string, string][]).map(([label, url]) => (
                  <button
                    key={label}
                    onClick={() => copyAndOpen(url)}
                    style={{ padding: "10px 12px", border: "2px solid var(--border)", borderRadius: 8, background: "var(--bg)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text)", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}
                  >
                    <span>🌐 {label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>copy&amp;open ↗</span>
                  </button>
                ))}
              </div>

              {/* Log result */}
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                {!showLogForm ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowLogForm(true)}>
                    📝 Log What I Found
                  </button>
                ) : (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Log National Lookup Result</div>
                    <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Found on</label>
                        <select className="form-select" value={logSource} onChange={(e) => setLogSource(e.target.value)}>
                          <option value="">— Select —</option>
                          {["HomeAgain","AVID","24PetWatch","PetLink","AKC Reunite","Found.org","Other Registry","Not Registered"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Owner Name Found</label>
                        <input className="form-input" value={logOwnerName} onChange={(e) => setLogOwnerName(e.target.value)} placeholder="If found" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Owner Phone</label>
                        <input className="form-input" value={logOwnerPhone} onChange={(e) => setLogOwnerPhone(e.target.value)} placeholder="If found" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Owner Contacted?</label>
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          {(["Yes", "No"] as const).map((l) => (
                            <button key={l} onClick={() => setLogContacted(l === "Yes")}
                              style={{ flex: 1, padding: "7px 0", border: "2px solid", borderColor: (l === "Yes") === logContacted ? "var(--teal)" : "var(--border)", borderRadius: 6, background: (l === "Yes") === logContacted ? "#f0fdfa" : "var(--bg)", color: (l === "Yes") === logContacted ? "var(--teal)" : "var(--text)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                            >{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Notes</label>
                      <textarea className="form-input" rows={2} value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Any additional details…" style={{ resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="btn btn-primary btn-sm" onClick={handleLogSave} disabled={logSaving || !logSource}>
                        {logSaving ? "Saving…" : "Save to Registry"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowLogForm(false)}>Cancel</button>
                      {logSaved && <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>✓ Saved to MCAS Registry</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
