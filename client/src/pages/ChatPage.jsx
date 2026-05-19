import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import MiniTopologyPreview from "../components/MiniTopologyPreview";
import {
  createSession, startGeneration, editTopology, approveTopology,
  downloadGns3, downloadConfigsZip, downloadRequirements,
  getChats, createChat, deleteChat, updateChatSessionId,
  checkBackendHealth, getChat,
} from "../lib/api";

// ── Design tokens (from reference §3.3) ──────────────────────────────────────
const G = "#166534";   // PRIMARY green
const GH = "#14532D";  // PRIMARY_HOVER
const BG = "#F9FAFB";
const BD = "#E5E7EB";
const MT = "#F3F4F6";

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
              {r.image_file || (r.image_required ? "⚠ not configured" : "built-in")}
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
  isActive,        // true = this is the current live bubble
  onOpenTopology,
  onEdit,
  onApprove,
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

  // Phase label shown while generating
  const phaseLabel = useMemo(() => {
    if (subPhase === "thinking" || phase === "generating") return "Analyzing your network requirements...";
    if (subPhase === "building") return "Building topology and assigning hardware...";
    if (subPhase === "generating_configs" || subPhase === "streaming_configs") return "Generating device configurations...";
    if (subPhase === "finalizing" || subPhase === "exporting") return "Exporting GNS3 project...";
    if (subPhase === "validating") return "Validating project structure...";
    return "Processing...";
  }, [phase, subPhase]);

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "flex-start" }}>
      <AIAvatar animate={isActive && isStreaming}/>

      <div style={{ flex: 1, minWidth: 0 }}>
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
        {isActive && isStreaming && (
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
        {isReview && topology && (
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
              onClick={onApprove}
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
//  Sidebar
// ═══════════════════════════════════════════════════════════════════
function Sidebar({ open, onClose, onNewChat, history, onSelectHistory, onDeleteChat, user, onLogout }) {
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
        width: 280, background: "white",
        borderRight: `1px solid ${BD}`,
        zIndex: 50, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-280px)",
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

        {/* History */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {history.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
              No topologies yet
            </div>
          )}
          {history.map((chat) => (
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
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  TopologyViewer overlay (full-screen)
// ═══════════════════════════════════════════════════════════════════
function TopologyViewer({ topology, requirements, onClose, onEdit, onApprove, isReview }) {
  const [selected, setSelected] = useState(null);

  const nodes = topology?.nodes || [];
  const links = topology?.links || [];

  // Simple grid layout — fixed tiers, no physics needed for correctness
  const NODE_TYPE_TIER = {
    nat: 0, cloud: 0,
    dynamips: 1, iou: 1, qemu: 1, virtualbox: 1, vmware: 1,
    ethernet_switch: 2, ethernet_hub: 2, frame_relay_switch: 2, atm_switch: 2,
    docker: 3,
    vpcs: 3, traceng: 3,
  };

  const NODE_COLOR = {
    dynamips:        { fill: "rgba(22,101,52,0.10)", stroke: "rgba(22,101,52,0.55)", text: "#166534", abbr: "R"   },
    iou:             { fill: "rgba(22,101,52,0.10)", stroke: "rgba(22,101,52,0.55)", text: "#166534", abbr: "IOU" },
    qemu:            { fill: "rgba(22,101,52,0.10)", stroke: "rgba(22,101,52,0.55)", text: "#166534", abbr: "VM"  },
    ethernet_switch: { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "SW" },
    ethernet_hub:    { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "HUB"},
    vpcs:            { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "PC"},
    nat:             { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "NAT"},
    cloud:           { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "CLD"},
    docker:          { fill: "rgba(99,102,241,0.08)", stroke: "rgba(99,102,241,0.45)", text: "#4338CA", abbr: "DK" },
    traceng:         { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "TR"},
  };

  function ncfg(node) {
    const nt = node.node_type || "";
    const tmpl = (node.template_name || "").toLowerCase();
    if (nt === "qemu" && (tmpl.includes("pfsense") || tmpl.includes("firewall") || tmpl.includes("asa"))) {
      return { fill: "rgba(234,88,12,0.08)", stroke: "rgba(234,88,12,0.45)", text: "#C2410C", abbr: "FW" };
    }
    return NODE_COLOR[nt] || { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "N" };
  }

  // Deterministic layout: group by tier, spread horizontally
  const positions = useMemo(() => {
    const groups = {};
    nodes.forEach((n, i) => {
      const tier = NODE_TYPE_TIER[n.node_type] ?? 2;
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push({ ...n, _idx: i });
    });
    const tiers = Object.keys(groups).map(Number).sort();
    const W = 1200, rowH = Math.min(160, 800 / Math.max(tiers.length, 1));
    const pos = {};
    tiers.forEach((tier, ri) => {
      const grp = groups[tier];
      const y = 80 + ri * rowH + rowH / 2;
      grp.forEach((n, ci) => {
        const x = W / 2 - (grp.length - 1) * 100 / 2 + ci * 100;
        pos[n.node_id] = { x, y };
      });
    });
    return pos;
  }, [nodes]);

  function gp(id) { return positions[id] || { x: 600, y: 400 }; }

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.node_id, n])), [nodes]);
  const connectedTo = useMemo(() => {
    if (!selected) return new Set();
    const s = new Set();
    links.forEach(({ from_node, to_node }) => {
      if (from_node === selected) s.add(to_node);
      if (to_node === selected) s.add(from_node);
    });
    return s;
  }, [selected, links]);

  const selNode = selected ? nodeMap[selected] : null;
  const selReq  = selNode ? requirements?.find((r) => r.node_id === selNode.node_id) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: BG, display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        height: 54, background: "white", borderBottom: `1px solid ${BD}`,
        display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 20px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: G,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <NetIcon size={16}/>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
            Topology Schematic
          </span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {nodes.length} nodes · {links.length} links
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isReview && (
            <>
              <button onClick={onEdit} style={{
                border: `1px solid ${BD}`, background: "white",
                borderRadius: 8, padding: "7px 14px",
                fontSize: 13, fontWeight: 500, color: "#374151",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                <Ic d={IC.pencil} size={13}/> Edit
              </button>
              <button onClick={onApprove} style={{
                border: "none", background: G,
                borderRadius: 8, padding: "7px 16px",
                fontSize: 13, fontWeight: 600, color: "white",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                <Ic d={IC.check} size={13}/> Continue
              </button>
            </>
          )}
          <button onClick={onClose} style={{
            border: `1px solid ${BD}`, background: "white",
            borderRadius: 8, padding: "7px 12px",
            cursor: "pointer", color: "#6B7280",
            display: "flex", alignItems: "center", gap: 4, fontSize: 13,
          }}>
            <Ic d={IC.x} size={13}/> Close
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: "auto", background: "#FAFAFA" }}>
          <svg width="100%" viewBox="0 0 1200 600" style={{ display: "block", minHeight: 600 }}>
            <defs>
              <pattern id="vgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#vgrid)"/>

            {links.map((l, i) => {
              const a = gp(l.from_node); const b = gp(l.to_node);
              const hi = selected && (l.from_node === selected || l.to_node === selected);
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={hi ? G : "rgba(0,0,0,0.12)"}
                  strokeWidth={hi ? 2.5 : 1.5}
                  strokeDasharray={l.link_type === "serial" ? "6 3" : undefined}
                />
              );
            })}

            {nodes.map((n) => {
              const { x, y } = gp(n.node_id);
              const cfg  = ncfg(n);
              const isSel = selected === n.node_id;
              const isDim = selected && !isSel && !connectedTo.has(n.node_id);
              const W2 = 70, H2 = 38;

              return (
                <g key={n.node_id}
                  onClick={() => setSelected(isSel ? null : n.node_id)}
                  style={{ cursor: "pointer", opacity: isDim ? 0.25 : 1, transition: "opacity .2s" }}
                >
                  <rect x={x - W2/2} y={y - H2/2} width={W2} height={H2} rx={6}
                    fill={isSel ? `${cfg.fill}` : cfg.fill}
                    stroke={isSel ? G : cfg.stroke}
                    strokeWidth={isSel ? 2 : 1.2}
                  />
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize="14" fontWeight="700" fill={isSel ? G : cfg.text}
                    fontFamily="monospace">
                    {cfg.abbr}
                  </text>
                  <text x={x} y={y + H2/2 + 13} textAnchor="middle"
                    fontSize="11" fill="#6B7280" fontFamily="system-ui">
                    {n.name}
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform="translate(16,16)">
              <rect width="126" height="108" rx="6"
                fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.07)" strokeWidth="0.8"/>
              <text x="10" y="20" fontSize="9" fill="#9CA3AF" fontWeight="700"
                fontFamily="monospace" letterSpacing="0.1em">LEGEND</text>
              {[
                ["R",   "Router",  "#166534"],
                ["SW",  "Switch",  "#1D4ED8"],
                ["PC",  "Host",    "#374151"],
                ["FW",  "Firewall","#C2410C"],
                ["DK",  "Docker",  "#4338CA"],
              ].map(([abbr, lbl, col], i) => (
                <g key={abbr} transform={`translate(10,${30 + i * 16})`}>
                  <rect width="24" height="12" rx="3"
                    fill={`${col}18`} stroke={`${col}60`} strokeWidth="0.8"/>
                  <text x="12" y="8.5" textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fill={col} fontWeight="700" fontFamily="monospace">{abbr}</text>
                  <text x="30" y="8" dominantBaseline="middle"
                    fontSize="9" fill="#6B7280" fontFamily="system-ui">{lbl}</text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Inspection panel */}
        <div style={{
          width: 260, borderLeft: `1px solid ${BD}`,
          background: "white", overflowY: "auto", flexShrink: 0,
          padding: selNode ? 20 : 0,
          display: "flex", flexDirection: "column",
        }}>
          {selNode ? (
            <div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", marginBottom: 18,
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>
                    {selNode.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    {selNode.node_type}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: "#9CA3AF", padding: 4,
                }}>
                  <Ic d={IC.x} size={14}/>
                </button>
              </div>

              {[
                ["Template",   selNode.template_name || "Built-in"],
                ["Node ID",    selNode.node_id],
                ["Links",      String(selNode.link_count ?? 0)],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                    color: "#9CA3AF", textTransform: "uppercase",
                    fontFamily: "monospace", marginBottom: 3,
                  }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#374151", fontFamily: "monospace" }}>
                    {val}
                  </div>
                </div>
              ))}

              {selReq && selReq.image_required && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                    color: "#9CA3AF", textTransform: "uppercase",
                    fontFamily: "monospace", marginBottom: 3,
                  }}>IMAGE FILE</div>
                  {selReq.image_file ? (
                    <div style={{
                      fontSize: 11, color: G, fontFamily: "monospace",
                      background: "#F0FDF4", padding: "4px 8px",
                      borderRadius: 4, border: "1px solid #BBF7D0",
                      wordBreak: "break-all",
                    }}>
                      {selReq.image_file}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 11, color: "#DC2626",
                      background: "#FEF2F2", padding: "4px 8px",
                      borderRadius: 4, border: "1px solid #FECACA",
                    }}>
                      Missing — configure in profile
                    </div>
                  )}
                </div>
              )}

              {/* Connected nodes */}
              {connectedTo.size > 0 && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                    color: "#9CA3AF", textTransform: "uppercase",
                    fontFamily: "monospace", marginBottom: 6,
                  }}>CONNECTED TO</div>
                  {[...connectedTo].map((id) => {
                    const peer = nodeMap[id];
                    return (
                      <div
                        key={id}
                        onClick={() => setSelected(id)}
                        style={{
                          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                          marginBottom: 4, background: MT,
                          fontSize: 12, color: "#374151", fontFamily: "monospace",
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = "#E5E7EB"}
                        onMouseOut={(e)  => e.currentTarget.style.background = MT}
                      >
                        {peer?.name || id}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: 24, textAlign: "center",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: MT, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#9CA3AF", marginBottom: 10,
              }}>
                <NetIcon size={20}/>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>
                Select a node
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 1.5 }}>
                Click any node to inspect its properties and connections
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Input bar
// ═══════════════════════════════════════════════════════════════════
function ChatInputBar({ onSend, disabled, placeholder }) {
  const [value, setValue] = useState("");
  const taRef = useRef(null);

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
  "Branch office with WAN link to HQ and local workstations",
  "Simple lab: 2 routers, 2 switches, and 4 PCs",
  "Data center spine-leaf with management VLAN",
  "Home network with firewall, switch, and wireless segment",
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
        <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 440, lineHeight: 1.6 }}>
          Describe any network topology in plain English. I'll design it, configure every device, and export a ready-to-import GNS3 project.
        </div>
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap",
        gap: 8, justifyContent: "center", maxWidth: 520, marginTop: 4,
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
    startStream, stopStream, reset,
  } = useSSE();

  // ── Page state ────────────────────────────────────────────────
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const [editMode,     setEditMode]     = useState(false);
  const [editText,     setEditText]     = useState("");
  const [history,      setHistory]      = useState([]);
  const [sessionId,    setSessionId]    = useState(null);
  const [chatId,       setChatId]       = useState(null);

  // ── messages: array of { role, text, bubbleData? } ───────────
  // role = "user" | "ai" | "error"
  // ai bubbles use bubbleData snapshot to replay history
  const [messages, setMessages] = useState([]);

  const bottomRef = useRef(null);
  const profile = useRef(null); // loaded from /api/profile on mount

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
    import("../lib/api").then(({ getUserProfile }) =>
      getUserProfile().then((d) => { profile.current = d?.profile || {}; }).catch(() => {})
    );
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thoughts.length, Object.keys(configTexts).length]);

  // ── Send a user prompt ────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    // 1. Push user bubble
    setMessages((prev) => [...prev, { role: "user", text }]);
    // 2. Push empty AI bubble (will fill via SSE)
    setMessages((prev) => [...prev, { role: "ai", id: Date.now() }]);
    setEditMode(false);

    try {
      // Create session if needed
      let sid = sessionId;
      if (!sid) {
        const sess = await createSession(profile.current || {});
        sid = sess.session_id;
        setSessionId(sid);
      }

      // Start generation
      await startGeneration(sid, text, null, profile.current?.security_profile || "none");
      startStream(sid);

      // Save to chat history
      try {
        const chat = await createChat({ text });
        const cid = chat._id || chat.id;
        setChatId(cid);
        setHistory((h) => [chat, ...h.filter((c) => (c._id || c.id) !== cid)]);
        if (sid) await updateChatSessionId(cid, sid);
      } catch { /* non-critical */ }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  }, [sessionId, startStream]);

  // ── Edit topology ─────────────────────────────────────────────
  const handleEdit = useCallback(async () => {
    if (!editText.trim() || !sessionId) return;
    const feedback = editText.trim();
    setEditText("");
    setEditMode(false);
    setMessages((prev) => [...prev, { role: "user", text: feedback }]);
    setMessages((prev) => [...prev, { role: "ai", id: Date.now() }]);
    reset();

    try {
      await editTopology(sessionId, feedback);
      startStream(sessionId);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  }, [editText, sessionId, reset, startStream]);

  // ── Approve topology ──────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!sessionId) return;
    try {
      await approveTopology(sessionId);
      // Status will transition to "exporting" via SSE phase_change
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  }, [sessionId]);

  // ── Load a past chat from history ────────────────────────────
  const handleSelectHistory = useCallback(async (chat) => {
    reset();
    setSessionId(null);
    setChatId(null);
    setMessages([]);
    setEditMode(false);

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
    setEditMode(false);
  }, [stopStream, reset]);

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
                return (
                  <AIBubble
                    key={msg.id || idx}
                    thoughts={isLive ? thoughts : []}
                    topology={isLive ? topology : null}
                    requirements={isLive ? requirements : null}
                    summary={isLive ? summary : null}
                    configTexts={isLive ? configTexts : {}}
                    phase={isLive ? phase : "done"}
                    subPhase={isLive ? subPhase : null}
                    status={isLive ? status : "complete"}
                    exportData={isLive ? exportData : null}
                    isActive={isLive && isActive}
                    onOpenTopology={() => setTopologyOpen(true)}
                    onEdit={() => { setEditMode(true); setEditText(""); }}
                    onApprove={handleApprove}
                    sessionId={sessionId}
                    projectName={projectName}
                  />
                );
              }

              return null;
            })}

            {/* ── Edit input that appears inline after the AI bubble ── */}
            {editMode && (
              <div style={{ marginBottom: 20 }}>
                {/* Looks like a user bubble being typed */}
                <div style={{
                  border: `1.5px solid ${G}`,
                  borderRadius: 12, background: "white",
                  overflow: "hidden",
                }}>
                  <div style={{
                    padding: "9px 14px", borderBottom: `1px solid ${BD}`,
                    fontSize: 11, fontWeight: 600, color: G,
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    background: "#F0FDF4", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Ic d={IC.pencil} size={11}/> Edit request
                  </div>
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                      if (e.key === "Escape") setEditMode(false);
                    }}
                    placeholder="Describe what you'd like to change..."
                    style={{
                      width: "100%", border: "none", outline: "none",
                      padding: "12px 14px", resize: "none",
                      fontSize: 14, fontFamily: "inherit",
                      color: "#111", lineHeight: 1.5, minHeight: 72,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{
                    padding: "8px 12px", borderTop: `1px solid ${BD}`,
                    display: "flex", gap: 8, justifyContent: "flex-end",
                  }}>
                    <button onClick={() => setEditMode(false)} style={{
                      border: `1px solid ${BD}`, background: "white",
                      borderRadius: 7, padding: "6px 14px",
                      fontSize: 12, color: "#6B7280", cursor: "pointer",
                    }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={!editText.trim()}
                      style={{
                        border: "none",
                        background: editText.trim() ? G : BD,
                        borderRadius: 7, padding: "6px 14px",
                        fontSize: 12, fontWeight: 600, color: "white",
                        cursor: editText.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}

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
            placeholder={
              isStreaming
                ? "Generating topology..."
                : isReview
                ? "Ask for changes or click Approve to export..."
                : "Describe a network topology..."
            }
          />
          <div style={{
            marginTop: 8, fontSize: 11, color: "#9CA3AF",
            textAlign: "center",
          }}>
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      {/* ── TopologyViewer overlay ── */}
      {topologyOpen && topology && (
        <TopologyViewer
          topology={topology}
          requirements={requirements}
          onClose={() => setTopologyOpen(false)}
          onEdit={() => {
            setTopologyOpen(false);
            setEditMode(true);
            setEditText("");
          }}
          onApprove={() => {
            setTopologyOpen(false);
            handleApprove();
          }}
          isReview={isReview}
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
      />
    </div>
  );
}
