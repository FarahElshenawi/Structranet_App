import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./chatPage.css";
import NewPrompt from "../../components/newPrompt/NewPrompt";
import TopologyView from "../../components/topologyView/TopologyView";
import PhaseProgress from "../../components/phaseProgress/PhaseProgress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  createSession,
  startGeneration,
  editTopology,
  approveTopology,
  subscribeToSession,
  getSession,
  downloadGns3Project,
  downloadTopologyJson,
} from "../../lib/api";


// ── Chat Header ───────────────────────────────────────────────────────
const ChatHeader = ({ title, sessionId, phase }) => {
  return (
    <div className="sn-chat-header">
      <div className="sn-header-left">
        <span className="sn-header-logo">🌐</span>
        <span className="sn-title-text">{title || "StructuraNet AI"}</span>
      </div>
      <div className="sn-header-right">
        {sessionId && (
          <span className="sn-session-badge">
            Session: {sessionId.slice(0, 8)}…
          </span>
        )}
        {phase && phase !== "idle" && (
          <span className={`sn-phase-badge sn-phase-${phase}`}>
            {phase}
          </span>
        )}
      </div>
    </div>
  );
};


// ── Action Bar (Review phase: Edit / Approve / Download) ─────────────
const ActionBar = ({ phase, sessionId, onEdit, onApprove, downloading, onDownload, onDownloadJson }) => {
  if (!sessionId) return null;

  return (
    <div className="sn-action-bar">
      {phase === "review" && (
        <>
          <button className="sn-action-bar-btn sn-btn-edit" onClick={onEdit}>
            ✏️ Request Changes
          </button>
          <button className="sn-action-bar-btn sn-btn-approve" onClick={onApprove}>
            ✅ Approve & Export
          </button>
        </>
      )}
      {phase === "success" && (
        <>
          <button
            className="sn-action-bar-btn sn-btn-download"
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? "⏳ Downloading…" : "📥 Download .gns3project"}
          </button>
          <button
            className="sn-action-bar-btn sn-btn-download-json"
            onClick={onDownloadJson}
          >
            📄 Download JSON
          </button>
          <button className="sn-action-bar-btn sn-btn-edit" onClick={onEdit}>
            ✏️ Edit Topology
          </button>
        </>
      )}
    </div>
  );
};


// ── Edit Modal ────────────────────────────────────────────────────────
const EditModal = ({ open, onClose, onSubmit }) => {
  const [text, setText] = useState("");

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim());
      setText("");
      onClose();
    }
  };

  return (
    <div className="sn-modal-overlay" onClick={onClose}>
      <div className="sn-modal" onClick={(e) => e.stopPropagation()}>
        <h3>✏️ Edit Topology</h3>
        <p>Describe what changes you want to make:</p>
        <form onSubmit={handleSubmit}>
          <textarea
            className="sn-edit-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., Add a firewall between the core switch and the internet router"
            rows={4}
            autoFocus
          />
          <div className="sn-modal-actions">
            <button type="button" className="sn-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="sn-btn-submit" disabled={!text.trim()}>Submit Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ── Main ChatPage ─────────────────────────────────────────────────────
const ChatPage = () => {
  const { id: chatId } = useParams();
  const navigate = useNavigate();

  // Session state (FastAPI)
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [subPhase, setSubPhase] = useState(null);
  const [thoughts, setThoughts] = useState([]);
  const [topology, setTopology] = useState(null);
  const [requirements, setRequirements] = useState(null);
  const [summary, setSummary] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [error, setError] = useState(null);

  // Chat messages (local + Express backend)
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);

  // Refs
  const endRef = useRef(null);
  const cleanupRef = useRef(null);
  const messagesRef = useRef([]);

  const getToken = () => localStorage.getItem("token");

  // Load existing chat from Express backend
  useEffect(() => {
    const fetchChat = async () => {
      const token = getToken();
      if (!token) return navigate("/sign-in");
      try {
        const res = await fetch(`http://localhost:3000/api/chats/${chatId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const loaded = data.messages || [];
        setMessages(loaded);
        messagesRef.current = loaded;

        // Try to restore session ID from last AI message metadata
        const lastAi = [...loaded].reverse().find((m) => m.role === "assistant");
        if (lastAi?.sessionId) {
          setSessionId(lastAi.sessionId);
          // Fetch current state from FastAPI
          try {
            const status = await getSession(lastAi.sessionId);
            setPhase(status.phase);
            setSubPhase(status.sub_phase);
            if (status.topology) setTopology(status.topology);
            if (status.summary) setSummary(status.summary);
            if (status.requirements) setRequirements(status.requirements);
            if (status.gns3project_ready) {
              setExportData({ download_url: `/api/sessions/${lastAi.sessionId}/download` });
            }
          } catch {
            // Session might have expired, that's fine
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChat();
  }, [chatId, navigate]);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thoughts]);

  // SSE subscription
  useEffect(() => {
    if (!sessionId) return;

    const cleanup = subscribeToSession(sessionId, {
      onPhaseChange: (data) => {
        setPhase(data.phase);
        setSubPhase(data.sub_phase);
        setError(null);

        // Add system message for phase transitions
        if (data.phase === "review") {
          addSystemMessage("✅ Topology generated! Review the design below, then approve or request changes.");
        } else if (data.phase === "success") {
          addSystemMessage("🎉 GNS3 project ready! Click the download button to get your .gns3project file.");
        }
      },
      onThought: (data) => {
        setThoughts((prev) => [...prev, data]);
      },
      onTopologyReady: (data) => {
        setTopology(data);
      },
      onRequirementsReady: (data) => {
        setRequirements(data);
      },
      onSummaryReady: (data) => {
        setSummary(data);
      },
      onExportProgress: (data) => {
        // Could show export progress
      },
      onComplete: (data) => {
        setExportData(data);
      },
      onError: (data) => {
        setError(data.message);
        setPhase("error");
        addSystemMessage(`❌ Error: ${data.message}`);
      },
      onKeepalive: () => {},
      onConnectionError: () => {
        console.warn("SSE connection lost");
      },
    });

    cleanupRef.current = cleanup;
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [sessionId]);

  const addSystemMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { role: "system", content: text, id: Date.now() }]);
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Handle new prompt submission
  const handleGenerate = async (requestText) => {
    try {
      // Create session if needed
      let sid = sessionId;
      if (!sid) {
        const session = await createSession();
        sid = session.session_id;
        setSessionId(sid);
      }

      // Add user message
      const userMsg = {
        role: "user",
        content: requestText,
        id: Date.now(),
      };
      addMessage(userMsg);

      // Reset state
      setPhase("generating");
      setSubPhase("thinking");
      setThoughts([]);
      setTopology(null);
      setRequirements(null);
      setSummary(null);
      setExportData(null);
      setError(null);

      // Add loading message
      addMessage({
        role: "assistant",
        content: "🔄 Generating your network topology...",
        id: Date.now() + 1,
        sessionId: sid,
      });

      // Start generation
      await startGeneration(sid, requestText);

      // Save to Express backend
      const token = getToken();
      if (chatId && token) {
        await fetch(`http://localhost:3000/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: requestText, images: [] },
              { role: "assistant", content: "Topology generated", images: [], sessionId: sid },
            ],
          }),
        });
      }
    } catch (err) {
      setError(err.message);
      setPhase("error");
      addSystemMessage(`❌ Failed: ${err.message}`);
    }
  };

  // Handle edit
  const handleEdit = async (feedback) => {
    if (!sessionId) return;

    setPhase("generating");
    setSubPhase("thinking");
    setThoughts([]);
    setError(null);
    addSystemMessage(`✏️ Applying changes: "${feedback}"`);

    try {
      await editTopology(sessionId, feedback);
    } catch (err) {
      setError(err.message);
      setPhase("error");
      addSystemMessage(`❌ Edit failed: ${err.message}`);
    }
  };

  // Handle approve
  const handleApprove = async () => {
    if (!sessionId) return;

    setPhase("exporting");
    setSubPhase("finalizing");
    setError(null);
    addSystemMessage("📦 Exporting GNS3 project...");

    try {
      await approveTopology(sessionId);
    } catch (err) {
      setError(err.message);
      setPhase("error");
      addSystemMessage(`❌ Export failed: ${err.message}`);
    }
  };

  // Handle downloads
  const handleDownload = async () => {
    if (!sessionId) return;
    setDownloading(true);
    try {
      await downloadGns3Project(sessionId);
    } catch (err) {
      addSystemMessage(`❌ Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadJson = async () => {
    if (!sessionId) return;
    try {
      await downloadTopologyJson(sessionId);
    } catch (err) {
      addSystemMessage(`❌ Download failed: ${err.message}`);
    }
  };

  if (loading) return <div className="sn-loading">Loading...</div>;

  return (
    <div className="sn-chat-page">
      <div className="sn-bg-title">StructuraNet AI</div>

      <ChatHeader
        title={messages[0]?.content?.substring(0, 40) || "New Topology"}
        sessionId={sessionId}
        phase={phase}
      />

      <div className="sn-messages-area">
        <div className="sn-messages-inner">
          {/* Welcome message if empty */}
          {messages.length === 0 && (
            <div className="sn-welcome">
              <div className="sn-welcome-icon">🌐</div>
              <h2>Design your network topology</h2>
              <p>Describe the network you want to build, and I'll generate a GNS3-ready topology for you.</p>
              <div className="sn-welcome-suggestions">
                <button onClick={() => handleGenerate("Design a campus network with 3 VLANs, core and access layer switches, and a router for inter-VLAN routing")}>
                  🏫 Campus Network
                </button>
                <button onClick={() => handleGenerate("Create a secure enterprise network with firewall, DMZ, internal servers, and VPN gateway")}>
                  🔒 Enterprise Security
                </button>
                <button onClick={() => handleGenerate("Build a data center topology with spine-leaf architecture, 2 spine and 4 leaf switches")}>
                  🖥️ Data Center
                </button>
                <button onClick={() => handleGenerate("Design a branch office network with router, switch, firewall, and 3 PCs connected to HQ via VPN")}>
                  🏢 Branch Office
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isSystem = msg.role === "system";

            if (isSystem) {
              return (
                <div key={msg.id || index} className="sn-system-msg">
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className={`sn-msg-wrapper ${isUser ? "sn-msg-wrapper-user" : "sn-msg-wrapper-ai"}`}
              >
                <div className={`sn-row ${isUser ? "sn-row-user" : "sn-row-ai"}`}>
                  <div className={`sn-bubble ${isUser ? "sn-bubble-user" : "sn-bubble-ai"}`}>
                    <div className={`sn-response-content ${!isUser ? "sn-response-content-ai" : ""}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeText = String(children).replace(/\n$/, '');
                            if (!inline && match) {
                              return (
                                <div className="sn-code-block">
                                  <div className="sn-code-header">
                                    <span className="sn-code-lang">{match[1]}</span>
                                    <button
                                      className="sn-copy-code-btn"
                                      onClick={() => navigator.clipboard.writeText(codeText)}
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    showLineNumbers
                                    {...props}
                                  >
                                    {codeText}
                                  </SyntaxHighlighter>
                                </div>
                              );
                            }
                            return <code className={`sn-inline-code ${className || ''}`} {...props}>{children}</code>;
                          }
                        }}
                      >
                        {msg.content || ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Phase Progress */}
          {phase !== "idle" && phase !== "review" && phase !== "success" && (
            <PhaseProgress
              phase={phase}
              subPhase={subPhase}
              thoughts={thoughts}
              error={error}
            />
          )}

          {/* Topology Visualization */}
          {topology && <TopologyView topology={topology} />}

          {/* Requirements table */}
          {requirements && requirements.length > 0 && (
            <div className="sn-requirements-card">
              <h4>📋 Required Appliances</h4>
              <div className="sn-req-table-wrapper">
                <table className="sn-req-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Type</th>
                      <th>Template</th>
                      <th>Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.node_type}</td>
                        <td>{r.template_name}</td>
                        <td>
                          <span className={`sn-req-status sn-req-${r.status}`}>
                            {r.status === "builtin" ? "Built-in" : r.image_file || "Missing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && summary.design_review?.length > 0 && (
            <div className="sn-summary-card">
              <h4>🔍 Design Review</h4>
              <ul>
                {summary.design_review.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              {summary.assumptions?.length > 0 && (
                <>
                  <h4>💡 Assumptions</h4>
                  <ul>
                    {summary.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Action Bar */}
          <ActionBar
            phase={phase}
            sessionId={sessionId}
            onEdit={() => setEditOpen(true)}
            onApprove={handleApprove}
            downloading={downloading}
            onDownload={handleDownload}
            onDownloadJson={handleDownloadJson}
          />

          <div ref={endRef} />
        </div>
      </div>

      <div className="sn-input-area">
        <NewPrompt
          onSubmit={handleGenerate}
          isLoading={phase === "generating" || phase === "exporting"}
        />
      </div>

      <EditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEdit}
      />
    </div>
  );
};

export default ChatPage;
