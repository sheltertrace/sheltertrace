"use client";
import { getCurrentUser } from "@/lib/auth";
import FieldIntakeWizard from "@/components/fieldIntake/FieldIntakeWizard";
import { clearDraft } from "@/lib/fieldIntake";
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

  // Closing here (the ✕, the backdrop, or "Done" after a completed intake)
  // must genuinely discard an in-progress form — the wizard's autosave-to-
  // localStorage draft exists for the phone PWA's offline resilience, but
  // in this quick in-app popup a stale draft would otherwise resurface and
  // silently pre-fill the next intake, possibly for an unrelated call.
  const handleClose = () => {
    clearDraft();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      {/* Reuses the app's standard .modal frame (not a one-off inline size)
          so this gets the same responsive treatment as every other modal:
          a centered dialog on desktop, a full-height bottom sheet on
          mobile — via the existing @media breakpoint on .modal-overlay/.modal. */}
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, padding: 0, overflow: "hidden" }}>
        <FieldIntakeWizard
          officer={officer}
          prefillCallId={callId}
          prefillAddress={callAddress}
          onClose={handleClose}
          onIntakeComplete={onIntakeComplete}
        />
      </div>
    </div>
  );
}
