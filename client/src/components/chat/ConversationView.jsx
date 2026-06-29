import { ArrowUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../stores/chatStore.js';
import TopologyMiniPreview from '../topology/TopologyMiniPreview.jsx';
import DeploymentKit from '../export/DeploymentKit.jsx';

// ── Faint network background SVG ────────────────────────────
function NetworkBackground() {
  const nodes = [
    { x: 50, y: 40 }, { x: 180, y: 80 }, { x: 320, y: 50 },
    { x: 450, y: 100 }, { x: 100, y: 180 }, { x: 280, y: 220 },
    { x: 400, y: 200 }, { x: 520, y: 260 }, { x: 160, y: 300 },
    { x: 340, y: 340 }, { x: 500, y: 380 },
  ];
  const links = [
    [0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7],
    [4,8],[5,9],[6,10],[7,10],[8,9],[9,10],
  ];
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 600 420"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.04 }}
      aria-hidden
    >
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="#94a3b8" strokeWidth="1" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="4" fill="#94a3b8" />
      ))}
    </svg>
  );
}

export default function ConversationView({ onExpandTopology }) {
  const {
    activeSessionId, messages, streamingText, isStreaming, activeTool,
    sendMessage, topology, exportKit,
  } = useChatStore();

  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  const activeMessages = activeSessionId ? (messages[activeSessionId] || []) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, streamingText, activeTool, topology, exportKit]);

  const handleSend = async () => {
    if (!text.trim() || isStreaming) return;
    await sendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApprove = () => {
    sendMessage('Yes, this looks good. Please generate the configurations and export the GNS3 project.');
  };

  const handleEdit = () => {
    const input = document.querySelector('[data-chat-input]');
    if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth' }); }
  };

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden font-sans antialiased"
      style={{ background: 'radial-gradient(circle at 80% 0%, #ecfdf5 0%, #ffffff 60%)' }}
    >
      {/* Faint network background */}
      <NetworkBackground />

      {/* ── Message stream ──────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          {activeMessages.map((msg, i) => (
            <MessageItem key={i} message={msg} />
          ))}

          {/* ── Streaming text ── */}
          {isStreaming && streamingText && (
            <div className="flex gap-4 animate-fade-in-up">
              <Avatar />
              <div className="flex-1 min-w-0">
                <div className="prose prose-slate max-w-none text-[15px] leading-relaxed streaming-cursor">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* ── Tool indicator ── */}
          {activeTool && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold text-emerald-700">
                  {activeTool.tool === 'generate_topology' && 'Generating topology'}
                  {activeTool.tool === 'edit_topology' && 'Editing topology'}
                  {activeTool.tool === 'export_project' && 'Building deployment kit'}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </span>
              </div>
              {activeTool.steps?.length > 0 && (
                <div className="space-y-1.5">
                  {activeTool.steps.slice(-4).map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm animate-fade-in">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 mt-0.5 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-slate-700">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Topology mini preview ── */}
          {topology && !activeTool && (
            <TopologyMiniPreview
              topology={topology}
              onExpand={onExpandTopology}
              onApprove={handleApprove}
              onEdit={handleEdit}
            />
          )}

          {/* ── Deployment kit ── */}
          {exportKit && !activeTool && (
            <DeploymentKit kit={exportKit} />
          )}

          {/* ── Thinking indicator ── */}
          {isStreaming && !streamingText && !activeTool && (
            <div className="flex items-center gap-2.5 text-sm text-slate-400">
              <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Thinking…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ChatGPT-style pill input ── */}
      <div className="flex-shrink-0 relative z-10 bg-gradient-to-t from-white via-white/80 to-transparent pt-2 pb-4 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 px-5 py-3 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all">
            <textarea
              data-chat-input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the network you want to build..."
              rows={1}
              className="flex-1 bg-transparent text-[15px] text-slate-800 placeholder-slate-400 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || isStreaming}
              className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-200 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Avatar ──────────────────────────────────────────────────
function Avatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-sm shadow-emerald-500/20">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
        <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
      </svg>
    </div>
  );
}

// ── Message item ────────────────────────────────────────────
function MessageItem({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-50 text-slate-800 px-4 py-2.5 text-[15px] border border-emerald-100 leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in-up">
      <Avatar />
      <div className="flex-1 min-w-0">
        <div className="prose prose-slate max-w-none text-[15px] leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
        {message.toolSummary && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-xl px-2 py-1 border border-slate-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {message.toolSummary}
          </div>
        )}
      </div>
    </div>
  );
}
