import { Icon, PATHS } from "./Icons";

/**
 * Streaming text display — Claude-style inline bold-labeled paragraphs.
 * Replaces the old colored-card approach.
 *
 * Each thought has: { id, type, content, timestamp }
 * Types: understanding, decision, assumption, warning
 */
const TYPE_LABELS = {
  understanding: "Understanding your request",
  decision: "Device selection",
  assumption: "Assumptions",
  warning: "Warning",
};

const TYPE_ICONS = {
  understanding: PATHS.search,
  decision: PATHS.sparkles,
  assumption: PATHS.alert,
  warning: PATHS.alert,
};

export default function ThoughtStream({ thoughts = [] }) {
  if (thoughts.length === 0) return null;

  // Group consecutive thoughts of same type for paragraph flow
  // But render each as its own bold-labeled paragraph
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Streaming text paragraphs */}
      <div
        style={{
          fontSize: 14,
          color: "#374151",
          lineHeight: 1.7,
          marginBottom: 16,
        }}
      >
        {thoughts.map((t, i) => {
          const label = TYPE_LABELS[t.type] || "Analysis";
          const content = t.text || t.content || "";
          const isLast = i === thoughts.length - 1;

          return (
            <span key={t.id || i}>
              <strong style={{ color: "#111", fontWeight: 600 }}>{label}</strong>
              {" -- "}
              {content}
              {isLast ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    background: "#166534",
                    verticalAlign: "text-bottom",
                    marginLeft: 1,
                    animation: "blink 1s step-end infinite",
                  }}
                />
              ) : (
                <>
                  <br />
                  <br />
                </>
              )}
            </span>
          );
        })}
      </div>

      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
