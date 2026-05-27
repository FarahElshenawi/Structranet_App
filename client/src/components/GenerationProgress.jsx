import NetworkLoader from "./NetworkLoader";

const G = "#166534";
const BD = "#E5E7EB";

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
  sparkles: "M12 3l1.912 5.813L20 11l-6.088 2.187L12 19l-1.912-5.813L4 11l6.088-2.187L12 3z",
  settings: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

/**
 * GenerationProgress — White card with dark code block streaming JSON topology.
 * Shows: header with icon + title, NetworkLoader, dark code block with streaming text + blinking cursor.
 */
export default function GenerationProgress({ title, icon, streamingText, isStreaming }) {
  const headerTitle = title || "Generating Topology";
  const iconPath = icon || IC.sparkles;

  return (
    <div style={{
      border: `1px solid ${BD}`,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
      background: "white",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: `1px solid ${BD}`,
        background: "#FAFAFA",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: "#F0FDF4",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: G, flexShrink: 0,
        }}>
          <Ic d={iconPath} size={14}/>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{headerTitle}</span>
        {isStreaming && <NetworkLoader size={20}/>}
      </div>

      {/* Dark code block */}
      <div style={{
        background: "#1E1E1E",
        padding: "14px",
        fontFamily: "'Courier New', 'Geist Mono', monospace",
        fontSize: 12,
        color: "#9CDCFE",
        lineHeight: 1.65,
        maxHeight: 120,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {streamingText || ""}
        {isStreaming && (
          <span style={{
            display: "inline-block",
            width: 2,
            height: 14,
            background: G,
            verticalAlign: "text-bottom",
            marginLeft: 1,
            animation: "gpBlink 1s step-end infinite",
          }}/>
        )}
      </div>

      <style>{`@keyframes gpBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
