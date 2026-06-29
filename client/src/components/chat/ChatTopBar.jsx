import { PanelLeft, Plus } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';

/**
 * ChatTopBar — sleek top bar.
 * Shows "StructuraNet AI | Workspace" + AI Online status badge.
 */
export default function ChatTopBar({ sidebarOpen, onToggleSidebar, activeSessionId }) {
  const isStreaming = useChatStore((s) => s.isStreaming);
  const activeTool = useChatStore((s) => s.activeTool);
  const streamingText = useChatStore((s) => s.streamingText);
  const createSession = useChatStore((s) => s.createSession);

  let statusText = 'AI Online';
  let statusColor = 'bg-emerald-500';

  if (activeTool) {
    statusText = 'Working';
    statusColor = 'bg-emerald-500 animate-pulse';
  } else if (isStreaming && streamingText) {
    statusText = 'Streaming';
    statusColor = 'bg-emerald-500 animate-pulse';
  } else if (isStreaming) {
    statusText = 'Thinking';
    statusColor = 'bg-emerald-500 animate-pulse';
  }

  return (
    <header className="flex-shrink-0 h-14 border-b border-slate-200 bg-white/80 backdrop-blur-sm flex items-center px-3 gap-2 font-sans antialiased">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        title="Toggle sidebar (Ctrl/Cmd+B)"
        aria-label="Toggle sidebar"
      >
        <PanelLeft size={18} />
      </button>

      <button
        onClick={() => createSession()}
        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        title="New chat"
        aria-label="New chat"
      >
        <Plus size={18} />
      </button>

      {/* Workspace title */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-800">StructuraNet AI</span>
        <span className="text-slate-300 text-sm">|</span>
        <span className="text-sm text-slate-400">Workspace</span>
      </div>

      {/* AI Online badge */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5">
        <span className={`w-2 h-2 rounded-full ${statusColor}`} />
        <span className="text-xs font-medium text-slate-600">{statusText}</span>
      </div>
    </header>
  );
}
