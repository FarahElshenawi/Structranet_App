const G = "#166534";
const BD = "#E5E7EB";

/**
 * SummaryPanel — Design review, assumptions, security zones.
 * Walkthrough spec: ✅ Design Review, ⚠️ Assumptions, 🛡️ Security Zones sections.
 */
export default function SummaryPanel({ summary }) {
  if (!summary) return null;

  const hasReview = summary.design_review && summary.design_review.length > 0;
  const hasAssumptions = summary.assumptions && summary.assumptions.length > 0;
  const hasZones = summary.security_zones && Object.keys(summary.security_zones).length > 0;

  if (!hasReview && !hasAssumptions && !hasZones) return null;

  return (
    <div style={{
      border: `1px solid ${BD}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
      background: "white",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* Design Review */}
      {hasReview && (
        <div style={{ padding: "12px 14px", borderBottom: hasAssumptions || hasZones ? `1px solid ${BD}` : "none" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#6B7280",
            letterSpacing: "0.05em", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ✅ Design Review
          </div>
          {summary.design_review.map((item, i) => (
            <div key={i} style={{
              fontSize: 12, color: "#374151", lineHeight: 1.6,
              padding: "4px 0",
            }}>
              {item}
            </div>
          ))}
        </div>
      )}

      {/* Assumptions */}
      {hasAssumptions && (
        <div style={{
          padding: "12px 14px",
          borderBottom: hasZones ? `1px solid ${BD}` : "none",
          background: "#FFFBEB",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: "#92400E",
            letterSpacing: "0.05em", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ⚠️ Assumptions
          </div>
          {summary.assumptions.map((item, i) => (
            <div key={i} style={{
              fontSize: 12, color: "#92400E", lineHeight: 1.6,
              padding: "4px 0",
            }}>
              {item}
            </div>
          ))}
        </div>
      )}

      {/* Security Zones */}
      {hasZones && (
        <div style={{ padding: "12px 14px" }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: G,
            letterSpacing: "0.05em", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            🛡️ Security Zones
          </div>
          {Object.entries(summary.security_zones).map(([zone, devices], i) => (
            <div key={i} style={{
              fontSize: 12, color: "#374151", lineHeight: 1.6,
              padding: "3px 0",
            }}>
              <strong style={{ color: "#111", fontWeight: 600 }}>{zone}:</strong>{" "}
              {Array.isArray(devices) ? devices.join(", ") : devices}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
