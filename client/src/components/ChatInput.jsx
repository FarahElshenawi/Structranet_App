import { useState, useEffect, useRef } from "react";

const G = "#166534";
const GH = "#14532D";
const BD = "#E5E7EB";

/**
 * ChatInput — Input with disabled state during streaming, 44px green send button.
 * Disabled: opacity 0.6, send button grayed out.
 */
export default function ChatInput({ onSend, disabled, placeholder, inputRef, focusTrigger }) {
  const [value, setValue] = useState("");
  const taRef = useRef(null);

  // Expose the internal textarea ref to parent
  useEffect(() => {
    if (inputRef) inputRef.current = taRef.current;
  }, [inputRef]);

  // Focus when focusTrigger changes
  useEffect(() => {
    if (focusTrigger && taRef.current) {
      taRef.current.focus();
    }
  }, [focusTrigger]);

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div style={{
      borderTop: `1px solid ${BD}`,
      padding: "12px 24px 16px",
      background: "white",
      display: "flex",
      justifyContent: "center",
      opacity: disabled ? 0.6 : 1,
      transition: "opacity .2s",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        maxWidth: 700,
        width: "100%",
      }}>
        {/* Text input wrapper */}
        <div style={{
          flex: 1,
          border: `1px solid ${BD}`,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          background: "white",
          transition: "border-color .15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = G}
          onBlurCapture={(e) => e.currentTarget.style.borderColor = BD}
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            disabled={disabled}
            placeholder={placeholder || "Describe your network topology..."}
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none",
              resize: "none", padding: "13px 14px",
              fontSize: 14, fontFamily: "inherit",
              color: "#111", lineHeight: 1.5,
              background: "transparent", maxHeight: 160,
            }}
          />
        </div>

        {/* 44px green send button */}
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          style={{
            width: 44, height: 44, borderRadius: 12, border: "none",
            background: (disabled || !value.trim()) ? BD : G,
            color: (disabled || !value.trim()) ? "#9CA3AF" : "white",
            cursor: (disabled || !value.trim()) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all .15s",
          }}
          onMouseOver={(e) => { if (!disabled && value.trim()) e.currentTarget.style.background = GH; }}
          onMouseOut={(e) => { if (!disabled && value.trim()) e.currentTarget.style.background = G; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
