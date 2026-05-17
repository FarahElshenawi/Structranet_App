import { useState, useEffect, useRef } from "react";
import { Icon, NetworkIcon, PATHS } from "../components/Icons";
import Sidebar from "../components/Sidebar";
import TopologyViewer from "../components/TopologyViewer";
import ProfileDrawer from "../components/ProfileDrawer";
import ThoughtStream from "../components/ThoughtStream";
import RequirementsPanel from "../components/RequirementsPanel";
import ChatInput from "../components/ChatInput";
import useSSE from "../hooks/useSSE";
import { useAuth } from "../context/AuthContext";
import {
  createSession,
  startGeneration,
  editAndRegenerate,
  approveTopology,
  downloadGns3,
  getChats,
  createChat,
  deleteChat,
} from "../lib/api";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { thoughts, topology, requirements, status, startStream, reset } = useSSE();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [topologyOpen, setTopologyOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // { role, text }
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [profile, setProfile] = useState(null);

  const messagesEndRef = useRef(null);

  // Load chat history — getChats() returns { chats: [...] }
  useEffect(() => {
    getChats()
      .then((data) => {
        // Backend returns { chats: [...] }, each chat has _id, title, createdAt
        const chats = data.chats || data || [];
        setHistory(Array.isArray(chats) ? chats : []);
      })
      .catch(() => {});
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts]);

  // Handle new chat
  const handleNewChat = async () => {
    reset();
    setSessionId(null);
    setMessages([]);
    setEditMode(false);
  };

  // Handle sending a message
  const handleSend = async (text) => {
    // Add user message
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      // Create session if needed
      let sid = sessionId;
      if (!sid) {
        const session = await createSession();
        sid = session.session_id;
        setSessionId(sid);
      }

      // Start generation + SSE streaming
      await startGeneration(sid, text);
      startStream(sid);

      // Save to chat history — backend expects { text }, NOT { title }
      try {
        const chat = await createChat({ text });
        setHistory((prev) => [{ _id: chat._id, title: text.slice(0, 40), createdAt: chat.createdAt }, ...prev]);
      } catch {
        // Non-critical
      }

      // Add assistant placeholder
      setMessages((prev) => [...prev, { role: "assistant", text: "" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  };

  // Handle edit
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

  // Handle approve
  const handleApprove = async () => {
    if (!sessionId) return;
    try {
      await approveTopology(sessionId);
      setMessages((prev) => [...prev, { role: "system", text: "Topology approved and finalized." }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: err.message }]);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!sessionId) return;
    try {
      await downloadGns3(sessionId);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", text: "Download failed: " + err.message }]);
    }
  };

  // Select a past chat
  const handleSelectHistory = (chat) => {
    // Future: load chat messages from backend
  };

  const handleDeleteChat = async (id) => {
    try {
      await deleteChat(id);
      setHistory((prev) => prev.filter((c) => (c._id || c.id) !== id));
    } catch {}
  };

  const isStreaming = status === "streaming";
  const isComplete = status === "complete";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: BG, fontFamily: "'Geist', system-ui, sans-serif" }}>
      {/* Top Bar */}
      <div
        style={{
          height: 52,
          background: "white",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6B7280",
              padding: 6,
              display: "flex",
              borderRadius: 6,
            }}
          >
            <Icon d={PATHS.menu} size={18} />
          </button>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <NetworkIcon size={14} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>Structranet AI</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {topology && (
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
          {isComplete && sessionId && (
            <button
              onClick={handleDownload}
              style={{
                border: `1px solid ${BORDER}`,
                background: "white",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon d={PATHS.download} size={13} /> Download .gns3project
            </button>
          )}
          <button
            onClick={() => setProfileOpen(true)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6B7280",
              padding: 6,
              display: "flex",
              borderRadius: 6,
            }}
          >
            <Icon d={PATHS.settings} size={16} />
          </button>
          <button
            onClick={logout}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#9CA3AF",
              padding: 6,
              display: "flex",
              borderRadius: 6,
            }}
            title="Sign out"
          >
            <Icon d={PATHS.logout} size={16} />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 16px" }}>
          {messages.length === 0 && !isStreaming && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 16,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "rgba(22,101,52,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: PRIMARY,
                }}
              >
                <NetworkIcon size={28} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#111", marginBottom: 4 }}>
                  Describe a network topology
                </div>
                <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 460, lineHeight: 1.5 }}>
                  For example: "Design a campus network with a core router, 3 floor switches,
                  VLANs 10/20/30, a perimeter firewall, and VPCS hosts"
                </div>
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: 16, maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
              {msg.role === "user" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <div
                    style={{
                      background: PRIMARY,
                      color: "white",
                      borderRadius: "12px 12px 4px 12px",
                      padding: "10px 14px",
                      fontSize: 14,
                      maxWidth: "80%",
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: PRIMARY, letterSpacing: "0.03em" }}>
                    STRUCTRANET AI
                  </span>
                </div>
              )}
              {msg.role === "error" && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#DC2626",
                  }}
                >
                  {msg.text}
                </div>
              )}
              {msg.role === "system" && (
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: PRIMARY,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon d={PATHS.check} size={14} style={{ color: PRIMARY }} />
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {/* Streaming thoughts */}
          {isStreaming && thoughts.length > 0 && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto", marginBottom: 16 }}>
              <ThoughtStream thoughts={thoughts} />
            </div>
          )}

          {/* Requirements */}
          {requirements && requirements.length > 0 && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto", marginBottom: 16 }}>
              <RequirementsPanel requirements={requirements} />
            </div>
          )}

          {/* Topology preview (inline) */}
          {topology && !topologyOpen && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto", marginBottom: 16 }}>
              <div
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "white",
                    padding: "10px 14px",
                    borderBottom: `1px solid ${BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon d={PATHS.maximize} size={14} style={{ color: PRIMARY }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                      Topology Generated
                    </span>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>
                      {topology.nodes?.length || 0} nodes · {topology.links?.length || 0} links
                    </span>
                  </div>
                  <button
                    onClick={() => setTopologyOpen(true)}
                    style={{
                      border: `1px solid ${BORDER}`,
                      background: "white",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#374151",
                      cursor: "pointer",
                    }}
                  >
                    Expand
                  </button>
                </div>
                <div style={{ background: "#fefefe", padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    Click "Expand" or "View Topology" to open the interactive schematic
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons after generation */}
          {isComplete && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditText("");
                  }}
                  style={{
                    border: `1px solid ${BORDER}`,
                    background: "white",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon d={PATHS.pencil} size={14} /> Edit Topology
                </button>
                <button
                  onClick={handleApprove}
                  style={{
                    border: `1px solid ${PRIMARY}`,
                    background: "rgba(22,101,52,0.05)",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: PRIMARY,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon d={PATHS.check} size={14} /> Approve
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    border: `1px solid ${BORDER}`,
                    background: "white",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon d={PATHS.download} size={14} /> Download .gns3project
                </button>
              </div>
            </div>
          )}

          {/* Edit mode input */}
          {editMode && (
            <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto", marginBottom: 16 }}>
              <div
                style={{
                  border: `1px solid ${PRIMARY}`,
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    background: "rgba(22,101,52,0.05)",
                    padding: "8px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderBottom: `1px solid rgba(22,101,52,0.15)`,
                  }}
                >
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

        {/* Input Area */}
        <div
          style={{
            padding: "16px 24px 20px",
            background: "white",
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ maxWidth: 700, marginLeft: "auto", marginRight: "auto" }}>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        history={history}
        onSelectHistory={handleSelectHistory}
        onDeleteChat={handleDeleteChat}
      />

      {/* Topology Viewer (fullscreen overlay) */}
      {topologyOpen && topology && (
        <TopologyViewer topology={topology} onClose={() => setTopologyOpen(false)} />
      )}

      {/* Profile Drawer */}
      {profileOpen && (
        <ProfileDrawer
          onClose={() => setProfileOpen(false)}
          profile={profile}
          onSave={setProfile}
        />
      )}
    </div>
  );
}
