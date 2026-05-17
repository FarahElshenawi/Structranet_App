import { useState } from "react";
import { Icon, NetworkIcon, PATHS } from "./Icons";

const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";
const PRIMARY = "#166534";

export default function Sidebar({
  open,
  onClose,
  onNewChat,
  history = [],
  onSelectHistory,
  onDeleteChat,
  onOpenProfile,
  onLogout,
  user,
}) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? history.filter((h) => (h.title || "").toLowerCase().includes(search.toLowerCase()))
    : history;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.15)",
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 300,
          background: "white",
          borderRight: `1px solid ${BORDER}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-300px)",
          transition: "transform .2s ease-out",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
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
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
              StructuraNet AI
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6B7280",
              padding: 4,
              display: "flex",
            }}
          >
            <Icon d={PATHS.x} size={15} />
          </button>
        </div>

        {/* ── New Chat ── */}
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
              fontFamily: "inherit",
              transition: "background .15s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "#14532D")}
            onMouseOut={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: "0 12px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#F3F4F6",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "7px 10px",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
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
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* ── History ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "4px 12px",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                textAlign: "center",
                padding: "20px 0",
              }}
            >
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
                </svg>
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
                  flexShrink: 0,
                  display: "flex",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#EF4444")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#D1D5DB")}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          ))}
          {filtered.length > 0 && (
            <div
              style={{
                fontSize: 12,
                color: "#9CA3AF",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              No more topologies
            </div>
          )}
        </div>

        {/* ── Profile Section ── */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6B7280",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
              </div>
              {/* Name + email */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>
                  {user?.username || "User"}
                </span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {user?.email || ""}
                </span>
              </div>
            </div>

            {/* Profile button */}
            <button
              onClick={() => {
                onOpenProfile?.();
              }}
              style={{
                padding: "6px 12px",
                border: `1px solid ${BORDER}`,
                background: "white",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                color: "#6B7280",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
                transition: "all .15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#F9FAFB";
                e.currentTarget.style.color = "#374151";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#6B7280";
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              </svg>
              Profile
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: 8,
              border: `1px solid ${BORDER}`,
              background: "white",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: "#9CA3AF",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
              transition: "all .15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#EF4444";
              e.currentTarget.style.borderColor = "#FECACA";
              e.currentTarget.style.background = "#FEF2F2";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "#9CA3AF";
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.background = "white";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
