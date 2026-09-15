"use client";
import { getCurrentUser } from "@/lib/auth";
import FieldIntakeWizard from "@/components/fieldIntake/FieldIntakeWizard";
import type { Animal } from "@/lib/types";

interface Props {
  callId: string;
  callAddress?: string;
  onIntakeComplete: (animal: Animal) => void;
  onClose: () => void;
}

// Opens the field intake wizard inline over the dispatch call page — the
// user is already authenticated in the main app, so this reuses that same
// session directly instead of routing through the standalone
// /officer/field-intake page (which has its own auth gate meant for a
// phone opening the PWA cold).
export default function FieldIntakeModal({ callId, callAddress, onIntakeComplete, onClose }: Props) {
  const officer = getCurrentUser();
  if (!officer) return null; // can't happen — dispatch itself requires a session

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "95vw", maxWidth: 480, borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
      >
        <FieldIntakeWizard
          officer={officer}
          prefillCallId={callId}
          prefillAddress={callAddress}
          onClose={onClose}
          onIntakeComplete={onIntakeComplete}
        />
      </div>
    </div>
  );
}
