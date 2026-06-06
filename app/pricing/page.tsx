"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ── Nav ───────────────────────────────────────────────────────────────────────

function PricingNav() {
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

        <nav className="pn-desktop-nav" style={{ display: "flex", gap: 32, flex: 1, alignItems: "center" }}>
          {([["/#features","Features"],["/#screenshots","Product"],["/#about","About"],["/#contact","Contact"]] as [string,string][]).map(([href, label]) => (
            <a key={label} href={href} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            >{label}</a>
          ))}
          <Link href="/pricing" style={{ color: "#5eead4", textDecoration: "none", fontSize: 14, fontWeight: 700, borderBottom: "2px solid #1a8a8a", paddingBottom: 2 }}>
            Pricing
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <Link href="/login" style={{ background: "#1a8a8a", color: "#fff", padding: "9px 22px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 700, letterSpacing: 0.2, whiteSpace: "nowrap", transition: "background 0.15s" }}>
            Staff Login
          </Link>
          <button className="pn-hamburger" onClick={() => setMobileOpen(v => !v)}
            style={{ display: "none", background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", padding: "4px 6px" }}>
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{ background: "#0a1e33", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 28px 20px" }}>
          {([["/#features","Features"],["/#screenshots","Product"],["/#about","About"],["/#contact","Contact"]] as [string,string][]).map(([href, label]) => (
            <a key={label} href={href}
              style={{ display: "block", color: "rgba(255,255,255,0.8)", textDecoration: "none", padding: "12px 0", fontSize: 16, fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onClick={close}
            >{label}</a>
          ))}
          <Link href="/pricing"
            style={{ display: "block", color: "#5eead4", textDecoration: "none", padding: "12px 0", fontSize: 16, fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            onClick={close}
          >Pricing</Link>
          <Link href="/login" style={{ display: "block", background: "#1a8a8a", color: "#fff", padding: "12px 0", borderRadius: 8, textDecoration: "none", fontSize: 16, fontWeight: 700, textAlign: "center", marginTop: 16 }} onClick={close}>
            Staff Login
          </Link>
        </div>
      )}
    </header>
  );
}

// ── Pricing tiers ─────────────────────────────────────────────────────────────

const TIERS = [
  {
    label: "Starter",
    badge: null,
    bestFor: "Small shelters & humane societies",
    volume: "Up to 500 animals/year",
    modules: [
      "Animal Records & Intake",
      "Kennel Floorplan",
      "Medical Records",
      "Basic Reporting",
      "Staff Accounts",
    ],
    price: "Contact Us",
    ctaLabel: "Request a Demo",
    ctaHref: "/#contact",
    ctaStyle: "outline" as const,
    featured: false,
  },
  {
    label: "Professional",
    badge: "Most Popular",
    bestFor: "Mid-size shelters & county agencies",
    volume: "Unlimited animals",
    modules: [
      "Everything in Starter, plus:",
      "Dispatch & GPS Tracking",
      "Citations & Court Portal",
      "Foster Care",
      "Volunteer Portal",
      "Clinic Management",
      "GDA Compliance Reporting",
      "Citizen Reporting Portal",
    ],
    price: "Contact Us",
    ctaLabel: "Request a Demo",
    ctaHref: "/#contact",
    ctaStyle: "filled" as const,
    featured: true,
  },
  {
    label: "Enterprise",
    badge: null,
    bestFor: "Multi-shelter organizations & regional agencies",
    volume: "Unlimited animals",
    modules: [
      "Everything in Professional, plus:",
      "Multi-location Support",
      "Custom Integrations",
      "Priority Support",
      "Custom Onboarding",
    ],
    price: "Contact Us",
    ctaLabel: "Contact Us",
    ctaHref: "mailto:info@sheltertrace.com",
    ctaStyle: "outline" as const,
    featured: false,
  },
];

// ── Comparison table ──────────────────────────────────────────────────────────

const TABLE_ROWS: { feature: string; starter: boolean; pro: boolean; enterprise: boolean }[] = [
  { feature: "Animal Records & Intake",       starter: true,  pro: true,  enterprise: true  },
  { feature: "Kennel Floorplan",              starter: true,  pro: true,  enterprise: true  },
  { feature: "Medical Records & Diagnostics", starter: true,  pro: true,  enterprise: true  },
  { feature: "Basic Reporting",               starter: true,  pro: true,  enterprise: true  },
  { feature: "Staff Roles & Permissions",     starter: true,  pro: true,  enterprise: true  },
  { feature: "Clinic & Veterinary Management",starter: false, pro: true,  enterprise: true  },
  { feature: "Dispatch & GPS Tracking",       starter: false, pro: true,  enterprise: true  },
  { feature: "Citations & Court Portal",      starter: false, pro: true,  enterprise: true  },
  { feature: "Foster Care Management",        starter: false, pro: true,  enterprise: true  },
  { feature: "Volunteer Portal",              starter: false, pro: true,  enterprise: true  },
  { feature: "GDA Compliance Reporting",      starter: false, pro: true,  enterprise: true  },
  { feature: "Citizen Reporting Portal",      starter: false, pro: true,  enterprise: true  },
  { feature: "Multi-location Support",        starter: false, pro: false, enterprise: true  },
  { feature: "Custom Integrations",           starter: false, pro: false, enterprise: true  },
  { feature: "Priority Support",              starter: false, pro: false, enterprise: true  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; color: #0f172a; }
        .pn-desktop-nav { display: flex !important; }
        .pn-hamburger { display: none !important; }
        @media (max-width: 768px) {
          .pn-desktop-nav { display: none !important; }
          .pn-hamburger { display: block !important; }
          .pricing-tier-grid { grid-template-columns: 1fr !important; }
          .pricing-table th:not(:first-child) { min-width: 70px; }
          .pricing-table { font-size: 13px !important; }
        }
      `}</style>

      <PricingNav />

      {/* ── HERO ── */}
      <section style={{ background: "#0f2942", padding: "100px 28px 80px", paddingTop: "calc(100px + 68px)", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(26,138,138,0.2)", border: "1px solid rgba(26,138,138,0.4)", borderRadius: 20, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#5eead4", letterSpacing: 1, textTransform: "uppercase", marginBottom: 22 }}>
            Pricing
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 50px)", fontWeight: 900, color: "#fff", margin: "0 0 18px", lineHeight: 1.15, letterSpacing: -0.5 }}>
            Simple, Transparent Pricing
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: 560, margin: "0 auto" }}>
            Scaled to fit your organization — no per-seat fees, no surprise charges.
          </p>
        </div>
      </section>

      {/* ── TIER CARDS ── */}
      <section style={{ background: "#f8fafc", padding: "72px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="pricing-tier-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, alignItems: "stretch" }}>
            {TIERS.map(tier => (
              <div key={tier.label} style={{
                background: "#fff",
                borderRadius: 18,
                padding: "36px 28px",
                border: tier.featured ? "2px solid #0f2942" : "1px solid #e2e8f0",
                boxShadow: tier.featured ? "0 12px 40px rgba(15,41,66,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: 0,
                position: "relative",
                transform: tier.featured ? "scale(1.02)" : "none",
              }}>
                {tier.badge && (
                  <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#1a8a8a", color: "#fff", borderRadius: 20, padding: "4px 16px", fontSize: 12, fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                    {tier.badge}
                  </div>
                )}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f2942", marginBottom: 4 }}>{tier.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{tier.bestFor}</div>
                </div>
                <div style={{ fontSize: 12, color: "#0d9488", fontWeight: 700, background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "4px 10px", display: "inline-block", marginTop: 10, marginBottom: 18 }}>
                  {tier.volume}
                </div>
                <div style={{ flex: 1, marginBottom: 24 }}>
                  {tier.modules.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <span style={{ color: m.startsWith("Everything") ? "#94a3b8" : "#1a8a8a", fontWeight: 700, fontSize: 12, flexShrink: 0, marginTop: 1 }}>
                        {m.startsWith("Everything") ? "" : "✓"}
                      </span>
                      <span style={{ fontSize: 14, color: m.startsWith("Everything") ? "#94a3b8" : "#374151", fontStyle: m.startsWith("Everything") ? "italic" : "normal" }}>{m}</span>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#1a8a8a", marginBottom: 14 }}>{tier.price}</div>
                  <a
                    href={tier.ctaHref}
                    style={{
                      display: "block",
                      textAlign: "center",
                      padding: "13px 20px",
                      borderRadius: 9,
                      fontSize: 15,
                      fontWeight: 700,
                      textDecoration: "none",
                      background: tier.ctaStyle === "filled" ? "#1a8a8a" : "transparent",
                      color: tier.ctaStyle === "filled" ? "#fff" : "#1a8a8a",
                      border: tier.ctaStyle === "filled" ? "none" : "2px solid #1a8a8a",
                      transition: "all 0.15s",
                    }}
                  >
                    {tier.ctaLabel} →
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Below-cards note */}
          <div style={{ textAlign: "center", marginTop: 44, maxWidth: 620, margin: "44px auto 0" }}>
            <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.75, marginBottom: 20 }}>
              All plans include cloud hosting, automatic updates, and onboarding support.{" "}
              Pilot program pricing available for early adopters — contact us to learn more.
            </p>
            <a href="/#contact" style={{ background: "#0f2942", color: "#fff", padding: "13px 28px", borderRadius: 9, textDecoration: "none", fontSize: 15, fontWeight: 700, display: "inline-block" }}>
              Apply for the Pilot Program →
            </a>
          </div>
        </div>
      </section>

      {/* ── FEATURE COMPARISON TABLE ── */}
      <section style={{ background: "#fff", padding: "80px 28px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 900, color: "#0f2942", margin: "0 0 12px", letterSpacing: -0.5 }}>
              Feature Comparison
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.65 }}>
              See exactly what{"'"}s included in each plan.
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pricing-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#0f2942" }}>
                  <th style={{ padding: "14px 18px", textAlign: "left", color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: 13 }}>Feature</th>
                  {["Starter", "Professional", "Enterprise"].map(col => (
                    <th key={col} style={{ padding: "14px 18px", textAlign: "center", color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: 13, minWidth: 100 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, i) => (
                  <tr key={row.feature} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "13px 18px", color: "#374151", fontWeight: 500 }}>{row.feature}</td>
                    {([row.starter, row.pro, row.enterprise] as boolean[]).map((has, j) => (
                      <td key={j} style={{ padding: "13px 18px", textAlign: "center" }}>
                        {has
                          ? <span style={{ color: "#0d9488", fontWeight: 800, fontSize: 16 }}>✓</span>
                          : <span style={{ color: "#cbd5e1", fontSize: 14 }}>—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ── */}
      <section style={{ background: "#0f2942", padding: "72px 28px", textAlign: "center" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 900, color: "#fff", margin: "0 0 14px", letterSpacing: -0.5 }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 28 }}>
            We{"'"}re accepting pilot program applications now. Fill out the form and we{"'"}ll reach out to schedule your demo.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/#contact" style={{ background: "#1a8a8a", color: "#fff", padding: "14px 32px", borderRadius: 9, textDecoration: "none", fontSize: 15, fontWeight: 700, display: "inline-block" }}>
              Request a Demo →
            </a>
            <a href="mailto:info@sheltertrace.com" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "14px 32px", borderRadius: 9, textDecoration: "none", fontSize: 15, fontWeight: 600, display: "inline-block" }}>
              Email Us
            </a>
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
            {([["/#features","Features"],["/#screenshots","Product"],["/#about","About"],["/#contact","Contact"],["/pricing","Pricing"],["/login","Staff Login"]] as [string,string][]).map(([href, label]) => (
              <a key={label} href={href} style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>{label}</a>
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
