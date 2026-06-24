"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchRabiesCertificates, voidRabiesCertificate, fetchClinicSettings } from "@/lib/clinicData";
import type { ClinicRabiesCertificate, ClinicSettings } from "@/lib/clinicTypes";
import { printRabiesCertificate } from "@/lib/rabiesCertPrint";

export default function ClinicDocumentsPage() {
  const { user } = useAuth();
  const { selectedClientId, selectedClient } = useClinic();
  const [tab, setTab] = useState<"certs" | "other">("certs");
  const [certs, setCerts] = useState<ClinicRabiesCertificate[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchRabiesCertificates(user.id, selectedClientId || undefined),
      fetchClinicSettings(user.id),
    ]).then(([c, s]) => { setCerts(c); setSettings(s); }).finally(() => setLoading(false));
  }, [user?.id, selectedClientId]);

  const handleVoid = async () => {
    if (!voidId || !voidReason.trim()) return;
    await voidRabiesCertificate(voidId, voidReason.trim());
    setCerts((prev) => prev.map((c) => c.id === voidId ? { ...c, voided: true, void_reason: voidReason.trim() } : c));
    setVoidId(null);
    setVoidReason("");
  };

  const handlePrint = (cert: ClinicRabiesCertificate, halfPage = false) => {
    if (!settings) return;
    printRabiesCertificate(cert, settings, halfPage);
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📄 Documents & Reports</h1>

      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
        {([["certs", "🏥 Rabies Certificates"], ["other", "📁 Other Documents"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "8px 18px", border: "none", background: "none", fontSize: 13,
            fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--teal)" : "var(--text-secondary)",
            borderBottom: tab === id ? "2px solid var(--teal)" : "2px solid transparent", cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {tab === "certs" && (
        <div>
          {loading ? <div style={{ padding: 20, color: "var(--text-muted)" }}>Loading…</div> :
          certs.length === 0 ? (
            <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏥</div>
              <div style={{ fontWeight: 700 }}>No rabies certificates issued yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Certificates appear here when generated from an animal's medical records.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Certificate #</th>
                    <th>Animal</th>
                    <th>County</th>
                    <th>Date Issued</th>
                    <th>Next Due</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => (
                    <tr key={c.id} style={{ opacity: c.voided ? 0.5 : 1 }}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.certificate_number}</td>
                      <td style={{ fontWeight: 600 }}>{c.animal_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.owner_name || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.issued_at ? new Date(c.issued_at).toLocaleDateString() : "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.next_due || "—"}</td>
                      <td>
                        {c.voided ? (
                          <span className="badge" style={{ background: "#fee2e2", color: "#dc2626" }} title={c.void_reason || ""}>VOID</span>
                        ) : (
                          <span className="badge" style={{ background: "#dcfce7", color: "#15803d" }}>Valid</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handlePrint(c)}>🖨 Print</button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handlePrint(c, true)}>½ Page</button>
                          {!c.voided && (
                            voidId === c.id ? (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input className="form-input" style={{ fontSize: 11, width: 140, padding: "2px 6px" }} placeholder="Reason…" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
                                <button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", fontSize: 11, padding: "2px 8px" }} onClick={handleVoid} disabled={!voidReason.trim()}>Void</button>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setVoidId(null)}>✕</button>
                              </div>
                            ) : (
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#dc2626" }} onClick={() => setVoidId(c.id)}>Void</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "other" && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Coming Soon</div>
          <div style={{ fontSize: 13 }}>General document management is under development.</div>
        </div>
      )}
    </div>
  );
}
