"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { fetchPeople, fetchOfficers, createCall, createPerson, addPersonNote } from "@/lib/data";
import type { Person, Officer } from "@/lib/types";
import { CALL_TYPES, CALL_PRIORITIES, PRIORITY_COLORS, MORGAN_COUNTY_JURISDICTIONS } from "@/lib/constants";
import { today, nowTime } from "@/lib/utils";
import DateInput from "@/components/ui/DateInput";

// ── Module-level components (prevents focus loss) ──────────────────────────────
function F({ label, req, span, children }: { label: string; req?: boolean; span?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-group" style={span ? { gridColumn: "1/-1" } : undefined}>
      <label className="form-label">{label}{req && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}</label>
      {children}
    </div>
  );
}

function PersonSearchRow({ people, selectedId, onSelect, onClear }: {
  people: Person[]; selectedId: string; onSelect: (p: Person) => void; onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (q.trim().length < 2) return [];
    const lo = q.toLowerCase();
    return people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(lo) || (p.phone || "").includes(q)).slice(0, 6);
  }, [people, q]);

  const sel = selectedId ? people.find((p) => p.id === selectedId) : null;
  if (sel) return (
    <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 12px", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span>✓ <strong>{sel.first_name} {sel.last_name}</strong> · {sel.phone || "no phone"} · <span style={{ color: "var(--text-muted)" }}>{sel.pid} · {sel.role}</span></span>
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={onClear}>Change</button>
    </div>
  );
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <input className="form-input" placeholder="Search contacts by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: "0 0 6px 6px", zIndex: 100, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}>
          {matches.map((p) => (
            <div key={p.id} style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid var(--border-light)" }}
              onClick={() => { onSelect(p); setQ(""); }}>
              <strong>{p.first_name} {p.last_name}</strong>
              <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>{p.phone}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 11 }}>{p.role} · {p.pid}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Phase1Data {
  type: string; priority: string; date_reported: string; time_reported: string; description: string;
  caller_anonymous: boolean; caller_person_id: string; caller: string;
  caller_first: string; caller_middle: string; caller_last: string; caller_phone: string;
  caller_address: string; caller_city: string; caller_state: string; caller_save: boolean;
  address: string; city: string; cross_street: string; location_notes: string;
  assigned_officers: Array<{ id: string; name: string; badge: string; vehicle: string }>;
  primary_officer_id: string;
}

const STEPS = ["Call Info", "Caller", "Location", "Assign Officer", "Dispatch Summary"];

const INIT: Phase1Data = {
  type: CALL_TYPES[0], priority: "Medium",
  date_reported: today(), time_reported: nowTime(), description: "",
  caller_anonymous: false, caller_person_id: "", caller: "",
  caller_first: "", caller_middle: "", caller_last: "", caller_phone: "",
  caller_address: "", caller_city: "", caller_state: "GA", caller_save: false,
  address: "", city: "", cross_street: "", location_notes: "",
  assigned_officers: [], primary_officer_id: "",
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NewCallPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Phase1Data>(INIT);
  const [people, setPeople] = useState<Person[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchPeople(), fetchOfficers()]).then(([p, o]) => { setPeople(p); setOfficers(o); });
  }, []);

  const upd = (patch: Partial<Phase1Data>) => setData((d) => ({ ...d, ...patch }));

  const canAdvance = () => {
    if (step === 1) return !!data.type;
    if (step === 3) return !!data.address;
    return true;
  };

  const toggleOfficer = (o: Officer) => {
    const already = data.assigned_officers.find((a) => a.id === o.id);
    if (already) {
      upd({ assigned_officers: data.assigned_officers.filter((a) => a.id !== o.id) });
    } else {
      upd({ assigned_officers: [...data.assigned_officers, { id: o.id, name: o.name, badge: o.badge || "", vehicle: o.vehicle || "" }] });
    }
  };

  const handleDispatch = async () => {
    setSaving(true);
    try {
      const involved = [];
      const callerFullName = [data.caller_first, data.caller_middle, data.caller_last].filter(Boolean).join(" ") || data.caller;
      if (!data.caller_anonymous && callerFullName) {
        involved.push({ role: "Caller", name: callerFullName, phone: data.caller_phone, address: data.caller_address, city: data.caller_city });
      }
      const locationExtra = [
        data.cross_street ? `Cross St: ${data.cross_street}` : "",
        data.location_notes ? `Location Notes: ${data.location_notes}` : "",
      ].filter(Boolean).join("\n");

      const call = await createCall({
        type: data.type, priority: data.priority,
        status: data.assigned_officers.length > 0 ? "Dispatched" : "Pending",
        caller: data.caller_anonymous ? "Anonymous" : (callerFullName || "Anonymous"),
        caller_phone: data.caller_phone,
        address: data.address, city: data.city,
        description: data.description,
        date_reported: data.date_reported, time_reported: data.time_reported,
        assigned_officers: data.assigned_officers,
        narrative: [], evidence: [], involved_parties: involved,
        response_notes: locationExtra || undefined,
      });

      if (!data.caller_anonymous && data.caller_save && callerFullName && !data.caller_person_id) {
        const p = await createPerson({ first_name: data.caller_first || callerFullName, middle_name: data.caller_middle || undefined, last_name: data.caller_last || undefined, role: "Caller", phone: data.caller_phone, address: data.caller_address });
        await addPersonNote(p.id, `Caller on ${data.type} call ${call.id} at ${data.address}, ${data.city}`, "Dispatch");
      }

      router.push(`/dispatch/${call.id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      alert(`Failed to dispatch call: ${err?.message || "Unknown error"}`);
    } finally { setSaving(false); }
  };

  // ── Step renderers ────────────────────────────────────────────────────────
  const renderStep = () => {
    const g2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" };

    switch (step) {
      case 1: return (
        <div>
          <div style={g2}>
            <F label="Call Type" req>
              <select className="form-select" value={data.type} onChange={(e) => upd({ type: e.target.value })}>
                {CALL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </F>
            <F label="Priority" req>
              <div style={{ display: "flex", gap: 6 }}>
                {CALL_PRIORITIES.map((p) => (
                  <button key={p} onClick={() => upd({ priority: p })}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: `2px solid ${data.priority === p ? PRIORITY_COLORS[p] : "var(--border)"}`, background: data.priority === p ? `${PRIORITY_COLORS[p]}18` : "#fff", color: data.priority === p ? PRIORITY_COLORS[p] : "var(--text-secondary)", fontWeight: data.priority === p ? 800 : 400, fontSize: 12, cursor: "pointer" }}>
                    {p}
                  </button>
                ))}
              </div>
            </F>
            <F label="Date Reported">
              <DateInput className="form-input" value={data.date_reported} onChange={(e) => upd({ date_reported: e.target.value })} />
            </F>
            <F label="Time Reported">
              <input className="form-input" type="time" value={data.time_reported} onChange={(e) => upd({ time_reported: e.target.value })} />
            </F>
          </div>
          <F label="Description">
            <textarea className="form-textarea" rows={3} value={data.description} onChange={(e) => upd({ description: e.target.value })} placeholder="Brief description of the incident…" />
          </F>
        </div>
      );

      case 2: return (
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14, padding: "8px 12px", background: data.caller_anonymous ? "#f1f5f9" : "#fff7ed", border: `1px solid ${data.caller_anonymous ? "#e2e8f0" : "#fed7aa"}`, borderRadius: 6 }}>
            <input type="checkbox" checked={data.caller_anonymous} onChange={(e) => upd({ caller_anonymous: e.target.checked })} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Anonymous caller — no information available</span>
          </label>
          {!data.caller_anonymous && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>Search Existing Contacts</div>
              <PersonSearchRow people={people} selectedId={data.caller_person_id}
                onSelect={(p) => upd({ caller_person_id: p.id, caller_first: p.first_name, caller_middle: p.middle_name || "", caller_last: p.last_name, caller: `${p.first_name} ${p.last_name}`, caller_phone: p.phone || "", caller_address: p.address || "", caller_city: p.city || "" })}
                onClear={() => upd({ caller_person_id: "", caller_first: "", caller_middle: "", caller_last: "", caller: "", caller_phone: "", caller_address: "" })} />
              <div style={g2}>
                <F label="First Name"><input className="form-input" value={data.caller_first} onChange={(e) => upd({ caller_first: e.target.value })} /></F>
                <F label="Middle Name"><input className="form-input" value={data.caller_middle} onChange={(e) => upd({ caller_middle: e.target.value })} /></F>
                <F label="Last Name"><input className="form-input" value={data.caller_last} onChange={(e) => upd({ caller_last: e.target.value })} /></F>
                <F label="Phone"><input className="form-input" value={data.caller_phone} onChange={(e) => upd({ caller_phone: e.target.value })} /></F>
                <F label="Address" span><input className="form-input" value={data.caller_address} onChange={(e) => upd({ caller_address: e.target.value })} /></F>
                <F label="City"><input className="form-input" value={data.caller_city} onChange={(e) => upd({ caller_city: e.target.value })} /></F>
                <F label="State"><input className="form-input" value={data.caller_state} onChange={(e) => upd({ caller_state: e.target.value })} /></F>
              </div>
              {!data.caller_person_id && (data.caller_first || data.caller_last) && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "6px 0" }}>
                  <input type="checkbox" checked={data.caller_save} onChange={(e) => upd({ caller_save: e.target.checked })} />
                  Save caller to Contacts database
                </label>
              )}
            </>
          )}
        </div>
      );

      case 3: return (
        <div>
          <div style={g2}>
            <F label="Street Address" req span>
              <input className="form-input" value={data.address} onChange={(e) => upd({ address: e.target.value })} placeholder="123 Main St" autoFocus />
            </F>
            <F label="Jurisdiction">
              <select className="form-select" value={data.city} onChange={(e) => upd({ city: e.target.value })}>
                {MORGAN_COUNTY_JURISDICTIONS.map((j) => <option key={j}>{j}</option>)}
              </select>
            </F>
            <F label="Cross Street"><input className="form-input" value={data.cross_street} onChange={(e) => upd({ cross_street: e.target.value })} placeholder="at Oak Ave" /></F>
          </div>
          <F label="Location Notes">
            <textarea className="form-textarea" rows={2} value={data.location_notes} onChange={(e) => upd({ location_notes: e.target.value })} placeholder="Gate code, landmarks, access notes…" />
          </F>
        </div>
      );

      case 4: return (
        <div>
          {data.assigned_officers.length > 0 && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--teal)", marginBottom: 8, textTransform: "uppercase" }}>Assigned ({data.assigned_officers.length})</div>
              {data.assigned_officers.map((o) => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #ccfbf1", fontSize: 13 }}>
                  <span><strong>{o.name}</strong>{o.badge ? ` · #${o.badge}` : ""}{o.vehicle ? ` · ${o.vehicle}` : ""}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626", fontSize: 11 }}
                    onClick={() => upd({ assigned_officers: data.assigned_officers.filter((a) => a.id !== o.id) })}>Remove</button>
                </div>
              ))}
              {data.assigned_officers.length > 1 && (
                <div style={{ marginTop: 8 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Primary Officer</label>
                  <select className="form-select" value={data.primary_officer_id} onChange={(e) => upd({ primary_officer_id: e.target.value })}>
                    <option value="">— Select primary —</option>
                    {data.assigned_officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>
            {officers.length === 0 ? "No officers found" : "Select Officers"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {officers.map((o) => {
              const assigned = !!data.assigned_officers.find((a) => a.id === o.id);
              const statusColor = o.status === "Available" ? "#16a34a" : o.status === "Off Duty" ? "#6b7280" : "#f59e0b";
              return (
                <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `2px solid ${assigned ? "var(--teal)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer", background: assigned ? "#f0fdfa" : "#fff" }}>
                  <input type="checkbox" checked={assigned} onChange={() => toggleOfficer(o)} style={{ accentColor: "var(--teal)" }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{o.name}</span>
                    {o.badge && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>#{o.badge}</span>}
                    {o.vehicle && <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{o.vehicle}</span>}
                    {o.zone && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Zone {o.zone}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, padding: "2px 8px", background: `${statusColor}15`, borderRadius: 10 }}>{o.status}</span>
                </label>
              );
            })}
          </div>
        </div>
      );

      case 5: {
        const dispStatus = data.assigned_officers.length > 0 ? "Dispatched" : "Pending";
        const Row = ({ label, value }: { label: string; value: string }) => (
          <div style={{ display: "flex", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", width: 120, flexShrink: 0 }}>{label}</span>
            <strong style={{ wordBreak: "break-word" }}>{value || "—"}</strong>
          </div>
        );
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: `${PRIORITY_COLORS[data.priority] || "#374151"}12`, border: `2px solid ${PRIORITY_COLORS[data.priority] || "#374151"}40`, borderRadius: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>🚨</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#0f2942" }}>{data.type}</div>
                <div style={{ fontSize: 13, color: PRIORITY_COLORS[data.priority] || "#374151", fontWeight: 700 }}>{data.priority} Priority · {dispStatus}</div>
              </div>
            </div>
            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div className="card" style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Call Details</div>
                <Row label="Type" value={data.type} />
                <Row label="Date / Time" value={`${data.date_reported} at ${data.time_reported}`} />
                {data.description && <Row label="Description" value={data.description} />}
              </div>
              <div className="card" style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Location</div>
                <Row label="Address" value={`${data.address}${data.city ? `, ${data.city}` : ""}`} />
                {data.cross_street && <Row label="Cross Street" value={data.cross_street} />}
                {data.location_notes && <Row label="Notes" value={data.location_notes} />}
              </div>
              <div className="card" style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Caller</div>
                <Row label="Name" value={data.caller_anonymous ? "Anonymous" : data.caller} />
                {!data.caller_anonymous && <><Row label="Phone" value={data.caller_phone} />{data.caller_address && <Row label="Address" value={`${data.caller_address}, ${data.caller_city}`} />}</>}
              </div>
              <div className="card" style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Officers</div>
                {data.assigned_officers.length === 0
                  ? <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "4px 0" }}>None assigned — call will be Pending</div>
                  : data.assigned_officers.map((o) => <Row key={o.id} label="Officer" value={`${o.name}${o.badge ? ` #${o.badge}` : ""}${o.vehicle ? ` · ${o.vehicle}` : ""}`} />)
                }
              </div>
            </div>
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "10px 14px", fontSize: 13 }}>
              ✓ Ready to dispatch. The call will be created with status <strong>{dispStatus}</strong> and appear in the Call Queue.
            </div>
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <AppShell title="">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/dispatch")} style={{ color: "var(--text-secondary)", gap: 4 }}>
          ← Back to Dispatch Board
        </button>
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#0f2942" }}>🚨 New Call — Quick Dispatch</h1>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Step {step} of 5 · {STEPS[step - 1]}</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Progress bar */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <div key={i} title={label} onClick={() => done ? setStep(n) : undefined}
                  style={{ flex: 1, height: 7, borderRadius: 4, background: current ? "#0f2942" : done ? "#16a34a" : "#e2e8f0", cursor: done ? "pointer" : "default", transition: "background .2s" }} />
              );
            })}
          </div>
          <div style={{ display: "flex" }}>
            {STEPS.map((label, i) => (
              <div key={i} style={{ flex: 1, fontSize: 10, textAlign: "center", color: i + 1 === step ? "#0f2942" : i + 1 < step ? "#16a34a" : "var(--text-muted)", fontWeight: i + 1 === step ? 800 : 400 }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "28px 28px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 20px", color: "#0f2942" }}>{STEPS[step - 1]}</h2>
          {renderStep()}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>← Back</button>
          <div style={{ flex: 1 }} />
          {(step === 2 || step === 4) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStep((s) => s + 1)} style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {step === 2 ? "Skip — Anonymous" : "Skip — Assign Later"} →
            </button>
          )}
          {step < 5 ? (
            <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ background: "#dc2626", borderColor: "#dc2626", minWidth: 180, fontSize: 15, fontWeight: 800, padding: "10px 20px" }}
              onClick={handleDispatch}
              disabled={saving || !data.address}
            >
              {saving ? "Dispatching…" : "🚨 Dispatch Now"}
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
