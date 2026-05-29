import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import MiniTopologyPreview from "../components/MiniTopologyPreview";
import ProfileModal from "../components/ProfileModal";
import TopologyViewer from "../components/TopologyViewer";
import { TopologyErrorBoundary } from "../components/ErrorBoundary";
import {
  createSession,
  agentChat,
  downloadGns3,
  downloadConfigsZip,
  downloadRequirements,
  downloadAnsible,
  getChats,
  createChat,
  deleteChat,
  updateChatSessionId,
  checkBackendHealth,
  getChat,
  getUserProfile,
} from "../lib/api";

/* ───────── Design Tokens ───────── */
const G = "#166534";
const GH = "#14532D";
const BG = "#F9FAFB";
const BD = "#E5E7EB";
const MT = "#F3F4F6";
const SIDEBAR_W = 300;

/* ───────── Icon Paths ───────── */
const IC = {
  menu:
    "M4 6h16M4 12h16M4 18h16",
  x: "M6 18L18 6M6 6l12 12",
  send: "M2.01 21L23 12 2.01 3 2 10l15 2-15 2z",
  pencil: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  download:
    "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  alert:
    "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  trash:
    "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  file: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z",
  shield:
    "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  logout:
    "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  expand:
    "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41zM7.41 15.41L12 19.99l4.59-4.58L18 16l-6 6-6-6 1.41-1.59z",
  settings:
    "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z",
  search:
    "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  terminal:
    "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-8-2h6v-2h-6v2zM7.5 17l1.41-1.41L6.33 13l2.58-2.59L7.5 9l-4 4 4 4z",
};

/* ═══════════════════════════════════════════
   INLINE HELPER COMPONENTS
   ═══════════════════════════════════════════ */

/* ── Blinking Cursor ── */
function Cursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 16,
        backgroundColor: G,
        marginLeft: 2,
        verticalAlign: "middle",
        borderRadius: 1,
        animation: "blink 1s step-end infinite",
      }}
    />
  );
}

/* ── Network Brand Icon ── */
function NetIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill={G} />
      <circle cx="14" cy="10" r="3" fill="#fff" />
      <circle cx="8" cy="19" r="2.5" fill="#fff" opacity=".8" />
      <circle cx="20" cy="19" r="2.5" fill="#fff" opacity=".8" />
      <line x1="14" y1="13" x2="8" y2="17" stroke="#fff" strokeWidth="1.5" />
      <line x1="14" y1="13" x2="20" y2="17" stroke="#fff" strokeWidth="1.5" />
      <line x1="8" y1="19" x2="20" y2="19" stroke="#fff" strokeWidth="1.2" opacity=".5" />
    </svg>
  );
}

/* ── Generic Icon Path Renderer ── */
function Ic({ d, size = 20, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke={color}
      strokeWidth="0"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/* ── Stroke Icon (for stroke-based icons like menu, x) ── */
function IcStroke({ d, size = 20, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/* ── Pulse Ring ── */
function PulseRing() {
  return (
    <span
      style={{
        position: "absolute",
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `2px solid ${G}`,
        animation: "pulseRing 2s ease-out infinite",
      }}
    />
  );
}

/* ── Network Loader (28px center glow, signal dots, pulse rings) ── */
function NetworkLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 0",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes signalBounce {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes centerGlow {
          0%, 100% { box-shadow: 0 0 8px ${G}44; }
          50% { box-shadow: 0 0 20px ${G}88; }
        }
      `}</style>
      <div style={{ position: "relative", width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PulseRing />
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: G,
            animation: "centerGlow 2s ease-in-out infinite",
            zIndex: 1,
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: G,
              animation: `signalBounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <span style={{ marginTop: 10, fontSize: 13, color: "#6B7280" }}>
        Building network topology…
      </span>
    </div>
  );
}

/* ── AI Avatar (28px) ── */
function AIAvatar({ animate = false }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        backgroundColor: G,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: animate ? `0 0 12px ${G}66` : "none",
        transition: "box-shadow 0.3s",
      }}
    >
      <NetIcon size={16} />
    </div>
  );
}

/* ── Typing Indicator ── */
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
      <AIAvatar animate />
      <span style={{ fontSize: 14, color: "#6B7280" }}>AI is thinking</span>
      <span style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: G,
              animation: `signalBounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </span>
      <style>{`
        @keyframes signalBounce {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

/* ── Thought Line (inline thought bubble) ── */
function ThoughtLine({ thought }) {
  if (!thought) return null;
  return (
    <div
      style={{
        backgroundColor: MT,
        border: `1px solid ${BD}`,
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 8,
        fontSize: 13,
        color: "#6B7280",
        fontStyle: "italic",
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>💭</span>
      <span>{thought}</span>
    </div>
  );
}

/* ── Config Block (one device config) ── */
function ConfigBlock({ name, text, streaming = false }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          backgroundColor: "#1E1E1E",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #333",
        }}
      >
        <div
          style={{
            backgroundColor: "#2D2D2D",
            padding: "6px 12px",
            fontSize: 12,
            color: "#9CDCFE",
            fontFamily: "'Courier New', monospace",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ic d={IC.terminal} size={14} color="#9CDCFE" />
          {name}
        </div>
        <pre
          style={{
            margin: 0,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.5,
            color: "#9CDCFE",
            fontFamily: "'Courier New', monospace",
            maxHeight: 160,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text}
          {streaming && <Cursor />}
        </pre>
      </div>
    </div>
  );
}

/* ── Download Card Row ── */
function DlRow({ icon, title, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        backgroundColor: "#fff",
        border: `1px solid ${BD}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = G;
        e.currentTarget.style.boxShadow = `0 2px 8px ${G}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BD;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: MT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Ic d={icon} size={20} color={G} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{sub}</div>
      </div>
      <Ic d={IC.download} size={18} color="#9CA3AF" />
    </div>
  );
}

/* ── Quick Reply Chip (disappears on click) ── */
function QuickReplyChip({ label, icon, variant = "default", onClick }) {
  const isGreen = variant === "green";
  const isOutlined = variant === "outlined";
  const isGreenOutlined = variant === "green-outlined";

  let chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    border: `1px solid ${BD}`,
    backgroundColor: "#fff",
    color: "#374151",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  };

  if (isGreen) {
    chipStyle = {
      ...chipStyle,
      backgroundColor: G,
      color: "#fff",
      borderColor: G,
    };
  }
  if (isGreenOutlined) {
    chipStyle = {
      ...chipStyle,
      backgroundColor: "#fff",
      color: G,
      borderColor: G,
    };
  }
  if (isOutlined) {
    chipStyle = {
      ...chipStyle,
      backgroundColor: "transparent",
      color: "#374151",
      borderColor: BD,
    };
  }

  return (
    <button
      style={chipStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isGreen) {
          e.currentTarget.style.backgroundColor = GH;
        } else {
          e.currentTarget.style.borderColor = G;
          e.currentTarget.style.color = G;
        }
      }}
      onMouseLeave={(e) => {
        if (isGreen) {
          e.currentTarget.style.backgroundColor = G;
        } else if (isGreenOutlined) {
          e.currentTarget.style.borderColor = G;
          e.currentTarget.style.color = G;
        } else {
          e.currentTarget.style.borderColor = BD;
          e.currentTarget.style.color = "#374151";
        }
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {label}
    </button>
  );
}

/* ── Green System Message ── */
function SystemMessage({ icon, text }) {
  return (
    <div
      style={{
        backgroundColor: "#F0FDF4",
        border: "1px solid #BBF7D0",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        color: G,
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      {icon || (
        <Ic d={IC.check} size={18} color={G} />
      )}
      <span>{text}</span>
    </div>
  );
}

/* ── Empty State (3 expandable pills) ── */
function EmptyState({ onSuggestionClick }) {
  const [expanded, setExpanded] = useState(null);

  const pills = [
    {
      key: "design",
      emoji: "🏗️",
      label: "Design",
      color: G,
      suggestions: [
        "Design a campus network with 3 buildings",
        "Create a small office network with VLANs",
        "Build a data center spine-leaf topology",
      ],
    },
    {
      key: "configure",
      emoji: "⚙️",
      label: "Configure",
      color: "#2563EB",
      suggestions: [
        "Configure OSPF between core routers",
        "Set up inter-VLAN routing",
        "Add NAT and ACLs for internet access",
      ],
    },
    {
      key: "secure",
      emoji: "🛡️",
      label: "Secure",
      color: "#DC2626",
      suggestions: [
        "Add firewall zones with DMZ",
        "Implement 802.1X port security",
        "Design a zero-trust network segment",
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: MT, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <NetIcon size={32} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        Welcome to StructuraNet AI
      </h2>
      <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, textAlign: "center", maxWidth: 400 }}>
        Describe your network and I'll design, configure, and secure it for you.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {pills.map((pill) => (
          <div
            key={pill.key}
            style={{
              borderRadius: 24,
              border: `1px solid ${expanded === pill.key ? pill.color : BD}`,
              backgroundColor: expanded === pill.key ? "#fff" : MT,
              overflow: "hidden",
              transition: "all 0.3s ease",
              cursor: "pointer",
              maxWidth: expanded === pill.key ? 300 : 160,
            }}
          >
            <div
              onClick={() => setExpanded(expanded === pill.key ? null : pill.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                color: expanded === pill.key ? pill.color : "#374151",
                whiteSpace: "nowrap",
              }}
            >
              <span>{pill.emoji}</span>
              {pill.label}
              <IcStroke
                d={expanded === pill.key ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"}
                size={14}
                color={expanded === pill.key ? pill.color : "#9CA3AF"}
              />
            </div>
            <div
              style={{
                maxHeight: expanded === pill.key ? 200 : 0,
                overflow: "hidden",
                transition: "max-height 0.3s ease",
                padding: expanded === pill.key ? "0 14px 14px" : "0 14px",
              }}
            >
              {pill.suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSuggestionClick(s);
                  }}
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "#374151",
                    borderRadius: 8,
                    cursor: "pointer",
                    marginBottom: 4,
                    backgroundColor: MT,
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#E5E7EB";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = MT;
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stream Card (dark code block, #1E1E1E bg) ── */
function StreamCard({ title, icon, codeText, streaming = false }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1px solid ${BD}`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderBottom: `1px solid ${BD}`,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            backgroundColor: G,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon || <NetIcon size={16} />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</span>
        {streaming && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: G,
              animation: "blink 1s step-end infinite",
              marginLeft: 4,
            }}
          />
        )}
      </div>
      <div
        style={{
          backgroundColor: "#1E1E1E",
          padding: "12px 16px",
          maxHeight: 120,
          overflowY: "auto",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.5,
            color: "#9CDCFE",
            fontFamily: "'Courier New', monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {codeText}
          {streaming && <Cursor />}
        </pre>
      </div>
    </div>
  );
}

/* ── Security Zone Panel ── */
function SecurityZonePanel({ summary }) {
  if (!summary || !summary.zones) return null;

  const zoneColors = {
    INSIDE: { bg: "#F0FDF4", border: "#BBF7D0", text: G },
    DMZ: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" },
    OUTSIDE: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
    MANAGEMENT: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF" },
    Firewall: { bg: "#F5F3FF", border: "#DDD6FE", text: "#5B21B6" },
  };

  const zoneEntries = Object.entries(summary.zones);

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Ic d={IC.shield} size={16} color={G} />
        Security Zones
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {zoneEntries.map(([zoneName, zoneData]) => {
          const devices = typeof zoneData === "string" ? zoneData : zoneData.devices || zoneData;
          const colors = zoneColors[zoneName] || zoneColors.INSIDE;
          return (
            <div
              key={zoneName}
              style={{
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 700, color: colors.text }}>{zoneName}: </span>
              <span style={{ color: colors.text, opacity: 0.85 }}>{devices}</span>
            </div>
          );
        })}
        {summary.firewall && (
          <div
            style={{
              backgroundColor: zoneColors.Firewall.bg,
              border: `1px solid ${zoneColors.Firewall.border}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: 700, color: zoneColors.Firewall.text }}>Firewall: </span>
            <span style={{ color: zoneColors.Firewall.text, opacity: 0.85 }}>{summary.firewall}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Requirements Summary Panel ── */
function ReqSummary({ requirements }) {
  if (!requirements || !requirements.devices) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Ic d={IC.file} size={16} color={G} />
        Image Requirements
      </div>
      <div
        style={{
          border: `1px solid ${BD}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {requirements.devices.map((dev, idx) => {
          const hasImage = dev.image && dev.image.trim() !== "";
          const isBuiltIn = dev.builtIn === true;
          const statusColor = isBuiltIn ? "#2563EB" : hasImage ? G : "#DC2626";
          const statusDot = isBuiltIn ? "#2563EB" : hasImage ? G : "#DC2626";

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderBottom: idx < requirements.devices.length - 1 ? `1px solid ${BD}` : "none",
                backgroundColor: idx % 2 === 0 ? "#fff" : MT,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: statusDot,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#111827" }}>
                  {dev.template || dev.name}
                  {dev.count > 1 && (
                    <span style={{ fontWeight: 400, color: "#6B7280" }}> × {dev.count}</span>
                  )}
                </div>
                {dev.category && (
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>{dev.category}</div>
                )}
              </div>
              <div style={{ flexShrink: 0, maxWidth: 200 }}>
                {isBuiltIn ? (
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: "#EFF6FF",
                      color: "#2563EB",
                      padding: "3px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Built-in — no image required
                  </span>
                ) : hasImage ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "'Courier New', monospace",
                      backgroundColor: "#F0FDF4",
                      color: G,
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: `1px solid #BBF7D0`,
                    }}
                  >
                    {dev.image}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid #FECACA",
                    }}
                  >
                    Image not configured — set in profile
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   AI BUBBLE — Core Message Component
   ═══════════════════════════════════════════ */
function AIBubble({
  message,
  sseState,
  onApprove,
  onEdit,
  onAsk,
  onSecuritySelect,
  onDigitalTwinConfirm,
  onChipClick,
  inputRef,
}) {
  const {
    thoughts,
    topology,
    requirements,
    summary,
    configTexts,
    phase,
    subPhase,
    status,
    exportData,
    agentMessage,
    toolCallsMade,
    securityConfidence,
    securityLevel,
    isDigitalTwin,
    baselineTopology,
    topologyName,
  } = sseState || {};

  const isStreaming = status === "streaming" || status === "processing";
  const isReview = phase === "review" || status === "review";
  const isConfig = phase === "config" || status === "config";
  const isComplete = phase === "complete" || status === "complete";
  const isGenerating = phase === "generating" || status === "generating";
  const showExport = isComplete || phase === "export" || status === "export";

  const topologyJson = topology ? JSON.stringify(topology, null, 2) : "";
  const nodeCount = topology?.nodes?.length || 0;
  const linkCount = topology?.links?.length || 0;

  /* Security profile label */
  const securityBadge = securityLevel
    ? securityLevel.charAt(0).toUpperCase() + securityLevel.slice(1)
    : summary?.securityLevel
    ? summary.securityLevel.charAt(0).toUpperCase() + summary.securityLevel.slice(1)
    : null;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <AIAvatar animate={isStreaming} />

      <div style={{ flex: 1, minWidth: 0, maxWidth: 700 }}>
        {/* ── Typing Indicator ── */}
        {isStreaming && !agentMessage && !thoughts?.length && !topology && (
          <TypingIndicator />
        )}

        {/* ── Thought Lines ── */}
        {thoughts?.map((t, i) => (
          <ThoughtLine key={i} thought={t} />
        ))}

        {/* ── Agent Message Text ── */}
        {agentMessage && (
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#374151",
              marginBottom: 10,
              whiteSpace: "pre-wrap",
            }}
          >
            {agentMessage}
          </div>
        )}

        {/* ── JSON Stream Card (during generation) ── */}
        {isGenerating && topologyJson && (
          <StreamCard
            title="Generating Topology"
            icon={<NetIcon size={16} />}
            codeText={topologyJson}
            streaming={isStreaming}
          />
        )}

        {/* ── Network Loader ── */}
        {isStreaming && !topology && !agentMessage && phase !== "review" && (
          <NetworkLoader />
        )}

        {/* ── Digital Twin Baseline Card ── */}
        {isDigitalTwin && baselineTopology && !isComplete && (
          <div
            style={{
              backgroundColor: "#fff",
              border: `1px solid ${BD}`,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderBottom: `1px solid ${BD}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: "#2563EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ic d={IC.shield} size={16} color="#fff" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Baseline Network
              </span>
            </div>
            <div style={{ padding: 12 }}>
              <MiniTopologyPreview topology={baselineTopology} />
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <QuickReplyChip
                  label="Yes, this is my network"
                  icon={<Ic d={IC.check} size={14} color="#fff" />}
                  variant="green"
                  onClick={() => onDigitalTwinConfirm && onDigitalTwinConfirm(true)}
                />
                <QuickReplyChip
                  label="No, let me describe again"
                  variant="outlined"
                  onClick={() => onDigitalTwinConfirm && onDigitalTwinConfirm(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Topology Card (review phase) ── */}
        {isReview && topology && (
          <div
            style={{
              backgroundColor: "#fff",
              border: `1px solid ${BD}`,
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            {/* Topology Card Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderBottom: `1px solid ${BD}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  backgroundColor: G,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <NetIcon size={16} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Topology Ready — {topologyName || "Network"}
              </span>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {nodeCount} nodes · {linkCount} links
              </span>
              {securityBadge && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: "#F0FDF4",
                    color: G,
                    border: "1px solid #BBF7D0",
                    padding: "2px 8px",
                    borderRadius: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  🛡️ {securityBadge}
                </span>
              )}
              <button
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: G,
                  background: "none",
                  border: `1px solid ${G}`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Expand
              </button>
            </div>
            {/* Topology Preview */}
            <div style={{ padding: 12 }}>
              <TopologyErrorBoundary>
                <MiniTopologyPreview topology={topology} />
              </TopologyErrorBoundary>

              {/* Security Zones */}
              {summary && <SecurityZonePanel summary={summary} />}

              {/* Requirements */}
              {requirements && <ReqSummary requirements={requirements} />}
            </div>
          </div>
        )}

        {/* ── Security Discovery Chips ── */}
        {isReview && securityConfidence !== undefined && securityConfidence < 0.85 && !securityLevel && (
          <div style={{ marginTop: 8, marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuickReplyChip
              label="Lab / None"
              icon={<Ic d={IC.shield} size={14} color="#9CA3AF" />}
              variant="outlined"
              onClick={() => onSecuritySelect && onSecuritySelect("none")}
            />
            <QuickReplyChip
              label="Small Office / Basic"
              icon={<Ic d={IC.shield} size={14} color="#F59E0B" />}
              variant="outlined"
              onClick={() => onSecuritySelect && onSecuritySelect("basic")}
            />
            <QuickReplyChip
              label="Corporate / Enterprise"
              icon={<Ic d={IC.shield} size={14} color={G} />}
              variant="green-outlined"
              onClick={() => onSecuritySelect && onSecuritySelect("enterprise")}
            />
          </div>
        )}

        {/* ── Review Quick Reply Chips ── */}
        {isReview && !showExport && (
          <div style={{ marginTop: 8, marginBottom: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuickReplyChip
              label="Edit Topology"
              icon={<Ic d={IC.pencil} size={14} color="#6B7280" />}
              variant="outlined"
              onClick={() => onChipClick && onChipClick("edit")}
            />
            <QuickReplyChip
              label="Approve and Export"
              icon={<Ic d={IC.check} size={14} color={G} />}
              variant="green-outlined"
              onClick={() => onChipClick && onChipClick("approve")}
            />
            <QuickReplyChip
              label="Ask a Question"
              icon={<Ic d={IC.search} size={14} color="#6B7280" />}
              variant="outlined"
              onClick={() => onChipClick && onChipClick("ask")}
            />
          </div>
        )}

        {/* ── Config Phase: Green System Message ── */}
        {isConfig && (
          <SystemMessage text="Looks good! Generating device configurations..." />
        )}

        {/* ── Config Stream Card ── */}
        {isConfig && configTexts && Object.keys(configTexts).length > 0 && (
          <StreamCard
            title="Generating Device Configs"
            icon={<Ic d={IC.settings} size={16} color="#fff" />}
            codeText={Object.entries(configTexts)
              .map(([name, text]) => `! ${name}\n${text}`)
              .join("\n\n")}
            streaming={isStreaming}
          />
        )}

        {/* ── Individual Config Blocks (after config done) ── */}
        {showExport &&
          configTexts &&
          Object.entries(configTexts).map(([name, text]) => (
            <ConfigBlock key={name} name={name} text={text} streaming={false} />
          ))}

        {/* ── Export Complete: Green System Message ── */}
        {showExport && (
          <SystemMessage text="GNS3 project generated successfully. Ready for download." />
        )}

        {/* ── Download Cards ── */}
        {showExport && exportData && (
          <div style={{ marginTop: 12 }}>
            {/* Ansible Warning */}
            <div
              style={{
                backgroundColor: "#FFFBEB",
                border: "1px solid #FDE68A",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Ic d={IC.alert} size={16} color="#F59E0B" />
              <span>
                The Ansible files use dummy IP addresses. Update the inventory with
                your actual device IPs before running playbooks.
              </span>
            </div>

            <DlRow
              icon={IC.file}
              title="campus-network.gns3project"
              sub="GNS3 project file ready to import"
              onClick={() => downloadGns3(exportData.sessionId || exportData.project_id)}
            />
            <DlRow
              icon={IC.terminal}
              title="configs.zip"
              sub="Device startup configurations"
              onClick={() => downloadConfigsZip(exportData.sessionId || exportData.project_id)}
            />
            <DlRow
              icon={IC.file}
              title="requirements.json"
              sub="Image filenames and device list"
              onClick={() => downloadRequirements(exportData.sessionId || exportData.project_id)}
            />
            <DlRow
              icon={IC.settings}
              title="ansible-export.zip"
              sub="Ansible playbook + inventory + config templates"
              onClick={() => downloadAnsible(exportData.sessionId || exportData.project_id)}
            />

            {/* Download All */}
            <button
              onClick={() => {
                const sid = exportData.sessionId || exportData.project_id;
                downloadGns3(sid);
                downloadConfigsZip(sid);
                downloadRequirements(sid);
                downloadAnsible(sid);
              }}
              style={{
                width: "100%",
                padding: "10px 16px",
                backgroundColor: "transparent",
                color: G,
                border: `1px solid ${G}`,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 4,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#F0FDF4";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Download All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════ */
function Sidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClose,
  onLogout,
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: SIDEBAR_W,
        height: "100vh",
        backgroundColor: "#fff",
        borderRight: `1px solid ${BD}`,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        boxShadow: "2px 0 12px rgba(0,0,0,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: `1px solid ${BD}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NetIcon size={24} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>StructuraNet</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            color: "#6B7280",
          }}
        >
          <IcStroke d={IC.x} size={18} />
        </button>
      </div>

      {/* New Chat */}
      <div style={{ padding: "12px 16px" }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 0",
            backgroundColor: G,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = GH;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = G;
          }}
        >
          <Ic d={IC.plus} size={16} color="#fff" />
          New Chat
        </button>
      </div>

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px" }}>
        {chats.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "#9CA3AF", fontSize: 13 }}>
            No conversations yet
          </div>
        )}
        {chats.map((chat) => (
          <div
            key={chat._id || chat.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              cursor: "pointer",
              marginBottom: 2,
              backgroundColor: (chat._id || chat.id) === currentChatId ? MT : "transparent",
              transition: "background 0.1s",
            }}
            onClick={() => onSelectChat(chat._id || chat.id)}
            onMouseEnter={(e) => {
              if ((chat._id || chat.id) !== currentChatId) {
                e.currentTarget.style.backgroundColor = MT;
              }
            }}
            onMouseLeave={(e) => {
              if ((chat._id || chat.id) !== currentChatId) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <Ic d={IC.file} size={16} color="#9CA3AF" />
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: "#374151",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {chat.title || chat.name || "Untitled Chat"}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(chat._id || chat.id);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#9CA3AF",
                display: "flex",
                opacity: 0.5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.color = "#DC2626";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.5";
                e.currentTarget.style.color = "#9CA3AF";
              }}
            >
              <Ic d={IC.trash} size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${BD}`,
        }}
      >
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            backgroundColor: "transparent",
            color: "#6B7280",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#FEF2F2";
            e.currentTarget.style.color = "#DC2626";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#6B7280";
          }}
        >
          <Ic d={IC.logout} size={16} color="currentColor" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHAT INPUT BAR
   ═══════════════════════════════════════════ */
function ChatInputBar({ onSend, disabled, inputRef }) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "12px 20px 16px",
        backgroundColor: "#fff",
        borderTop: `1px solid ${BD}`,
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? "Waiting for response..." : "Describe your network..."}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          border: `1px solid ${BD}`,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 14,
          fontFamily: "inherit",
          lineHeight: 1.5,
          color: "#111827",
          backgroundColor: BG,
          outline: "none",
          maxHeight: 120,
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = G;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = BD;
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "none",
          backgroundColor: disabled || !text.trim() ? BD : G,
          color: disabled || !text.trim() ? "#9CA3AF" : "#fff",
          cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!disabled && text.trim()) {
            e.currentTarget.style.backgroundColor = GH;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && text.trim()) {
            e.currentTarget.style.backgroundColor = G;
          }
        }}
      >
        <Ic d={IC.send} size={18} color="currentColor" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN CHATPAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function ChatPage() {
  /* ── Auth ── */
  const { user, logout } = useAuth();

  /* ── Health ── */
  const [pythonUp, setPythonUp] = useState(true);
  const [expressUp, setExpressUp] = useState(true);

  /* ── Sidebar ── */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Chats ── */
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  /* ── Session ── */
  const [sessionId, setSessionId] = useState(null);

  /* ── Messages ── */
  const [messages, setMessages] = useState([]);

  /* ── SSE State (shared across assistant messages) ── */
  const [sseState, setSseState] = useState({
    thoughts: [],
    topology: null,
    requirements: null,
    summary: null,
    configTexts: {},
    phase: null,
    subPhase: null,
    status: null,
    exportData: null,
    agentMessage: "",
    toolCallsMade: [],
    securityConfidence: null,
    securityLevel: null,
    isDigitalTwin: false,
    baselineTopology: null,
    topologyName: "",
  });

  /* ── Streaming ── */
  const [isStreaming, setIsStreaming] = useState(false);

  /* ── Topology Viewer ── */
  const [showTopology, setShowTopology] = useState(false);

  /* ── Profile ── */
  const [showProfile, setShowProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  /* ── Refs ── */
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamAbortRef = useRef(null);

  /* ── SSE Hook ── */
  const { startSSE, stopSSE } = useSSE();

  /* ── Derive review state ── */
  const isInReview = useMemo(() => {
    return (
      sseState.phase === "review" ||
      sseState.status === "review" ||
      (sseState.topology && !sseState.exportData && !isStreaming)
    );
  }, [sseState, isStreaming]);

  /* ═══════════ Effects ═══════════ */

  /* Health check on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await checkBackendHealth();
        if (cancelled) return;
        setPythonUp(health?.python !== false);
        setExpressUp(health?.express !== false);
      } catch {
        if (!cancelled) {
          setPythonUp(false);
          setExpressUp(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Load chats on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getChats();
        if (!cancelled && Array.isArray(data)) {
          setChats(data);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Profile check on first visit */
  useEffect(() => {
    if (profileChecked) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile();
        if (!cancelled) {
          if (!profile || !profile.name || !profile.gns3Images) {
            setShowProfile(true);
          }
          setProfileChecked(true);
        }
      } catch {
        if (!cancelled) {
          setShowProfile(true);
          setProfileChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileChecked]);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sseState]);

  /* ═══════════ Handlers ═══════════ */

  /* Reset SSE state for new interaction */
  const resetSSEState = useCallback(() => {
    setSseState({
      thoughts: [],
      topology: null,
      requirements: null,
      summary: null,
      configTexts: {},
      phase: null,
      subPhase: null,
      status: null,
      exportData: null,
      agentMessage: "",
      toolCallsMade: [],
      securityConfidence: null,
      securityLevel: null,
      isDigitalTwin: false,
      baselineTopology: null,
      topologyName: "",
    });
  }, []);

  /* New Chat */
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setSessionId(null);
    setIsStreaming(false);
    resetSSEState();
    setSidebarOpen(false);
    stopSSE();
  }, [resetSSEState, stopSSE]);

  /* Select Chat */
  const handleSelectChat = useCallback(
    async (chatId) => {
      try {
        const chatData = await getChat(chatId);
        setCurrentChatId(chatId);
        setSessionId(chatData?.sessionId || null);
        if (chatData?.messages) {
          setMessages(
            chatData.messages.map((m) => ({
              id: m._id || m.id || Date.now() + Math.random(),
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || new Date().toISOString(),
            }))
          );
        }
        resetSSEState();
        setIsStreaming(false);
        setSidebarOpen(false);
      } catch {
        // silent
      }
    },
    [resetSSEState]
  );

  /* Delete Chat */
  const handleDeleteChat = useCallback(
    async (chatId) => {
      try {
        await deleteChat(chatId);
        setChats((prev) => prev.filter((c) => (c._id || c.id) !== chatId));
        if (chatId === currentChatId) {
          handleNewChat();
        }
      } catch {
        // silent
      }
    },
    [currentChatId, handleNewChat]
  );

  /* Send Message */
  const handleSend = useCallback(
    async (text) => {
      if (!text.trim() || isStreaming) return;

      /* 1. Add user message */
      const userMsg = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      /* 2. Create chat if new */
      let chatId = currentChatId;
      if (!chatId) {
        try {
          const newChat = await createChat({ title: text.slice(0, 60) });
          chatId = newChat._id || newChat.id;
          setCurrentChatId(chatId);
          setChats((prev) => [newChat, ...prev]);
        } catch {
          /* fallback: continue without saving */
        }
      }

      /* 3. Create session if needed */
      let sid = sessionId;
      if (!sid) {
        try {
          const session = await createSession();
          sid = session.sessionId || session.id || session._id;
          setSessionId(sid);
          if (chatId) {
            updateChatSessionId(chatId, sid).catch(() => {});
          }
        } catch {
          return;
        }
      }

      /* 4. Reset SSE state and start streaming */
      resetSSEState();
      setIsStreaming(true);

      /* 5. Add assistant placeholder */
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ]);

      /* 6. Call agentChat + SSE */
      try {
        const response = await agentChat(sid, text);

        /* Start SSE stream */
        startSSE(sid, {
          onThought: (thought) => {
            setSseState((prev) => ({
              ...prev,
              thoughts: [...prev.thoughts, thought],
            }));
          },
          onTopology: (topo) => {
            setSseState((prev) => ({
              ...prev,
              topology: topo,
              topologyName: topo?.name || prev.topologyName || "Network",
            }));
          },
          onRequirements: (reqs) => {
            setSseState((prev) => ({ ...prev, requirements: reqs }));
          },
          onSummary: (sum) => {
            setSseState((prev) => ({
              ...prev,
              summary: sum,
              securityConfidence: sum?.securityConfidence ?? prev.securityConfidence,
              securityLevel: sum?.securityLevel ?? prev.securityLevel,
            }));
          },
          onConfigText: (name, text) => {
            setSseState((prev) => ({
              ...prev,
              configTexts: { ...prev.configTexts, [name]: text },
            }));
          },
          onPhase: (phase) => {
            setSseState((prev) => ({ ...prev, phase }));
          },
          onSubPhase: (subPhase) => {
            setSseState((prev) => ({ ...prev, subPhase }));
          },
          onStatus: (status) => {
            setSseState((prev) => ({ ...prev, status }));
          },
          onExportData: (data) => {
            setSseState((prev) => ({ ...prev, exportData: data }));
          },
          onAgentMessage: (msg) => {
            setSseState((prev) => ({ ...prev, agentMessage: msg }));
          },
          onToolCall: (call) => {
            setSseState((prev) => ({
              ...prev,
              toolCallsMade: [...prev.toolCallsMade, call],
            }));
          },
          onDigitalTwin: (data) => {
            setSseState((prev) => ({
              ...prev,
              isDigitalTwin: true,
              baselineTopology: data?.topology || data,
            }));
          },
          onSecurityConfidence: (conf) => {
            setSseState((prev) => ({ ...prev, securityConfidence: conf }));
          },
          onComplete: () => {
            setIsStreaming(false);
            setSseState((prev) => ({
              ...prev,
              phase: prev.configTexts && Object.keys(prev.configTexts).length > 0 ? "export" : "complete",
              status: "complete",
            }));
          },
          onError: (err) => {
            setIsStreaming(false);
            setSseState((prev) => ({
              ...prev,
              status: "error",
              agentMessage: prev.agentMessage || `An error occurred: ${err?.message || "Unknown error"}`,
            }));
          },
        });
      } catch (err) {
        setIsStreaming(false);
        setSseState((prev) => ({
          ...prev,
          status: "error",
          agentMessage: `Failed to reach the agent: ${err?.message || "Unknown error"}`,
        }));
      }
    },
    [currentChatId, sessionId, isStreaming, resetSSEState, startSSE]
  );

  /* Approve Flow */
  const handleApprove = useCallback(() => {
    handleSend("Approve the topology and generate configurations.");
  }, [handleSend]);

  /* Edit Flow */
  const handleEdit = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  /* Ask Flow */
  const handleAsk = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  /* Chip Click Handler */
  const handleChipClick = useCallback(
    (type) => {
      if (type === "approve") {
        handleApprove();
      } else if (type === "edit") {
        handleEdit();
      } else if (type === "ask") {
        handleAsk();
      }
    },
    [handleApprove, handleEdit, handleAsk]
  );

  /* Security Level Select */
  const handleSecuritySelect = useCallback(
    (level) => {
      setSseState((prev) => ({ ...prev, securityLevel: level }));
      handleSend(`Apply security level: ${level}`);
    },
    [handleSend]
  );

  /* Digital Twin Confirm */
  const handleDigitalTwinConfirm = useCallback(
    (confirmed) => {
      if (confirmed) {
        setSseState((prev) => ({ ...prev, isDigitalTwin: false }));
        handleSend("Yes, that is my network. Proceed with the modifications.");
      } else {
        setSseState((prev) => ({
          ...prev,
          isDigitalTwin: false,
          baselineTopology: null,
        }));
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    },
    [handleSend]
  );

  /* Suggestion Click from Empty State */
  const handleSuggestionClick = useCallback(
    (text) => {
      handleSend(text);
    },
    [handleSend]
  );

  /* Logout */
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  /* ═══════════ RENDER ═══════════ */

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BG,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        position: "relative",
      }}
    >
      {/* Global keyframe styles */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes signalBounce {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
        @keyframes centerGlow {
          0%, 100% { box-shadow: 0 0 8px ${G}44; }
          50% { box-shadow: 0 0 20px ${G}88; }
        }
        * { box-sizing: border-box; }
        textarea:focus { outline: none; }
      `}</style>

      {/* ── Sidebar Overlay ── */}
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0,0,0,0.3)",
              zIndex: 40,
            }}
          />
          <Sidebar
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            onClose={() => setSidebarOpen(false)}
            onLogout={handleLogout}
          />
        </>
      )}

      {/* ── Profile Modal ── */}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      {/* ── Top Bar (52px) ── */}
      <div
        style={{
          height: 52,
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BD}`,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              color: "#374151",
            }}
          >
            <IcStroke d={IC.menu} size={22} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <NetIcon size={24} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              StructuraNet AI
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* View Topology Button (during review) */}
          {isInReview && sseState.topology && (
            <button
              onClick={() => setShowTopology(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                backgroundColor: G,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = GH;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = G;
              }}
            >
              <NetIcon size={16} />
              View Topology
            </button>
          )}
          {/* User avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: MT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 600,
              color: "#6B7280",
            }}
          >
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
        </div>
      </div>

      {/* ── Error Banners ── */}
      {!pythonUp && (
        <div
          style={{
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderLeft: "4px solid #F59E0B",
            padding: "10px 16px",
            fontSize: 13,
            color: "#92400E",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ic d={IC.alert} size={18} color="#F59E0B" />
          Python backend is currently unavailable. Topology generation will not work.
        </div>
      )}
      {!expressUp && (
        <div
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderLeft: "4px solid #DC2626",
            padding: "10px 16px",
            fontSize: 13,
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Ic d={IC.alert} size={18} color="#DC2626" />
          Express API server is down. Chat and session management unavailable.
        </div>
      )}

      {/* ── Message Area ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
        }}
      >
        {/* Empty State */}
        {messages.length === 0 && !isStreaming && (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        )}

        {/* Messages */}
        {messages.map((msg) => {
          if (msg.role === "user") {
            /* ── User Bubble ── */
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    maxWidth: 480,
                    padding: "10px 16px",
                    backgroundColor: G,
                    color: "#fff",
                    borderRadius: "12px 12px 4px 12px",
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }

          /* ── AI Bubble ── */
          return (
            <div key={msg.id} style={{ marginBottom: 20 }}>
              <AIBubble
                message={msg}
                sseState={sseState}
                onApprove={handleApprove}
                onEdit={handleEdit}
                onAsk={handleAsk}
                onSecuritySelect={handleSecuritySelect}
                onDigitalTwinConfirm={handleDigitalTwinConfirm}
                onChipClick={handleChipClick}
                inputRef={inputRef}
              />
            </div>
          );
        })}

        {/* Streaming indicator when no assistant message yet */}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div style={{ marginBottom: 20 }}>
            <AIBubble
              message={{ id: "streaming-placeholder", role: "assistant", content: "" }}
              sseState={{ ...sseState, status: sseState.status || "streaming", phase: sseState.phase || null }}
              onChipClick={handleChipClick}
              inputRef={inputRef}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input ── */}
      <ChatInputBar
        onSend={handleSend}
        disabled={isStreaming}
        inputRef={inputRef}
      />

      {/* ── Topology Viewer Overlay ── */}
      {showTopology && sseState.topology && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "92vw",
              height: "88vh",
              backgroundColor: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowTopology(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#374151",
              }}
            >
              <IcStroke d={IC.x} size={18} />
            </button>
            <TopologyErrorBoundary>
              <TopologyViewer topology={sseState.topology} />
            </TopologyErrorBoundary>
          </div>
        </div>
      )}
    </div>
  );
}
