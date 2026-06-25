"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/providers";
import { changePassword, updateMyProfile, saveVetSignature, fetchVetSignature } from "@/lib/clinicData";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-group"><label className="form-label">{label}</label>{children}</div>;
}

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: "Weak", color: "#dc2626", pct: 25 };
  if (score <= 3) return { label: "Fair", color: "#f59e0b", pct: 50 };
  if (score <= 4) return { label: "Good", color: "#0369a1", pct: 75 };
  return { label: "Strong", color: "#15803d", pct: 100 };
}

export default function ClinicProfilePage() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [signature, setSignature] = useState<string | null>(null);
  const [sigSaving, setSigSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || user.first_name || "");
    setLastName(user.lastName || user.last_name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    fetchVetSignature(user.id).then(setSignature);
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setProfileSaving(true);
    try {
      await updateMyProfile(user.id, { first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e: unknown) {
      alert(`Failed: ${(e as { message?: string }).message}`);
    } finally { setProfileSaving(false); }
  };

  const handleChangePw = async () => {
    setPwMsg(null);
    if (!user?.id) return;
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "New passwords do not match" }); return; }
    if (newPw.length < 8) { setPwMsg({ ok: false, text: "Password must be at least 8 characters" }); return; }
    if (!/\d/.test(newPw)) { setPwMsg({ ok: false, text: "Password must contain at least one number" }); return; }
    setPwSaving(true);
    const result = await changePassword(user.id, curPw, newPw);
    setPwSaving(false);
    if (result.ok) {
      setPwMsg({ ok: true, text: "Password updated successfully" });
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwMsg({ ok: false, text: result.error || "Failed to change password" });
    }
  };

  const toPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ("touches" in e) { const t = e.touches[0]; return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }; }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); setDrawing(true); const c = canvasRef.current; if (c) lastPos.current = toPos(e, c); };
  const drawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return; e.preventDefault();
    const c = canvasRef.current; const ctx = c?.getContext("2d"); if (!c || !ctx || !lastPos.current) return;
    const pos = toPos(e, c); ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y); ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); lastPos.current = pos; setHasStrokes(true);
  };
  const endDraw = () => { setDrawing(false); lastPos.current = null; };
  const clearCanvas = () => { const c = canvasRef.current; const ctx = c?.getContext("2d"); if (c && ctx) ctx.clearRect(0, 0, c.width, c.height); setHasStrokes(false); };

  const handleSaveSig = useCallback(async () => {
    if (!user?.id || !canvasRef.current) return;
    setSigSaving(true);
    try { const d = canvasRef.current.toDataURL("image/png"); await saveVetSignature(user.id, d); setSignature(d); clearCanvas(); }
    catch (e: unknown) { alert(`Failed: ${(e as { message?: string }).message}`); }
    finally { setSigSaving(false); }
  }, [user?.id]);

  const strength = passwordStrength(newPw);

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>👤 My Profile</h1>

      {/* Personal Info */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", marginBottom: 14 }}>Personal Information</div>
        <div className="grid-2">
          <F label="First Name"><input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></F>
          <F label="Last Name"><input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></F>
          <F label="Email"><input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></F>
          <F label="Phone"><input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></F>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save Profile"}</button>
          {profileSaved && <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", marginBottom: 14 }}>Change Password</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
          <F label="Current Password"><input className="form-input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} /></F>
          <F label="New Password">
            <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            {newPw && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${strength.pct}%`, height: "100%", background: strength.color, transition: "width 0.2s" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: strength.color }}>{strength.label}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Min 8 characters, at least one number</div>
              </div>
            )}
          </F>
          <F label="Confirm New Password"><input className="form-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></F>
          {confirmPw && newPw !== confirmPw && <div style={{ fontSize: 12, color: "#dc2626" }}>Passwords do not match</div>}
        </div>
        {pwMsg && (
          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, background: pwMsg.ok ? "#f0fdf4" : "#fee2e2", color: pwMsg.ok ? "#15803d" : "#dc2626", fontSize: 13, fontWeight: 600 }}>
            {pwMsg.ok ? "✓ " : "⚠️ "}{pwMsg.text}
          </div>
        )}
        <button className="btn btn-primary" onClick={handleChangePw} disabled={pwSaving || !curPw || !newPw || !confirmPw || newPw !== confirmPw} style={{ marginTop: 10 }}>
          {pwSaving ? "Updating…" : "Update Password"}
        </button>
      </div>

      {/* Signature */}
      {(user?.role === "Veterinarian" || user?.role === "veterinarian") && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--teal)", marginBottom: 6 }}>Veterinarian Signature</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>Used on rabies certificates and official documents.</div>
          {signature ? (
            <div>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "inline-block", marginBottom: 10 }}>
                <img src={signature} alt="Signature" style={{ maxHeight: 80, display: "block" }} />
              </div>
              <div><button className="btn btn-secondary btn-sm" onClick={async () => { if (user?.id) { await saveVetSignature(user.id, ""); setSignature(null); } }}>Clear &amp; Redraw</button></div>
            </div>
          ) : (
            <div>
              <div style={{ border: "2px solid var(--border)", borderRadius: 8, background: "#fff", marginBottom: 10 }}>
                <canvas ref={canvasRef} width={500} height={150} style={{ width: "100%", height: 150, cursor: "crosshair", touchAction: "none", display: "block", borderRadius: 8 }}
                  onMouseDown={startDraw} onMouseMove={drawMove} onMouseUp={endDraw} onMouseLeave={endDraw}
                  onTouchStart={startDraw} onTouchMove={drawMove} onTouchEnd={endDraw} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSaveSig} disabled={!hasStrokes || sigSaving}>{sigSaving ? "Saving…" : "Save Signature"}</button>
                <button className="btn btn-ghost btn-sm" onClick={clearCanvas} disabled={!hasStrokes}>Clear</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
