"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabasePublic } from "@/lib/supabase-public";

// ── Scroll-reveal hook ────────────────────────────────────────────────────────

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{ transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`, opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", ...style }}>
      {children}
    </div>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "🐾", title: "Animal Records & Intake Wizard", desc: "Multi-step intake wizard with auto-generated vaccines, kennel assignment, and complete animal profiles.", extra: "Supports Dogs, Cats, Wildlife, and Other species with species-specific intake protocols." },
  { icon: "🏠", title: "Virtual Kennel Floorplan", desc: "Visual shelter layout showing real-time occupancy, kennel cards, and rapid animal moves.", extra: "Fully customizable room and kennel layout using a drag-and-drop designer built for your facility." },
  { icon: "📡", title: "Officer Dispatch & GPS Tracking", desc: "Live call management, officer GPS tracking, narrative logging, and automated field reporting.", extra: "Real-time map view of all active officers with status updates from the field mobile app." },
  { icon: "💊", title: "Medical Records & Diagnostics", desc: "Vaccine scheduling, diagnostic test tracking (Heartworm, FIV/FeLV), and DEA-compliant drug logs.", extra: "Staff must confirm each vaccine as administered — Scheduled vs. Administered clearly distinguished." },
  { icon: "📋", title: "Citations & Court Portal", desc: "Full citation management with digital signatures, court scheduling, and judge-specific portals.", extra: "Matches physical citation forms with digital capture, electronic service, and automatic court notification." },
  { icon: "❤️", title: "Foster Care Management", desc: "Foster placements, check-ins, supply requests, and foster parent portals — all in one place.", extra: "Public foster application portal, placement tracking, and GDA-required foster agreement documentation." },
  { icon: "🙋", title: "Volunteer Kiosk & Portal", desc: "Self-service clock-in kiosk, hour tracking, announcements, and printable volunteer badges.", extra: "Confidentiality forms, volunteer agreements, and task assignment from a single clean interface." },
  { icon: "📊", title: "GDA Compliance Reporting", desc: "One-click state monthly reports, live-release rates, and customizable export formats.", extra: "Automated Basic Animal Data Matrix with species × age breakdown — meets all state reporting requirements." },
  { icon: "🔐", title: "Role-Based Staff Access", desc: "Granular permissions for Admins, Officers, Dispatchers, Vet Techs, Volunteers, and Court staff.", extra: "Each role sees only the screens they need — protecting sensitive data while enabling efficient workflows." },
];

// ── Stats ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "25+", label: "System Modules" },
  { value: "GDA", label: "& DEA Compliant" },
  { value: "100%", label: "Cloud-Based" },
  { value: "Mobile", label: "Field-Ready" },
];

// ── App mockup frames ─────────────────────────────────────────────────────────

function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
      {/* Browser chrome */}
      <div style={{ background: "#1e293b", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
        </div>
        <div style={{ flex: 1, background: "#0f172a", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: "#64748b", textAlign: "center" }}>
          app.sheltertrace.com/{title.toLowerCase().replace(/\s/g, "-")}
        </div>
      </div>
      {children}
    </div>
  );
}

function AnimalListMockup() {
  const animals = [
    { name: "Buddy", species: "🐕", breed: "Lab Mix", status: "Available", kennel: "A-3", statusColor: "#16a34a", statusBg: "#dcfce7" },
    { name: "Luna", species: "🐈", breed: "DSH", status: "Medical Hold", kennel: "M-2", statusColor: "#b45309", statusBg: "#fef3c7" },
    { name: "Rex", species: "🐕", breed: "GSD Mix", status: "Quarantine", kennel: "Q-1", statusColor: "#dc2626", statusBg: "#fee2e2" },
    { name: "Daisy", species: "🐈", breed: "Calico", status: "Available", kennel: "B-7", statusColor: "#16a34a", statusBg: "#dcfce7" },
    { name: "Max", species: "🐕", breed: "Pit Mix", status: "Pending", kennel: "A-9", statusColor: "#0369a1", statusBg: "#dbeafe" },
  ];
  return (
    <div style={{ background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0f2942", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>🐾 Animal Records</span>
        <span style={{ background: "#1a8a8a", color: "#fff", padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>+ New Intake</span>
      </div>
      <div style={{ padding: "8px 12px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["All", "Dogs", "Cats", "Available"].map(f => (
            <span key={f} style={{ background: f === "All" ? "#0f2942" : "#e2e8f0", color: f === "All" ? "#fff" : "#374151", padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{f}</span>
          ))}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {["Name", "Species", "Breed", "Kennel", "Status"].map(h => (
                <th key={h} style={{ padding: "4px 8px", textAlign: "left", color: "#475569", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {animals.map(a => (
              <tr key={a.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "5px 8px", fontWeight: 700, color: "#0f2942" }}>{a.name}</td>
                <td style={{ padding: "5px 8px" }}>{a.species}</td>
                <td style={{ padding: "5px 8px", color: "#64748b" }}>{a.breed}</td>
                <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: "#0369a1", fontWeight: 700 }}>{a.kennel}</td>
                <td style={{ padding: "5px 8px" }}>
                  <span style={{ background: a.statusBg, color: a.statusColor, padding: "2px 6px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KennelMockup() {
  type KStatus = "available" | "hold" | "medical" | "empty";
  const runs: { id: string; name: string; icon: string; status: KStatus }[] = [
    { id: "A-1", name: "Buddy",  icon: "🐕", status: "available" },
    { id: "A-2", name: "",       icon: "",   status: "empty"     },
    { id: "A-3", name: "Max",    icon: "🐕", status: "available" },
    { id: "A-4", name: "Rex",    icon: "🐕", status: "medical"   },
    { id: "A-5", name: "",       icon: "",   status: "empty"     },
    { id: "A-6", name: "Bear",   icon: "🐕", status: "hold"      },
    { id: "B-1", name: "Luna",   icon: "🐈", status: "available" },
    { id: "B-2", name: "",       icon: "",   status: "empty"     },
    { id: "B-3", name: "Daisy",  icon: "🐈", status: "hold"      },
    { id: "B-4", name: "Coco",   icon: "🐈", status: "available" },
    { id: "B-5", name: "",       icon: "",   status: "empty"     },
    { id: "B-6", name: "Milo",   icon: "🐕", status: "medical"   },
  ];
  const cfg: Record<KStatus, { bg: string; border: string; labelBg: string; labelColor: string; label: string }> = {
    available: { bg: "#f0fdf4", border: "#86efac", labelBg: "#dcfce7", labelColor: "#15803d", label: "Available" },
    hold:      { bg: "#fffbeb", border: "#fde68a", labelBg: "#fef3c7", labelColor: "#b45309", label: "Hold" },
    medical:   { bg: "#fff1f2", border: "#fda4af", labelBg: "#fee2e2", labelColor: "#dc2626", label: "Medical" },
    empty:     { bg: "#f8fafc", border: "#e2e8f0", labelBg: "#f1f5f9", labelColor: "#94a3b8", label: "Empty" },
  };
  return (
    <div style={{ background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0f2942", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>🏠 Virtual Shelter Floorplan</span>
        <span style={{ color: "#93c5fd", fontSize: 10 }}>8/12 occupied</span>
      </div>
      <div style={{ padding: "10px 12px" }}>
        {["Wing A","Wing B"].map((wing, wi) => (
          <div key={wing} style={{ marginBottom: wi === 0 ? 12 : 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>{wing}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
              {runs.slice(wi * 6, wi * 6 + 6).map(k => {
                const c = cfg[k.status];
                return (
                  <div key={k.id} style={{ background: c.bg, borderRadius: 6, border: `1.5px solid ${c.border}`, padding: "7px 4px 5px", textAlign: "center" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#64748b", marginBottom: 2 }}>{k.id}</div>
                    {k.icon && <div style={{ fontSize: 14, lineHeight: 1, marginBottom: 2 }}>{k.icon}</div>}
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                      {k.name || "—"}
                    </div>
                    <div style={{ background: c.labelBg, color: c.labelColor, fontSize: 7, fontWeight: 800, borderRadius: 3, padding: "1px 3px" }}>{c.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {(Object.entries(cfg) as [KStatus, typeof cfg[KStatus]][]).map(([key, c]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.labelBg, border: `1px solid ${c.border}` }} />
              <span style={{ fontSize: 8, color: "#64748b", fontWeight: 600 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DispatchMockup() {
  const calls = [
    { id: "D-0247", type: "Stray Animal", address: "142 Oak St", priority: "Medium", status: "Dispatched", officer: "Officer T.", pColor: "#f59e0b", sBg: "#dbeafe", sColor: "#1d4ed8" },
    { id: "D-0246", type: "Animal Bite", address: "88 Pine Ave", priority: "High", status: "On Scene", officer: "Officer M.", pColor: "#dc2626", sBg: "#dcfce7", sColor: "#15803d" },
    { id: "D-0245", type: "Noise Complaint", address: "555 Elm Dr", priority: "Low", status: "Pending", officer: "Unassigned", pColor: "#64748b", sBg: "#fef3c7", sColor: "#b45309" },
    { id: "D-0244", type: "Welfare Check", address: "200 Maple Ln", priority: "Medium", status: "Resolved", officer: "Officer T.", pColor: "#f59e0b", sBg: "#f1f5f9", sColor: "#64748b" },
  ];
  return (
    <div style={{ background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0f2942", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>📡 Dispatch</span>
        <span style={{ background: "#dc2626", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>2 Active</span>
      </div>
      <div style={{ padding: "6px 10px" }}>
        {calls.map(c => (
          <div key={c.id} style={{ padding: "7px 8px", borderBottom: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "70px 1fr 60px 65px", gap: 6, alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#0369a1", fontWeight: 700 }}>{c.id}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0f2942" }}>{c.type}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{c.address}</div>
            </div>
            <span style={{ background: c.sBg, color: c.sColor, padding: "2px 5px", borderRadius: 5, fontSize: 9, fontWeight: 700, textAlign: "center" }}>{c.status}</span>
            <span style={{ fontSize: 9, color: c.pColor, fontWeight: 700 }}>● {c.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MedicalMockup() {
  const records = [
    { type: "Vaccination", desc: "DHPP", date: "05/15/26", vet: "Dr. Smith", status: "✅", statusLabel: "Administered", sBg: "#dcfce7", sColor: "#15803d" },
    { type: "Vaccination", desc: "Bordetella", date: "05/15/26", vet: "", status: "🕐", statusLabel: "Scheduled", sBg: "#fef3c7", sColor: "#b45309" },
    { type: "Heartworm Test", desc: "4Dx Test", date: "05/15/26", vet: "Dr. Smith", status: "🔬", statusLabel: "Negative", sBg: "#dcfce7", sColor: "#15803d" },
    { type: "Treatment", desc: "Strongid Dewormer", date: "05/15/26", vet: "", status: "🕐", statusLabel: "Scheduled", sBg: "#fef3c7", sColor: "#b45309" },
  ];
  return (
    <div style={{ background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0f2942", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>💊 Medical Records — Buddy</span>
        <span style={{ background: "#1a8a8a", color: "#fff", padding: "3px 10px", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>+ Add Record</span>
      </div>
      <div style={{ padding: "6px 10px" }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "6px 10px", marginBottom: 8, fontSize: 10, color: "#92400e", fontWeight: 600 }}>
          🕐 2 vaccines scheduled — confirm when administered
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {["", "Type", "Description", "Date", "Result"].map(h => (
                <th key={h} style={{ padding: "3px 6px", textAlign: "left", color: "#475569", fontWeight: 700, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.desc} style={{ borderBottom: "1px solid #f1f5f9", background: r.statusLabel === "Scheduled" ? "#fffbeb" : undefined }}>
                <td style={{ padding: "4px 6px", fontSize: 12 }}>{r.status}</td>
                <td style={{ padding: "4px 6px" }}>
                  <span style={{ background: r.type === "Heartworm Test" ? "#f3e8ff" : "#e0f2fe", color: r.type === "Heartworm Test" ? "#7c3aed" : "#0369a1", padding: "1px 5px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{r.type}</span>
                </td>
                <td style={{ padding: "4px 6px", color: "#374151", fontWeight: 600 }}>{r.desc}</td>
                <td style={{ padding: "4px 6px", color: "#64748b" }}>{r.date}</td>
                <td style={{ padding: "4px 6px" }}>
                  <span style={{ background: r.sBg, color: r.sColor, padding: "1px 5px", borderRadius: 5, fontSize: 9, fontWeight: 700 }}>{r.statusLabel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MOCKUPS = [
  { title: "Animal Records", caption: "Complete animal profiles with intake wizard, photo upload, and behavior tracking.", content: <AnimalListMockup /> },
  { title: "Virtual Kennel", caption: "Real-time kennel occupancy map with color-coded status and one-click animal moves.", content: <KennelMockup /> },
  { title: "Dispatch Dashboard", caption: "Live call management with officer assignment, GPS tracking, and narrative logging.", content: <DispatchMockup /> },
  { title: "Medical Records", caption: "Vaccine scheduling, diagnostic tests, and DEA-compliant controlled substance logs.", content: <MedicalMockup /> },
];

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const close = () => setMobileOpen(false);

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? "rgba(13,35,58,0.96)" : "#0f2942",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
      transition: "all 0.25s",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", height: 68, display: "flex", alignItems: "center", gap: 40 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/logo.jpg" alt="ShelterTrace" width={44} height={44} style={{ borderRadius: 10, background: "#ececec", padding: 3, objectFit: "contain" }} />
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 20, letterSpacing: 0.2, lineHeight: 1 }}>ShelterTrace</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 500, letterSpacing: 0.3 }}>Shelter Management Software</div>
          </div>
        </Link>

        <nav className="st-desktop-nav" style={{ display: "flex", gap: 32, flex: 1, alignItems: "center" }}>
          {[["#features","Features"],["#screenshots","Product"],["#about","About"],["#contact","Contact"]].map(([href, label]) => (
            <a key={label} href={href} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            >{label}</a>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <Link href="/login" style={{ background: "#1a8a8a", color: "#fff", padding: "9px 22px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700, letterSpacing: 0.2, whiteSpace: "nowrap", transition: "background 0.15s" }}>
            Staff Login
          </Link>
          <button className="st-hamburger" onClick={() => setMobileOpen(v => !v)}
            style={{ display: "none", background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", padding: "4px 6px" }}>
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{ background: "#0a1e33", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 28px 20px" }}>
          {[["#features","Features"],["#screenshots","Product"],["#about","About"],["#contact","Contact"]].map(([href, label]) => (
            <a key={label} href={href}
              style={{ display: "block", color: "rgba(255,255,255,0.8)", textDecoration: "none", padding: "12px 0", fontSize: 16, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onClick={close}
            >{label}</a>
          ))}
          <Link href="/login" style={{ display: "block", background: "#1a8a8a", color: "#fff", padding: "12px 0", borderRadius: 8, textDecoration: "none", fontSize: 16, fontWeight: 700, textAlign: "center", marginTop: 16 }} onClick={close}>
            Staff Login
          </Link>
        </div>
      )}
    </header>
  );
}

// ── Contact form ──────────────────────────────────────────────────────────────

function ContactForm() {
  const [form, setForm] = useState({ name: "", shelter_name: "", county_state: "", email: "", phone: "", message: "", org_type: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.shelter_name.trim() || !form.email.trim()) return;
    setStatus("saving");
    try {
      const { error } = await supabasePublic.from("pilot_applications").insert({
        name: form.name.trim(), shelter_name: form.shelter_name.trim(),
        county_state: form.county_state.trim() || null, email: form.email.trim(),
        phone: form.phone.trim() || null, message: form.message.trim() || null,
        org_type: form.org_type || null,
      });
      if (error) throw error;
      setStatus("done");
    } catch { setStatus("error"); }
  };

  if (status === "done") {
    return (
      <div style={{ background: "rgba(26,138,138,0.15)", border: "1px solid rgba(26,138,138,0.5)", borderRadius: 14, padding: "36px", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>We'll be in touch!</div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1.7 }}>
          Thanks for your interest. We'll reach out to <strong style={{ color: "#5eead4" }}>{form.email}</strong> shortly to schedule your demo.
        </div>
      </div>
    );
  }

  const inp: React.CSSProperties = { width: "100%", padding: "13px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 15, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s", fontFamily: "inherit" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="st-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          { key: "name", label: "Your Name", placeholder: "Jane Smith", required: true, type: "text" },
          { key: "shelter_name", label: "Organization Name", placeholder: "County Animal Services", required: true, type: "text" },
          { key: "county_state", label: "County & State", placeholder: "Jefferson County, GA", required: false, type: "text" },
          { key: "email", label: "Email Address", placeholder: "you@organization.org", required: true, type: "email" },
          { key: "phone", label: "Phone (optional)", placeholder: "(555) 000-0000", required: false, type: "tel" },
        ].map(field => (
          <div key={field.key}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {field.label}{field.required && <span style={{ color: "#1a8a8a" }}> *</span>}
            </label>
            <input style={inp} type={field.type} value={form[field.key as keyof typeof form]} onChange={e => f(field.key, e.target.value)}
              placeholder={field.placeholder} required={field.required}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(26,138,138,0.6)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
            />
          </div>
        ))}
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Organization Type
          </label>
          <select style={{ ...inp, cursor: "pointer" }} value={form.org_type} onChange={e => f("org_type", e.target.value)}
            onFocus={e => e.currentTarget.style.borderColor = "rgba(26,138,138,0.6)"}
            onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
          >
            <option value="" style={{ background: "#0f2942" }}>— Select your organization type —</option>
            {["Municipal / County Animal Control","Humane Society / Nonprofit","Regional / Multi-Shelter Organization","Other"].map(o => (
              <option key={o} value={o} style={{ background: "#0f2942" }}>{o}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Tell us about your shelter
        </label>
        <textarea style={{ ...inp, resize: "vertical", minHeight: 100 } as React.CSSProperties}
          value={form.message} onChange={e => f("message", e.target.value)}
          placeholder="Annual intake volume, current software challenges, what you'd most like to see improved…"
          onFocus={e => e.currentTarget.style.borderColor = "rgba(26,138,138,0.6)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
        />
      </div>
      {status === "error" && <div style={{ color: "#fca5a5", fontSize: 13 }}>⚠️ Something went wrong. Please try again or email us at info@sheltertrace.com.</div>}
      <button type="submit" disabled={status === "saving"}
        style={{ background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 9, padding: "15px 28px", fontSize: 15, fontWeight: 700, cursor: status === "saving" ? "wait" : "pointer", transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "#15766e")} onMouseLeave={e => (e.currentTarget.style.background = "#1a8a8a")}
      >
        {status === "saving" ? "Sending…" : "Request a Demo →"}
      </button>
      <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
        Or email us directly at{" "}
        <a href="mailto:info@sheltertrace.com" style={{ color: "#5eead4", textDecoration: "none" }}>info@sheltertrace.com</a>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; color: #0f172a; }
        section { scroll-margin-top: 68px; }
        .st-desktop-nav { display: flex !important; }
        .st-hamburger { display: none !important; }
        @media (max-width: 768px) {
          .st-desktop-nav { display: none !important; }
          .st-hamburger { display: block !important; }
          .st-hero-btns { flex-direction: column !important; }
          .st-features-grid { grid-template-columns: 1fr !important; }
          .st-about-grid { grid-template-columns: 1fr !important; }
          .st-contact-grid { grid-template-columns: 1fr !important; }
          .st-form-grid { grid-template-columns: 1fr !important; }
          .st-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .st-mockups-grid { grid-template-columns: 1fr !important; }
          .st-quotes-grid { grid-template-columns: 1fr !important; }
          .st-modular-grid { grid-template-columns: 1fr !important; }
        }
        .st-feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.10) !important; border-color: #1a8a8a !important; }
      `}</style>

      <Nav />

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(150deg, #0a1e33 0%, #0f2942 40%, #0d3352 70%, #0a2540 100%)", minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 68, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-80px", bottom: "-60px", fontSize: 500, opacity: 0.025, userSelect: "none", pointerEvents: "none", lineHeight: 1 }}>🐾</div>
        <div style={{ position: "absolute", left: "-60px", top: "15%", fontSize: 300, opacity: 0.02, userSelect: "none", pointerEvents: "none", transform: "rotate(-15deg)" }}>🐾</div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 28px 100px", position: "relative", zIndex: 1, textAlign: "center" }}>
          {/* Hero logo — sole branding centerpiece, horizontal rectangle.
              No background box — the logo renders directly on the navy hero.
              border-radius clips JPEG corners to navy, matching the hero. */}
          <div style={{ marginBottom: 44, display: "flex", justifyContent: "center" }}>
            <Image
              src="/logo.jpg"
              alt="ShelterTrace"
              width={640}
              height={280}
              quality={100}
              priority
              style={{
                borderRadius: 24,
                background: "transparent",
                padding: 0,
                objectFit: "contain",
                boxShadow: "0 32px 100px rgba(0,0,0,0.55)",
                display: "block",
                width: "min(640px, 92vw)",
                height: "auto",
              }}
            />
          </div>

          <h1 style={{ fontSize: "clamp(22px, 3vw, 44px)", fontWeight: 800, color: "rgba(255,255,255,0.88)", margin: "0 0 18px", lineHeight: 1.2, letterSpacing: -0.3, maxWidth: 740, marginLeft: "auto", marginRight: "auto" }}>
            Built by Shelter Staff.<br />
            <span style={{ color: "#1a8a8a" }}>For Shelter Staff.</span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(255,255,255,0.6)", maxWidth: 580, lineHeight: 1.75, margin: "0 auto 44px" }}>
            ShelterTrace gives animal shelters and humane societies the tools they need — without the complexity, cost, or compromises of legacy platforms.
          </p>
          <div className="st-hero-btns" style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            <a href="#contact" style={{ background: "#1a8a8a", color: "#fff", padding: "16px 36px", borderRadius: 10, textDecoration: "none", fontSize: 16, fontWeight: 700, letterSpacing: 0.2, display: "inline-block", transition: "background 0.15s" }}>
              Request a Demo
            </a>
            <a href="#screenshots" style={{ background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", padding: "16px 36px", borderRadius: 10, textDecoration: "none", fontSize: 16, fontWeight: 600, display: "inline-block" }}>
              See it in Action ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div style={{ background: "#0a1e33", padding: "36px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="st-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            {STATS.map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "12px 16px", borderRight: i < STATS.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, color: "#1a8a8a", lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SCREENSHOTS ── */}
      <section id="screenshots" style={{ background: "#0f1c2e", padding: "100px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, color: "#fff", margin: "0 0 14px", letterSpacing: -0.5 }}>
              See ShelterTrace in Action
            </h2>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Every screen is purpose-built for daily shelter operations — fast, focused, and built to reduce the time staff spend on paperwork.
            </p>
          </Reveal>
          <div className="st-mockups-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 28 }}>
            {MOCKUPS.map((m, i) => (
              <Reveal key={m.title} delay={i * 100}>
                <BrowserFrame title={m.title}>
                  {m.content}
                </BrowserFrame>
                <div style={{ marginTop: 12, textAlign: "center" }}>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, marginBottom: 4 }}>{m.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{m.caption}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "#f8fafc", padding: "108px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ display: "inline-block", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#0d9488", letterSpacing: 1, textTransform: "uppercase", marginBottom: 18 }}>
              Features
            </div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 900, color: "#0f2942", margin: "0 0 16px", letterSpacing: -0.5 }}>
              Everything Your Shelter Needs
            </h2>
            <p style={{ fontSize: 18, color: "#475569", maxWidth: 620, margin: "0 auto", lineHeight: 1.65 }}>
              Every feature was built to solve a real operational problem faced by municipal animal control agencies and humane societies — nothing is theoretical, nothing is unnecessary.
            </p>
          </Reveal>
          <div className="st-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80}>
                <div className="st-feature-card" style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #e2e8f0", transition: "all 0.22s", boxShadow: "0 1px 4px rgba(0,0,0,.04)", cursor: "default", height: "100%" }}>
                  <div style={{ fontSize: 38, marginBottom: 14 }}>{f.icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f2942", margin: "0 0 10px", lineHeight: 1.3 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: "#475569", margin: "0 0 10px", lineHeight: 1.65 }}>{f.desc}</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>{f.extra}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULAR ── */}
      <section style={{ background: "#0f2942", padding: "96px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, color: "#fff", margin: "0 0 16px", letterSpacing: -0.5 }}>
              Built to Fit Your Organization
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.62)", maxWidth: 700, margin: "0 auto", lineHeight: 1.75 }}>
              Every shelter operates differently. ShelterTrace is modular and configurable — include only the modules your organization actually needs.
            </p>
          </Reveal>

          <div className="st-modular-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            {[
              {
                icon: "🏛️",
                label: "Municipal & County Agencies",
                color: "#0369a1",
                bg: "rgba(3,105,161,0.12)",
                border: "rgba(3,105,161,0.3)",
                items: ["Field Dispatch & GPS Tracking","Citations & Court Portal","Officer PWA Mobile App","GDA / State Compliance Reporting","Animal Control Ordinance Library","Citizen Concern Reporting Portal"],
              },
              {
                icon: "❤️",
                label: "Humane Societies",
                color: "#1a8a8a",
                bg: "rgba(26,138,138,0.12)",
                border: "rgba(26,138,138,0.3)",
                items: ["Public Adoption Listings Portal","Foster Care Management","Volunteer Kiosk & Hour Tracking","Donor & Fundraising Tracking (soon)","Public Online Surrender Request","Lost & Found Community Board"],
              },
            ].map(col => (
              <Reveal key={col.label} delay={80}>
                <div style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 14, padding: "28px 24px", height: "100%" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{col.icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: col.color, marginBottom: 16, letterSpacing: 0.2 }}>{col.label}</div>
                  {col.items.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                      <span style={{ color: col.color, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>
                      <span style={{ color: "rgba(255,255,255,0.78)", fontSize: 14 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "24px 28px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Shared Core — Included for Every Organization</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {["Animal Records & Intake Wizard","Virtual Kennel Floorplan","Medical Records & Diagnostics","Staff Roles & Permissions","Report Builder & CSV Export"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#1a8a8a", fontWeight: 700, fontSize: 12 }}>✓</span>
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{ background: "#fff", padding: "108px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="st-about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
            <Reveal>
              <div style={{ display: "inline-block", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#0d9488", letterSpacing: 1, textTransform: "uppercase", marginBottom: 22 }}>
                Our Story
              </div>
              <h2 style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 900, color: "#0f2942", margin: "0 0 28px", letterSpacing: -0.5, lineHeight: 1.15 }}>
                Built in the Shelter.<br />Built for the Shelter.
              </h2>
              <div style={{ fontSize: 16, color: "#374151", lineHeight: 1.85, display: "flex", flexDirection: "column", gap: 18 }}>
                <p>ShelterTrace was developed by an active animal shelter director who grew frustrated with the limitations of existing software. The tools that dominated the market were built for large metro facilities — expensive, overly complex, and still missing the features that small county shelters and humane societies actually need every day.</p>
                <p>Rather than settle, they built something better — from the ground up, informed by real daily operations at both a municipal animal control agency and conversations with humane society directors facing the same challenges. Every module exists because it solved a real problem at a real organization.</p>
                <p>The result is a platform that fits the way shelter staff actually work: fast intake, clear kennel visibility, DEA-compliant drug logs, state-ready reporting, and public-facing portals — all without requiring a dedicated IT team to maintain it.</p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { icon: "🏛️", label: "Municipal & Nonprofit Ready", sub: "Serves both government animal control agencies and nonprofit humane society organizations." },
                  { icon: "📋", label: "GDA & DEA Compliant", sub: "Meets state reporting requirements and federal controlled substance regulations out of the box." },
                  { icon: "📱", label: "Works in the Field", sub: "Mobile PWA for officers — GPS tracking, dispatch, and on-duty status from any phone." },
                  { icon: "☁️", label: "No IT Required", sub: "Cloud-hosted, zero infrastructure to maintain, automatic updates included." },
                ].map(item => (
                  <div key={item.label} style={{ background: "#f8fafc", borderRadius: 12, padding: "22px 18px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f2942", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ background: "#f8fafc", padding: "96px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <Reveal style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 900, color: "#0f2942", margin: "0 0 12px", letterSpacing: -0.5 }}>
              What Agencies Are Saying
            </h2>
            <p style={{ fontSize: 16, color: "#64748b" }}>Early feedback from our pilot program partners.</p>
          </Reveal>
          <div className="st-quotes-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {[
              {
                quote: "We went from spending hours on monthly state reports to clicking one button. The GDA reporting alone was worth switching. Everything else is a bonus.",
                name: "[Agency Name], Animal Services",
                org: "County Animal Control — Pilot Partner",
              },
              {
                quote: "We needed something that handled both our adoption workflow and our volunteer management without paying for two separate systems. ShelterTrace covers both. The foster care module alone saved us countless hours.",
                name: "[Agency Name], Humane Society",
                org: "Nonprofit Humane Society — Pilot Partner",
              },
            ].map(t => (
              <Reveal key={t.name}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "36px 32px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 36, color: "#1a8a8a", marginBottom: 14, lineHeight: 1 }}>"</div>
                  <p style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, fontStyle: "italic", margin: "0 0 24px" }}>{t.quote}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🐾</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f2942" }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>{t.org}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ background: "#0f2942", padding: "108px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="st-contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 80, alignItems: "start" }}>
            <Reveal>
              <div style={{ display: "inline-block", background: "rgba(26,138,138,0.2)", border: "1px solid rgba(26,138,138,0.4)", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#5eead4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 22 }}>
                Pilot Program
              </div>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 900, color: "#fff", margin: "0 0 20px", letterSpacing: -0.5, lineHeight: 1.18 }}>
                Interested in Bringing ShelterTrace to Your Shelter?
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.64)", lineHeight: 1.8, margin: "0 0 32px" }}>
                We're working with a small number of animal shelters and humane societies as pilot partners. If your organization runs on limited resources and outdated tools, we'd love to talk.
              </p>
              {[
                "Free during the pilot program",
                "Onboarding and configuration included",
                "GDA-compliant from day one",
                "Your data stays yours — no lock-in",
                "Direct access to the development team",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <span style={{ color: "#1a8a8a", fontWeight: 900, fontSize: 16, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 15 }}>{item}</span>
                </div>
              ))}
              <div style={{ marginTop: 28, padding: "16px 20px", background: "rgba(26,138,138,0.12)", border: "1px solid rgba(26,138,138,0.3)", borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Direct Contact</div>
                <a href="mailto:info@sheltertrace.com" style={{ color: "#5eead4", textDecoration: "none", fontSize: 16, fontWeight: 700 }}>info@sheltertrace.com</a>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#070e17", color: "rgba(255,255,255,0.45)", padding: "44px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Image src="/logo.jpg" alt="ShelterTrace" width={30} height={30} style={{ borderRadius: 6, background: "#ececec", padding: 2, objectFit: "contain" }} />
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>ShelterTrace</span>
            </div>
            <div style={{ fontSize: 12 }}>Modern Shelter Management Software</div>
            <a href="mailto:info@sheltertrace.com" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textDecoration: "none", display: "block", marginTop: 4 }}>info@sheltertrace.com</a>
          </div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[["#features","Features"],["#screenshots","Product"],["#about","About"],["#contact","Contact"],["login","Staff Login"]].map(([href, label]) => (
              <a key={label} href={href.startsWith("#") ? href : `/${href}`} style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>{label}</a>
            ))}
          </div>
          <div style={{ fontSize: 12, textAlign: "right" }}>
            <div>© 2026 ShelterTrace. All rights reserved.</div>
            <div style={{ marginTop: 4, display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <a href="#" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none", fontSize: 11 }}>Privacy Policy</a>
              <a href="#" style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none", fontSize: 11 }}>Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
