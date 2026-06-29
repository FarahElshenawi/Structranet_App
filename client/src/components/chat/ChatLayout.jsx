import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore.js';
import { useAuthStore } from '../../stores/authStore.js';
import ChatTopBar from './ChatTopBar.jsx';
import Sidebar from './Sidebar.jsx';
import EmptyState from './EmptyState.jsx';
import ConversationView from './ConversationView.jsx';
import TopologyFullCanvas from '../topology/TopologyFullCanvas.jsx';

/**
 * ChatLayout — root container.
 * Dark sidebar + light workspace.
 */
export default function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFullCanvas, setShowFullCanvas] = useState(false);

  const {
    sessions, activeSessionId, messages, topology,
    loadSessions, createSession, selectSession, deleteSession, reset,
  } = useChatStore();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    loadSessions();
    return () => reset();
  }, []); // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const activeMessages = activeSessionId ? (messages[activeSessionId] || []) : [];
  const showEmptyState = !activeSessionId || activeMessages.length === 0;

  const handleNewChat = async () => {
    await createSession();
    setSidebarOpen(false);
  };

  const handleSelectSession = async (id) => {
    await selectSession(id);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        user={user}
        onNewChat={handleNewChat}
        onSelect={handleSelectSession}
        onDelete={deleteSession}
        onLogout={handleLogout}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <ChatTopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          activeSessionId={activeSessionId}
        />

        <div className="flex-1 overflow-hidden">
          {showEmptyState ? (
            <EmptyState onNewChat={handleNewChat} />
          ) : (
            <ConversationView onExpandTopology={() => setShowFullCanvas(true)} />
          )}
        </div>
      </div>

      {/* Full-screen topology modal */}
      {showFullCanvas && topology && (
        <TopologyFullCanvas
          topology={topology}
          onClose={() => setShowFullCanvas(false)}
        />
      )}
    </div>
  );
}
