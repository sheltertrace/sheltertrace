"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StaffAccount, MedicalRecord, Person } from "@/lib/types";
import { fetchMedical, fetchPeopleForAnimal } from "@/lib/data";
import { describeSections, impoundedAnimals, staffName, type PacketInputs, type PacketExtras, type SectionId } from "@/lib/courtPacket/sections";
import { generateCourtPacket, type PacketProgress, type PacketResult } from "@/lib/courtPacket/generate";
import { saveCopyToCall, recordPacket } from "@/lib/courtPacket/persist";

const REASONS = ["Court", "Records Request", "Internal Review", "DA Request", "Other"];

interface Props {
  inputs: PacketInputs;
  user: StaffAccount;
  onClose: () => void;
  // Called after a copy is saved to the call so the page can refresh its documents.
  onSaved: () => void;
}

type Phase = "select" | "generating" | "done";

export default function CourtPacketDialog({ inputs, user, onClose, onSaved }: Props) {
  const [extras, setExtras] = useState<PacketExtras | null>(null);
  const [checked, setChecked] = useState<Set<SectionId>>(new Set());
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<Phase>("select");
  const [progress, setProgress] = useState<PacketProgress>({ done: 0, total: 1, label: "" });
  const [result, setResult] = useState<PacketResult | null>(null);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<{ status: "saving" | "saved" | "failed"; url?: string; message?: string }>({ status: "saving" });
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [emailState, setEmailState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string }>({ status: "idle" });
  const abortRef = useRef({ aborted: false });
  const blobUrlRef = useRef<string | null>(null);

  // Load what the checklist needs beyond what the page already holds: medical
  // history for impounded animals (from intake forward) and the owner/finder
  // for each intake form.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const medicalByAnimal: Record<string, MedicalRecord[]> = {};
      const intakePeople: Record<string, { owner?: Person; finder?: Person }> = {};
      await Promise.all(impoundedAnimals(inputs.animalLinks).map(async (l) => {
        try {
          const from = l.animal?.intake_date || "";
          const recs = (await fetchMedical(l.animal_id)).filter((r) => !from || (r.date || "") >= from);
          medicalByAnimal[l.animal_id] = recs.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        } catch { medicalByAnimal[l.animal_id] = []; }
        try {
          const links = await fetchPeopleForAnimal(l.animal_id);
          intakePeople[l.animal_id] = {
            owner: links.find((p) => ["Previous Owner", "Owner"].includes(p.role))?.person,
            finder: links.find((p) => p.role === "Finder")?.person,
          };
        } catch { intakePeople[l.animal_id] = {}; }
      }));
      if (cancelled) return;
      const ex = { medicalByAnimal, intakePeople };
      setExtras(ex);
      setChecked(new Set(describeSections(inputs, ex).map((d) => d.id))); // all checked by default
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const defs = useMemo(() => (extras ? describeSections(inputs, extras) : []), [extras, inputs]);
  const toggle = (id: SectionId) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const generate = async () => {
    if (!extras) return;
    setPhase("generating");
    setError("");
    abortRef.current = { aborted: false };
    let res: PacketResult;
    try {
      res = await generateCourtPacket(inputs, extras, checked, user, setProgress, abortRef.current);
    } catch (e) {
      if (abortRef.current.aborted) { setPhase("select"); return; }
      setError(e instanceof Error ? e.message : "Packet generation failed");
      setPhase("select");
      return;
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(new Blob([res.bytes as unknown as BlobPart], { type: "application/pdf" }));
    setResult(res);
    setSaveState({ status: "saving" });
    setPhase("done");
    const who = staffName(user);
    // The packet exists as soon as it renders — saving a copy and logging it
    // are separate steps that report their own failures rather than losing it.
    recordPacket(inputs.call.id, res, who, reason || undefined).catch((e) => console.error("[court-packet] log failed:", e));
    saveCopyToCall(inputs.call.id, res, who, reason || undefined)
      .then(({ url }) => { setSaveState({ status: "saved", url }); onSaved(); })
      .catch((e) => setSaveState({ status: "failed", message: e instanceof Error ? e.message : "Upload failed" }));
  };

  const download = () => {
    if (!result || !blobUrlRef.current) return;
    const a = document.createElement("a");
    a.href = blobUrlRef.current;
    a.download = result.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const print = () => {
    if (!blobUrlRef.current) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.src = blobUrlRef.current;
    frame.onload = () => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); }
      catch { window.open(blobUrlRef.current!, "_blank"); }
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  };

  const sendEmail = async () => {
    if (!result || saveState.status !== "saved" || !saveState.url) return;
    setEmailState({ status: "sending" });
    try {
      const res = await fetch("/api/court-packet/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-staff-id": user.id },
        body: JSON.stringify({ to: emailTo.trim(), subject: `Court Packet — ${inputs.callNumber}`, message: emailMsg, pdfUrl: saveState.url, filename: result.filename, callNumber: inputs.callNumber, sentBy: staffName(user) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || "Send failed");
      setEmailState({ status: "sent" });
    } catch (e) {
      setEmailState({ status: "error", message: e instanceof Error ? e.message : "Send failed" });
    }
  };

  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100);
  const busy = phase === "generating";

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" style={{ maxWidth: 640, width: "95vw" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📁 Court Packet — {inputs.callNumber}</span>
          {!busy && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
        </div>

        <div className="modal-body">
          {phase === "select" && (
            <>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                Assembles the selected records into one continuous PDF, each section starting on a new page. Only sections that have content are listed.
              </div>
              {error && <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>⚠️ {error}</div>}
              {!extras ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Checking what&apos;s attached to this call…</div>
              ) : (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
                  {defs.map((d) => (
                    <label key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: "1px solid var(--border-light)", cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={checked.has(d.id)} onChange={() => toggle(d.id)} />
                      {d.label}
                    </label>
                  ))}
                </div>
              )}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Reason (optional)</label>
                <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">— Select —</option>
                  {REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </>
          )}

          {phase === "generating" && (
            <div style={{ padding: "10px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Generating packet…</div>
              <div style={{ height: 10, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)", transition: "width .25s" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>{pct}% — {progress.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>Each section is rendered on the server and assembled here. Large packets with many photos can take a minute — keep this window open.</div>
            </div>
          )}

          {phase === "done" && result && (
            <div>
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, color: "#15803d" }}>✓ Packet ready — {result.pageCount} pages · {(result.bytes.length / 1048576).toFixed(1)} MB</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#166534", marginTop: 2 }}>{result.filename}</div>
              </div>
              <div style={{ fontSize: 12, marginBottom: 10, color: saveState.status === "failed" ? "#dc2626" : "var(--text-secondary)" }}>
                {saveState.status === "saving" && "Saving a copy to this call's documents…"}
                {saveState.status === "saved" && "✓ A copy was saved to this call's attached documents and the generation was logged."}
                {saveState.status === "failed" && `⚠️ Couldn't save a copy to the call's documents (${saveState.message}). The packet below is still good — download it now.`}
              </div>
              {result.skipped.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#92400e", marginBottom: 10 }}>
                  <strong>Skipped:</strong>
                  <ul style={{ margin: "4px 0 0 18px" }}>{result.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 12 }}>
                <tbody>
                  {result.sections.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "4px 2px" }}>{s.label}</td>
                      <td style={{ padding: "4px 2px", textAlign: "right", color: "var(--text-secondary)" }}>p. {s.startPage}{s.pages > 1 ? `–${s.startPage + s.pages - 1}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {showEmail && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div className="form-group"><label className="form-label">Send to</label>
                    <input className="form-input" type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@example.gov" />
                  </div>
                  <div className="form-group"><label className="form-label">Message (optional)</label>
                    <textarea className="form-textarea" rows={3} value={emailMsg} onChange={(e) => setEmailMsg(e.target.value)} />
                  </div>
                  {emailState.status === "error" && <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>⚠️ {emailState.message}</div>}
                  {emailState.status === "sent" && <div style={{ color: "#15803d", fontSize: 12, marginBottom: 8 }}>✓ Sent with the PDF attached.</div>}
                  <button className="btn btn-primary btn-sm" onClick={sendEmail} disabled={emailState.status === "sending" || !emailTo.trim() || saveState.status !== "saved"}>
                    {emailState.status === "sending" ? "Sending…" : "Send Packet"}
                  </button>
                  {saveState.status !== "saved" && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>Available once the copy is saved.</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexWrap: "wrap" }}>
          {phase === "select" && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set(defs.map((d) => d.id)))} disabled={!extras}>Select All</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setChecked(new Set())} disabled={!extras}>Deselect All</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={generate} disabled={!extras || checked.size === 0}>Generate Packet</button>
            </>
          )}
          {phase === "generating" && (
            <>
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => { abortRef.current.aborted = true; }}>Cancel</button>
            </>
          )}
          {phase === "done" && (
            <>
              <button className="btn btn-primary" onClick={download}>⬇ Download PDF</button>
              <button className="btn btn-secondary" onClick={print}>🖨 Print</button>
              <button className="btn btn-secondary" onClick={() => setShowEmail((v) => !v)}>✉ Email Packet</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
