import { X, Plus, MessageSquare, Trash2, LogOut, User, Settings, HelpCircle, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Sidebar — slide-in drawer.
 * Deep zinc-900 (not pure black) for softer transition to white workspace.
 * Profile section uses a clean popover instead of raw text links.
 */
export default function Sidebar({
  open, sessions, activeSessionId, user,
  onNewChat, onSelect, onDelete, onLogout, onClose,
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:bg-black/20"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-[280px] bg-zinc-900 border-r border-zinc-800 z-40 flex flex-col transition-transform duration-300 ease-out font-sans antialiased ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
                <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
              </svg>
            </span>
            <span className="font-semibold text-white text-sm">StructuraNet <span className="text-emerald-400">AI</span></span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* New Chat — desaturated emerald */}
        <div className="p-3 border-b border-zinc-800 flex-shrink-0">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-3 py-2.5 transition-colors shadow-sm"
          >
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare size={20} className="mx-auto text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No chats yet</p>
              <p className="text-[11px] text-zinc-600 mt-1">Start a new conversation to begin</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-2 py-2">Recent</p>
              <ul className="space-y-0.5">
                {sessions.map((session) => (
                  <li key={session._id}>
                    <div
                      className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm cursor-pointer transition-colors ${
                        activeSessionId === session._id
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      }`}
                      onClick={() => onSelect(session._id)}
                    >
                      <MessageSquare size={14} className="flex-shrink-0 opacity-60" />
                      <span className="flex-1 truncate text-[13px]">{session.title || 'New Chat'}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(session._id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-red-400 transition-all"
                        aria-label="Delete chat"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Profile popover */}
        <div className="border-t border-zinc-800 p-3 flex-shrink-0 relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-zinc-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-semibold text-xs shadow-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || <User size={14} />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-white truncate">{user?.name || 'User'}</div>
            </div>
            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-zinc-700 bg-zinc-800 shadow-xl overflow-hidden animate-fade-in">
              <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors">
                <Settings size={14} className="text-zinc-500" />
                Settings
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors">
                <HelpCircle size={14} className="text-zinc-500" />
                Help
              </button>
              <div className="h-px bg-zinc-700" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
