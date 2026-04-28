"use client";
import { useRef, useState } from "react";

interface Props {
  label: string;
  value: string | null;
  timestamp: string | null;
  onAccept: (data: string, timestamp: string) => void;
  onClear: () => void;
}

export default function SignaturePad({ label, value, timestamp, onAccept, onClear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const toCanvasPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    setHasStrokes(true);
    lastPos.current = toCanvasPos(e, canvas);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !lastPos.current) return;
    const pos = toCanvasPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    onClear();
  };

  const handleAccept = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    const data = canvas.toDataURL("image/png");
    const ts = new Date().toLocaleString("en-US", {
      month: "2-digit", day: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    onAccept(data, ts);
  };

  if (value) {
    return (
      <div style={{ border: "1px solid #86efac", borderRadius: 8, padding: 14, background: "#f0fdf4" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 8, textTransform: "uppercase" }}>
          ✓ {label}
        </div>
        <img
          src={value}
          alt="Signature"
          style={{ display: "block", maxWidth: "100%", height: 80, objectFit: "contain", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 4, padding: 4 }}
        />
        <div style={{ fontSize: 11, color: "#16a34a", marginTop: 6 }}>Signed at {timestamp}</div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}
          onClick={onClear}
        >
          ✕ Clear &amp; Re-sign
        </button>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "#fafafa" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase" }}>
        {label}
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={130}
        style={{
          display: "block", width: "100%", height: 130,
          background: "#fff", border: "2px solid #e2e8f0", borderRadius: 6,
          cursor: "crosshair", touchAction: "none",
        }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" onClick={handleClear} disabled={!hasStrokes}>
          Clear
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleAccept}
          disabled={!hasStrokes}
          style={{ fontWeight: 700 }}
        >
          ✓ Accept Signature
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sign with mouse or finger</span>
      </div>
    </div>
  );
}
