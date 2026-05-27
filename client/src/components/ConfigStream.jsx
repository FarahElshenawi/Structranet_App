import NetworkLoader from "./NetworkLoader";

const G = "#166534";
const BD = "#E5E7EB";

/**
 * ConfigStream — Dark code block streaming Cisco IOS configs.
 * Shows: header with settings icon + "Generating Device Configs" + NetworkLoader,
 * dark code block with streaming config text + blinking cursor.
 */
export default function ConfigStream({ configTexts, isStreaming, activeDevice }) {
  const deviceNames = Object.keys(configTexts);
  if (deviceNames.length === 0) return null;

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
        <span style={{ fontSize: 16, lineHeight: 1 }}>⚙️</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Generating Device Configs</span>
        {isStreaming && <NetworkLoader size={20}/>}
      </div>

      {/* Dark code block — all configs in one block */}
      <div style={{
        background: "#1E1E1E",
        padding: "14px",
        fontFamily: "'Courier New', 'Geist Mono', monospace",
        fontSize: 12,
        color: "#9CDCFE",
        lineHeight: 1.65,
        maxHeight: 260,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {deviceNames.map((name, i) => (
          <span key={name}>
            {i > 0 && "\n\n"}
            {!name.startsWith("!") && `! ${name} Configuration\n!\n`}
            {configTexts[name]}
          </span>
        ))}
        {isStreaming && (
          <span style={{
            display: "inline-block",
            width: 2,
            height: 14,
            background: G,
            verticalAlign: "text-bottom",
            marginLeft: 1,
            animation: "csBlink 1s step-end infinite",
          }}/>
        )}
      </div>

      <style>{`@keyframes csBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
