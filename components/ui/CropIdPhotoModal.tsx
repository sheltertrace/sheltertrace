"use client";
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

interface Props {
  imageUrl: string;
  title?: string;
  onApply: (croppedBlob: Blob) => void;
  onUseOriginal: () => void;
  onClose: () => void;
}

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "ID Card", value: 85.6 / 53.98 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
];

async function cropToBlob(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null")),
        "image/jpeg",
        0.92
      );
    };
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = imageSrc.includes("?") ? imageSrc : `${imageSrc}?cb=${Date.now()}`;
  });
}

export default function CropIdPhotoModal({ imageUrl, title, onApply, onUseOriginal, onClose }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const aspect = ASPECTS[aspectIdx].value;

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handlePreview = async () => {
    if (!croppedAreaPixels) return;
    try {
      const blob = await cropToBlob(imageUrl, croppedAreaPixels);
      setPreview(URL.createObjectURL(blob));
    } catch { }
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setErrMsg("");
    try {
      const blob = await cropToBlob(imageUrl, croppedAreaPixels);
      onApply(blob);
    } catch (err: unknown) {
      setErrMsg((err as Error).message || "Crop failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div
        className="modal"
        style={{ maxWidth: 680, width: "95vw", padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">✂️ {title || "Crop Photo ID"}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {preview ? (
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>Crop Preview</div>
            <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 8, border: "2px solid var(--border)" }} />
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", height: "min(50vh, 400px)", background: "#111", touchAction: "none" }}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              style={{
                containerStyle: { borderRadius: 0 },
                cropAreaStyle: { border: "2px solid #38bdf8", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" },
              }}
            />
          </div>
        )}

        {!preview && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>Ratio:</span>
              {ASPECTS.map((a, i) => (
                <button
                  key={a.label}
                  className={`btn btn-sm ${aspectIdx === i ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAspectIdx(i)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", width: 44 }}>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--teal)" }}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)", width: 36, textAlign: "right" }}>
                {zoom.toFixed(1)}×
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              Drag to reposition · Pinch or scroll to zoom · Touch-friendly on mobile
            </div>
          </div>
        )}

        {errMsg && (
          <div style={{ margin: "0 18px 10px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626" }}>
            ⚠️ {errMsg}
          </div>
        )}

        <div className="modal-footer" style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <button className="btn btn-secondary" onClick={onUseOriginal} disabled={saving}>
            Use Original
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {preview ? (
              <>
                <button className="btn btn-secondary" onClick={() => setPreview(null)}>Back to Crop</button>
                <button className="btn btn-primary" onClick={handleApply} disabled={saving}>
                  {saving ? "Saving…" : "✓ Apply Crop"}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handlePreview} disabled={!croppedAreaPixels}>
                  Preview
                </button>
                <button className="btn btn-primary" onClick={handleApply} disabled={saving || !croppedAreaPixels}>
                  {saving ? "Saving…" : "✓ Apply Crop"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
