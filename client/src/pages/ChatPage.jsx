import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import MiniTopologyPreview from "../components/MiniTopologyPreview";
import ProfileModal from "../components/ProfileModal";
import TopologyViewer from "../components/TopologyViewer";
import {
  createSession, agentChat,
  downloadGns3, downloadConfigsZip, downloadRequirements,
  getChats, createChat, deleteChat, updateChatSessionId,
  checkBackendHealth, getChat, getUserProfile,
} from "../lib/api";

// ── Design tokens (from reference §3.3) ──────────────────────────────────────
const G = "#166534";   // PRIMARY green
const GH = "#14532D";  // PRIMARY_HOVER
const BG = "#F9FAFB";
const BD = "#E5E7EB";
const MT = "#F3F4F6";
const SIDEBAR_W = 300; // §12 spec: 300px sidebar width

// ── Thought type labels & colours ─────────────────────────────────────────────
const THOUGHT_TYPE = {
  understanding: { label: "Understanding",  dot: "#3B82F6" },
  decision:      { label: "Device selection", dot: "#10B981" },
  assumption:    { label: "Assumption",      dot: "#F59E0B" },
  warning:       { label: "Warning",         dot: "#EF4444" },
  info:          { label: "Info",            dot: "#8B5CF6" },
};

// ── Blinking cursor ───────────────────────────────────────────────────────────
function Cursor() {
  return (
    <>
      <span style={{
        display: "inline-block", width: 7, height: 14,
        background: G, marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "blink 1s step-end infinite",
      }}/>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </>
  );
}

// ── Network brand icon ────────────────────────────────────────────────────────
function NetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/>
      <rect x="9" y="18" width="6" height="4" rx="1"/>
      <rect x="2" y="10" width="6" height="4" rx="1"/>
      <rect x="16" y="10" width="6" height="4" rx="1"/>
      <line x1="12" y1="6" x2="12" y2="10"/>
      <line x1="12" y1="14" x2="12" y2="18"/>
      <line x1="8" y1="12" x2="5" y2="12"/>
      <line x1="19" y1="12" x2="16" y2="12"/>
    </svg>
  );
}

// ── Icon helper ───────────────────────────────────────────────────────────────
function Ic({ d, size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || "currentColor"} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const IC = {
  menu:     "M3 12h18M3 6h18M3 18h18",
  x:        "M18 6 6 18M6 6l12 12",
  send:     "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  pencil:   "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:    "M20 6L9 17l-5-5",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  alert:    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  file:     "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  shield:   "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  plus:     "M12 5v14M5 12h14",
  expand:   "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  settings: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
};

// ── Pulsing ring loader ────────────────────────────────────────────────────────
function PulseRing() {
  return (
    <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        background: "rgba(22,101,52,0.15)",
        animation: "ring 1.5s ease-out infinite",
      }}/>
      <div style={{
        position: "absolute", inset: 4, borderRadius: "50%",
        background: G,
      }}/>
      <style>{`@keyframes ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}`}</style>
    </div>
  );
}

// ── Thought bubble rendered inline ────────────────────────────────────────────
function ThoughtLine({ thought }) {
  const cfg = THOUGHT_TYPE[thought.type] || THOUGHT_TYPE.info;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0, marginTop: 7,
      }}/>
      <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
        <strong style={{ color: "#111", fontWeight: 600 }}>{cfg.label}</strong>
        {" — "}
        {thought.content || thought.text}
      </span>
    </div>
  );
}

// ── One device config block ───────────────────────────────────────────────────
function ConfigBlock({ name, text, streaming }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
        color: "#6B7280", textTransform: "uppercase",
        fontFamily: "monospace", marginBottom: 4,
      }}>
        {name}
      </div>
      <div style={{
        background: "#0F172A",
        borderRadius: 8,
        padding: "12px 14px",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 12,
        color: "#94A3B8",
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        maxHeight: 260,
        overflowY: "auto",
      }}>
        {text || ""}
        {streaming && <Cursor />}
      </div>
    </div>
  );
}

// ── Download row ──────────────────────────────────────────────────────────────
function DlRow({ icon, title, sub, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", textAlign: "left",
        background: hover ? "#F0FDF4" : "white",
        border: `1px solid ${hover ? "#86EFAC" : BD}`,
        borderRadius: 10, padding: "12px 14px",
        cursor: "pointer", transition: "all .15s",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: "rgba(22,101,52,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: G, flexShrink: 0,
      }}>
        <Ic d={IC[icon]} size={17}/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{sub}</div>
      </div>
      <Ic d={IC.download} size={14} color="#9CA3AF"/>
    </button>
  );
}

// ── Requirements summary (compact, inline) ────────────────────────────────────
function ReqSummary({ requirements }) {
  if (!requirements?.length) return null;
  const missing = requirements.filter((r) => r.status === "missing").length;
  return (
    <div style={{
      border: `1px solid ${BD}`, borderRadius: 10,
      overflow: "hidden", marginBottom: 12,
    }}>
      <div style={{
        background: "#FAFAFA", padding: "8px 14px",
        borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Ic d={IC.shield} size={13} color={G}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>
          Appliance Requirements
        </span>
        <span style={{
          marginLeft: "auto", fontSize: 10, fontFamily: "monospace",
          color: missing > 0 ? "#DC2626" : G,
          background: missing > 0 ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${missing > 0 ? "#FECACA" : "#BBF7D0"}`,
          padding: "1px 7px", borderRadius: 4,
        }}>
          {missing > 0 ? `${missing} missing` : `${requirements.length} OK`}
        </span>
      </div>
      <div style={{ padding: "6px 14px 10px" }}>
        {requirements.map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 0",
            borderBottom: i < requirements.length - 1 ? `1px solid ${MT}` : "none",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: r.status === "ok" ? "#22C55E"
                : r.status === "missing" ? "#EF4444" : "#9CA3AF",
            }}/>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 500, flex: 1 }}>
              {r.name}
            </span>
            <span style={{
              fontSize: 10, fontFamily: "monospace", color: "#6B7280",
              maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {r.image_file || (r.image_required ? "\u26A0 not configured" : "built-in")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI avatar ─────────────────────────────────────────────────────────────────
function AIAvatar({ animate }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: animate ? G : "#E5E7EB",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: animate ? "white" : "#9CA3AF",
      flexShrink: 0,
      transition: "background .3s",
      boxShadow: animate ? `0 0 0 3px rgba(22,101,52,0.15)` : "none",
    }}>
      <NetIcon size={14}/>
    </div>
  );
}

// ── Typing indicator (pulsing dots) ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginBottom: 12,
    }}>
      <PulseRing/>
      <span style={{
        fontSize: 13, color: "#6B7280",
        animation: "typFade 1.5s ease-in-out infinite",
      }}>
        AI is thinking...
      </span>
      <style>{`@keyframes typFade{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );
}

// ── Security profile picker (inline in AIBubble review area) ──────────────────
const SECURITY_PROFILES = [
  {
    id: "none",
    label: "No hardening (lab)",
    desc: "No hardening \u2014 clean configs only",
    icon: "\uD83D\uDCC4",
  },
  {
    id: "basic",
    label: "Basic (SSH, AAA)",
    desc: "SSH, AAA, NTP, Syslog",
    icon: "\uD83D\uDD12",
  },
  {
    id: "enterprise",
    label: "Enterprise (Full ZBF, ACLs)",
    desc: "Full ZBF, ACLs, SNMPv3, HSRP",
    icon: "\uD83D\uDEE1\uFE0F",
  },
];

function SecurityProfilePicker({ selectedProfile, onSelectProfile, onConfirm, onCancel }) {
  return (
    <div style={{
      border: `1px solid ${BD}`, borderRadius: 10,
      overflow: "hidden", marginBottom: 16,
      background: "white",
    }}>
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${BD}`,
        background: "#FAFAFA",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ic d={IC.shield} size={14} color={G}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
            Select security profile
          </span>
        </div>
        <button
          onClick={onCancel}
          style={{
            border: "none", background: "transparent",
            cursor: "pointer", color: "#9CA3AF", padding: 2,
            display: "flex", alignItems: "center",
          }}
        >
          <Ic d={IC.x} size={13}/>
        </button>
      </div>
      <div style={{ padding: "10px 10px 6px" }}>
        {/* Radio-style buttons in a row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {SECURITY_PROFILES.map((p) => {
            const isSelected = selectedProfile === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectProfile(p.id)}
                style={{
                  flex: 1, textAlign: "center",
                  border: `1px solid ${isSelected ? "#BBF7D0" : BD}`,
                  background: isSelected ? "#F0FDF4" : "white",
                  borderRadius: 8, padding: "10px 8px",
                  cursor: "pointer", transition: "all .15s",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>{p.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: isSelected ? G : "#374151",
                }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 1.3 }}>
                  {p.desc}
                </span>
                {/* Radio dot */}
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${isSelected ? G : BD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 2,
                }}>
                  {isSelected && (
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%", background: G,
                    }}/>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {/* Confirm / Cancel buttons */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              border: `1px solid ${BD}`, background: "white",
              borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 500, color: "#6B7280",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              border: "none", background: G,
              borderRadius: 8, padding: "8px 20px",
              fontSize: 13, fontWeight: 600, color: "white",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 5,
              transition: "background .15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = GH; }}
            onMouseOut={(e) => { e.currentTarget.style.background = G; }}
          >
            <Ic d={IC.check} size={13}/> Confirm Export
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  The AI message bubble — renders ALL pipeline output inline
//  This is the core of the Claude-like experience.
//  It mutates progressively as SSE events arrive.
// ═══════════════════════════════════════════════════════════════════
function AIBubble({
  thoughts,        // accumulated thoughts so far
  topology,        // TopologyData or null
  requirements,    // RequiredAppliance[] or null
  summary,         // TopologySummary or null
  configTexts,     // { deviceName: text }
  phase,
  subPhase,
  status,
  exportData,
  agentMessage,    // LLM's text response (from Tool Calling)
  toolCallsMade,   // which tools the LLM called
  isActive,        // true = this is the current live bubble
  onOpenTopology,
  onEdit,
  onApprove,       // (securityProfileId) => void
  sessionId,
  projectName,
}) {
  const isStreaming   = status === "streaming" || status === "exporting";
  const isReview      = status === "review";
  const isDone        = status === "complete";
  const isError       = status === "error";
  const isConfigPhase = status === "exporting" || (isStreaming && Object.keys(configTexts).length > 0);
  const deviceNames   = Object.keys(configTexts);
  // Which device is currently streaming (last one added)
  const activeDevice  = deviceNames[deviceNames.length - 1] || null;

  // Security profile picker state
  const [securityPickerOpen, setSecurityPickerOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState("none");

  // Whether this bubble has any visible content yet
  const hasContent = agentMessage || thoughts.length > 0 || topology || deviceNames.length > 0 || toolCallsMade?.length > 0;

  // Phase label shown while generating
  const phaseLabel = useMemo(() => {
    if (subPhase === "thinking" || phase === "generating") return "Analyzing your network requirements...";
    if (subPhase === "building") return "Building topology and assigning hardware...";
    if (subPhase === "generating_configs" || subPhase === "streaming_configs") return "Generating device configurations...";
    if (subPhase === "finalizing" || subPhase === "exporting") return "Exporting GNS3 project...";
    if (subPhase === "validating") return "Validating project structure...";
    return "Processing...";
  }, [phase, subPhase]);

  // Handle security profile confirmation
  const handleSecurityConfirm = useCallback(() => {
    setSecurityPickerOpen(false);
    onApprove(selectedProfile);
  }, [onApprove, selectedProfile]);

  // Handle security profile cancellation
  const handleSecurityCancel = useCallback(() => {
    setSecurityPickerOpen(false);
    setSelectedProfile("none");
  }, []);

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-start" }}>
      <AIAvatar animate={isActive && isStreaming}/>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── Typing indicator: shown immediately when active but no content yet ── */}
        {isActive && isStreaming && !hasContent && (
          <TypingIndicator />
        )}

        {/* ── Tool call badges (shown during streaming AND after) ── */}
        {toolCallsMade?.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {toolCallsMade.map((tool, i) => {
              const TOOL_STYLE = {
                generate_new_topology:     { label: "Generated Topology",   bg: "#F0FDF4", border: "#BBF7D0", color: G },
                modify_current_topology:   { label: "Modified Topology",    bg: "#EFF6FF", border: "#BFDBFE", color: "#1D4ED8" },
                apply_security_and_export: { label: "Applied Security",     bg: "#FFF7ED", border: "#FED7AA", color: "#C2410C" },
                search_cisco_knowledge:    { label: "Searched Knowledge",   bg: "#FAF5FF", border: "#E9D5FF", color: "#7C3AED" },
              };
              const ts = TOOL_STYLE[tool] || { label: tool, bg: MT, border: BD, color: "#6B7280" };
              return (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 4,
                  background: ts.bg, border: `1px solid ${ts.border}`,
                  color: ts.color, fontFamily: "monospace",
                  letterSpacing: "0.02em",
                }}>
                  {ts.label}
                </span>
              );
            })}
          </div>
        )}

        {/* ── LLM text response (shown DURING streaming too) ── */}
        {agentMessage && (
          <div style={{
            fontSize: 14, color: "#374151", lineHeight: 1.7,
            marginBottom: 16, whiteSpace: "pre-wrap",
          }}>
            {agentMessage}
            {isActive && isStreaming && <Cursor />}
          </div>
        )}

        {/* ── Thinking section — streams thoughts one by one ── */}
        {thoughts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {thoughts.map((t, i) => (
              <ThoughtLine key={t.id || i} thought={t}/>
            ))}
            {isActive && isStreaming && phase === "generating" && thoughts.length > 0 && (
              <Cursor />
            )}
          </div>
        )}

        {/* ── Phase status line while actively generating ── */}
        {isActive && isStreaming && hasContent && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: thoughts.length > 0 ? 16 : 0,
          }}>
            <PulseRing/>
            <span style={{ fontSize: 13, color: "#6B7280" }}>{phaseLabel}</span>
          </div>
        )}

        {/* ── Topology ready card + MiniPreview ── */}
        {topology && (
          <div style={{
            border: `1px solid ${BD}`, borderRadius: 12,
            overflow: "hidden", marginBottom: 16,
          }}>
            {/* Header */}
            <div style={{
              background: "#F0FDF4",
              borderBottom: `1px solid #BBF7D0`,
              padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Ic d={IC.check} size={14} color={G}/>
              <span style={{ fontSize: 13, fontWeight: 600, color: G }}>
                Topology Ready — {topology.name}
              </span>
              <span style={{ fontSize: 12, color: "#6B7280", marginLeft: 4 }}>
                {topology.node_count} nodes · {topology.link_count} links
              </span>
              <button
                onClick={onOpenTopology}
                style={{
                  marginLeft: "auto",
                  background: "none", border: `1px solid #BBF7D0`,
                  borderRadius: 6, padding: "3px 10px",
                  fontSize: 11, fontWeight: 600, color: G,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <Ic d={IC.expand} size={11}/> Expand
              </button>
            </div>

            {/* Mini preview inline */}
            <div style={{ padding: "8px 12px", background: "white" }}>
              <MiniTopologyPreview
                topology={topology}
                requirements={requirements}
                onClick={onOpenTopology}
              />
            </div>

            {/* Requirements summary */}
            {requirements && (
              <div style={{ padding: "0 12px 12px" }}>
                <ReqSummary requirements={requirements}/>
              </div>
            )}

            {/* Design summary */}
            {summary && (
              <div style={{ padding: "0 12px 12px" }}>
                {summary.design_review?.length > 0 && (
                  <div style={{
                    fontSize: 13, color: "#374151", lineHeight: 1.6,
                    padding: "8px 12px",
                    background: MT, borderRadius: 8,
                    marginBottom: 8,
                  }}>
                    {summary.design_review.map((line, i) => (
                      <div key={i} style={{ marginBottom: i < summary.design_review.length - 1 ? 4 : 0 }}>
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Review action buttons ── */}
        {isReview && topology && !securityPickerOpen && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              onClick={onEdit}
              style={{
                border: `1px solid ${BD}`,
                background: "white", borderRadius: 8,
                padding: "9px 18px",
                fontSize: 13, fontWeight: 500, color: "#374151",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "all .15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = G; e.currentTarget.style.color = G; }}
              onMouseOut={(e)  => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.color = "#374151"; }}
            >
              <Ic d={IC.pencil} size={13}/> Edit Topology
            </button>
            <button
              onClick={() => setSecurityPickerOpen(true)}
              style={{
                border: "none", background: G,
                borderRadius: 8, padding: "9px 20px",
                fontSize: 13, fontWeight: 600, color: "white",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "background .15s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = GH; }}
              onMouseOut={(e)  => { e.currentTarget.style.background = G; }}
            >
              <Ic d={IC.check} size={13}/> Approve & Export
            </button>
          </div>
        )}

        {/* ── Inline security profile picker ── */}
        {isReview && topology && securityPickerOpen && (
          <SecurityProfilePicker
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            onConfirm={handleSecurityConfirm}
            onCancel={handleSecurityCancel}
          />
        )}

        {/* ── Config streaming ── one block per device, appending live ── */}
        {deviceNames.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 12, color: "#6B7280",
              marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
            }}>
              {isConfigPhase && <PulseRing/>}
              {isConfigPhase
                ? "Generating device startup configurations..."
                : "Device configurations generated"}
            </div>
            {deviceNames.map((name) => (
              <ConfigBlock
                key={name}
                name={name}
                text={configTexts[name]}
                streaming={isActive && isConfigPhase && name === activeDevice}
              />
            ))}
          </div>
        )}

        {/* ── Success: download cards ── */}
        {isDone && exportData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{
              fontSize: 13, color: G, fontWeight: 500,
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 4,
            }}>
              <Ic d={IC.check} size={13}/>
              GNS3 project ready
              {exportData.validator_passed === true && (
                <span style={{
                  fontSize: 10, background: "#F0FDF4",
                  border: "1px solid #BBF7D0", borderRadius: 4,
                  padding: "1px 7px", color: G, fontWeight: 600,
                }}>VALIDATED</span>
              )}
            </div>
            <DlRow icon="file" title={`${projectName || "network"}.gns3project`}
              sub={`${exportData.configured_count} configured · ${(exportData.file_size_bytes / 1024).toFixed(0)} KB`}
              onClick={() => downloadGns3(sessionId, projectName)}
            />
            <DlRow icon="file" title="Device Configurations"
              sub="Startup configs for all routers and hosts"
              onClick={() => downloadConfigsZip(sessionId, projectName)}
            />
            <DlRow icon="shield" title="Requirements Manifest"
              sub="Appliance list with image filenames"
              onClick={() => downloadRequirements(sessionId, projectName)}
            />
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "12px 14px",
            fontSize: 13, color: "#DC2626",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Ic d={IC.alert} size={14} color="#DC2626"/>
            Generation failed. Please try again or edit your prompt.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Sidebar (300px width per §12)
// ═══════════════════════════════════════════════════════════════════
function Sidebar({ open, onClose, onNewChat, history, onSelectHistory, onDeleteChat, user, onLogout, onOpenProfile }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter history by search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter((chat) =>
      (chat.title || "").toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.15)",
        }}/>
      )}
      <div style={{
        position: "fixed", left: 0, top: 0, bottom: 0,
        width: SIDEBAR_W, background: "white",
        borderRight: `1px solid ${BD}`,
        zIndex: 50, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : `translateX(-${SIDEBAR_W}px)`,
        transition: "transform .22s ease-out",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px", borderBottom: `1px solid ${BD}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: G,
              display: "flex", alignItems: "center", justifyContent: "center", color: "white",
            }}>
              <NetIcon size={14}/>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>StructuraNet AI</span>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "transparent",
            cursor: "pointer", color: "#6B7280", padding: 4,
          }}>
            <Ic d={IC.x} size={15}/>
          </button>
        </div>

        {/* New chat */}
        <div style={{ padding: "12px 12px 8px" }}>
          <button onClick={() => { onNewChat(); onClose(); }} style={{
            width: "100%", background: G, color: "white",
            border: "none", borderRadius: 8, padding: "9px 12px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, justifyContent: "center",
            fontFamily: "inherit",
          }}
            onMouseOver={(e) => e.currentTarget.style.background = GH}
            onMouseOut={(e)  => e.currentTarget.style.background = G}
          >
            <Ic d={IC.plus} size={13}/> New Topology
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            border: `1px solid ${BD}`, borderRadius: 8,
            padding: "6px 10px", background: "white",
          }}>
            <Ic d={IC.search} size={13} color="#9CA3AF"/>
            <input
              type="text"
              placeholder="Search topologies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none", outline: "none", flex: 1,
                fontSize: 12, color: "#374151", background: "transparent",
                fontFamily: "inherit", padding: 0,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: "#9CA3AF", padding: 0,
                  display: "flex", alignItems: "center",
                }}
              >
                <Ic d={IC.x} size={11}/>
              </button>
            )}
          </div>
        </div>

        {/* History */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {filteredHistory.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
              {searchQuery ? "No matching topologies" : "No topologies yet"}
            </div>
          )}
          {filteredHistory.map((chat) => (
            <div
              key={chat._id || chat.id}
              onClick={() => { onSelectHistory(chat); onClose(); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              }}
              onMouseOver={(e) => e.currentTarget.style.background = MT}
              onMouseOut={(e)  => e.currentTarget.style.background = "transparent"}
            >
              <span style={{
                fontSize: 13, color: "#374151",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                flex: 1,
              }}>
                {chat.title || "Untitled"}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteChat(chat._id || chat.id); }}
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: "#D1D5DB",
                  padding: 2, flexShrink: 0,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = "#EF4444"}
                onMouseOut={(e)  => e.currentTarget.style.color = "#D1D5DB"}
              >
                <Ic d={IC.trash} size={12}/>
              </button>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${BD}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
              {user?.username || "User"}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>{user?.email || ""}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { onOpenProfile(); onClose(); }} style={{
              border: `1px solid ${BD}`, background: "white",
              borderRadius: 7, padding: "5px 10px",
              fontSize: 12, color: "#6B7280", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
              onMouseOver={(e) => { e.currentTarget.style.color = G; e.currentTarget.style.borderColor = "#BBF7D0"; }}
              onMouseOut={(e)  => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = BD; }}
            >
              <Ic d={IC.settings} size={13}/> Profile
            </button>
            <button onClick={onLogout} style={{
              border: `1px solid ${BD}`, background: "white",
              borderRadius: 7, padding: "5px 10px",
              fontSize: 12, color: "#6B7280", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseOut={(e)  => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = BD; }}
            >
              <Ic d={IC.logout} size={13}/> Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Input bar
// ═══════════════════════════════════════════════════════════════════
function ChatInputBar({ onSend, disabled, placeholder, inputRef, externalFocus }) {
  const [value, setValue] = useState("");
  const taRef = useRef(null);

  // Expose the internal textarea ref to parent via inputRef
  useEffect(() => {
    if (inputRef) inputRef.current = taRef.current;
  }, [inputRef]);

  // When externalFocus is triggered, focus and optionally set placeholder
  useEffect(() => {
    if (externalFocus && taRef.current) {
      taRef.current.focus();
    }
  }, [externalFocus]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      <div style={{
        flex: 1, border: `1px solid ${BD}`, borderRadius: 12,
        overflow: "hidden", display: "flex", alignItems: "flex-end",
        background: "white", transition: "border-color .15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
        onFocusCapture={(e) => e.currentTarget.style.borderColor = G}
        onBlurCapture={(e)  => e.currentTarget.style.borderColor = BD}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          disabled={disabled}
          placeholder={placeholder || "Describe a network topology..."}
          rows={1}
          style={{
            flex: 1, border: "none", outline: "none",
            resize: "none", padding: "13px 14px",
            fontSize: 14, fontFamily: "inherit",
            color: "#111", lineHeight: 1.5,
            background: "transparent", maxHeight: 160,
          }}
        />
      </div>
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        style={{
          width: 44, height: 44, borderRadius: 12, border: "none",
          background: (disabled || !value.trim()) ? BD : G,
          color:      (disabled || !value.trim()) ? "#9CA3AF" : "white",
          cursor:     (disabled || !value.trim()) ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, transition: "all .15s",
        }}
        onMouseOver={(e) => { if (!disabled && value.trim()) e.currentTarget.style.background = GH; }}
        onMouseOut={(e)  => { if (!disabled && value.trim()) e.currentTarget.style.background = G; }}
      >
        <Ic d={IC.send} size={17}/>
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Empty state / suggestions
// ═══════════════════════════════════════════════════════════════════
const SUGGESTIONS = [
  "Campus network with 3 VLANs, core router, and internet access",
  "How do I configure OSPF on a Cisco router?",
  "Apply enterprise security to my topology",
  "Branch office with WAN link to HQ and local workstations",
  "Add a DMZ zone with firewall between my core and edge routers",
  "Simple lab: 2 routers, 2 switches, and 4 PCs",
];

function EmptyState({ onSend }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "100%", gap: 14, textAlign: "center",
      padding: "0 24px",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "rgba(22,101,52,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center", color: G,
      }}>
        <NetIcon size={28}/>
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 6 }}>
          What network would you like to build?
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 460, lineHeight: 1.6 }}>
          Describe any topology in plain English, ask about configurations, or request security hardening. I'll design, configure, and export a ready-to-import GNS3 project.
        </div>
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap",
        gap: 8, justifyContent: "center", maxWidth: 560, marginTop: 4,
      }}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} onClick={() => onSend(s)} style={{
            background: "white", border: `1px solid ${BD}`,
            borderRadius: 20, padding: "7px 16px",
            fontSize: 13, color: "#374151", cursor: "pointer",
            transition: "all .15s",
          }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = G; e.currentTarget.style.color = G; e.currentTarget.style.background = "#F0FDF4"; }}
            onMouseOut={(e)  => { e.currentTarget.style.borderColor = BD; e.currentTarget.style.color = "#374151"; e.currentTarget.style.background = "white"; }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN ChatPage
// ═══════════════════════════════════════════════════════════════════
export default function ChatPage() {
  const { user, logout } = useAuth();

  const {
    thoughts, topology, requirements, summary,
    configTexts, phase, subPhase, status, exportData,
    agentMessage, toolCallsMade,
    startStream, stopStream, reset,
  } = useSSE();

  // ── Page state ────────────────────────────────────────────────
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const [history,      setHistory]      = useState([]);
  const [sessionId,    setSessionId]    = useState(null);
  const [chatId,       setChatId]       = useState(null);
  const [profileOpen,  setProfileOpen]  = useState(false);

  // ── Edit mode: just a focus trigger for the chat input ────────
  const [editFocusCounter, setEditFocusCounter] = useState(0);
  const [inputPlaceholder, setInputPlaceholder] = useState("");
  const inputRef = useRef(null);

  // ── messages: array of { role, text, bubbleData? } ───────────
  // role = "user" | "ai" | "error"
  // ai bubbles use bubbleData snapshot to replay history
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);
  const profile = useRef(null); // loaded from /api/profile on mount

  // ── Refs to track current SSE state for snapshotting ──────────
  // These let us snapshot the current bubble data before reset() clears it.
  const sseStateRef = useRef({
    thoughts: [], topology: null, requirements: null, summary: null,
    configTexts: {}, phase: 'idle', subPhase: null, status: 'idle',
    exportData: null, agentMessage: '', toolCallsMade: [],
  });

  // Keep the ref in sync with the actual SSE state
  useEffect(() => {
    sseStateRef.current = {
      thoughts, topology, requirements, summary,
      configTexts, phase, subPhase, status,
      exportData, agentMessage, toolCallsMade,
    };
  }, [thoughts, topology, requirements, summary,
      configTexts, phase, subPhase, status,
      exportData, agentMessage, toolCallsMade]);

  // ── Snapshot current live bubble data into messages array ────
  // Call this BEFORE reset()/startStream() to preserve the previous AI bubble's content.
  const snapshotCurrentBubble = useCallback(() => {
    const snap = { ...sseStateRef.current };
    setMessages((prev) => {
      // Find the last 'ai' message and attach the snapshot
      const idx = prev.findLastIndex((m) => m.role === 'ai');
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], bubbleData: snap };
      return updated;
    });
  }, []);

  // ── Auto-snapshot when a bubble completes ───────────────────
  // When status transitions to 'complete' or 'error', snapshot automatically
  // so the bubble data is preserved even without an explicit call.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if ((status === 'complete' || status === 'error' || status === 'review')
        && prevStatusRef.current !== status) {
      snapshotCurrentBubble();
    }
    prevStatusRef.current = status;
  }, [status, snapshotCurrentBubble]);
  // Derived
  const isStreaming  = status === "streaming" || status === "exporting";
  const isReview     = status === "review";
  const isComplete   = status === "complete";
  const isError      = status === "error";
  const isActive     = isStreaming || isReview || isComplete || isError;
  const projectName  = topology?.name || sessionId || "network";

  // ── Load history + profile on mount ──────────────────────────
  useEffect(() => {
    getChats().then(setHistory).catch(() => {});
    getUserProfile().then((d) => {
      const p = d?.profile || {};
      profile.current = p;
      // ── First-visit profile popup ──
      // Only show if the profile has NO version AND NO images at all.
      // This prevents the popup from showing every time the page loads
      // when the user previously skipped it.
      const hasVersion = p.version && p.version.trim() !== "";
      const hasImages = (Array.isArray(p.images) && p.images.length > 0)
        || (typeof p.images === "object" && p.images !== null && Object.keys(p.images).length > 0);
      // FIX: Only show profile popup if there's genuinely no profile data.
      // If the user already saved a profile (even partially), don't force the popup.
      const hasAnyProfileData = hasVersion || hasImages || p.features;
      if (!hasAnyProfileData) {
        setProfileOpen(true);
      }
    }).catch(() => {
      // Profile not loaded — could be a 404 (no profile yet) or server error.
      // Don't force the popup on server error — only on first visit (404).
      profile.current = {};
      // Only show popup if it's genuinely a first visit (no profile exists)
      // Don't block the UI if the server is just temporarily unavailable.
    });
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thoughts.length, Object.keys(configTexts).length]);

  // ── Send a user prompt (LLM Tool Calling) ────────────────────────
  // FIX: Only create a chat entry in the database ONCE per conversation (first message only).
  // Previously, every message created a new chat entry.
  // FIX: Use agentChat HTTP response for instant agent_message display,
  // while SSE streams topology/config data in real-time.
  const handleSend = useCallback(async (text) => {
    // 0. Snapshot the current live bubble before we start a new stream
    snapshotCurrentBubble();

    // 1. Push user bubble
    setMessages((prev) => [...prev, { role: "user", text }]);
    // 2. Push empty AI bubble (will fill via SSE + agentChat response)
    setMessages((prev) => [...prev, { role: "ai", id: Date.now() }]);

    // Clear edit placeholder
    setInputPlaceholder("");

    try {
      // Create session if needed
      let sid = sessionId;
      if (!sid) {
        const sess = await createSession(profile.current || {});
        sid = sess.session_id;
        setSessionId(sid);
      }

      // Start SSE listener first (so we catch early events)
      startStream(sid);

      // Send message to the Tool Calling agent
      // The LLM decides which tools to call; SSE events stream topology/config/etc.
      // The HTTP response also contains { message, tool_calls_made } for instant display.
      const agentResponse = await agentChat(sid, text);

      // Save to chat history ONLY on the first message of a conversation
      if (!chatId) {
        try {
          const chat = await createChat({ text });
          const cid = chat._id || chat.id;
          setChatId(cid);
          setHistory((h) => [chat, ...h.filter((c) => (c._id || c.id) !== cid)]);
          if (sid) await updateChatSessionId(cid, sid);
        } catch { /* non-critical */ }
      } else {
        // Persist subsequent user messages to the existing chat record
        try {
          await fetch(`/api/chats/${chatId}/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({
              messages: [
                { role: "user", content: text },
                { role: "assistant", content: agentResponse?.message || "" },
              ],
            }),
          });
        } catch { /* non-critical */ }
      }
    } catch (err) {
      // CRITICAL FIX: Reset SSE state on error so the input re-enables.
      // Without this, the status stays "streaming" forever and the user can't type.
      stopStream();
      reset();
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  }, [sessionId, chatId, startStream, stopStream, reset, snapshotCurrentBubble]);

  // ── Edit topology — focuses chat input with a hint placeholder ──
  const handleEditFocus = useCallback(() => {
    setInputPlaceholder("Describe your changes...");
    setEditFocusCounter((c) => c + 1);
    // Also focus the input directly if ref is available
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // ── Approve topology — accepts a security profile from the inline selector ──
  const handleApprove = useCallback(async (securityProfile) => {
    if (!sessionId) return;
    const secProfile = securityProfile || profile.current?.security_profile || "none";
    const secLabel = secProfile === "enterprise" ? "enterprise-grade"
      : secProfile === "basic" ? "basic"
      : "no (pure lab)";
    const msg = `I approve this topology. Please export it with ${secLabel} security hardening.`;

    // Snapshot current bubble before reset
    snapshotCurrentBubble();

    // Push user message to chat
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setMessages((prev) => [...prev, { role: "ai", id: Date.now() }]);

    try {
      startStream(sessionId);
      await agentChat(sessionId, msg);
    } catch (err) {
      // CRITICAL FIX: Reset SSE state on error so the input re-enables.
      stopStream();
      reset();
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  }, [sessionId, startStream, stopStream, reset, snapshotCurrentBubble]);

  // ── Load a past chat from history ────────────────────────────
  const handleSelectHistory = useCallback(async (chat) => {
    reset();
    setSessionId(null);
    setChatId(null);
    setMessages([]);
    setInputPlaceholder("");

    try {
      const full = await getChat(chat._id || chat.id);
      const msgs = full.messages || [];
      // Restore conversation as user + static AI bubbles (no live SSE)
      const restored = [];
      msgs.forEach((m) => {
        if (m.role === "user") {
          restored.push({ role: "user", text: m.content });
        }
        // Skip assistant messages — they were pipeline output, just show
        // a placeholder "Generation complete" AI bubble
      });
      // Add a static summary bubble if we have a sessionId from the chat
      if (full.sessionId) {
        setSessionId(full.sessionId);
        restored.push({
          role: "ai-static",
          text: "Topology generation completed. Use the session to download files or start a new request.",
        });
      }
      setMessages(restored);
      setChatId(chat._id || chat.id);
    } catch {
      // Fallback: just show title
      setMessages([{ role: "user", text: chat.title || "Previous conversation" }]);
    }
  }, [reset]);

  // ── New chat ──────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    stopStream();
    reset();
    setSessionId(null);
    setChatId(null);
    setMessages([]);
    setInputPlaceholder("");
  }, [stopStream, reset]);

  // ── Profile saved — update local ref ──────────────────────────
  const handleProfileSaved = useCallback((savedProfile) => {
    profile.current = savedProfile;
  }, []);

  // ── Delete chat from sidebar ──────────────────────────────────
  const handleDeleteChat = useCallback(async (id) => {
    try {
      await deleteChat(id);
      setHistory((h) => h.filter((c) => (c._id || c.id) !== id));
    } catch { /* ignore */ }
  }, []);

  // ── Figure out how many messages are in the chat ─────────────
  const isEmpty = messages.length === 0 && !isActive;

  // ── The live AI bubble is always the last "ai" message ───────
  const liveAiBubbleIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "ai") return i;
    }
    return -1;
  }, [messages]);

  // ── Dynamic placeholder for the input bar ────────────────────
  const chatPlaceholder = inputPlaceholder
    || (isStreaming
      ? "Generating topology..."
      : isReview
      ? "Ask for changes or click Approve to export..."
      : "Describe a network topology...");

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: BG, fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Top bar ── */}
      <div style={{
        height: 52, background: "white", borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSidebarOpen(true)} style={{
            border: "none", background: "transparent",
            cursor: "pointer", color: "#6B7280", padding: 6,
            display: "flex", borderRadius: 6,
          }}>
            <Ic d={IC.menu} size={18}/>
          </button>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: G,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}>
            <NetIcon size={14}/>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>StructuraNet AI</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {topology && !topologyOpen && (
            <button onClick={() => setTopologyOpen(true)} style={{
              border: `1px solid #BBF7D0`, background: "#F0FDF4",
              borderRadius: 8, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, color: G,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
              <Ic d={IC.expand} size={12}/> View Full Topology
            </button>
          )}
          <button onClick={logout} style={{
            border: "none", background: "transparent",
            cursor: "pointer", color: "#9CA3AF", padding: 6,
            display: "flex", borderRadius: 6,
          }} title="Sign out">
            <Ic d={IC.logout} size={16}/>
          </button>
        </div>
      </div>

      {/* ── Message scroll area ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        {isEmpty ? (
          <EmptyState onSend={handleSend}/>
        ) : (
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px" }}>
            {messages.map((msg, idx) => {
              // ── User bubble ──────────────────────────────────────
              if (msg.role === "user") {
                return (
                  <div key={idx} style={{
                    display: "flex", justifyContent: "flex-end",
                    marginBottom: 20,
                  }}>
                    <div style={{
                      background: G, color: "white",
                      borderRadius: "18px 18px 4px 18px",
                      padding: "11px 16px",
                      fontSize: 14, lineHeight: 1.55,
                      maxWidth: "75%",
                      boxShadow: "0 1px 4px rgba(22,101,52,0.25)",
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // ── Error bubble ─────────────────────────────────────
              if (msg.role === "error") {
                return (
                  <div key={idx} style={{ marginBottom: 20 }}>
                    <div style={{
                      background: "#FEF2F2", border: "1px solid #FECACA",
                      borderRadius: 12, padding: "10px 14px",
                      fontSize: 13, color: "#DC2626",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <Ic d={IC.alert} size={14} color="#DC2626"/> {msg.text}
                    </div>
                  </div>
                );
              }

              // ── Static AI bubble (history) ───────────────────────
              if (msg.role === "ai-static") {
                return (
                  <div key={idx} style={{
                    display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-start",
                  }}>
                    <AIAvatar animate={false}/>
                    <div style={{
                      fontSize: 14, color: "#6B7280",
                      lineHeight: 1.6, paddingTop: 4,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // ── Live AI bubble ───────────────────────────────────
              // The last "ai" role message is the live one; earlier ones
              // are completed (no cursor, no buttons)
              if (msg.role === "ai") {
                const isLive = idx === liveAiBubbleIdx;
                // Use bubbleData snapshot for non-live bubbles, live SSE state for the current one
                const bd = msg.bubbleData;
                return (
                  <AIBubble
                    key={msg.id || idx}
                    thoughts={isLive ? thoughts : (bd?.thoughts || [])}
                    topology={isLive ? topology : (bd?.topology || null)}
                    requirements={isLive ? requirements : (bd?.requirements || null)}
                    summary={isLive ? summary : (bd?.summary || null)}
                    configTexts={isLive ? configTexts : (bd?.configTexts || {})}
                    phase={isLive ? phase : (bd?.phase || "done")}
                    subPhase={isLive ? subPhase : (bd?.subPhase || null)}
                    status={isLive ? status : (bd?.status || "complete")}
                    exportData={isLive ? exportData : (bd?.exportData || null)}
                    agentMessage={isLive ? agentMessage : (bd?.agentMessage || "")}
                    toolCallsMade={isLive ? toolCallsMade : (bd?.toolCallsMade || [])}
                    isActive={isLive && isActive}
                    onOpenTopology={() => setTopologyOpen(true)}
                    onEdit={handleEditFocus}
                    onApprove={handleApprove}
                    sessionId={sessionId}
                    projectName={projectName}
                  />
                );
              }

              return null;
            })}

            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div style={{
        borderTop: `1px solid ${BD}`, background: "white",
        padding: "12px 24px 16px",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <ChatInputBar
            onSend={handleSend}
            disabled={isStreaming}
            placeholder={chatPlaceholder}
            inputRef={inputRef}
            externalFocus={editFocusCounter}
          />
          <div style={{
            marginTop: 8, fontSize: 11, color: "#9CA3AF",
            textAlign: "center",
          }}>
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* ── TopologyViewer overlay (standalone component) ── */}
      {/* Only pass topology, requirements, onClose — NOT onEdit/onApprove/isReview */}
      {topologyOpen && topology && (
        <TopologyViewer
          topology={topology}
          requirements={requirements}
          onClose={() => setTopologyOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        history={history}
        onSelectHistory={handleSelectHistory}
        onDeleteChat={handleDeleteChat}
        user={user}
        onLogout={logout}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          onSaved={(saved) => { handleProfileSaved(saved); setProfileOpen(false); }}
        />
      )}
    </div>
  );
}
