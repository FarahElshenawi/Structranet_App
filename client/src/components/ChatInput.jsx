import { useState, useRef } from "react";
import { Icon, PATHS } from "./Icons";

const PRIMARY = "#166534";
const PRIMARY_HOVER = "#14532D";
const BORDER = "#E5E7EB";

export default function ChatInput({ onSend, disabled, placeholder }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e) => {
    setValue(e.target.value);
    // Auto-resize
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        padding: "0 0 0 0",
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          background: "white",
          transition: "border-color .15s",
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Describe a network topology... (e.g., 'Campus network with 3 VLANs and a firewall')"}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            resize: "none",
            padding: "12px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            color: "#111",
            lineHeight: 1.5,
            background: "transparent",
            maxHeight: 160,
          }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          border: "none",
          background: disabled || !value.trim() ? "#E5E7EB" : PRIMARY,
          color: disabled || !value.trim() ? "#9CA3AF" : "white",
          cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all .15s",
        }}
        onMouseOver={(e) => {
          if (!disabled && value.trim()) e.currentTarget.style.background = PRIMARY_HOVER;
        }}
        onMouseOut={(e) => {
          if (!disabled && value.trim()) e.currentTarget.style.background = PRIMARY;
        }}
      >
        <Icon d={PATHS.send} size={18} />
      </button>
    </div>
  );
}
