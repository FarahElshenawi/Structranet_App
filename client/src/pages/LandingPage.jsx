import { Icon, NetworkIcon, PATHS } from "../components/Icons";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BG = "#F9FAFB";
const BORDER = "#E5E7EB";

/* ── 8 Feature cards per walkthrough spec ──────────────────────────── */
const FEATURES = [
  {
    icon: PATHS.sparkles,
    title: "AI Topology Generation",
    desc: "Describe your network architecture in natural language. Our AI designs a complete topology with routers, switches, firewalls, and hosts.",
  },
  {
    icon: PATHS.shield,
    title: "Security-First Design",
    desc: "Security scope is established before topology generation. Firewalls, DMZ segments, and zone-based policies are built into the physical structure.",
  },
  {
    icon: PATHS.search,
    title: "Smart Appliance Matching",
    desc: "Automatically matches your installed GNS3 images to the right devices. Know exactly what you need before importing.",
  },
  {
    icon: PATHS.download,
    title: "One-Click Export",
    desc: "Download a ready-to-import .gns3project file, device configurations, and a requirements manifest — all in one click.",
  },
  {
    icon: PATHS.pencil,
    title: "Conversational Editing",
    desc: "Review the generated topology, request changes in natural language, and iterate until it matches your exact requirements.",
  },
  {
    icon: PATHS.copy,
    title: "Digital Twin Mode",
    desc: "Describe an existing network and the AI reconstructs it as a baseline, then applies your requested changes as a delta.",
  },
  {
    icon: PATHS.hardDrive,
    title: "Ansible Automation",
    desc: "Auto-generates Ansible playbooks, inventory files, and config templates alongside your GNS3 project for real-world deployment.",
  },
  {
    icon: PATHS.settings,
    title: "Device Configuration",
    desc: "Auto-generates startup configurations for every device — VLANs, routing protocols, firewall rules, and interface addressing.",
  },
];

/* ── 4 Steps per walkthrough spec ──────────────────────────────────── */
const STEPS = [
  {
    num: 1,
    title: "Describe",
    desc: "Write what you need in plain English. AI determines security scope automatically.",
  },
  {
    num: 2,
    title: "Design",
    desc: "AI generates a security-aware topology with firewall, DMZ, and zone separation if needed.",
  },
  {
    num: 3,
    title: "Review",
    desc: "Examine the topology, edit or approve the design, and request changes in natural language.",
  },
  {
    num: 4,
    title: "Export",
    desc: "Download the .gns3project file, device configurations, and Ansible automation files.",
  },
];

export default function LandingPage({ onLogin, onSignup }) {
  return (
    <div
      style={{
        fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
        background: "#fff",
        color: "#111",
        minHeight: "100vh",
      }}
    >
      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 64,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <NetworkIcon size={16} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, color: "#111" }}>
            StructuraNet AI
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#features" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}>
            Features
          </a>
          <a href="#how-it-works" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}>
            How It Works
          </a>
          <a href="#" style={{ fontSize: 14, color: "#6B7280", textDecoration: "none", fontWeight: 500 }}>
            Documentation
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onLogin}
            style={{
              padding: "8px 18px",
              border: `1px solid ${BORDER}`,
              background: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Log in
          </button>
          <button
            onClick={onSignup}
            style={{
              padding: "8px 20px",
              border: "none",
              background: PRIMARY,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
            }}
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "120px 24px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,101,52,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            border: "1px solid #BBF7D0",
            borderRadius: 24,
            background: "#F0FDF4",
            fontSize: 13,
            fontWeight: 500,
            color: PRIMARY,
            marginBottom: 32,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: PRIMARY,
              animation: "pulse 2s infinite",
            }}
          />
          AI-Powered Network Design
        </div>

        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            maxWidth: 720,
            marginBottom: 20,
          }}
        >
          Design GNS3 Topologies with{" "}
          <span style={{ color: PRIMARY }}>Natural Language</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#6B7280",
            maxWidth: 560,
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          Describe your network in plain English and get a fully configured,
          export-ready GNS3 project — complete with device configs and
          appliance requirements.
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onSignup}
            style={{
              padding: "14px 32px",
              border: "none",
              background: PRIMARY,
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
              transition: "all .15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = PRIMARY_HOVER;
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,101,52,0.25)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = PRIMARY;
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Get Started Free
          </button>
          <a
            href="#"
            style={{
              padding: "14px 32px",
              border: `1px solid ${BORDER}`,
              background: "white",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              color: "#374151",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              transition: "all .15s",
            }}
          >
            View Documentation
          </a>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "100px 48px", background: BG }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
            From description to deployment
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Everything you need to go from an idea to a working GNS3 topology
            in seconds.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: "white",
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 32,
                transition: "all .2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = "#BBF7D0";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(22,101,52,0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = BORDER;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "#F0FDF4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                  color: PRIMARY,
                }}
              >
                <Icon d={f.icon} size={22} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS — 4 steps ──────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "100px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 16 }}>
            How it works
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 480, margin: "0 auto" }}>
            Four steps from idea to a fully configured GNS3 project.
          </p>
        </div>

        <div style={{ display: "flex", gap: 48, maxWidth: 1000, margin: "0 auto" }}>
          {STEPS.map((s) => (
            <div key={s.num} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: PRIMARY,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 16,
                  margin: "0 auto 20px",
                }}
              >
                {s.num}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 48px", background: PRIMARY, textAlign: "center" }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "white", marginBottom: 16 }}>
          Start designing networks today
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", maxWidth: 440, margin: "0 auto 32px", lineHeight: 1.6 }}>
          No more manual topology building. Describe your network and let AI
          do the heavy lifting.
        </p>
        <button
          onClick={onSignup}
          style={{
            padding: "14px 32px",
            border: "none",
            background: "white",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            color: PRIMARY,
            cursor: "pointer",
            transition: "all .15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#F0FDF4";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.transform = "none";
          }}
        >
          Get Started Free
        </button>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: "32px 48px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>
          StructuraNet AI — AI-Powered GNS3 Topology Generator
        </p>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="#" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Documentation</a>
          <a href="https://github.com/FarahElshenawi/Structranet_App" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>GitHub</a>
          <a href="#" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Contact</a>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          #features > div > div { grid-template-columns: 1fr !important; }
          #how-it-works > div:last-child { flex-direction: column; gap: 32px !important; }
        }
      `}</style>
    </div>
  );
}
