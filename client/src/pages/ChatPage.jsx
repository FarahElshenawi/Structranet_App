import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import useSSE from "../hooks/useSSE";
import ChatSidebar from "../components/ChatSidebar";
import ChatNavbar from "../components/ChatNavbar";
import EmptyState from "../components/EmptyState";
import ChatMessages from "../components/ChatMessages";
import ChatInput from "../components/ChatInput";
import ProfileModal from "../components/ProfileModal";
import TopologyViewer from "../components/TopologyViewer";
import {
  createSession, agentChat,
  downloadGns3, downloadConfigsZip, downloadRequirements,
  getChats, createChat, deleteChat, updateChatSessionId,
  checkBackendHealth, getChat, getUserProfile,
} from "../lib/api";

// ── Design tokens ──────────────────────────────────────────────────────────
const G = "#166534";

// ── Chat state machine ─────────────────────────────────────────────────────
// empty → security-clarification → generating → review → digital-twin-confirm → config-streaming → complete

export default function ChatPage() {
  const { user, logout } = useAuth();

  // ── Core state ──────────────────────────────────────────────────────────
  const [chatState, setChatState] = useState("empty"); // empty|security-clarification|generating|review|digital-twin-confirm|config-streaming|complete|error
  const [messages, setMessages] = useState([]);          // [{role, content}]
  const [sessionId, setSessionId] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [projectName, setProjectName] = useState("network");
  const [securityProfile, setSecurityProfile] = useState("none");
  const [isBaseline, setIsBaseline] = useState(false);

  // ── SSE state ───────────────────────────────────────────────────────────
  const sse = useSSE();

  // ── Streaming JSON text (for GenerationProgress card) ───────────────────
  const [streamingJsonText, setStreamingJsonText] = useState("");

  // ── UI state ────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [topologyViewerOpen, setTopologyViewerOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [inputFocusTrigger, setInputFocusTrigger] = useState(0);
  const [healthStatus, setHealthStatus] = useState({ express: true, fastapi: true });
  const [profileChecked, setProfileChecked] = useState(false);
  const [showFirstVisitModal, setShowFirstVisitModal] = useState(false);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // ── Check backend health on mount ───────────────────────────────────────
  useEffect(() => {
    checkBackendHealth().then(setHealthStatus).catch(() => {});
  }, []);

  // ── Load chat history ───────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    try {
      const chats = await getChats();
      setHistory(Array.isArray(chats) ? chats : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Check if profile exists on first visit ──────────────────────────────
  useEffect(() => {
    if (profileChecked) return;
    getUserProfile()
      .then((data) => {
        const p = data.profile || {};
        const hasProfile = p.version || (p.images && Object.keys(p.images).length > 0);
        if (!hasProfile) {
          setShowFirstVisitModal(true);
        }
      })
      .catch(() => {
        setShowFirstVisitModal(true);
      })
      .finally(() => setProfileChecked(true));
  }, [profileChecked]);

  // ── Auto-scroll on new content ──────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sse.thoughts, sse.topology, sse.configTexts, sse.agentMessage, chatState, streamingJsonText]);

  // ── Sync SSE state → chat state machine ─────────────────────────────────
  useEffect(() => {
    if (sse.status === "streaming") {
      setChatState("generating");
    } else if (sse.status === "review") {
      setChatState("review");
    } else if (sse.status === "exporting") {
      setChatState("config-streaming");
    } else if (sse.status === "complete") {
      setChatState("complete");
    } else if (sse.status === "error") {
      setChatState("error");
    }
  }, [sse.status]);

  // ── Build streaming JSON text from topology ─────────────────────────────
  useEffect(() => {
    if (sse.topology) {
      try {
        setStreamingJsonText(JSON.stringify(sse.topology, null, 2));
      } catch {
        setStreamingJsonText("");
      }
    }
  }, [sse.topology]);

  // ── Handle sending a message ────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    if (!text.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // Create chat entry if new
    let currentChatId = chatId;
    if (!currentChatId) {
      try {
        const chat = await createChat({ text });
        currentChatId = chat._id || chat.id;
        setChatId(currentChatId);
        loadHistory();
      } catch (err) {
        console.error("Failed to create chat:", err);
      }
    }

    // Create AI session if needed
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        // Load profile for session creation
        let profile = {};
        try {
          const data = await getUserProfile();
          profile = data.profile || {};
        } catch { /* no profile yet */ }

        const session = await createSession(profile);
        currentSessionId = session.session_id || session.id;
        setSessionId(currentSessionId);

        // Link chat to session
        if (currentChatId) {
          updateChatSessionId(currentChatId, currentSessionId).catch(() => {});
        }

        // Set project name from user message
        const name = text.slice(0, 40).replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        setProjectName(name || "network");
      } catch (err) {
        setMessages((prev) => [...prev, { role: "assistant", content: `Failed to create session: ${err.message}` }]);
        return;
      }
    }

    // Start streaming
    setChatState("generating");
    sse.startStream(currentSessionId);

    // Send message via agent
    try {
      const result = await agentChat(currentSessionId, text);
      if (result.message) {
        sse.setAgentMessage?.(result.message);
      }
    } catch (err) {
      console.error("Agent chat error:", err);
    }
  }, [chatId, sessionId, loadHistory, sse]);

  // ── Handle security profile selection ───────────────────────────────────
  const handleSecuritySelect = useCallback((profileId) => {
    setSecurityProfile(profileId);
    setChatState("generating");
    // The SSE stream continues — the backend will use the selected profile
  }, []);

  // ── Handle Quick Reply actions ──────────────────────────────────────────
  const handleQuickReply = useCallback((action) => {
    if (action === "edit") {
      setInputFocusTrigger((prev) => prev + 1);
    } else if (action === "approve") {
      setChatState("config-streaming");
      // Trigger export
      if (sessionId) {
        agentChat(sessionId, "Approve and export the topology").catch(console.error);
      }
    } else if (action === "ask") {
      setInputFocusTrigger((prev) => prev + 1);
    }
  }, [sessionId]);

  // ── Handle baseline confirm/deny ────────────────────────────────────────
  const handleBaselineConfirm = useCallback(() => {
    if (sessionId) {
      agentChat(sessionId, "Yes, this is my network").catch(console.error);
      setChatState("generating");
    }
  }, [sessionId]);

  const handleBaselineDeny = useCallback(() => {
    setChatState("review");
  }, []);

  // ── Handle downloads ────────────────────────────────────────────────────
  const handleDownload = useCallback(async (key, filename) => {
    if (!sessionId) return;
    try {
      switch (key) {
        case "gns3":
          await downloadGns3(sessionId, projectName);
          break;
        case "configs":
          await downloadConfigsZip(sessionId, projectName);
          break;
        case "requirements":
          await downloadRequirements(sessionId, projectName);
          break;
        case "ansible":
          // Download ansible — reuse configs endpoint with ansible flag
          await downloadConfigsZip(sessionId, projectName);
          break;
      }
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [sessionId, projectName]);

  // ── New Chat ────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setChatState("empty");
    setMessages([]);
    setSessionId(null);
    setChatId(null);
    setProjectName("network");
    setSecurityProfile("none");
    setIsBaseline(false);
    setStreamingJsonText("");
    sse.reset();
  }, [sse]);

  // ── Select history item ─────────────────────────────────────────────────
  const handleSelectHistory = useCallback(async (chat) => {
    const sid = chat.session_id || chat.sessionId;
    if (sid) {
      setSessionId(sid);
      // Try to restore session state
      try {
        const session = await getChat(chat._id || chat.id);
        if (session?.topology || session?.session_id) {
          setChatState("review");
        }
      } catch {
        // Session may not be restorable
      }
    }
    setChatId(chat._id || chat.id);
    setMessages([{ role: "user", content: chat.title || "Previous conversation" }]);
    setSidebarOpen(false);
  }, []);

  // ── Delete chat ─────────────────────────────────────────────────────────
  const handleDeleteChat = useCallback(async (id) => {
    try {
      await deleteChat(id);
      loadHistory();
      if (id === chatId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [chatId, handleNewChat, loadHistory]);

  // ── Determine if input should be disabled ───────────────────────────────
  const isInputDisabled = chatState === "generating" || chatState === "config-streaming";

  // ── Determine if "View Topology" should show in navbar ──────────────────
  const showViewTopology = chatState === "review" && sse.topology;

  // ── Get current placeholder text ────────────────────────────────────────
  const placeholder = chatState === "review"
    ? "Describe your changes..."
    : "Describe your network topology...";

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
      background: "#F9FAFB",
    }}>
      {/* Health banners */}
      {!healthStatus.express && (
        <div style={{
          background: "#FEF2F2", borderBottom: "1px solid #FECACA",
          padding: "8px 16px", fontSize: 12, color: "#DC2626", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          🔴 Backend server is not running.
        </div>
      )}
      {healthStatus.express && !healthStatus.fastapi && (
        <div style={{
          background: "#FFFBEB", borderBottom: "1px solid #FDE68A",
          padding: "8px 16px", fontSize: 12, color: "#92400E", fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ⚠️ AI engine is not reachable.
        </div>
      )}

      {/* Navbar */}
      <ChatNavbar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onViewTopology={() => setTopologyViewerOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={logout}
        showViewTopology={showViewTopology}
      />

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {chatState === "empty" && messages.length === 0 ? (
            <EmptyState onSuggestionClick={handleSend}/>
          ) : (
            <ChatMessages
              messages={messages}
              chatState={chatState}
              thoughts={sse.thoughts}
              topology={sse.topology}
              requirements={sse.requirements}
              summary={sse.summary}
              configTexts={sse.configTexts}
              streamingJsonText={streamingJsonText}
              agentMessage={sse.agentMessage}
              securityProfile={securityProfile}
              isBaseline={isBaseline}
              isActive={true}
              onOpenTopology={() => setTopologyViewerOpen(true)}
              onSecuritySelect={handleSecuritySelect}
              onQuickReply={handleQuickReply}
              onBaselineConfirm={handleBaselineConfirm}
              onBaselineDeny={handleBaselineDeny}
              sessionId={sessionId}
              projectName={projectName}
              onDownload={handleDownload}
              exportData={sse.exportData}
            />
          )}
          <div ref={messagesEndRef}/>

          {/* Chat Input */}
          <ChatInput
            onSend={handleSend}
            disabled={isInputDisabled}
            placeholder={placeholder}
            inputRef={inputRef}
            focusTrigger={inputFocusTrigger}
          />
        </div>
      </div>

      {/* Sidebar */}
      <ChatSidebar
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

      {/* Profile Modal (centered, NOT a drawer) */}
      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          onSaved={(profile) => {
            setProfileOpen(false);
            // If we have a session, the profile will be used next time
          }}
        />
      )}

      {/* First-visit profile modal */}
      {showFirstVisitModal && !profileOpen && (
        <ProfileModal
          onClose={() => setShowFirstVisitModal(false)}
          onSaved={() => setShowFirstVisitModal(false)}
        />
      )}

      {/* Topology Viewer (full-screen overlay) */}
      {topologyViewerOpen && sse.topology && (
        <TopologyViewer
          topology={sse.topology}
          requirements={sse.requirements}
          onClose={() => setTopologyViewerOpen(false)}
        />
      )}
    </div>
  );
}
