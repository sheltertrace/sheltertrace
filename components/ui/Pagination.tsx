"use client";

interface PaginationProps {
  total: number;
  perPage: number;
  current: number;
  onChange: (page: number) => void;
}

export default function Pagination({ total, perPage, current, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 2 && i <= current + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="pagination">
      <button className="page-btn" disabled={current <= 1} onClick={() => onChange(current - 1)}>‹</button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "#94a3b8" }}>…</span>
        ) : (
          <button
            key={p}
            className={`page-btn${current === p ? " active" : ""}`}
            onClick={() => onChange(p as number)}
          >
            {p}
          </button>
        )
      )}
      <button className="page-btn" disabled={current >= totalPages} onClick={() => onChange(current + 1)}>›</button>
    </div>
  );
}
