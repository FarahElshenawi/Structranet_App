import { Icon, PATHS } from "./Icons";

const PRIMARY = "#166534";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

// Backend sends: { thinking_text, thoughts: [...], design_review: [...], assumptions: [...] }
export default function SummaryPanel({ summary }) {
  if (!summary) return null;

  const hasReview = summary.design_review && summary.design_review.length > 0;
  const hasAssumptions = summary.assumptions && summary.assumptions.length > 0;

  return (
    <div
      style={{
        fontFamily: "'Geist', system-ui, sans-serif",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "white",
          padding: "12px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon d={PATHS.sparkles} size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>AI Design Review</span>
      </div>

      {/* Design Review */}
      {hasReview && (
        <div style={{ background: "white", padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", marginBottom: 8 }}>
            DESIGN REVIEW
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.design_review.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  background: "#F0FDF4",
                  borderRadius: 6,
                  border: "1px solid #BBF7D0",
                }}
              >
                <Icon d={PATHS.check} size={12} style={{ color: PRIMARY, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {hasAssumptions && (
        <div style={{ background: "white", padding: "12px 16px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", marginBottom: 8 }}>
            ASSUMPTIONS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {summary.assumptions.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  background: "#FFFBEB",
                  borderRadius: 6,
                  border: "1px solid #FDE68A",
                }}
              >
                <Icon d={PATHS.alert} size={12} style={{ color: "#D97706", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: "#92400E", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
