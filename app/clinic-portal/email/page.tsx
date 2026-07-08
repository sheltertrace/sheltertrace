"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicEmails, createClinicEmail, updateClinicEmail, fetchClinicSettings } from "@/lib/clinicData";
import type { ClinicEmail, ClinicSettings } from "@/lib/clinicTypes";
import { today } from "@/lib/utils";
import DragDropUpload from "@/components/ui/DragDropUpload";

const TEMPLATES = [
  { label: "Invoice Delivery", subject: "Invoice Enclosed — AWA Georgia Veterinary Services", body: "Dear [Contact Name],\n\nPlease find attached invoice [Invoice #] for veterinary services rendered during [Service Period].\n\nTotal Amount Due: $[Amount]\nDue Date: [Due Date]\n\nPlease remit payment at your earliest convenience. If you have any questions, please don't hesitate to contact me.\n\nThank you for your partnership.\n\nDr. Odum\nAWA Georgia" },
  { label: "Lab Results", subject: "Diagnostic Results — [Animal Name]", body: "Dear [Contact Name],\n\nPlease find attached the diagnostic test results for [Animal Name].\n\nTest: [Test Type]\nResult: [Result]\nDate: [Date]\n\nPlease contact me if you have any questions or if follow-up care is needed.\n\nDr. Odum\nAWA Georgia" },
  { label: "Appointment Reminder", subject: "Appointment Reminder — [Date]", body: "Dear [Contact Name],\n\nThis is a reminder of the upcoming veterinary appointment:\n\nAnimal: [Animal Name]\nDate: [Date]\nTime: [Time]\nType: [Appointment Type]\n\nPlease ensure the animal is brought in on time. If you need to reschedule, please contact me as soon as possible.\n\nDr. Odum\nAWA Georgia" },
  { label: "Monthly Summary", subject: "Monthly Service Summary — [Month Year]", body: "Dear [Contact Name],\n\nPlease find attached the monthly veterinary service summary for [Month Year].\n\nThis report includes all services rendered, test results, and associated costs for the period.\n\nPlease review and contact me if you have any questions.\n\nDr. Odum\nAWA Georgia" },
  { label: "General", subject: "", body: "" },
];

export default function EmailPage() {
  const { user } = useAuth();
  const { clients } = useClinic();
  const [emails, setEmails] = useState<ClinicEmail[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"compose" | "sent" | "drafts">("compose");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchClinicEmails(user.id),
      fetchClinicSettings(user.id),
    ]).then(([e, s]) => { setEmails(e); setSettings(s); }).finally(() => setLoading(false));
  }, [user?.id]);

  const handleTemplate = (t: typeof TEMPLATES[0]) => { setSubject(t.subject); setBody(t.body); };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !user?.id) return;
    setSending(true);
    try {
      const email = await createClinicEmail({
        clinic_account_id: user.id,
        client_id: selectedClientId || undefined,
        to_email: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        attachments: attachments.map((a) => ({ url: a, name: a.split("/").pop() || "attachment" })),
        status: "Sent",
        sent_at: new Date().toISOString(),
      });
      setEmails((prev) => [email, ...prev]);
      setSent(true);
      setTo(""); setCc(""); setSubject(""); setBody(""); setAttachments([]);
      setTimeout(() => setSent(false), 3000);
    } catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSending(false); }
  };

  const handleSaveDraft = async () => {
    if (!user?.id) return;
    const email = await createClinicEmail({ clinic_account_id: user.id, client_id: selectedClientId || undefined, to_email: to, subject, body, status: "Draft" });
    setEmails((prev) => [email, ...prev]);
    alert("Draft saved");
  };

  const sentEmails = emails.filter((e) => e.status === "Sent");
  const draftEmails = emails.filter((e) => e.status === "Draft");

  const fromEmail = settings?.clinic_email || user?.email || "your-email@example.com";

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>📧 Email</h1>

      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
        {([["compose","✏️ Compose"],["sent","📤 Sent"],["drafts","📝 Drafts"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "8px 16px", border: "none", background: "none", fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--teal)" : "var(--text-secondary)", borderBottom: tab === id ? "2px solid var(--teal)" : "2px solid transparent", cursor: "pointer", fontSize: 13 }}>{label}</button>
        ))}
      </div>

      {tab === "compose" && (
        <div style={{ maxWidth: 720 }}>
          {/* Templates */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Quick Templates</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TEMPLATES.map((t) => (
                <button key={t.label} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handleTemplate(t)}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 2, marginBottom: 8 }}>
            <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 40 }}>From</span>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fromEmail}</span>
            </div>
            <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 40 }}>To</span>
              <input style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none" }} value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" list="contacts" />
              <datalist id="contacts">{clients.map((c) => c.contact_email && <option key={c.id} value={c.contact_email || ""}>{c.county_name}</option>)}</datalist>
            </div>
            <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 40 }}>CC</span>
              <input style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none" }} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" />
            </div>
            <div style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", width: 40 }}>Subject</span>
              <input style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, fontWeight: 600, outline: "none" }} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
            </div>
          </div>

          <textarea
            className="form-textarea"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            style={{ marginBottom: 10, fontFamily: "inherit" }}
          />

          <DragDropUpload onFiles={(files) => files.forEach((f) => setAttachments((prev) => [...prev, f.name]))} compact label="Attach files (PDFs, documents)" multiple />
          {attachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {attachments.map((a, i) => <span key={i} style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "2px 8px" }}>📎 {a} <button onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12 }}>✕</button></span>)}
            </div>
          )}

          {sent && <div style={{ marginTop: 8, fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Email sent successfully</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}>{sending ? "Sending…" : "Send Email"}</button>
            <button className="btn btn-secondary" onClick={handleSaveDraft}>Save Draft</button>
          </div>
        </div>
      )}

      {tab === "sent" && (
        <div>
          {loading ? <div style={{ padding: 20, color: "var(--text-muted)" }}>Loading…</div> : sentEmails.length === 0 ? <div style={{ color: "var(--text-muted)", padding: 20 }}>No sent emails.</div> : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
                <tbody>
                  {sentEmails.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12 }}>{e.sent_at ? new Date(e.sent_at).toLocaleDateString() : "—"}</td>
                      <td style={{ fontSize: 12 }}>{e.to_email}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{e.subject}</td>
                      <td><span className="badge" style={{ background: "#dcfce7", color: "#15803d", fontSize: 10 }}>Sent</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "drafts" && (
        <div>
          {loading ? <div style={{ padding: 20, color: "var(--text-muted)" }}>Loading…</div> : draftEmails.length === 0 ? <div style={{ color: "var(--text-muted)", padding: 20 }}>No saved drafts.</div> : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="data-table">
                <thead><tr><th>Saved</th><th>To</th><th>Subject</th><th></th></tr></thead>
                <tbody>
                  {draftEmails.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString() : "—"}</td>
                      <td style={{ fontSize: 12 }}>{e.to_email || "—"}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{e.subject || "(no subject)"}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setTo(e.to_email || ""); setSubject(e.subject || ""); setBody(e.body || ""); setTab("compose"); }}>Continue editing</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
