"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { AamvaData } from "@/lib/parseAamva";

// Load the camera modal only on the client — ZXing uses browser APIs
const ScanLicenseModal = dynamic(() => import("./ScanLicenseModal"), { ssr: false });

interface Props {
  onScan: (data: AamvaData) => void;
  label?: string;
  style?: React.CSSProperties;
}

export default function ScanLicenseButton({ onScan, label = "Scan License", style }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
        title="Scan the PDF417 barcode on the back of a driver's license"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, ...style }}
      >
        <span style={{ fontSize: 14 }}>📷</span> {label}
      </button>

      {open && (
        <ScanLicenseModal
          onScan={(data) => {
            setOpen(false);
            onScan(data);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
