import { useState, useMemo } from "react";
import { Icon, NetworkIcon, PATHS } from "./Icons";

const G = "#166534";
const GH = "#14532D";
const BD = "#E5E7EB";
const MT = "#F3F4F6";
const SIDEBAR_W = 300;

function Ic({ d, size = 16, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || "currentColor"} strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>
    </svg>
  );
}

const IC = {
  x:        "M18 6 6 18M6 6l12 12",
  plus:     "M12 5v14M5 12h14",
  search:   "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  trash:    "M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  settings: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  logout:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

export default function ChatSidebar({
  open,
  onClose,
  onNewChat,
  history,
  onSelectHistory,
  onDeleteChat,
  user,
  onLogout,
  onOpenProfile,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter((chat) =>
      (chat.title || "").toLowerCase().includes(q)
    );
  }, [history, searchQuery]);

  return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(0,0,0,0.15)",
        }}/>
      )}
      <div style={{
        position: "fixed", left: 0, top: 0, bottom: 0,
        width: SIDEBAR_W, background: "white",
        borderRight: `1px solid ${BD}`,
        zIndex: 50, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : `translateX(-${SIDEBAR_W}px)`,
        transition: "transform .22s ease-out",
        fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px", borderBottom: `1px solid ${BD}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: G,
              display: "flex", alignItems: "center", justifyContent: "center", color: "white",
            }}>
              <NetworkIcon size={14}/>
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>StructuraNet AI</span>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "transparent",
            cursor: "pointer", color: "#6B7280", padding: 4,
          }}>
            <Ic d={IC.x} size={15}/>
          </button>
        </div>

        {/* New Chat */}
        <div style={{ padding: "12px 12px 8px" }}>
          <button onClick={() => { onNewChat(); onClose(); }} style={{
            width: "100%", background: G, color: "white",
            border: "none", borderRadius: 8, padding: "9px 12px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 7, justifyContent: "center",
            fontFamily: "inherit",
          }}
            onMouseOver={(e) => e.currentTarget.style.background = GH}
            onMouseOut={(e) => e.currentTarget.style.background = G}
          >
            <Ic d={IC.plus} size={13}/> New Chat
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            border: `1px solid ${BD}`, borderRadius: 8,
            padding: "6px 10px", background: MT,
          }}>
            <Ic d={IC.search} size={13} color="#9CA3AF"/>
            <input
              type="text"
              placeholder="Search topologies"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none", outline: "none", flex: 1,
                fontSize: 12, color: "#374151", background: "transparent",
                fontFamily: "inherit", padding: 0,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{
                border: "none", background: "transparent",
                cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex",
              }}>
                <Ic d={IC.x} size={11}/>
              </button>
            )}
          </div>
        </div>

        {/* History Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
          {filteredHistory.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
              {searchQuery ? "No matching topologies" : "No topologies yet"}
            </div>
          )}
          {filteredHistory.map((chat) => (
            <div
              key={chat._id || chat.id}
              onClick={() => { onSelectHistory(chat); onClose(); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
              }}
              onMouseOver={(e) => e.currentTarget.style.background = MT}
              onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={{
                fontSize: 13, color: "#374151",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
              }}>
                {chat.title || "Untitled"}
              </span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteChat(chat._id || chat.id); }}
                style={{
                  border: "none", background: "transparent",
                  cursor: "pointer", color: "#D1D5DB", padding: 2, flexShrink: 0,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = "#EF4444"}
                onMouseOut={(e) => e.currentTarget.style.color = "#D1D5DB"}
              >
                <Ic d={IC.trash} size={12}/>
              </button>
            </div>
          ))}
          {filteredHistory.length > 0 && (
            <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "8px 0" }}>
              No more topologies
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${BD}`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#E5E7EB", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#6B7280", fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}>
              {(user?.username || "U")[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                {user?.username || "User"}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email || ""}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { onOpenProfile(); onClose(); }} style={{
              flex: 1, border: `1px solid ${BD}`, background: "white",
              borderRadius: 7, padding: "7px 10px",
              fontSize: 12, color: "#6B7280", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, justifyContent: "center",
              fontFamily: "inherit",
            }}
              onMouseOver={(e) => { e.currentTarget.style.color = G; e.currentTarget.style.borderColor = "#BBF7D0"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = BD; }}
            >
              <Ic d={IC.settings} size={13}/> Profile
            </button>
            <button onClick={onLogout} style={{
              flex: 1, border: `1px solid ${BD}`, background: "white",
              borderRadius: 7, padding: "7px 10px",
              fontSize: 12, color: "#6B7280", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, justifyContent: "center",
              fontFamily: "inherit", transition: "all .15s",
            }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = BD; }}
            >
              <Ic d={IC.logout} size={13}/> Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
