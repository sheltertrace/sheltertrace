// Shared notification utilities — used by both AppShell (global) and Messages page.

/** Two-tone chime using Web Audio API. No external file needed. */
export function playNotificationSound(): void {
  try {
    type AudioCtxCtor = typeof AudioContext;
    const AudioCtx: AudioCtxCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx  = new AudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = "sine";
    osc.frequency.value = 880;   // A5
    gain.gain.value     = 0.28;
    osc.start();
    setTimeout(() => { osc.frequency.value = 1174; }, 150); // D6
    setTimeout(() => { osc.stop(); ctx.close(); }, 320);
  } catch { /* silently no-op if audio unavailable */ }
}

/** Show a browser OS notification (only when permission is "granted"). */
export function showBrowserNotification(senderName: string, preview: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("New Message — ShelterTrace", {
      body: `${senderName}: ${preview}`,
      icon: "/mcas_logo.png",
      tag:  "sheltertrace-msg",
    });
  } catch { /* ignore */ }
}

/** True when the current localStorage flag says sounds are muted. */
export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("msg_muted") === "true";
}
