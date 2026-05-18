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
  checkBackendConnection,
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

// ── Requirements Panel — shows devices with image filenames ───────────────────
// Image filenames come from: profile first, then appliance.py defaults
function RequirementsPanelInline({ requirements }) {
  if (!requirements || requirements.length === 0) return null;

  // Group by template_name for a compact display
  const grouped = {};
  for (const req of requirements) {
    const key = req.template_name || req.node_type || "unknown";
    if (!grouped[key]) {
      grouped[key] = {
        template_name: req.template_name,
        node_type: req.node_type,
        category: req.category,
        image_required: req.image_required,
        image_file: req.image_file,
        status: req.status,
        count: 0,
        names: [],
      };
    }
    grouped[key].count++;
    grouped[key].names.push(req.name);
  }

  const entries = Object.values(grouped);

  return (
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
        background: "#FAFAFA",
      }}>
        <Icon d={PATHS.box} size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Appliance Requirements</span>
        <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 4 }}>
          {requirements.length} device{requirements.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ padding: "8px 0" }}>
        {entries.map((entry, i) => (
          <div
            key={i}
            style={{
              padding: "8px 14px",
              borderBottom: i < entries.length - 1 ? `1px solid ${BORDER}` : "none",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            {/* Status dot */}
            <div style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
              background: entry.status === "ok" ? "#22C55E" : entry.status === "missing" ? "#EF4444" : "#9CA3AF",
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Template name + count */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111", fontFamily: "monospace" }}>
                  {entry.template_name}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: "#6B7280",
                  background: MUTED, borderRadius: 4, padding: "1px 6px",
                }}>
                  x{entry.count}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 500, color: "#9CA3AF",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {entry.category}
                </span>
              </div>

              {/* Device names */}
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {entry.names.join(", ")}
              </div>

              {/* Image filename — from profile or appliance.py defaults */}
              {entry.image_required && (
                <div style={{ marginTop: 4 }}>
                  {entry.image_file ? (
                    <div style={{
                      fontSize: 11,
                      color: "#166534",
                      fontFamily: "monospace",
                      background: "rgba(22,101,52,0.06)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid rgba(22,101,52,0.12)",
                      wordBreak: "break-all",
                      lineHeight: 1.4,
                    }}>
                      {entry.image_file}
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 11,
                      color: "#DC2626",
                      fontFamily: "monospace",
                      background: "#FEF2F2",
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid #FECACA",
                    }}>
                      Image not configured — set in profile or appliance defaults
                    </div>
                  )}
                </div>
              )}

              {!entry.image_required && (
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  Built-in — no image required
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary Panel ─────────────────────────────────────────────────────────────
function SummaryPanelInline({ summary }) {
  if (!summary) return null;

  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      background: "white",
      overflow: "hidden",
    }}>
      {/* Design review */}
      {summary.design_review && summary.design_review.length > 0 && (
        <div>
          <div style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FAFAFA",
          }}>
            <Icon d={PATHS.check} size={14} style={{ color: PRIMARY }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Design Review</span>
          </div>
          <div style={{ padding: "10px 14px" }}>
            {summary.design_review.map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 4 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {summary.assumptions && summary.assumptions.length > 0 && (
        <div>
          <div style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#FAFAFA",
          }}>
            <Icon d={PATHS.info} size={14} style={{ color: "#D97706" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Assumptions</span>
          </div>
          <div style={{ padding: "10px 14px" }}>
            {summary.assumptions.map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: 4 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Download Card ─────────────────────────────────────────────────────────────
function DownloadCard({ icon, title, subtitle, onDownload }) {
  return (
    <button
      onClick={onDownload}
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        background: "white",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        transition: "all .15s",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = PRIMARY;
        e.currentTarget.style.background = "rgba(22,101,52,0.02)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = BORDER;
        e.currentTarget.style.background = "white";
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: "rgba(22,101,52,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon d={icon === "box" ? PATHS.box : PATHS.file} size={18} style={{ color: PRIMARY }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>{subtitle}</div>
      </div>
      <Icon d={PATHS.download} size={16} style={{ color: "#9CA3AF", flexShrink: 0 }} />
    </button>
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
  const [backendStatus, setBackendStatus] = useState({ checked: false, express: false, fastapi: false });

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // ── Derived state ─────────────────────────────────────────────────────────
  const isStreaming = status === "streaming";
  const isComplete = status === "complete";
  const isReview = phase?.phase === "review";
  const isExporting = phase?.phase === "exporting" && isStreaming;
  const isSuccess = phase?.phase === "success" && isComplete;
  const isError = phase?.phase === "error";
  const isConfigStreaming = (phase?.phase === "exporting" || phase?.sub_phase === "streaming_configs" || phase?.sub_phase === "generating_configs") && isStreaming;
  const hasTopology = topology != null;

  // Determine which phase we are in for display
  const isPhase1Streaming = isStreaming && (phase?.phase === "generating" || phase?.phase === "review") && !isConfigStreaming;
  const isPhase2Streaming = isStreaming && isConfigStreaming;

  // ── Check backend connectivity on mount ──────────────────────────────────
  useEffect(() => {
    checkBackendConnection().then((s) => {
      setBackendStatus({ checked: true, ...s });
    });
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
            // Pass user's custom image filenames to override appliance catalog defaults
            template_image_map: profile.images || undefined,
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
    try { await downloadGns3(sessionId, projectName); }
    catch (err) { setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]); }
  };

  const handleDownloadConfigs = async () => {
    if (!sessionId) return;
    try { await downloadConfigsZip(sessionId, projectName); }
    catch (err) { setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]); }
  };

  const handleDownloadRequirements = async () => {
    if (!sessionId) return;
    try { await downloadRequirements(sessionId, projectName); }
    catch (err) { setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]); }
  };

  // ── Select a past chat ────────────────────────────────────────────────────
  const handleSelectHistory = () => {};
  const handleDeleteChat = async (id) => {
    try { await deleteChat(id); setHistory((prev) => prev.filter((c) => (c._id || c.id) !== id)); } catch {}
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

      {/* ── Connection Status Banner ──────────────────────────────────────── */}
      {backendStatus.checked && !backendStatus.express && (
        <div style={{
          background: "#FEF2F2",
          borderBottom: "1px solid #FECACA",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 13,
          color: "#DC2626",
          flexShrink: 0,
        }}>
          <Icon d={PATHS.alert} size={14} style={{ color: "#DC2626" }} />
          <span style={{ fontWeight: 500 }}>Backend server is not running.</span>
          <span style={{ color: "#991B1B" }}>Start the Express server on port 3000 and the AI engine on port 8000.</span>
        </div>
      )}
      {backendStatus.checked && backendStatus.express && !backendStatus.fastapi && (
        <div style={{
          background: "#FFFBEB",
          borderBottom: "1px solid #FDE68A",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 13,
          color: "#D97706",
          flexShrink: 0,
        }}>
          <Icon d={PATHS.alert} size={14} style={{ color: "#D97706" }} />
          <span style={{ fontWeight: 500 }}>AI engine is not reachable.</span>
          <span style={{ color: "#92400E" }}>Start the FastAPI server on port 8000 to generate topologies.</span>
        </div>
      )}

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
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "rgba(22,101,52,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: PRIMARY,
              }}>
                <NetworkIcon size={28} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>
                What would you like to build?
              </div>
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
                          onMouseOver={(e) => { e.currentTarget.style.background = "rgba(22,101,52,0.06)"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
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
              {(messages.some((m) => m.role === "assistant") || isStreaming) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <NetworkLoader size={28} />
                  </div>

                  {/* ─── STATE 2: Streaming thoughts ─────────── */}
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
                  {isStreaming && phase?.phase === "generating" && (
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

                    <div style={{ padding: 16, display: "flex", justifyContent: "center", gap: 24 }}>
                      {[
                        { label: "Nodes", value: topology.nodes?.length || 0 },
                        { label: "Links", value: topology.links?.length || 0 },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 700, color: PRIMARY }}>{value}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
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
                      onMouseOver={(e) => { e.currentTarget.style.borderColor = PRIMARY; e.currentTarget.style.color = PRIMARY; }}
                      onMouseOut={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = "#374151"; }}
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
                      onMouseOver={(e) => { e.currentTarget.style.background = "#14532D"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = PRIMARY; }}
                    >
                      <Icon d={PATHS.check} size={15} /> Continue
                    </button>
                  </div>

                  {/* Requirements panel — shows image filenames from profile/appliance defaults */}
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

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <DownloadCard
                      icon="box"
                      title={`${projectName}.gns3project`}
                      subtitle="GNS3 Project File"
                      onDownload={handleDownloadGns3}
                    />
                    <DownloadCard
                      icon="box"
                      title={`${projectName}_configs.zip`}
                      subtitle="Device Startup Configurations"
                      onDownload={handleDownloadConfigs}
                    />
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
                    background: "white",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${BORDER}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(22,101,52,0.03)",
                    }}>
                      <Icon d={PATHS.pencil} size={14} style={{ color: PRIMARY }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>Edit Topology</span>
                    </div>
                    <div style={{ padding: 12 }}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        placeholder="Describe how you want to modify the topology..."
                        style={{
                          width: "100%",
                          minHeight: 80,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 14,
                          fontFamily: "'Geist', system-ui, sans-serif",
                          resize: "vertical",
                          outline: "none",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = PRIMARY; }}
                        onBlur={(e) => { e.target.style.borderColor = BORDER; }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
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
                            background: editText.trim() ? PRIMARY : "#D1D5DB",
                            borderRadius: 8,
                            padding: "7px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "white",
                            cursor: editText.trim() ? "pointer" : "not-allowed",
                          }}
                        >
                          Submit Edit
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

        {/* ── Chat Input ──────────────────────────────────────────────────── */}
        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          disabled={isStreaming || editMode}
          placeholder={
            isStreaming
              ? "Generating topology..."
              : "Describe a network topology..."
          }
        />
      </div>

      {/* ── TopologyViewer overlay ─────────────────────────────────────────── */}
      {topologyOpen && hasTopology && (
        <TopologyViewer
          topology={topology}
          requirements={requirements}
          onClose={() => setTopologyOpen(false)}
          onEdit={() => {
            setTopologyOpen(false);
            setEditMode(true);
            setEditText("");
          }}
          onApprove={handleApprove}
          isReview={isReview}
        />
      )}

      {/* ── Profile Drawer ─────────────────────────────────────────────────── */}
      {profileOpen && (
        <ProfileDrawer
          profile={profile}
          onUpdate={(p) => setProfile(p)}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <Sidebar
          history={history}
          onSelect={handleSelectHistory}
          onDelete={handleDeleteChat}
          onNewChat={handleNewChat}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
