"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { fetchClinicSettings, saveClinicSettings, saveVetSignature, fetchVetSignature } from "@/lib/clinicData";
import type { ClinicSettings } from "@/lib/clinicTypes";

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export default function ClinicSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ClinicSettings>({
    clinic_name: "", vet_name: "", vet_credentials: "DVM", license_number: "",
    clinic_address: "", clinic_phone: "", clinic_email: "", logo_url: "",
    tax_rate: 0, invoice_prefix: "INV-", email_signature: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchClinicSettings(user.id).then(setSettings);
    fetchVetSignature(user.id).then(setSignature);
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await saveClinicSettings(user.id, settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      alert(`Save failed: ${(e as { message?: string }).message}`);
    } finally { setSaving(false); }
  };

  // Signature drawing
  const toPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    lastPos.current = toPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPos.current) return;
    const pos = toPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  };

  const endDraw = () => { setDrawing(false); lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    setHasStrokes(false);
  };

  const handleSaveSignature = useCallback(async () => {
    if (!user?.id || !canvasRef.current) return;
    setSigSaving(true);
    try {
      const data = canvasRef.current.toDataURL("image/png");
      await saveVetSignature(user.id, data);
      setSignature(data);
      clearCanvas();
    } catch (e: unknown) {
      alert(`Failed to save: ${(e as { message?: string }).message}`);
    } finally { setSigSaving(false); }
  }, [user?.id]);

  const handleClearSignature = async () => {
    if (!user?.id) return;
    await saveVetSignature(user.id, "");
    setSignature(null);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>⚙️ Clinic Settings</h1>

      {/* Practice Info */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", marginBottom: 14 }}>Practice Information</div>
        <div className="grid-2">
          <F label="Clinic / Practice Name"><input className="form-input" value={settings.clinic_name} onChange={(e) => setSettings((s) => ({ ...s, clinic_name: e.target.value }))} placeholder="e.g. Madison Veterinary Clinic" /></F>
          <F label="Veterinarian Name"><input className="form-input" value={settings.vet_name} onChange={(e) => setSettings((s) => ({ ...s, vet_name: e.target.value }))} placeholder="e.g. Dr. Jane Smith" /></F>
          <F label="Credentials"><input className="form-input" value={settings.vet_credentials} onChange={(e) => setSettings((s) => ({ ...s, vet_credentials: e.target.value }))} placeholder="DVM" style={{ maxWidth: 120 }} /></F>
          <F label="Veterinary License #"><input className="form-input" value={settings.license_number} onChange={(e) => setSettings((s) => ({ ...s, license_number: e.target.value }))} placeholder="e.g. VET-12345" /></F>
          <F label="Clinic Address" hint="Appears on certificates and invoices"><input className="form-input" value={settings.clinic_address} onChange={(e) => setSettings((s) => ({ ...s, clinic_address: e.target.value }))} /></F>
          <F label="Clinic Phone"><input className="form-input" type="tel" value={settings.clinic_phone} onChange={(e) => setSettings((s) => ({ ...s, clinic_phone: e.target.value }))} /></F>
          <F label="Clinic Email"><input className="form-input" type="email" value={settings.clinic_email} onChange={(e) => setSettings((s) => ({ ...s, clinic_email: e.target.value }))} /></F>
        </div>

        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", margin: "16px 0 14px" }}>Billing Defaults</div>
        <div className="grid-2">
          <F label="Tax Rate (%)" hint="Applied to invoices"><input className="form-input" type="number" min="0" step="0.01" value={settings.tax_rate} onChange={(e) => setSettings((s) => ({ ...s, tax_rate: parseFloat(e.target.value) || 0 }))} style={{ maxWidth: 100 }} /></F>
          <F label="Invoice Number Prefix"><input className="form-input" value={settings.invoice_prefix} onChange={(e) => setSettings((s) => ({ ...s, invoice_prefix: e.target.value }))} placeholder="INV-" style={{ maxWidth: 140 }} /></F>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Settings"}</button>
          {saved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Veterinarian Signature */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", marginBottom: 6 }}>Veterinarian Signature</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          Draw your signature below. It will be automatically applied to all rabies certificates and official documents.
        </div>

        {signature ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--text-secondary)" }}>Current Signature:</div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "inline-block", marginBottom: 10 }}>
              <img src={signature} alt="Vet Signature" style={{ maxHeight: 80, display: "block" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleClearSignature}>Clear &amp; Redraw</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ border: "2px solid var(--border)", borderRadius: 8, background: "#fff", marginBottom: 10 }}>
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                style={{ width: "100%", height: 150, cursor: "crosshair", touchAction: "none", display: "block", borderRadius: 8 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleSaveSignature} disabled={!hasStrokes || sigSaving}>
                {sigSaving ? "Saving…" : "Save Signature"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearCanvas} disabled={!hasStrokes}>Clear</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Draw your signature with your mouse or finger (touch supported). This signature appears on printed certificates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
