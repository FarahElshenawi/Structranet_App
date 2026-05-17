import { useState } from "react";
import { Icon, NetworkIcon, PATHS } from "./Icons";

const BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";
const PRIMARY = "#166534";

export default function Sidebar({ open, onClose, onNewChat, history = [], onSelectHistory, onDeleteChat }) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? history.filter((h) => (h.title || "").toLowerCase().includes(search.toLowerCase()))
    : history;

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 280,
          background: "white",
          borderRight: `1px solid ${BORDER}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-280px)",
          transition: "transform .2s ease-out",
          fontFamily: "'Geist', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${BORDER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: PRIMARY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <NetworkIcon size={14} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>Structranet AI</span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#9CA3AF",
              padding: 4,
            }}
          >
            <Icon d={PATHS.x} size={15} />
          </button>
        </div>

        {/* New Chat Button */}
        <div style={{ padding: "12px 12px 8px" }}>
          <button
            onClick={() => {
              onNewChat?.();
              onClose?.();
            }}
            style={{
              width: "100%",
              background: PRIMARY,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              justifyContent: "center",
            }}
          >
            <Icon d={PATHS.plus} size={14} style={{ color: "white" }} />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "0 12px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: MUTED,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "7px 10px",
            }}
          >
            <Icon d={PATHS.search} size={14} style={{ color: "#9CA3AF" }} />
            <input
              placeholder="Search topologies"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: 13,
                color: "#374151",
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* History List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 12px",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
              No topologies yet
            </div>
          )}
          {filtered.map((chat) => (
            <div
              key={chat._id || chat.id}
              onClick={() => {
                onSelectHistory?.(chat);
                onClose?.();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 10px",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 2,
                transition: "background .15s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = MUTED)}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <Icon d={PATHS.file} size={14} style={{ color: "#9CA3AF", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 13,
                    color: "#374151",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {chat.title || "Untitled"}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat?.(chat._id || chat.id);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#D1D5DB",
                  padding: 2,
                  display: "flex",
                  flexShrink: 0,
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#EF4444")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#D1D5DB")}
              >
                <Icon d={PATHS.trash} size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${BORDER}`,
            fontSize: 11,
            color: "#9CA3AF",
            textAlign: "center",
          }}
        >
          StructuraNet AI v1.0
        </div>
      </div>
    </>
  );
}
