// Shared file-type/size validation for every public and staff upload zone.
// Mirrors the semantics of the HTML `accept` attribute (exact MIME, "type/*"
// wildcards, and ".ext" extensions) so the JS check never rejects a file the
// accept string was actually written to allow.

function parseAccept(accept: string): string[] {
  return accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isFileTypeAccepted(file: File, accept: string): boolean {
  const entries = parseAccept(accept);
  if (entries.length === 0 || entries.includes("*")) return true;

  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot) : "";
  if (ext && entries.includes(ext)) return true;

  // No usable MIME (common on some mobile browsers/HEIC uploads) — extension
  // is the only signal available, and it already failed the check above.
  const type = (file.type || "").toLowerCase();
  if (!type) return false;

  return entries.some((e) => {
    if (e.startsWith(".")) return false; // already checked
    if (e.endsWith("/*")) return type.startsWith(e.slice(0, -1));
    return type === e;
  });
}

export function deriveAcceptLabel(accept: string): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  const add = (l: string) => {
    const u = l.toUpperCase();
    if (u && !seen.has(u)) { seen.add(u); labels.push(u); }
  };
  for (const raw of accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    if (raw === "*") continue;
    if (raw.startsWith(".")) { add(raw.slice(1)); continue; }
    if (raw.endsWith("/*")) { add(raw.slice(0, raw.indexOf("/"))); continue; }
    const sub = raw.split("/")[1];
    if (sub) add(sub.split("+")[0]);
  }
  return labels.join(", ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
