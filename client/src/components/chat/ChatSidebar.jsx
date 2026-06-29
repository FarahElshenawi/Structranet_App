import { useAuthStore } from '../../stores/authStore.js';

export default function ChatSidebar({ sessions, activeSessionId, user, onNewChat, onSelect, onDelete, onLogout }) {
  const profile = useAuthStore((s) => s.profile);

  return (
    <aside className="w-72 h-full bg-ink-950 text-white flex flex-col flex-shrink-0 scrollbar-dark border-r border-ink-800/60">
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-ink-800/60">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-glow-brand">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="18" r="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 8v8M18 8v8M8 6h8M8 18h8M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold tracking-tight leading-none">StructuraNet<span className="text-brand-400"> AI</span></div>
            <div className="text-[11px] text-ink-500 mt-1">Topology designer</div>
          </div>
        </div>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="group w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 px-3 py-2.5 text-sm font-medium text-white shadow-soft hover:from-brand-400 hover:to-brand-500 hover:shadow-soft-lg active:scale-[0.98] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Sessions label */}
      <div className="px-5 pt-2 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Recent</span>
        <span className="text-[11px] text-ink-600">{sessions.length}</span>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-dark">
        {sessions.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-800/60 mb-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-xs text-ink-500 leading-relaxed">No chats yet.<br />Click "New Chat" to start.</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const active = activeSessionId === s._id;
              return (
                <li key={s._id}>
                  <div
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-all ${
                      active
                        ? 'bg-ink-800/80 text-white shadow-sm'
                        : 'text-ink-400 hover:bg-ink-800/50 hover:text-white'
                    }`}
                    onClick={() => onSelect(s._id)}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-brand-400" />
                    )}
                    <svg viewBox="0 0 24 24" className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-400' : 'text-ink-500'}`} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="flex-1 truncate">{s.title || 'New Chat'}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(s._id); }}
                      className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-danger-400 transition-all p-0.5 rounded hover:bg-ink-700/60"
                      title="Delete chat"
                      aria-label="Delete chat"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Calibration status pill */}
      {profile && (
        <div className="px-3 pb-2">
          <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
            profile.isCalibrated
              ? 'bg-success-500/10 text-success-500 ring-1 ring-inset ring-success-500/20'
              : 'bg-warning-500/10 text-warning-500 ring-1 ring-inset ring-warning-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${profile.isCalibrated ? 'bg-success-500' : 'bg-warning-500'} animate-pulse`} />
            <span className="flex-1 truncate">
              {profile.isCalibrated ? 'GNS3 calibrated' : 'GNS3 needs setup'}
            </span>
            {profile.gns3Server?.host && (
              <span className="font-mono text-ink-500">{profile.gns3Server.host}:{profile.gns3Server.port}</span>
            )}
          </div>
        </div>
      )}

      {/* User footer */}
      <div className="border-t border-ink-800/60 p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-semibold shadow-sm">
            {user?.name?.[0]?.toUpperCase() || '?'}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success-500 border-2 border-ink-950" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name || 'User'}</div>
            <div className="text-xs text-ink-500 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-400 hover:bg-ink-800/60 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
