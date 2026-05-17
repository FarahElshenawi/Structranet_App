import { useState, useEffect, useRef, useMemo } from "react";
import { Icon, NetworkIcon, PATHS } from "../components/Icons";
import Sidebar from "../components/Sidebar";
import TopologyViewer from "../components/TopologyViewer";
import ProfileDrawer from "../components/ProfileDrawer";
import NetworkLoader from "../components/NetworkLoader";
import ChatInput from "../components/ChatInput";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import {
  createSession, startGeneration, editAndRegenerate, approveTopology,
  downloadGns3, downloadConfigsZip, downloadRequirements,
  getChats, createChat, deleteChat, updateChatSessionId,
} from "../lib/api";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

// ── Suggestion data for keyword pills ─────────────────────────────────────────
const PILL_CATEGORIES = [
  {
    key: "design",
    label: "Design",
    icon: "sparkles",
    suggestions: [
      "Campus network with 3 VLANs and a core router",
      "Branch office topology with WAN redundancy",
      "Data center spine-leaf architecture",
    ],
  },
  {
    key: "configure",
    label: "Configure",
    icon: "settings",
    suggestions: [
      "OSPF routing with area segmentation",
      "VLANs with inter-VLAN routing on a core router",
      "ACLs and NAT on a perimeter firewall",
    ],
  },
  {
    key: "secure",
    label: "Secure",
    icon: "shield",
    suggestions: [
      "Firewall with DMZ and NAT rules",
      "VPN site-to-site between two branch routers",
      "Port security and DHCP snooping on access switches",
    ],
  },
];

// ── Mini SVG Topology Preview ─────────────────────────────────────────────────
function computeMiniLayout(nodes) {
  const RING_RADII = { router: 55, firewall: 85, switch: 110, host: 140 };
  const CX = 200, CY = 110;
  const groups = {};
  for (const n of nodes) {
    const t = n.node_type || "host";
    if (!groups[t]) groups[t] = [];
    groups[t].push(n);
  }
  const positions = {};
  const typeOrder = ["router", "firewall", "switch", "host"];
  for (const type of typeOrder) {
    const group = groups[type] || [];
    const radius = RING_RADII[type] || 140;
    const count = group.length;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
      const nodeId = group[i].node_id;
      positions[nodeId] = {
        x: Math.round(CX + radius * Math.cos(angle)),
        y: Math.round(CY + radius * Math.sin(angle)),
      };
    }
  }
  return positions;
}

function MiniTopologyPreview({ topology }) {
  const nodes = topology?.nodes || [];
  const links = topology?.links || [];
  const positions = useMemo(() => computeMiniLayout(nodes), [nodes]);

  const nodeAbbr = (type) => ({ router: "R", switch: "SW", host: "PC", firewall: "FW", docker: "DK" }[type] || "N");

  const nodeColors = {
    router:  { fill: "rgba(22,101,52,0.10)", stroke: "rgba(22,101,52,0.50)", text: "#166534" },
    switch:  { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.40)", text: "#1D4ED8" },
    host:    { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.30)", text: "#374151" },
    firewall:{ fill: "rgba(234,88,12,0.08)", stroke: "rgba(234,88,12,0.40)", text: "#C2410C" },
    docker:  { fill: "rgba(99,102,241,0.08)", stroke: "rgba(99,102,241,0.40)", text: "#4338CA" },
  };

  return (
    <svg width="100%" height={240} viewBox="0 0 400 220" style={{ display: "block", background: "#FAFAFA", borderRadius: 8 }}>
      {/* Links */}
      {links.map((l, i) => {
        const a = positions[l.from_node] || { x: 0, y: 0 };
        const b = positions[l.to_node] || { x: 0, y: 0 };
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(22,101,52,0.22)" strokeWidth={1.5} />
        );
      })}
      {/* Nodes */}
      {nodes.map((n) => {
        const pos = positions[n.node_id] || { x: 0, y: 0 };
        const t = n.node_type || "host";
        const colors = nodeColors[t] || nodeColors.host;
        const w = t === "switch" ? 44 : t === "host" ? 36 : t === "firewall" ? 44 : 48;
        const h = t === "host" ? 22 : 28;
        return (
          <g key={n.node_id}>
            <rect
              x={pos.x - w / 2}
              y={pos.y - h / 2}
              width={w}
              height={h}
              rx={4}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1}
            />
            <text
              x={pos.x}
              y={pos.y - 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="700"
              fill={colors.text}
              fontFamily="monospace"
            >
              {nodeAbbr(t)}
            </text>
            <text
              x={pos.x}
              y={pos.y + h / 2 + 11}
              textAnchor="middle"
              fontSize="9"
              fontWeight="500"
              fill="#6B7280"
              fontFamily="'Geist', system-ui, sans-serif"
            >
              {n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Blinking cursor component ─────────────────────────────────────────────────
function BlinkingCursor() {
  return (
    <span style={{
      display: "inline-block",
      width: 7,
      height: 14,
      background: PRIMARY,
      marginLeft: 2,
      verticalAlign: "text-bottom",
      animation: "blink 1s step-end infinite",
    }}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </span>
  );
}

// ── Main ChatPage Component ───────────────────────────────────────────────────
export default function ChatPage() {
  const { user, logout } = useAuth();
  const {
    thoughts, topology, requirements, summary, phase, configTexts,
    status, startStream, stopStream, reset,
  } = useSSE();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]); // { role, text }
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [profile, setProfile] = useState(null);
  const [expandedPill, setExpandedPill] = useState(null);

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isStreaming = status === "streaming";
  const isComplete = status === "complete";
  const isReview = phase?.phase === "review" && isComplete;
  const isExporting = phase?.phase === "exporting" && isStreaming;
  const isSuccess = phase?.phase === "success" && isComplete;
  const isError = phase?.phase === "error";
  const isConfigStreaming = (phase?.phase === "exporting" || phase?.sub_phase === "generating_configs") && isStreaming;
  const hasTopology = topology != null;

  // Determine which phase we are in for display
  const isPhase1Streaming = isStreaming && (phase?.phase === "generating" || phase?.phase === "review") && !isConfigStreaming;
  const isPhase2Streaming = isStreaming && isConfigStreaming;

  // ── Load chat history on mount ────────────────────────────────────────────
  useEffect(() => {
    getChats().then(setHistory).catch(() => {});
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts, configTexts]);

  // ── Handle new chat ───────────────────────────────────────────────────────
  const handleNewChat = () => {
    reset();
    setSessionId(null);
    setChatId(null);
    setMessages([]);
    setEditMode(false);
    setExpandedPill(null);
  };

  // ── Handle sending a message ──────────────────────────────────────────────
  const handleSend = async (text) => {
    setMessages((prev) => [...prev, { role: "user", text }]);
    setExpandedPill(null);

    try {
      let sid = sessionId;
      if (!sid) {
        const sessionBody = {};
        if (profile) {
          sessionBody.profile = {
            gns3_version: profile.version || "2.2",
            supports_iou: profile.features?.iou || false,
            supports_qemu: profile.features?.qemu || true,
            supports_docker: profile.features?.docker || false,
          };
        }
        const session = await createSession(sessionBody.profile || {});
        sid = session.session_id;
        setSessionId(sid);
      }

      await startGeneration(sid, text);
      startStream(sid);

      // Save to chat history (non-critical)
      try {
        const chat = await createChat({ text, title: text.slice(0, 60) });
        setChatId(chat._id || chat.id);
        setHistory((prev) => [chat, ...prev]);
        // Link session to chat
        if (sid && (chat._id || chat.id)) {
          await updateChatSessionId(chat._id || chat.id, sid);
        }
      } catch {
        // Non-critical
      }

      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  };

  // ── Handle pill suggestion click ──────────────────────────────────────────
  const handleSuggestionClick = (text) => {
    // Auto-fill the chat input and send
    handleSend(text);
  };

  // ── Handle edit ───────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editText.trim() || !sessionId) return;
    setMessages((prev) => [...prev, { role: "user", text: editText }]);
    setEditMode(false);

    try {
      await editAndRegenerate(sessionId, editText);
      reset();
      startStream(sessionId);
      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  };

  // ── Handle approve ────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!sessionId) return;
    try {
      await approveTopology(sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "Topology approved. Generating device configurations..." },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  };

  // ── Handle downloads ──────────────────────────────────────────────────────
  const projectName = topology?.name || sessionId || "network";

  const handleDownloadGns3 = async () => {
    if (!sessionId) return;
    try {
      await downloadGns3(sessionId, projectName);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]);
    }
  };

  const handleDownloadConfigs = async () => {
    if (!sessionId) return;
    try {
      await downloadConfigsZip(sessionId, projectName);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]);
    }
  };

  const handleDownloadRequirements = async () => {
    if (!sessionId) return;
    try {
      await downloadRequirements(sessionId, projectName);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]);
    }
  };

  // ── Select a past chat ────────────────────────────────────────────────────
  const handleSelectHistory = () => {
    // Future: load chat messages from backend
  };

  const handleDeleteChat = async (id) => {
    try {
      await deleteChat(id);
      setHistory((prev) => prev.filter((c) => (c._id || c.id) !== id));
    } catch {}
  };

  // ── Map thought type to label ─────────────────────────────────────────────
  const thoughtLabel = (type) => {
    switch (type) {
      case "understanding": return "Understanding your request";
      case "decision": return "Device selection";
      case "assumption": return "Assumptions";
      case "info": return "Building topology";
      default: return "Processing";
    }
  };

  // ── Build config text display ─────────────────────────────────────────────
  const fullConfigText = useMemo(() => {
    const deviceNames = Object.keys(configTexts);
    if (deviceNames.length === 0) return "";
    return deviceNames
      .map((name) => `! ${name} Configuration\n${configTexts[name]}`)
      .join("\n\n");
  }, [configTexts]);

  // ── Build topology JSON snippet ───────────────────────────────────────────
  const topologySnippet = useMemo(() => {
    if (!topology) return "";
    return JSON.stringify(
      {
        name: topology.name,
        nodes: topology.nodes?.map((n) => ({
          node_id: n.node_id,
          name: n.name,
          node_type: n.node_type,
        })),
        links: topology.links?.map((l) => ({
          from_node: l.from_node,
          to_node: l.to_node,
          link_type: l.link_type,
        })),
      },
      null,
      2
    );
  }, [topology]);

  // ── Determine if we should show the empty state ──────────────────────────
  const isEmpty = messages.length === 0 && !isStreaming && status === "idle";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: BG, fontFamily: "'Geist', system-ui, sans-serif" }}>
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div style={{
        height: 52,
        background: "white",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 6, display: "flex", borderRadius: 6 }}
          >
            <Icon d={PATHS.menu} size={18} />
          </button>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: PRIMARY,
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}>
            <NetworkIcon size={14} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>Structranet AI</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* View Topology — show when topology exists AND topology viewer is NOT open */}
          {hasTopology && !topologyOpen && (
            <button
              onClick={() => setTopologyOpen(true)}
              style={{
                border: `1px solid ${PRIMARY}`,
                background: "rgba(22,101,52,0.05)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: PRIMARY,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon d={PATHS.maximize} size={13} /> View Topology
            </button>
          )}
          <button
            onClick={() => setProfileOpen(true)}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 6, display: "flex", borderRadius: 6 }}
          >
            <Icon d={PATHS.settings} size={16} />
          </button>
          <button
            onClick={logout}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", padding: 6, display: "flex", borderRadius: 6 }}
            title="Sign out"
          >
            <Icon d={PATHS.logout} size={16} />
          </button>
        </div>
      </div>

      {/* ── Main Area ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Messages / Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 16px" }}>

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 1: Empty Chat
              ═══════════════════════════════════════════════════════════════════ */}
          {isEmpty && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: "100%", gap: 16, textAlign: "center",
            }}>
              {/* NetworkIcon 56px rounded-16 */}
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "rgba(22,101,52,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: PRIMARY,
              }}>
                <NetworkIcon size={28} />
              </div>

              {/* Heading */}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>
                What would you like to build?
              </div>

              {/* Subtitle */}
              <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 480, lineHeight: 1.6 }}>
                Describe a network topology in natural language and I will generate a fully configured GNS3 project for you.
              </div>

              {/* Keyword Pills */}
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {PILL_CATEGORIES.map((cat) => (
                  <div key={cat.key}>
                    <button
                      onClick={() => setExpandedPill(expandedPill === cat.key ? null : cat.key)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = PRIMARY;
                        e.currentTarget.style.color = PRIMARY;
                        e.currentTarget.style.background = "rgba(22,101,52,0.04)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = BORDER;
                        e.currentTarget.style.color = "#374151";
                        e.currentTarget.style.background = "white";
                      }}
                      style={{
                        border: `1px solid ${BORDER}`,
                        background: "white",
                        borderRadius: 20,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all .15s",
                      }}
                    >
                      <Icon d={PATHS[cat.icon]} size={14} />
                      {cat.label}
                    </button>
                  </div>
                ))}
              </div>

              {/* Expandable suggestion panels */}
              {PILL_CATEGORIES.map((cat) => (
                <div
                  key={`exp-${cat.key}`}
                  style={{
                    maxHeight: expandedPill === cat.key ? 300 : 0,
                    opacity: expandedPill === cat.key ? 1 : 0,
                    overflow: "hidden",
                    transition: "max-height .3s ease, opacity .3s ease",
                    width: "100%",
                    maxWidth: 480,
                  }}
                >
                  <div style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    background: "white",
                    marginTop: 4,
                    padding: "12px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                      <Icon d={PATHS[cat.icon]} size={14} style={{ color: PRIMARY }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{cat.label}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {cat.suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleSuggestionClick(suggestion)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = "rgba(22,101,52,0.06)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            textAlign: "left",
                            padding: "8px 10px",
                            borderRadius: 6,
                            fontSize: 13,
                            color: "#374151",
                            cursor: "pointer",
                            transition: "background .15s",
                            lineHeight: 1.4,
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              NON-EMPTY STATES: Messages + dynamic content
              ═══════════════════════════════════════════════════════════════════ */}
          {!isEmpty && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>

              {/* User messages + assistant sections */}
              {messages.map((msg, i) => {
                // Only render user messages inline; assistant/system/error handled separately
                if (msg.role === "user") {
                  return (
                    <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
                      <div style={{
                        background: PRIMARY,
                        color: "white",
                        borderRadius: "12px 12px 4px 12px",
                        padding: "10px 14px",
                        fontSize: 14,
                        maxWidth: "80%",
                        lineHeight: 1.5,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                if (msg.role === "error") {
                  return (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{
                        background: "#FEF2F2",
                        border: "1px solid #FECACA",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#DC2626",
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              {/* ─── Assistant section with NetworkLoader ─────────────────────── */}
              {/* Show whenever there's an assistant message placeholder or streaming content */}
              {(messages.some((m) => m.role === "assistant") || isStreaming) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <NetworkLoader size={28} />
                  </div>

                  {/* ─── STATE 2: Streaming thoughts (Claude-style) ─────────── */}
                  {thoughts.length > 0 && (
                    <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
                      {thoughts.map((thought, i) => (
                        <div key={thought.id || i} style={{ marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, color: "#111" }}>
                            {thoughtLabel(thought.type)}
                          </span>
                          {" — "}
                          <span>{thought.content}</span>
                        </div>
                      ))}
                      {isStreaming && <BlinkingCursor />}
                    </div>
                  )}

                  {/* ─── Stream card: Topology JSON snippet ──────────────────── */}
                  {isStreaming && !isConfigStreaming && (
                    <div style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: 10,
                      background: "white",
                      marginTop: 12,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        padding: "10px 14px",
                        borderBottom: `1px solid ${BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <Icon d={PATHS.sparkles} size={14} style={{ color: PRIMARY }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                          {hasTopology ? "Topology JSON" : "Generating Topology"}
                        </span>
                        {hasTopology && (
                          <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 4 }}>
                            {topology.nodes?.length || 0} nodes / {topology.links?.length || 0} links
                          </span>
                        )}
                      </div>
                      <div style={{
                        background: "#1E1E1E",
                        padding: 14,
                        fontFamily: "'Courier New', monospace",
                        fontSize: 12,
                        color: "#9CDCFE",
                        maxHeight: 280,
                        overflowY: "auto",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}>
                        {hasTopology ? topologySnippet : ": Generating topology data..."}
                        <BlinkingCursor />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── STATE 3: Review Phase ──────────────────────────────────── */}
              {isReview && hasTopology && (
                <div style={{ marginBottom: 16 }}>
                  {/* Topology card */}
                  <div style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    background: "white",
                    overflow: "hidden",
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: "12px 16px",
                      borderBottom: `1px solid ${BORDER}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#F0FDF4",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon d={PATHS.maximize} size={16} style={{ color: PRIMARY }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>Topology Ready</span>
                        <span style={{ fontSize: 13, color: "#6B7280" }}>
                          {topology.nodes?.length || 0} nodes / {topology.links?.length || 0} links
                        </span>
                      </div>
                      <button
                        onClick={() => setTopologyOpen(true)}
                        style={{
                          border: `1px solid ${PRIMARY}`,
                          background: "rgba(22,101,52,0.05)",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: PRIMARY,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon d={PATHS.maximize} size={12} /> Expand
                      </button>
                    </div>

                    {/* Mini SVG preview */}
                    <div style={{ padding: 16, display: "flex", justifyContent: "center" }}>
                      <MiniTopologyPreview topology={topology} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button
                      onClick={() => { setEditMode(true); setEditText(""); }}
                      style={{
                        border: `1px solid ${BORDER}`,
                        background: "white",
                        borderRadius: 8,
                        padding: "10px 18px",
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#374151",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all .15s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = PRIMARY;
                        e.currentTarget.style.color = PRIMARY;
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = BORDER;
                        e.currentTarget.style.color = "#374151";
                      }}
                    >
                      <Icon d={PATHS.pencil} size={15} /> Edit Topology
                    </button>
                    <button
                      onClick={handleApprove}
                      style={{
                        border: "none",
                        background: PRIMARY,
                        borderRadius: 8,
                        padding: "10px 18px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all .15s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "#14532D";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = PRIMARY;
                      }}
                    >
                      <Icon d={PATHS.check} size={15} /> Continue
                    </button>
                  </div>

                  {/* Requirements panel */}
                  {requirements && requirements.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <RequirementsPanelInline requirements={requirements} />
                    </div>
                  )}

                  {/* Summary panel */}
                  {summary && (
                    <div style={{ marginTop: 16 }}>
                      <SummaryPanelInline summary={summary} />
                    </div>
                  )}
                </div>
              )}

              {/* ─── STATE 4: Config Streaming (Phase 2 after approve) ──────── */}
              {isPhase2Streaming && (
                <div style={{ marginBottom: 16 }}>
                  {/* System message: Topology approved */}
                  <div style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: PRIMARY,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}>
                    <Icon d={PATHS.check} size={14} style={{ color: PRIMARY }} />
                    Topology approved. Generating device configurations...
                  </div>

                  {/* Config stream card */}
                  <div style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    background: "white",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${BORDER}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Icon d={PATHS.settings} size={14} style={{ color: PRIMARY }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Generating Device Configs</span>
                    </div>
                    <div style={{
                      background: "#1E1E1E",
                      padding: 14,
                      fontFamily: "'Courier New', monospace",
                      fontSize: 12,
                      color: "#9CDCFE",
                      maxHeight: 380,
                      overflowY: "auto",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}>
                      {fullConfigText || ": Waiting for device configurations..."}
                      {isStreaming && <BlinkingCursor />}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── STATE 5: Downloads (complete) ──────────────────────────── */}
              {isSuccess && (
                <div style={{ marginBottom: 16 }}>
                  {/* System message: Generating configs approved */}
                  <div style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: PRIMARY,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}>
                    <Icon d={PATHS.check} size={14} style={{ color: PRIMARY }} />
                    Topology approved. Generating device configurations...
                  </div>

                  {/* System message: Ready for download */}
                  <div style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: PRIMARY,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 12,
                  }}>
                    <Icon d={PATHS.check} size={14} style={{ color: PRIMARY }} />
                    GNS3 project generated successfully. Ready for download.
                  </div>

                  {/* Download cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* GNS3 Project */}
                    <DownloadCard
                      icon="box"
                      title={`${projectName}.gns3project`}
                      subtitle="GNS3 Project File"
                      onDownload={handleDownloadGns3}
                    />
                    {/* Configs ZIP */}
                    <DownloadCard
                      icon="box"
                      title={`${projectName}_configs.zip`}
                      subtitle="Device Startup Configurations"
                      onDownload={handleDownloadConfigs}
                    />
                    {/* Requirements JSON */}
                    <DownloadCard
                      icon="file"
                      title={`${projectName}_requirements.json`}
                      subtitle="Appliance Requirements"
                      onDownload={handleDownloadRequirements}
                    />
                  </div>
                </div>
              )}

              {/* ─── Error state with retry ──────────────────────────────────── */}
              {isError && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 10,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon d={PATHS.alert} size={16} style={{ color: "#DC2626" }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#DC2626" }}>Generation Failed</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#991B1B" }}>
                      An error occurred while generating the topology. You can try again with a new prompt.
                    </div>
                    <button
                      onClick={handleNewChat}
                      style={{
                        border: "1px solid #FECACA",
                        background: "white",
                        borderRadius: 8,
                        padding: "7px 14px",
                        fontSize: 13,
                        color: "#DC2626",
                        fontWeight: 500,
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      }}
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}

              {/* ─── Edit mode input ─────────────────────────────────────────── */}
              {editMode && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    border: `1px solid ${PRIMARY}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      background: "rgba(22,101,52,0.05)",
                      padding: "8px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      borderBottom: "1px solid rgba(22,101,52,0.15)",
                    }}>
                      <Icon d={PATHS.pencil} size={13} style={{ color: PRIMARY }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY }}>Edit Topology</span>
                    </div>
                    <div style={{ padding: 12 }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Describe what you want to change... (e.g., 'Add a second firewall for redundancy' or 'Change VLAN 30 to VLAN 40')"
                        style={{
                          width: "100%",
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          padding: "10px 12px",
                          fontSize: 14,
                          outline: "none",
                          resize: "none",
                          fontFamily: "inherit",
                          color: "#111",
                          minHeight: 80,
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => setEditMode(false)}
                          style={{
                            border: `1px solid ${BORDER}`,
                            background: "white",
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 13,
                            color: "#6B7280",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleEdit}
                          disabled={!editText.trim()}
                          style={{
                            border: "none",
                            background: editText.trim() ? PRIMARY : "#E5E7EB",
                            color: editText.trim() ? "white" : "#9CA3AF",
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: editText.trim() ? "pointer" : "not-allowed",
                          }}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Area ────────────────────────────────────────────────────── */}
        <div style={{
          padding: "16px 24px 20px",
          background: "white",
          borderTop: `1px solid ${BORDER}`,
        }}>
          <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      </div>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        history={history}
        onSelectHistory={handleSelectHistory}
        onDeleteChat={handleDeleteChat}
      />

      {/* ── Topology Viewer (fullscreen overlay) ───────────────────────────── */}
      {topologyOpen && topology && (
        <TopologyViewer
          topology={topology}
          onClose={() => setTopologyOpen(false)}
          onEdit={() => { setTopologyOpen(false); setEditMode(true); setEditText(""); }}
          onApprove={handleApprove}
          isReview={isReview}
        />
      )}

      {/* ── Profile Drawer ─────────────────────────────────────────────────── */}
      {profileOpen && (
        <ProfileDrawer
          onClose={() => setProfileOpen(false)}
          profile={profile}
          onSave={setProfile}
        />
      )}

      {/* ── Global keyframe styles ─────────────────────────────────────────── */}
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inline Requirements Panel (same data, rendered inline in chat flow)
// ═══════════════════════════════════════════════════════════════════════════════
function RequirementsPanelInline({ requirements = [] }) {
  if (requirements.length === 0) return null;

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>
      <div style={{
        background: "white",
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <Icon d={PATHS.shield} size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Requirements Manifest</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: MUTED }}>
            {["CATEGORY", "APPLIANCE", "IMAGE", "STATUS"].map((h) => (
              <th key={h} style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requirements.map((req, i) => {
            const statusOk = req.status === "ok";
            const statusBuiltin = req.status === "builtin";
            return (
              <tr key={req.node_id || i} style={{ borderBottom: i < requirements.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                <td style={{ padding: "10px 14px", color: "#374151", fontFamily: "monospace", fontSize: 11 }}>{req.category}</td>
                <td style={{ padding: "10px 14px", color: "#111", fontWeight: 500 }}>{req.name}</td>
                <td style={{ padding: "10px 14px", color: "#6B7280", fontFamily: "monospace", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {req.image_file || (statusBuiltin ? "Built-in" : "Required")}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  {statusOk || statusBuiltin ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: PRIMARY, fontWeight: 500 }}>
                      <Icon d={PATHS.check} size={12} /> {statusBuiltin ? "Built-in" : "Installed"}
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#DC2626", fontWeight: 500 }}>
                      <Icon d={PATHS.alert} size={12} /> Missing
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inline Summary Panel (same data, rendered inline in chat flow)
// ═══════════════════════════════════════════════════════════════════════════════
function SummaryPanelInline({ summary }) {
  if (!summary) return null;

  const hasReview = summary.design_review && summary.design_review.length > 0;
  const hasAssumptions = summary.assumptions && summary.assumptions.length > 0;

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>
      <div style={{
        background: "white",
        padding: "12px 16px",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <Icon d={PATHS.sparkles} size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>AI Design Review</span>
      </div>
      {hasReview && (
        <div style={{ background: "white", padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", marginBottom: 8 }}>DESIGN REVIEW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.design_review.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "8px 10px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0",
              }}>
                <Icon d={PATHS.check} size={12} style={{ color: PRIMARY, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasAssumptions && (
        <div style={{ background: "white", padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", marginBottom: 8 }}>ASSUMPTIONS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.assumptions.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "8px 10px", background: "#FFFBEB", borderRadius: 6, border: "1px solid #FDE68A",
              }}>
                <Icon d={PATHS.alert} size={12} style={{ color: "#D97706", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Download Card Component
// ═══════════════════════════════════════════════════════════════════════════════
function DownloadCard({ icon, title, subtitle, onDownload }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onDownload();
    } finally {
      setLoading(false);
    }
  };

  const iconPath = icon === "box" ? PATHS.box : PATHS.file;

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      background: "white",
      padding: "12px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: MUTED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
          flexShrink: 0,
        }}>
          <Icon d={iconPath} size={18} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111", fontFamily: "monospace" }}>{title}</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{subtitle}</div>
        </div>
      </div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          border: `1px solid ${PRIMARY}`,
          background: "white",
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          color: PRIMARY,
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Icon d={PATHS.download} size={13} />
        {loading ? "Downloading..." : "Download"}
      </button>
    </div>
  );
}
