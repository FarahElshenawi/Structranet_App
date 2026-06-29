import { useState } from 'react';
import { ArrowUp, Lightbulb, Shield, TrendingUp, BookOpen } from 'lucide-react';
import ActionChipsBar from './ActionChipsBar.jsx';
import { useChatStore } from '../../stores/chatStore.js';

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

export default function EmptyState({ onNewChat }) {
  const [text, setText] = useState('');
  const { sendMessage, createSession, activeSessionId, topology } = useChatStore();

  const handleSend = async () => {
    if (!text.trim()) return;
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession();
    }
    await sendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptSelect = (prompt) => {
    setText(prompt);
    const textarea = document.querySelector('[data-chat-input]');
    if (textarea) textarea.focus();
  };

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-6 relative overflow-hidden font-sans antialiased"
      style={{ background: 'radial-gradient(circle at 80% 0%, #ecfdf5 0%, #ffffff 60%)' }}
    >
      {/* Faint network background */}
      <NetworkBackground />

      <div className="relative w-full max-w-3xl z-10">
        {/* Greeting — elegant, tight */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight mb-1.5">
            Design a network
          </h1>
          <p className="text-sm text-slate-400">
            Describe what you want to build, or pick a starting point
          </p>
        </div>

        {/* Sleek pill input */}
        <div className="relative">
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
              disabled={!text.trim()}
              className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-200 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>

        {/* Action Chips — expandable with prompt lists */}
        <div className="mt-6">
          <ActionChipsBar
            hasTopology={!!topology}
            onPromptSelect={handlePromptSelect}
          />
        </div>
      </div>
    </div>
  );
}
