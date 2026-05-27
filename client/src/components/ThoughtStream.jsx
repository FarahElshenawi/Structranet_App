const G = "#166534";

/**
 * ThoughtStream — AI thinking/reasoning display.
 * Shows thoughts with colored dots and labels inline.
 */
const THOUGHT_TYPE = {
  understanding: { label: "Understanding", dot: "#3B82F6" },
  decision:      { label: "Device selection", dot: "#10B981" },
  assumption:    { label: "Assumption", dot: "#F59E0B" },
  warning:       { label: "Warning", dot: "#EF4444" },
  info:          { label: "Info", dot: "#8B5CF6" },
};

export default function ThoughtStream({ thoughts = [], isStreaming }) {
  if (thoughts.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}>
      {thoughts.map((t, i) => {
        const cfg = THOUGHT_TYPE[t.type] || THOUGHT_TYPE.info;
        const isLast = i === thoughts.length - 1;
        return (
          <div key={t.id || i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: cfg.dot, flexShrink: 0, marginTop: 7,
            }}/>
            <span style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
              <strong style={{ color: "#111", fontWeight: 600 }}>{cfg.label}</strong>
              {" — "}
              {t.content || t.text}
            </span>
          </div>
        );
      })}
      {isStreaming && (
        <span style={{
          display: "inline-block", width: 2, height: 14,
          background: G, marginLeft: 14,
          verticalAlign: "text-bottom",
          animation: "tsBlink 1s step-end infinite",
        }}/>
      )}
      <style>{`@keyframes tsBlink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}
