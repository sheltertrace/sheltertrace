"use client";
import { useState, useEffect, use } from "react";
import AppShell from "@/components/layout/AppShell";
import { useRouter } from "next/navigation";
import { fetchCitizenReport, updateCitizenReport, createCall, fetchStaffOptions } from "@/lib/data";
import type { CitizenReport } from "@/lib/types";
import Image from "next/image";

const STATUSES = ["New", "Under Review", "Assigned", "Resolved", "Dismissed"];
const PRIORITIES = ["Low", "Medium", "High", "Emergency"];
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  New:            { bg: "#dbeafe", color: "#1d4ed8" },
  "Under Review": { bg: "#fef3c7", color: "#b45309" },
  Assigned:       { bg: "#ede9fe", color: "#6d28d9" },
  Resolved:       { bg: "#dcfce7", color: "#15803d" },
  Dismissed:      { bg: "#f1f5f9", color: "#64748b" },
};
const PRIORITY_COLORS: Record<string, string> = {
  Low: "#64748b", Medium: "#f59e0b", High: "#f97316", Emergency: "#dc2626",
};

function mapReportTypeToCallType(reportType: string): string {
  const map: Record<string, string> = {
    "Stray / Loose Animal": "Stray Animal",
    "Animal Neglect or Abuse": "Animal Cruelty/Neglect",
    "Barking / Noise Complaint": "Noise Complaint",
    "Dangerous / Aggressive Animal": "Dangerous Animal",
    "Animal Bite": "Animal Bite",
    "Tethering Violation": "Ordinance Violation",
    "Too Many Animals": "Ordinance Violation",
    "Dead Animal Pickup": "Dead Animal Pickup",
    "Wildlife Concern": "Wildlife",
    "Licensing Violation": "Ordinance Violation",
    "Other": "General Inquiry",
  };
  return map[reportType] || "General Inquiry";
}

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

export default function CitizenReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport]           = useState<CitizenReport | null>(null);
  const [loading, setLoading]         = useState(true);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);
  const [status, setStatus]           = useState("");
  const [priority, setPriority]       = useState("");
  const [officer, setOfficer]         = useState("");
  const [notes, setNotes]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [showDismiss, setShowDismiss] = useState(false);
  const [creatingCall, setCreatingCall] = useState(false);
  const [callCreated, setCallCreated] = useState(false);
  const [callId, setCallId]           = useState("");

  useEffect(() => {
    Promise.all([fetchCitizenReport(id), fetchStaffOptions()]).then(([r, staff]) => {
      if (r) {
        setReport(r);
        setStatus(r.status);
        setPriority(r.priority || "Medium");
        setOfficer(r.assigned_officer || "");
        setNotes(r.staff_notes || "");
        setCallId(r.dispatch_call_id || "");
      }
      setStaffOptions(staff);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const updated = await updateCitizenReport(id, {
        status, priority, assigned_officer: officer || undefined,
        staff_notes: notes || undefined,
        resolved_at: status === "Resolved" ? new Date().toISOString() : undefined,
      });
      setReport(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const handleDismiss = async () => {
    if (!dismissReason.trim()) { alert("Please provide a reason for dismissal."); return; }
    setSaving(true);
    try {
      const updated = await updateCitizenReport(id, {
        status: "Dismissed",
        dismissed_reason: dismissReason.trim(),
        staff_notes: notes || undefined,
      });
      setReport(updated);
      setStatus("Dismissed");
      setShowDismiss(false);
    } finally { setSaving(false); }
  };

  const handleCreateCall = async () => {
    if (!report) return;
    setCreatingCall(true);
    try {
      const callerName = report.anonymous
        ? "Anonymous Online Report"
        : [report.reporter_first_name, report.reporter_last_name].filter(Boolean).join(" ") || "Online Report";

      const call = await createCall({
        type: mapReportTypeToCallType(report.report_type),
        priority: (report.priority || "Medium") as "Low" | "Medium" | "High" | "Emergency",
        status: "Open",
        caller: callerName,
        caller_phone: report.reporter_phone || undefined,
        address: report.location_address || undefined,
        city: report.location_city || undefined,
        description: `[Citizen Report ${report.reference_number}]\n\n${report.description}\n\n` +
          (report.location_details ? `Location details: ${report.location_details}\n` : "") +
          (report.species ? `Animal: ${[report.species, report.breed, report.animal_color].filter(Boolean).join(", ")}\n` : "") +
          (report.animal_injured ? "⚠️ Animal appears injured.\n" : "") +
          (report.animal_aggressive ? "⚠️ Animal appears aggressive.\n" : ""),
      });

      await updateCitizenReport(id, {
        dispatch_call_id: call.id,
        status: status === "New" ? "Assigned" : status,
      });
      setCallId(call.id);
      setStatus(status === "New" ? "Assigned" : status);
      setCallCreated(true);
    } catch (err) {
      alert("Failed to create dispatch call: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally { setCreatingCall(false); }
  };

  if (loading) return <AppShell title="Loading…"><div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div></AppShell>;
  if (!report) return <AppShell title="Not Found"><div style={{ padding: 40, color: "var(--text-muted)" }}>Report not found.</div></AppShell>;

  const sc = STATUS_COLORS[report.status] || { bg: "#f1f5f9", color: "#374151" };

  return (
    <AppShell
      title={`Report ${report.reference_number}`}
      action={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/citizen-reports")}>← Back</button>
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

        {/* Left: Report Details */}
        <div>
          {/* Header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#0f2942" }}>{report.reference_number}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                  Submitted {report.created_at ? new Date(report.created_at).toLocaleString() : "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 12, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                  {report.status}
                </span>
                <span style={{ color: PRIORITY_COLORS[report.priority || "Medium"], fontWeight: 700, fontSize: 13 }}>
                  {report.priority || "Medium"} Priority
                </span>
              </div>
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef3c7", borderRadius: 6, fontSize: 14, fontWeight: 700, color: "#b45309" }}>
              📋 {report.report_type}
            </div>
          </div>

          {/* Location */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📍 Location</div>
            <DetailRow label="Address" value={report.location_address} />
            <DetailRow label="City" value={report.location_city} />
            <DetailRow label="Zip" value={report.location_zip} />
            <DetailRow label="Additional Details" value={report.location_details} />
          </div>

          {/* Concern Description */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📝 Concern Details</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid var(--border-light)" }}>
              {report.description}
            </div>
            <div style={{ marginTop: 10 }}>
              <DetailRow label="Duration" value={report.duration} />
              <DetailRow label="Reported Before" value={report.reported_before} />
            </div>
          </div>

          {/* Animal Info */}
          {(report.species || report.breed || report.animal_color) && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>🐾 Animal Information</div>
              <DetailRow label="Species" value={report.species} />
              <DetailRow label="Breed" value={report.breed} />
              <DetailRow label="Color / Description" value={report.animal_color} />
              <DetailRow label="Number of Animals" value={report.animal_count} />
              <DetailRow label="Animal Contained" value={report.animal_contained} />
              <DetailRow label="Animal Injured" value={report.animal_injured} />
              <DetailRow label="Animal Aggressive" value={report.animal_aggressive} />
            </div>
          )}

          {/* Reporter */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
              👤 Reporter {report.anonymous && <span style={{ color: "#64748b", fontWeight: 400 }}>(Anonymous)</span>}
            </div>
            {report.anonymous ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>Reporter chose to remain anonymous</div>
            ) : (
              <>
                <DetailRow label="Name" value={[report.reporter_first_name, report.reporter_last_name].filter(Boolean).join(" ") || undefined} />
                <DetailRow label="Phone" value={report.reporter_phone} />
                <DetailRow label="Email" value={report.reporter_email} />
                <DetailRow label="Wants Update" value={report.wants_update} />
                <DetailRow label="Best Contact Time" value={report.contact_time} />
                {report.wants_update && report.reporter_email && (
                  <div style={{ marginTop: 8 }}>
                    <a href={`mailto:${report.reporter_email}?subject=Update on your animal report ${report.reference_number}`}
                      className="btn btn-secondary btn-sm">
                      ✉️ Send Update Email
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Photos */}
          {report.photo_urls && report.photo_urls.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>📷 Photos ({report.photo_urls.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {report.photo_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ position: "relative", width: 120, height: 120 }}>
                      <Image src={url} alt={`Photo ${i+1}`} fill style={{ objectFit: "cover", borderRadius: 8, border: "2px solid var(--border)" }} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Dispatch link */}
          {callId && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d" }}>✅ Dispatch Call Created</div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => router.push(`/dispatch/${callId}`)}>
                View Dispatch Call →
              </button>
            </div>
          )}
        </div>

        {/* Right: Staff Actions */}
        <div style={{ position: "sticky", top: 76 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>⚙️ Staff Actions</div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p} style={{ color: PRIORITY_COLORS[p] }}>{p}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Assign to Officer</label>
              <select className="form-select" value={officer} onChange={e => setOfficer(e.target.value)}>
                <option value="">— Unassigned —</option>
                {staffOptions.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Staff Notes</label>
              <textarea className="form-textarea" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Investigation notes, follow-up actions, resolution…" />
            </div>

            <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={handleSave} disabled={saving || saved}>
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
            </button>

            {/* Create Dispatch Call */}
            {!callId && !callCreated && (
              <button
                className="btn btn-secondary"
                style={{ width: "100%", marginBottom: 8 }}
                onClick={handleCreateCall}
                disabled={creatingCall}
              >
                {creatingCall ? "Creating…" : "📡 Create Dispatch Call"}
              </button>
            )}
            {callCreated && (
              <button className="btn btn-secondary" style={{ width: "100%", marginBottom: 8 }} onClick={() => router.push(`/dispatch/${callId}`)}>
                View Dispatch Call →
              </button>
            )}

            {/* Dismiss */}
            {report.status !== "Dismissed" && report.status !== "Resolved" && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ width: "100%", background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }}
                  onClick={() => setShowDismiss(v => !v)}
                >
                  🚫 Dismiss Report
                </button>
                {showDismiss && (
                  <div style={{ marginTop: 8, background: "#fee2e2", borderRadius: 6, padding: 10 }}>
                    <label className="form-label">Reason for dismissal *</label>
                    <textarea className="form-textarea" rows={2} value={dismissReason} onChange={e => setDismissReason(e.target.value)} placeholder="e.g., Duplicate report, unfounded, outside jurisdiction…" />
                    <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", width: "100%", marginTop: 6 }} onClick={handleDismiss} disabled={saving}>
                      Confirm Dismiss
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {report.dismissed_reason && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, fontSize: 12, color: "#991b1b" }}>
              <strong>Dismissed:</strong> {report.dismissed_reason}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
