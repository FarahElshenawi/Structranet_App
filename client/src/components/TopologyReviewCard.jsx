import MiniTopologyPreview from "./MiniTopologyPreview";

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
  expand: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
};

const SECURITY_BADGES = {
  none: { label: "None", emoji: "📄" },
  basic: { label: "Basic", emoji: "🔒" },
  enterprise: { label: "Enterprise", emoji: "🛡️" },
};

/**
 * TopologyReviewCard — inline topology review card with mini SVG preview.
 * Shows: header with node/link count + security badge + Expand button, mini SVG, requirements/summary below.
 */
export default function TopologyReviewCard({
  topology,
  requirements,
  summary,
  securityProfile,
  isBaseline,
  onExpand,
}) {
  const nodes = topology?.nodes || [];
  const links = topology?.links || [];
  const badge = SECURITY_BADGES[securityProfile] || SECURITY_BADGES.none;
  const title = isBaseline ? "Baseline Network" : "Topology Ready";

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
        background: "#F0FDF4",
        borderBottom: `1px solid #BBF7D0`,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        <Ic d={IC.expand} size={14} color={G}/>
        <span style={{ fontSize: 13, fontWeight: 600, color: G }}>{title}</span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {nodes.length} nodes / {links.length} links
        </span>
        {!isBaseline && securityProfile && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 4,
            padding: "2px 8px",
            color: G,
          }}>
            {badge.emoji} {badge.label}
          </span>
        )}
        <button
          onClick={onExpand}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "1px solid #BBF7D0",
            borderRadius: 6,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: G,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Ic d={IC.expand} size={11}/> Expand
        </button>
      </div>

      {/* Mini SVG preview */}
      <div style={{ padding: "8px 12px", background: "white" }}>
        <MiniTopologyPreview
          topology={topology}
          requirements={requirements}
          onClick={onExpand}
        />
      </div>
    </div>
  );
}
