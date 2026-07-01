"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchApplication, approveApplication, updateApplication, fetchLicensesByApplication } from "@/lib/cityLicenseData";
import type { PetLicenseApplication, CityPetLicense, LicenseAnimal } from "@/lib/cityLicenseTypes";
import { calcApplicationFee, LICENSE_FEE_STERILIZED, LICENSE_FEE_UNSTERILIZED } from "@/lib/cityLicenseTypes";
import { useAuth } from "@/app/providers";
import { printLicenseCertificate } from "@/lib/licenseCertPrint";

function F({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value || "—"}</div>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [app, setApp] = useState<PetLicenseApplication | null>(null);
  const [licenses, setLicenses] = useState<CityPetLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [showDeny, setShowDeny] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    Promise.all([fetchApplication(id), fetchLicensesByApplication(id)]).then(([a, l]) => {
      if (!a) { router.replace("/city-portal/applications"); return; }
      setApp(a);
      setLicenses(l);
      setReviewNotes(a.review_notes || "");
    }).finally(() => setLoading(false));
  }, [id, router]);

  const handleApprove = async () => {
    if (!app || !user) return;
    if (!confirm(`Approve application ${app.application_number} and issue ${(app.animals as LicenseAnimal[]).length} license(s)?`)) return;
    setApproving(true);
    try {
      const issued = await approveApplication(app, `${user.firstName} ${user.lastName}`);
      setLicenses(issued);
      setApp((prev) => prev ? { ...prev, status: "Approved" } : prev);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setApproving(false); }
  };

  const handleDeny = async () => {
    if (!app || !denyReason.trim()) return;
    await updateApplication(app.id, { status: "Denied", denial_reason: denyReason.trim(), reviewed_by: `${user?.firstName} ${user?.lastName}`, reviewed_at: new Date().toISOString() });
    setApp((prev) => prev ? { ...prev, status: "Denied", denial_reason: denyReason } : prev);
    setShowDeny(false);
  };

  const handleSaveNotes = async () => {
    if (!app) return;
    await updateApplication(app.id, { review_notes: reviewNotes, status: app.status === "Pending" ? "Under Review" : app.status });
    setApp((prev) => prev ? { ...prev, review_notes: reviewNotes } : prev);
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading…</div>;
  if (!app) return null;

  const animals = app.animals as LicenseAnimal[];
  const fee = calcApplicationFee(animals, app.late_fee);
  const statusColor: Record<string, string> = { Pending: "#b45309", "Under Review": "#0369a1", Approved: "#15803d", Denied: "#dc2626" };
  const statusBg: Record<string, string> = { Pending: "#fef3c7", "Under Review": "#dbeafe", Approved: "#dcfce7", Denied: "#fee2e2" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push("/city-portal/applications")}>← Back</button>
        <h1 style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{app.application_number}</h1>
        <span className="badge" style={{ background: statusBg[app.status] || "#f1f5f9", color: statusColor[app.status] || "#64748b", fontSize: 12, padding: "4px 12px" }}>{app.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Left: Application data */}
        <div>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", marginBottom: 12 }}>Owner Information</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
              <F label="Name" value={`${app.owner_first_name} ${app.owner_last_name}`} />
              <F label="Phone" value={app.owner_phone} />
              <F label="Email" value={app.owner_email} />
              <F label="Address" value={app.owner_address} />
              <F label="City" value={app.owner_city} />
              <F label="State" value={app.owner_state} />
            </div>
          </div>

          {animals.map((a, i) => (
            <div key={i} className="card" style={{ padding: 18, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)", marginBottom: 12 }}>
                🐕 Dog #{i + 1}: {a.name} — <span style={{ color: a.sterilized ? "#15803d" : "#dc2626" }}>${a.sterilized ? LICENSE_FEE_STERILIZED : LICENSE_FEE_UNSTERILIZED}.00</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                <F label="Breed" value={a.breed} />
                <F label="Color" value={a.color} />
                <F label="Markings" value={a.markings} />
                <F label="Sex" value={a.sex === "M" ? "Male" : a.sex === "F" ? "Female" : "—"} />
                <F label="Sterilized" value={a.sterilized ? "Yes" : "No"} />
                <F label="Veterinarian" value={a.veterinarian} />
                <F label="Rabies Tag #" value={a.rabies_tag} />
                <F label="Rabies Expiration" value={a.rabies_expiration} />
              </div>
            </div>
          ))}

          {app.documents?.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>📎 Documents</div>
              {(app.documents as Array<{ name: string; url: string }>).map((d, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--teal)" }}>{d.name}</a>
                </div>
              ))}
            </div>
          )}

          {licenses.length > 0 && (
            <div className="card" style={{ padding: 14, marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d", marginBottom: 8 }}>✅ Issued Licenses</div>
              {licenses.map((l) => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-light)", fontSize: 13 }}>
                  <div><strong>{l.license_number}</strong> (Tag #{l.tag_number}) — {l.animal_name}</div>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => printLicenseCertificate(l)}>🖨 Print</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Review panel */}
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Review Panel</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Submitted</div>
              <div style={{ fontSize: 13 }}>{app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"}</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Fee Summary</div>
              {animals.map((a, i) => <div key={i} style={{ fontSize: 12 }}>{a.name}: ${a.sterilized ? LICENSE_FEE_STERILIZED : LICENSE_FEE_UNSTERILIZED}</div>)}
              {app.late_fee && <div style={{ fontSize: 12, color: "#dc2626" }}>Late fee: ${animals.length * 5}</div>}
              <div style={{ fontSize: 14, fontWeight: 700, borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>Total: ${fee}.00</div>
            </div>
            <div className="form-group">
              <label className="form-label">Internal Notes</label>
              <textarea className="form-textarea" rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleSaveNotes}>Save Notes</button>
                {notesSaved && <span style={{ fontSize: 12, color: "#15803d" }}>✓ Saved</span>}
              </div>
            </div>
          </div>

          {app.status !== "Approved" && app.status !== "Denied" && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Actions</div>
              {!showDeny ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleApprove} disabled={approving} style={{ background: "#15803d", borderColor: "#15803d" }}>
                    {approving ? "Issuing…" : "✅ Approve & Issue License"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => setShowDeny(true)}>✗ Deny Application</button>
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Reason for Denial *</label>
                    <textarea className="form-textarea" rows={3} value={denyReason} onChange={(e) => setDenyReason(e.target.value)} placeholder="Explain why this application is being denied…" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }} onClick={handleDeny} disabled={!denyReason.trim()}>Deny</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDeny(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {app.status === "Denied" && (
            <div className="card" style={{ padding: 14, background: "#fef2f2", border: "1px solid #fca5a5" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 6 }}>Application Denied</div>
              <div style={{ fontSize: 13 }}>{app.denial_reason || "No reason provided"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
