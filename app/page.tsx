"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabasePublic } from "@/lib/supabase-public";

// ── Feature cards ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "🐾", title: "Animal Records & Intake Wizard", desc: "Multi-step intake wizard with auto-generated vaccines, kennel assignment, and complete animal profiles." },
  { icon: "🏠", title: "Virtual Kennel Floorplan", desc: "Drag-and-drop visual shelter layout showing real-time occupancy, kennel cards, and rapid animal moves." },
  { icon: "📡", title: "Officer Dispatch & GPS Tracking", desc: "Live call management, officer GPS tracking, narrative logging, and automated field reporting." },
  { icon: "💊", title: "Medical Records & Diagnostics", desc: "Vaccine scheduling, diagnostic test tracking (Heartworm, FIV/FeLV), and GDA-compliant drug logs." },
  { icon: "📋", title: "Citations & Court Portal", desc: "Full citation management with digital signatures, court scheduling, and judge-specific portals." },
  { icon: "❤️", title: "Foster Care Management", desc: "Foster placements, check-ins, supply requests, and foster parent portals — all in one place." },
  { icon: "🙋", title: "Volunteer Kiosk & Portal", desc: "Self-service clock-in kiosk, hour tracking, announcements, and printable volunteer badges." },
  { icon: "📊", title: "GDA Compliance Reporting", desc: "One-click Georgia Department of Agriculture monthly reports, live-release rates, and custom exports." },
  { icon: "🔐", title: "Role-Based Staff Access", desc: "Granular permissions for Admins, Officers, Dispatchers, Vet Techs, Volunteers, and Court staff." },
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

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? "rgba(15,41,66,0.97)" : "#0f2942",
      backdropFilter: scrolled ? "blur(8px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "none",
      transition: "all 0.2s",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/logo.jpg" alt="ShelterTrace" width={36} height={36} style={{ borderRadius: 8, background: "#ececec", padding: 2, objectFit: "contain" }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}>ShelterTrace</span>
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: "flex", gap: 28, flex: 1, alignItems: "center" }} className="desktop-nav">
          <a href="#features" style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: 14, fontWeight: 500 }} onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#about"    style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: 14, fontWeight: 500 }} onClick={() => setMobileOpen(false)}>About</a>
          <a href="#contact"  style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: 14, fontWeight: 500 }} onClick={() => setMobileOpen(false)}>Contact</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <Link href="/login" style={{ background: "#1a8a8a", color: "#fff", padding: "8px 20px", borderRadius: 7, textDecoration: "none", fontSize: 14, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>
            Staff Login
          </Link>
          {/* Mobile hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(v => !v)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", padding: 4 }}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{ background: "#0f2942", borderTop: "1px solid rgba(255,255,255,0.1)", padding: "16px 24px 20px" }} className="mobile-nav">
          {["Features", "About", "Contact"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              style={{ display: "block", color: "rgba(255,255,255,0.85)", textDecoration: "none", padding: "10px 0", fontSize: 16, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

// ── Contact form ──────────────────────────────────────────────────────────────

function ContactForm() {
  const [form, setForm] = useState({ name: "", shelter_name: "", county_state: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.shelter_name.trim() || !form.email.trim()) return;
    setStatus("saving");
    try {
      const { error } = await supabasePublic.from("pilot_applications").insert({
        name: form.name.trim(),
        shelter_name: form.shelter_name.trim(),
        county_state: form.county_state.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        message: form.message.trim() || null,
      });
      if (error) throw error;
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ background: "rgba(26,138,138,0.15)", border: "1px solid #1a8a8a", borderRadius: 12, padding: "28px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Request Received!</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
          Thank you for your interest. We'll reach out to {form.email} shortly to schedule a demo.
        </div>
      </div>
    );
  }

  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 14, boxSizing: "border-box", outline: "none" };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Your Name *</label>
          <input style={inp} value={form.name} onChange={e => f("name", e.target.value)} placeholder="Jane Smith" required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Shelter Name *</label>
          <input style={inp} value={form.shelter_name} onChange={e => f("shelter_name", e.target.value)} placeholder="Morgan County Animal Services" required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>County / State</label>
          <input style={inp} value={form.county_state} onChange={e => f("county_state", e.target.value)} placeholder="Morgan County, GA" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Email Address *</label>
          <input style={inp} type="email" value={form.email} onChange={e => f("email", e.target.value)} placeholder="you@county.gov" required />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Phone (optional)</label>
          <input style={inp} type="tel" value={form.phone} onChange={e => f("phone", e.target.value)} placeholder="(706) 555-0000" />
        </div>
      </div>
      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Tell us about your shelter</label>
        <textarea
          style={{ ...inp, resize: "vertical", minHeight: 100, fontFamily: "inherit" }}
          value={form.message}
          onChange={e => f("message", e.target.value)}
          placeholder="How many animals do you intake annually? What's your biggest operational challenge?"
        />
      </div>
      {status === "error" && (
        <div style={{ color: "#fca5a5", fontSize: 13 }}>⚠️ Something went wrong. Please try again or email us directly.</div>
      )}
      <button
        type="submit"
        disabled={status === "saving"}
        style={{ background: "#1a8a8a", color: "#fff", border: "none", borderRadius: 8, padding: "14px 28px", fontSize: 15, fontWeight: 700, cursor: status === "saving" ? "wait" : "pointer", marginTop: 4 }}
      >
        {status === "saving" ? "Sending…" : "Request a Demo →"}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; color: #0f172a; }
        .desktop-nav { }
        .mobile-menu-btn { display: none; }
        .mobile-nav { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
          .mobile-nav { display: block !important; }
          .hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .about-grid { grid-template-columns: 1fr !important; }
          .contact-inner { grid-template-columns: 1fr !important; }
          .form-row-2 { grid-template-columns: 1fr !important; }
        }
        a:focus-visible { outline: 2px solid #1a8a8a; outline-offset: 2px; }
        section { scroll-margin-top: 64px; }
      `}</style>

      <Nav />

      {/* ── HERO ── */}
      <section style={{ background: "linear-gradient(135deg, #0f2942 0%, #1a3a5c 50%, #0d3352 100%)", minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: 64, position: "relative", overflow: "hidden" }}>
        {/* Subtle paw watermark */}
        <div style={{ position: "absolute", right: "-60px", top: "50%", transform: "translateY(-50%)", fontSize: 420, opacity: 0.03, userSelect: "none", pointerEvents: "none", lineHeight: 1 }}>🐾</div>

        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", background: "rgba(26,138,138,0.2)", border: "1px solid rgba(26,138,138,0.4)", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: "#5eead4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
            Built for County Animal Services
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 62px)", fontWeight: 900, color: "#fff", margin: "0 0 20px", lineHeight: 1.1, letterSpacing: -1, maxWidth: 820 }}>
            Modern Shelter Management.<br />
            <span style={{ color: "#1a8a8a" }}>Built by Shelter Staff.</span>
          </h1>
          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "rgba(255,255,255,0.72)", maxWidth: 620, lineHeight: 1.65, margin: "0 0 40px" }}>
            ShelterTrace gives small and mid-size county animal shelters the tools they need — without the complexity or cost of legacy platforms.
          </p>
          <div className="hero-btns" style={{ display: "flex", gap: 14 }}>
            <a href="#contact" style={{ background: "#1a8a8a", color: "#fff", padding: "15px 32px", borderRadius: 9, textDecoration: "none", fontSize: 16, fontWeight: 700, letterSpacing: 0.2, display: "inline-block", textAlign: "center" }}>
              Request a Demo
            </a>
            <a href="#features" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", padding: "15px 32px", borderRadius: 9, textDecoration: "none", fontSize: 16, fontWeight: 600, display: "inline-block", textAlign: "center" }}>
              Learn More ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ background: "#f8fafc", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 900, color: "#0f2942", margin: "0 0 14px", letterSpacing: -0.5 }}>
              Everything Your Shelter Needs
            </h2>
            <p style={{ fontSize: 18, color: "#475569", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
              Every feature was designed to solve a real problem faced by working shelter staff.
            </p>
          </div>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: "#fff", borderRadius: 14, padding: "28px 24px", border: "1px solid #e2e8f0", transition: "box-shadow 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f2942", margin: "0 0 8px", lineHeight: 1.3 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" style={{ background: "#fff", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="about-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-block", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: "#0d9488", letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
                Our Story
              </div>
              <h2 style={{ fontSize: "clamp(26px, 3.5vw, 40px)", fontWeight: 900, color: "#0f2942", margin: "0 0 24px", letterSpacing: -0.5, lineHeight: 1.2 }}>
                Built in the Shelter.<br />Built for the Shelter.
              </h2>
              <div style={{ fontSize: 16, color: "#374151", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ margin: 0 }}>
                  ShelterTrace was built by the Director of Morgan County Animal Services in Madison, Georgia — someone who runs a real shelter with a small staff, limited budget, and very real operational pressures every day.
                </p>
                <p style={{ margin: 0 }}>
                  It was created because the existing platforms weren't good enough. They were built for large metro shelters, required expensive licensing, came with unnecessary complexity, and still left critical gaps — GDA compliance reports, DEA-compliant drug logs, citizen-facing reporting portals, and tools that work on a smartphone in the field.
                </p>
                <p style={{ margin: 0 }}>
                  Every feature in ShelterTrace exists because it solved a real problem at a real shelter. Nothing is theoretical. Everything is tested in the field by the people who built it.
                </p>
              </div>
            </div>
            <div style={{ background: "#f1f5f9", borderRadius: 20, aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: "2px dashed #cbd5e1" }}>
              <span style={{ fontSize: 64 }}>🐾</span>
              <div style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", maxWidth: 200 }}>Morgan County Animal Services, Madison, GA</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PILOT PROGRAM ── */}
      <section id="contact" style={{ background: "#0f2942", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="contact-inner" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 72, alignItems: "start" }}>
            <div>
              <div style={{ display: "inline-block", background: "rgba(26,138,138,0.2)", border: "1px solid rgba(26,138,138,0.4)", borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 700, color: "#5eead4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 24 }}>
                Pilot Program
              </div>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: "#fff", margin: "0 0 20px", letterSpacing: -0.5, lineHeight: 1.2 }}>
                Interested in Bringing ShelterTrace to Your Shelter?
              </h2>
              <p style={{ fontSize: 16, color: "rgba(255,255,255,0.68)", lineHeight: 1.75, margin: "0 0 28px" }}>
                We're working with a small number of county animal services departments as pilot partners. If your shelter runs on limited resources and outdated tools, we'd love to talk.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "✅", text: "Free during the pilot program" },
                  { icon: "✅", text: "We configure and onboard your team" },
                  { icon: "✅", text: "Your data, your shelter, fully customized" },
                  { icon: "✅", text: "GDA-compliant from day one" },
                ].map(item => (
                  <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ color: "#1a8a8a", fontWeight: 700, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 15 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0a1e33", color: "rgba(255,255,255,0.55)", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Image src="/logo.jpg" alt="ShelterTrace" width={28} height={28} style={{ borderRadius: 6, background: "#ececec", padding: 2, objectFit: "contain" }} />
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>ShelterTrace</span>
            </div>
            <div style={{ fontSize: 13 }}>Shelter Data Systems</div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["#features","Features"],["#about","About"],["#contact","Contact"],["login","Staff Login"]].map(([href, label]) => (
              <a key={label} href={href.startsWith("#") ? href : `/${href}`} style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 12, textAlign: "right" }}>
            <div>© 2026 ShelterTrace. Developed by</div>
            <div>Morgan County Animal Services, Madison, GA.</div>
          </div>
        </div>
      </footer>
    </>
  );
}
