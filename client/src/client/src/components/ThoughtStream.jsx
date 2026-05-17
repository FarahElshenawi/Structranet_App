import { Icon, PATHS } from "./Icons";

const TYPE_STYLES = {
  understanding: { color: "#2563EB", bg: "#EFF6FF", icon: PATHS.search, label: "Understanding" },
  decision: { color: "#166534", bg: "#F0FDF4", icon: PATHS.check, label: "Decision" },
  assumption: { color: "#D97706", bg: "#FFFBEB", icon: PATHS.alert, label: "Assumption" },
  info: { color: "#6B7280", bg: "#F9FAFB", icon: PATHS.settings, label: "Info" },
};

export default function ThoughtStream({ thoughts = [] }) {
  if (thoughts.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: "'Geist', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon d={PATHS.sparkles} size={14} style={{ color: "#166534" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", letterSpacing: "0.03em" }}>
          AI REASONING
        </span>
      </div>

      {thoughts.map((t, i) => {
        const style = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 8,
              background: style.bg,
              border: `1px solid ${style.color}15`,
              animation: "fadeInUp .2s ease-out",
            }}
          >
            <Icon d={style.icon} size={14} style={{ color: style.color, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: style.color,
                  letterSpacing: "0.05em",
                  marginBottom: 3,
                  textTransform: "uppercase",
                }}
              >
                {style.label}
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{t.text || t.content}</div>
            </div>
          </div>
        );
      })}

      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}
