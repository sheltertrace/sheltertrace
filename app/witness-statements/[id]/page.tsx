"use client";
import { useState, useEffect, use, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRouter } from "next/navigation";
import { fetchWitnessStatement, updateWitnessStatement, fetchCalls } from "@/lib/data";
import type { WitnessStatement, DispatchCall } from "@/lib/types";
import { useAuth } from "@/app/providers";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:       { bg: "#dbeafe", color: "#1d4ed8" },
  Reviewed:  { bg: "#fef3c7", color: "#b45309" },
  Attached:  { bg: "#dcfce7", color: "#15803d" },
  Dismissed: { bg: "#f1f5f9", color: "#64748b" },
};

function DetailRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)", minWidth: 160 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{display}</span>
    </div>
  );
}

// ── Attach-to-call search modal ────────────────────────────────────────────────
function AttachCallModal({ initialQuery, onSelect, onClose }: {
  initialQuery: string;
  onSelect: (call: DispatchCall) => void;
  onClose: () => void;
}) {
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => { fetchCalls().then(setCalls).finally(() => setLoading(false)); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calls.slice(0, 20);
    return calls.filter((c) =>
      c.id.toLowerCase().includes(q) ||
      (c.type || "").toLowerCase().includes(q) ||
      (c.address || "").toLowerCase().includes(q) ||
      (c.date_reported || "").toLowerCase().includes(q)
    ).slice(0, 30);
  }, [calls, query]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 10, padding: "20px 22px", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,.25)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Attach to Dispatch Call</div>
        <input
          className="form-input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by call number, date, or address…"
          style={{ marginBottom: 12 }}
        />
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Loading calls…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>No matching calls found.</div>
          ) : (
            results.map((c) => (
              <div key={c.id} onClick={() => onSelect(c)}
                style={{ padding: "10px 12px", borderRadius: 6, cursor: "pointer", marginBottom: 4, border: "1px solid var(--border)", fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <div style={{ fontWeight: 700 }}>#{c.id.slice(-4)} — {c.type}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                  {c.address || "No address"}{c.city ? `, ${c.city}` : ""} · {c.date_reported || ""} {c.time_reported || ""}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function WitnessStatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [statement, setStatement]     = useState<WitnessStatement | null>(null);
  const [loading, setLoading]         = useState(true);
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [showDismiss, setShowDismiss] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [linkedCall, setLinkedCall]   = useState<DispatchCall | null>(null);

  const staffName = user ? `${user.firstName || user.first_name || ""} ${user.lastName || user.last_name || ""}`.trim() || user.username : "Staff";

  useEffect(() => {
    fetchWitnessStatement(id).then(async (s) => {
      if (s) {
        setStatement(s);
        setNotes(s.staff_notes || "");
        if (s.dispatch_call_id) {
          const all = await fetchCalls();
          setLinkedCall(all.find((c) => c.id === s.dispatch_call_id) || null);
        }
        if (s.status === "New") {
          const updated = await updateWitnessStatement(id, { status: "Reviewed" });
          setStatement(updated);
        }
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSaveNotes = async () => {
    if (!statement) return;
    setSaving(true);
    try {
      const updated = await updateWitnessStatement(id, { staff_notes: notes || undefined });
      setStatement(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleAttach = async (call: DispatchCall) => {
    setShowAttachModal(false);
    setSaving(true);
    try {
      const updated = await updateWitnessStatement(id, {
        dispatch_call_id: call.id,
        status: "Attached",
        attached_by: staffName,
        attached_at: new Date().toISOString(),
      });
      setStatement(updated);
      setLinkedCall(call);
    } finally { setSaving(false); }
  };

  const handleDismiss = async () => {
    if (!dismissReason.trim()) { alert("Please provide a reason for dismissal."); return; }
    setSaving(true);
    try {
      const updated = await updateWitnessStatement(id, {
        status: "Dismissed",
        dismissed_reason: dismissReason.trim(),
        staff_notes: notes || undefined,
      });
      setStatement(updated);
      setShowDismiss(false);
    } finally { setSaving(false); }
  };

  if (loading) return <AppShell title="Loading…"><div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div></AppShell>;
  if (!statement) return <AppShell title="Not Found"><div style={{ padding: 40, color: "var(--text-muted)" }}>Witness statement not found.</div></AppShell>;

  const sc = STATUS_COLORS[statement.status] || { bg: "#f1f5f9", color: "#374151" };

  return (
    <AppShell
      title={`Statement ${statement.reference_number}`}
      action={<button className="btn btn-secondary btn-sm" onClick={() => router.push("/witness-statements")}>← Back</button>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

        {/* Left: Statement details */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#0f2942" }}>{statement.reference_number}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  Submitted {statement.submitted_at ? formatDateTime(statement.submitted_at) : "—"}
                </div>
              </div>
              <span style={{ background: sc.bg, color: sc.color, borderRadius: 12, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                {statement.status}
              </span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>👤 Witness Information</div>
            <DetailRow label="Name" value={`${statement.witness_first_name} ${statement.witness_last_name}`} />
            <DetailRow label="Phone" value={statement.witness_phone} />
            <DetailRow label="Email" value={statement.witness_email} />
            <DetailRow label="Address" value={[statement.witness_address, statement.witness_city, statement.witness_state, statement.witness_zip].filter(Boolean).join(", ")} />
            <DetailRow label="Preferred Contact" value={statement.preferred_contact} />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📍 Incident Information</div>
            <DetailRow label="Date" value={statement.incident_date ? formatDate(statement.incident_date) : undefined} />
            <DetailRow label="Approximate Time" value={statement.incident_time} />
            <DetailRow label="Location" value={statement.incident_location} />
            <DetailRow label="Case # Provided" value={statement.provided_case_number} />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📝 Statement</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid var(--border-light)" }}>
              {statement.statement}
            </div>
            {statement.certified && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#15803d" }}>
                ✓ Certified true and accurate — signed <strong>{statement.typed_signature}</strong>
              </div>
            )}
          </div>

          {statement.attachments && statement.attachments.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📎 Attachments ({statement.attachments.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {statement.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600, padding: "6px 10px", background: "#f0fdfa", borderRadius: 6, border: "1px solid #99f6e4" }}>
                    {a.type.startsWith("image") ? "🖼️" : a.type.startsWith("video") ? "🎞️" : "📄"} {a.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {linkedCall && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d" }}>✅ Attached to Dispatch Call</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0" }}>
                #{linkedCall.id.slice(-4)} — {linkedCall.type} · {linkedCall.address}
              </div>
              {statement.attached_by && (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Attached by {statement.attached_by}{statement.attached_at ? ` on ${formatDateTime(statement.attached_at)}` : ""}
                </div>
              )}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => router.push(`/dispatch/${linkedCall.id}`)}>
                View Dispatch Call →
              </button>
            </div>
          )}

          {statement.dismissed_reason && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 12, color: "#991b1b" }}>
              <strong>Dismissed:</strong> {statement.dismissed_reason}
            </div>
          )}
        </div>

        {/* Right: Staff actions */}
        <div style={{ position: "sticky", top: 76 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⚙️ Staff Actions</div>

            <div className="form-group">
              <label className="form-label">Staff Notes</label>
              <textarea className="form-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes…" />
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={handleSaveNotes} disabled={saving || saved}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Notes"}
            </button>

            {!linkedCall && statement.status !== "Dismissed" && (
              <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setShowAttachModal(true)}>
                📡 Attach to Call
              </button>
            )}

            {statement.status !== "Dismissed" && statement.status !== "Attached" && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ width: "100%", background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={() => setShowDismiss((v) => !v)}
                >
                  🚫 Dismiss Statement
                </button>
                {showDismiss && (
                  <div style={{ marginTop: 8, background: "#fee2e2", borderRadius: 6, padding: 10 }}>
                    <label className="form-label">Reason for dismissal *</label>
                    <select className="form-select" value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} style={{ marginBottom: 8 }}>
                      <option value="">— Select reason —</option>
                      <option>Spam</option>
                      <option>Duplicate</option>
                      <option>Unrelated to an animal services matter</option>
                      <option>Other</option>
                    </select>
                    <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", width: "100%" }} onClick={handleDismiss} disabled={saving}>
                      Confirm Dismiss
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showAttachModal && (
        <AttachCallModal
          initialQuery={statement.provided_case_number || ""}
          onSelect={handleAttach}
          onClose={() => setShowAttachModal(false)}
        />
      )}
    </AppShell>
  );
}
