import { useState } from "react";
import { NetworkIcon, PATHS } from "./Icons";

const G = "#166534";

function Ic({ d, size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || "currentColor"} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const PILLS = [
  {
    id: "design",
    label: "Design",
    icon: PATHS.sparkles,
    suggestions: [
      "Campus network with 3 VLANs and a core router",
      "Branch office topology with WAN redundancy",
      "Data center spine-leaf architecture",
    ],
  },
  {
    id: "configure",
    label: "Configure",
    icon: PATHS.settings,
    suggestions: [
      "Configure OSPF routing between 3 routers",
      "Set up VLANs with inter-VLAN routing",
      "Implement HSRP for gateway redundancy",
    ],
  },
  {
    id: "secure",
    label: "Secure",
    icon: PATHS.shield,
    suggestions: [
      "Add a firewall between inside and outside networks",
      "Configure site-to-site VPN with IKEv2",
      "Implement zone-based firewall with DMZ",
    ],
  },
];

export default function EmptyState({ onSuggestionClick }) {
  const [expandedPill, setExpandedPill] = useState(null);

  const togglePill = (id) => {
    setExpandedPill((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      padding: "40px 24px",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* 56px icon in green circle */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "#F0FDF4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: G,
        marginBottom: 20,
      }}>
        <NetworkIcon size={28}/>
      </div>

      <h2 style={{
        fontSize: 22,
        fontWeight: 700,
        color: "#111",
        marginBottom: 8,
      }}>
        What would you like to build?
      </h2>

      <p style={{
        fontSize: 14,
        color: "#6B7280",
        maxWidth: 460,
        textAlign: "center",
        lineHeight: 1.6,
        marginBottom: 28,
      }}>
        Describe a network topology in natural language and I will generate a fully configured GNS3 project for you.
      </p>

      {/* Three pills */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {PILLS.map((pill) => {
          const isExpanded = expandedPill === pill.id;
          return (
            <div key={pill.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                onClick={() => togglePill(pill.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 18px",
                  border: `1px solid ${isExpanded ? "#BBF7D0" : "#E5E7EB"}`,
                  background: isExpanded ? "#F0FDF4" : "white",
                  borderRadius: 24,
                  fontSize: 13,
                  fontWeight: 600,
                  color: isExpanded ? G : "#374151",
                  cursor: "pointer",
                  transition: "all .2s",
                  fontFamily: "inherit",
                }}
                onMouseOver={(e) => {
                  if (!isExpanded) {
                    e.currentTarget.style.borderColor = "#BBF7D0";
                    e.currentTarget.style.background = "#F0FDF4";
                    e.currentTarget.style.color = G;
                  }
                }}
                onMouseOut={(e) => {
                  if (!isExpanded) {
                    e.currentTarget.style.borderColor = "#E5E7EB";
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "#374151";
                  }
                }}
              >
                <Ic d={pill.icon} size={15} color={isExpanded ? G : "#6B7280"}/>
                {pill.label}
              </button>

              {/* Expanded suggestions */}
              <div style={{
                overflow: "hidden",
                maxHeight: isExpanded ? 200 : 0,
                transition: "max-height .3s ease-out",
                width: "100%",
              }}>
                <div style={{
                  marginTop: 8,
                  background: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  minWidth: 260,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    marginBottom: 8, fontSize: 12, fontWeight: 600, color: G,
                  }}>
                    <Ic d={pill.icon} size={13}/> {pill.label}
                  </div>
                  {pill.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onSuggestionClick(s)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "7px 10px",
                        border: "none",
                        background: "transparent",
                        borderRadius: 6,
                        fontSize: 13,
                        color: "#374151",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "background .15s",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(22,101,52,0.08)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
