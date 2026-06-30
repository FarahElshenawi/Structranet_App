import { ArrowUp } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../stores/chatStore.js';

/**
 * ConversationView — active conversation UI.
 *
 * Design system (Zinc + Emerald accent):
 *  - Background: zinc-950 (deep, slightly warmer than pure black)
 *  - User bubbles: zinc-800 with subtle emerald border (elegant, not blinding)
 *  - AI responses: prose prose-invert (Tailwind Typography plugin) — text-[16px] leading-relaxed
 *  - Streaming cursor: pulsing emerald block at the end of streaming text
 *  - Max width: max-w-4xl (wide, not cramped)
 *  - No emojis (server-side stripping safety net guarantees this)
 */
export default function ConversationView() {
  const {
    activeSessionId, messages, streamingText, isStreaming, activeTool,
    sendMessage,
  } = useChatStore();

  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  const activeMessages = activeSessionId ? (messages[activeSessionId] || []) : [];

  // ── Auto-scroll to bottom on new content ────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, streamingText, activeTool]);

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

  return (
    <div className="h-full flex flex-col">
      {/* ── Message stream ──────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {activeMessages.map((msg, i) => (
            <MessageItem key={i} message={msg} />
          ))}

          {/* ── Streaming text with pulsing emerald cursor ── */}
          {isStreaming && streamingText && (
            <div className="flex gap-4 animate-fade-in-up">
              <Avatar />
              <div className="flex-1 min-w-0">
                <div className="prose prose-invert max-w-none text-[16px] leading-relaxed streaming-cursor">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* ── Tool indicator (glass-box) ───────────────── */}
          {activeTool && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm p-5 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold text-emerald-300">
                  {activeTool.tool === 'generate_topology' && 'Generating topology'}
                  {activeTool.tool === 'edit_topology' && 'Editing topology'}
                  {activeTool.tool === 'export_project' && 'Building deployment kit'}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </span>
              </div>
              {activeTool.steps?.length > 0 && (
                <div className="space-y-2">
                  {activeTool.steps.slice(-4).map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm animate-fade-in">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 mt-0.5 flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-zinc-300">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Thinking indicator ───────────────────────── */}
          {isStreaming && !streamingText && !activeTool && (
            <div className="flex items-center gap-2.5 text-base text-zinc-500">
              <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Thinking…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Small pill input (ChatGPT style, no hint text) ── */}
      <div className="flex-shrink-0 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-[20px] border border-white/[0.08] bg-[#131A24] px-5 py-3 focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all shadow-lg shadow-black/20">
            <textarea
              data-chat-input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the network you want to build..."
              rows={1}
              className="flex-1 bg-transparent text-[15px] text-white placeholder-zinc-500 resize-none focus:outline-none leading-relaxed max-h-32"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || isStreaming}
              className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
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

// ── Avatar (shared) ────────────────────────────────────────
function Avatar() {
  return (
    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/30">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    // User bubble: zinc-800 + subtle emerald border (elegant, not blinding)
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-zinc-800 text-white px-5 py-3 text-[16px] border border-emerald-500/30 shadow-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant response — prose prose-invert for clean markdown rendering
  return (
    <div className="flex gap-4 animate-fade-in-up">
      <Avatar />
      <div className="flex-1 min-w-0">
        <div className="prose prose-invert max-w-none text-[16px] leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
        {message.toolSummary && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-zinc-400 bg-zinc-800/50 rounded-md px-2.5 py-1.5 border border-zinc-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {message.toolSummary}
          </div>
        )}
      </div>
    </div>
  );
}
