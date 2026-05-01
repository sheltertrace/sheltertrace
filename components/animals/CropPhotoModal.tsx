"use client";
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { supabase } from "@/lib/supabase";

interface Props {
  photoUrl: string;
  animalId: string;
  animalName: string;
  onSave: (newUrl: string) => void;
  onClose: () => void;
}

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1 Square", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
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
    img.onerror = () => reject(new Error("Image failed to load. The photo may not support cross-origin access."));
    // Append cache-bust so the browser re-fetches with CORS headers
    img.src = imageSrc.includes("?") ? imageSrc : `${imageSrc}?cb=${Date.now()}`;
  });
}

export default function CropPhotoModal({ photoUrl, animalId, animalName, onSave, onClose }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(1); // default: Square
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const aspect = ASPECTS[aspectIdx].value;

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setErrMsg("");
    try {
      const blob = await cropToBlob(photoUrl, croppedAreaPixels);
      const file = new File([blob], "photo-cropped.jpg", { type: "image/jpeg" });
      const path = `${animalId}/${Date.now()}-cropped.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("animal-photos")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("animal-photos").getPublicUrl(path);
      onSave(urlData.publicUrl);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || "Unknown error";
      setErrMsg(msg.includes("cross-origin") || msg.includes("load")
        ? "Could not read this photo for cropping (CORS). Try uploading the photo again first, then crop."
        : `Crop failed: ${msg}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 660, width: "95vw", padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">✂️ Crop Photo — {animalName}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Crop area */}
        <div style={{ position: "relative", width: "100%", height: "min(55vh, 420px)", background: "#111" }}>
          <Cropper
            image={photoUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: "2px solid #22d3ee", boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" },
            }}
          />
        </div>

        {/* Controls */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
          {/* Aspect ratio */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>Aspect:</span>
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

          {/* Zoom slider */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
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
              {zoom.toFixed(2)}×
            </span>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            Drag to reposition · Pinch or scroll to zoom · Drag corners/edges to resize crop box
          </div>
        </div>

        {/* Error */}
        {errMsg && (
          <div style={{ margin: "0 18px 10px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "9px 13px", fontSize: 12, color: "#dc2626", lineHeight: 1.5 }}>
            ⚠️ {errMsg}
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={saving || !croppedAreaPixels}>
            {saving ? "Saving…" : "✓ Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
