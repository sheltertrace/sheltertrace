"use client";
import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  previewUrl?: string;
  progress: number;
  error?: string;
  file: File;
}

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
  capture?: "environment" | "user";
  children?: React.ReactNode;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf") return "📄";
  if (type.includes("word") || type.includes("doc")) return "📝";
  if (type.includes("sheet") || type.includes("xls") || type.includes("csv")) return "📊";
  return "📎";
}

export default function DragDropUpload({
  onFiles,
  accept = DEFAULT_ACCEPT,
  multiple = false,
  maxSizeMB = 10,
  label,
  compact = false,
  disabled = false,
  capture,
  children,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const acceptSet = new Set(
    accept.split(",").map((s) => s.trim().toLowerCase())
  );

  const isAccepted = useCallback((file: File): boolean => {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
    return acceptSet.has(file.type.toLowerCase()) || acceptSet.has(ext) || acceptSet.has("*");
  }, [acceptSet]);

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const errs: string[] = [];
    const valid: File[] = [];

    for (const f of files) {
      if (!isAccepted(f)) {
        errs.push(`${f.name}: file type not allowed`);
      } else if (f.size > maxBytes) {
        errs.push(`${f.name}: exceeds ${maxSizeMB}MB limit (${formatSize(f.size)})`);
      } else {
        valid.push(f);
      }
    }

    setErrors(errs);
    if (valid.length > 0) {
      onFiles(multiple ? valid : [valid[0]]);
    }
  }, [isAccepted, maxBytes, maxSizeMB, multiple, onFiles]);

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    if (dragCountRef.current === 1) setDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current = 0;
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = "";
  };

  if (children) {
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ position: "relative" }}
      >
        {children}
        {dragging && !disabled && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(26,138,138,0.12)", border: "3px solid #1a8a8a",
            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
            backdropFilter: "blur(2px)",
          }}>
            <div style={{ background: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 700, color: "#1a8a8a", fontSize: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
              Release to upload
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          capture={capture}
          style={{ display: "none" }}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? "#1a8a8a" : "var(--border)"}`,
          borderRadius: compact ? 8 : 12,
          padding: compact ? "12px 16px" : "24px 16px",
          background: dragging ? "rgba(26,138,138,0.06)" : disabled ? "var(--bg-muted)" : "transparent",
          cursor: disabled ? "default" : "pointer",
          textAlign: "center",
          transition: "all 0.15s ease",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: compact ? 20 : 32, marginBottom: compact ? 4 : 8 }}>
          {dragging ? "📥" : "📁"}
        </div>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: dragging ? "#1a8a8a" : "var(--text-secondary)" }}>
          {dragging ? "Release to upload" : (label || "Drop files here or click to browse")}
        </div>
        {!compact && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {multiple ? "Multiple files allowed" : "Single file"} · Max {maxSizeMB}MB
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture}
        style={{ display: "none" }}
        onChange={handleChange}
        disabled={disabled}
      />
      {errors.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {errors.map((err, i) => (
            <div key={i} style={{ fontSize: 11, color: "#dc2626", padding: "2px 0" }}>⚠️ {err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FilePreview({ file, url, onRemove }: { file?: File; url: string; onRemove?: () => void }) {
  const isImage = file ? file.type.startsWith("image/") : /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url);
  const icon = file ? fileIcon(file.type) : isImage ? "🖼️" : "📄";
  const name = file?.name || url.split("/").pop()?.split("?")[0] || "File";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--bg-muted)", borderRadius: 8, fontSize: 12 }}>
      {isImage ? (
        <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }} />
      ) : (
        <span style={{ fontSize: 22 }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {file && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatSize(file.size)}</div>}
      </div>
      {onRemove && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: 11, color: "#dc2626", padding: "2px 6px" }}
          onClick={onRemove}
        >✕</button>
      )}
    </div>
  );
}
