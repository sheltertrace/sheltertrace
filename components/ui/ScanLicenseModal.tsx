"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { parseAamva, type AamvaData } from "@/lib/parseAamva";

interface Props {
  onScan: (data: AamvaData) => void;
  onClose: () => void;
}

export default function ScanLicenseModal({ onScan, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<"starting" | "scanning" | "success" | "error">("starting");
  const [errMsg, setErrMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(30);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      try {
        if (!videoRef.current) return;

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result, _err) => {
            if (cancelledRef.current || !result) return;
            const text = result.getText();
            // Sanity check: AAMVA barcodes always contain at least one DL field code
            if (!text.includes("DAQ") && !text.includes("DCS") && !text.includes("DAC")) return;
            cancelledRef.current = true;
            controls.stop();
            controlsRef.current = null;
            setPhase("success");
            const data = parseAamva(text);
            setTimeout(() => onScan(data), 500);
          }
        );

        if (cancelledRef.current) {
          controls.stop();
        } else {
          controlsRef.current = controls;
          setPhase("scanning");
        }
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        const e = err as { name?: string; message?: string };
        if (e.name === "NotAllowedError" || e.message?.includes("ermission")) {
          setErrMsg("Camera access denied. Please allow camera permission in your browser and try again.");
        } else if (e.name === "NotFoundError") {
          setErrMsg("No camera found on this device.");
        } else {
          setErrMsg(`Camera error: ${e.message || "Unknown error"}`);
        }
        setPhase("error");
      }
    })();

    return () => { stop(); };
  }, [onScan, stop]);

  // 30-second countdown timeout
  useEffect(() => {
    if (phase !== "scanning") return;
    setSecondsLeft(30);
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          stop();
          setErrMsg("Scan timed out. Could not read the barcode. Please try again or enter the information manually.");
          setPhase("error");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, stop]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal"
        style={{ maxWidth: 520, width: "95vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">📷 Scan Driver's License</span>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
            Hold the <strong>back</strong> of the license in front of the camera and aim at the
            <strong> PDF417 barcode</strong> (the wide rectangular barcode).
          </p>

          {phase === "error" ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📵</div>
              <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{errMsg}</div>
              <button className="btn btn-secondary" onClick={handleClose}>Enter Manually Instead</button>
            </div>
          ) : (
            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000" }}>
              {/* Live camera feed */}
              <video
                ref={videoRef}
                style={{ width: "100%", display: "block", minHeight: 260 }}
                muted
                playsInline
              />

              {/* Viewfinder — wide rectangle for PDF417 */}
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}>
                {/* Shadow mask */}
                <div style={{
                  width: "82%",
                  height: 76,
                  borderRadius: 6,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  border: phase === "success" ? "2px solid #22c55e" : "2px solid #22d3ee",
                  transition: "border-color 0.2s",
                }}>
                  {/* Corner markers */}
                  {[
                    { top: -2, left: -2, borderRight: "none", borderBottom: "none" },
                    { top: -2, right: -2, borderLeft: "none", borderBottom: "none" },
                    { bottom: -2, left: -2, borderRight: "none", borderTop: "none" },
                    { bottom: -2, right: -2, borderLeft: "none", borderTop: "none" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      width: 18, height: 18,
                      border: "3px solid",
                      borderColor: phase === "success" ? "#22c55e" : "#22d3ee",
                      ...s,
                    }} />
                  ))}
                </div>
              </div>

              {/* Status overlay */}
              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", pointerEvents: "none" }}>
                {phase === "starting" && (
                  <span style={{ background: "rgba(0,0,0,0.65)", color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 12 }}>
                    Starting camera…
                  </span>
                )}
                {phase === "scanning" && (
                  <span style={{ background: "rgba(0,0,0,0.65)", color: "#22d3ee", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    🔍 Align barcode inside the box · {secondsLeft}s
                  </span>
                )}
                {phase === "success" && (
                  <span style={{ background: "rgba(34,197,94,0.85)", color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    ✓ Barcode detected — reading data…
                  </span>
                )}
              </div>
            </div>
          )}

          {phase !== "error" && (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
              <strong>Tips:</strong> Ensure good lighting. Hold steady. The barcode is the wide striped one — not the magnetic stripe or the small QR code.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel / Enter Manually
          </button>
        </div>
      </div>
    </div>
  );
}
