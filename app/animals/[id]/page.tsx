"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import AnimalDetail from "@/components/animals/AnimalDetail";
import { fetchAnimal, fetchMedical, fetchPeople, fetchCalls, deleteAnimal } from "@/lib/data";
import { useAuth } from "@/app/providers";
import type { Animal, MedicalRecord, Person, DispatchCall } from "@/lib/types";

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [medical, setMedical] = useState<MedicalRecord[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, m, p, c] = await Promise.all([
        fetchAnimal(id),
        fetchMedical(id),
        fetchPeople(),
        fetchCalls(),
      ]);
      if (!a) { setNotFound(true); return; }
      setAnimal(a);
      setMedical(m);
      setPeople(p);
      setCalls(c);
    } catch { setNotFound(true); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!animal) return;
    setDeleting(true);
    try {
      await deleteAnimal(animal.id);
      router.push("/animals");
    } catch (e) {
      console.error("Delete failed:", e);
      setDeleting(false);
    }
  };

  // Admin = permissions includes "all"
  const isAdmin = Array.isArray(user?.permissions) && user.permissions.includes("all");

  console.log("[AnimalDetailPage] user role:", user?.role, "| permissions:", user?.permissions, "| isAdmin:", isAdmin);

  if (loading) return <AppShell title="Animal Detail"><div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Loading…</div></AppShell>;
  if (notFound || !animal) return <AppShell title="Animal Not Found"><div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Animal not found.</div></AppShell>;

  return (
    <AppShell title={`${animal.name} — ${animal.id}`}>
      <AnimalDetail
        animal={animal}
        medical={medical}
        people={people}
        dispatchCalls={calls}
        onUpdate={setAnimal}
      />

      {/* Delete Animal — admin only, always rendered at bottom of page */}
      {isAdmin && (
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "2px solid #fee2e2", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            🗑 Delete Animal Record
          </button>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Permanently removes this animal and all associated records. Admin only.
          </span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && animal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 0, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#fef2f2", padding: "16px 20px", borderBottom: "1px solid #fecaca", borderLeft: "4px solid #dc2626", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#dc2626" }}>Delete Animal Record</span>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{animal.name}</strong> <span style={{ fontFamily: "monospace", color: "#64748b" }}>({animal.id})</span>?
              </p>
              <p style={{ fontSize: 13, color: "#dc2626", background: "#fee2e2", padding: "10px 14px", borderRadius: 7, border: "1px solid #fca5a5", lineHeight: 1.5, margin: 0 }}>
                This action cannot be undone. All medical records, notes, and attachments for this animal will also be deleted.
              </p>
            </div>
            <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "Deleting…" : "Yes, Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
