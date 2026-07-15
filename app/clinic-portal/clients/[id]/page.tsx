"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { useClinic } from "@/components/clinic/ClinicShell";
import { fetchClinicAnimals } from "@/lib/clinicData";
import type { ClinicAnimal } from "@/lib/clinicTypes";
import AddAnimalModal from "@/components/clinic/AddAnimalModal";
import { displayAge } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { clients, shelterLinks } = useClinic();
  const router = useRouter();
  const [animals, setAnimals] = useState<ClinicAnimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const client = clients.find((c) => c.id === id);

  useEffect(() => {
    if (!user?.id || !id) return;
    setLoading(true);
    fetchClinicAnimals(user.id, id).then(setAnimals).finally(() => setLoading(false));
  }, [user?.id, id]);

  if (clients.length > 0 && !client) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 12 }}>County client not found.</div>
        <Link href="/clinic-portal/clients" style={{ color: "var(--teal)", fontSize: 13 }}>← Back to County Clients</Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <Link href="/clinic-portal/clients" style={{ color: "var(--teal)", fontSize: 13, textDecoration: "none" }}>
          ← County Clients
        </Link>
      </div>

      {client && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 2 }}>{client.county_name}</h1>
              {client.agency_name && (
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{client.agency_name}</div>
              )}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-secondary)" }}>
                {client.contact_person && <span>👤 {client.contact_person}</span>}
                {client.contact_email && <span>📧 {client.contact_email}</span>}
                {client.contact_phone && <span>📞 {client.contact_phone}</span>}
                {(client.address || client.city) && (
                  <span>📍 {[client.address, client.city, client.state].filter(Boolean).join(", ")}</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span
                className="badge"
                style={{ background: client.active ? "#dcfce7" : "#fee2e2", color: client.active ? "#15803d" : "#dc2626" }}
              >
                {client.active ? "Active" : "Inactive"}
              </span>
              {client.billing_type && (
                <span className="badge" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", fontSize: 10 }}>
                  {client.billing_type.replace("_", " ")}
                </span>
              )}
              {client.contract_end && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Contract ends {client.contract_end}</span>
              )}
            </div>
          </div>
          {client.notes && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 6, fontSize: 12, color: "var(--text-secondary)" }}>
              {client.notes}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>
          🐾 Animals {!loading && `(${animals.length})`}
        </h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          + Add Animal
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Species</th>
                <th>Breed</th>
                <th>Sex</th>
                <th>Age</th>
                <th>Microchip</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {animals.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                    No animals added yet.{" "}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAdd(true)}
                      style={{ marginLeft: 8 }}
                    >
                      + Add Animal
                    </button>
                  </td>
                </tr>
              ) : (
                animals.map((a) => (
                  <tr
                    key={a.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/clinic-portal/animals/${a.id}`)}
                  >
                    <td style={{ width: 40 }}>
                      {a.photo_url ? (
                        <img src={a.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>
                          {a.species === "Dog" ? "🐕" : a.species === "Cat" ? "🐈" : "🐾"}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      <a
                        href={`/clinic-portal/animals/${a.id}`}
                        style={{ color: "var(--teal)", textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.name || "—"}
                      </a>
                    </td>
                    <td style={{ fontSize: 12 }}>{a.species || "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.breed || "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.sex || "—"}</td>
                    <td style={{ fontSize: 12 }}>{displayAge(a.age) || "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11 }}>{a.microchip || "—"}</td>
                    <td><span className="badge">{a.status || "Active"}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {user && (
        <AddAnimalModal
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          onSaved={(animal) => setAnimals((prev) => [animal, ...prev])}
          prefillClientId={id}
          clinicAccountId={user.id}
          clients={clients}
          shelterLinks={shelterLinks}
        />
      )}
    </div>
  );
}
