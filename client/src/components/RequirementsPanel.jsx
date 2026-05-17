const BORDER  = "rgba(255,255,255,0.07)";
const SURFACE = "#111";

const STATUS_CFG = {
  ok:      { color: "#10B981", label: "Installed",  icon: "✓" },
  builtin: { color: "#6B7280", label: "Built-in",   icon: "○" },
  missing: { color: "#EF4444", label: "Missing",    icon: "✗" },
};

const CAT_COLOR = {
  dynamips: "#3B82F6",
  iou:      "#3B82F6",
  qemu:     "#8B5CF6",
  docker:   "#8B5CF6",
  builtin:  "#6B7280",
};

export default function RequirementsPanel({ requirements = [] }) {
  if (!requirements.length) return null;

  const missingCount = requirements.filter((r) => r.status === "missing").length;

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      background: "#0D0D0D",
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "11px 16px",
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", gap: 10,
        background: SURFACE,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
          Requirements Manifest
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10, fontFamily: "monospace",
          color: missingCount > 0 ? "#EF4444" : "#10B981",
          background: missingCount > 0 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
          border: `1px solid ${missingCount > 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}`,
          padding: "2px 8px", borderRadius: 4,
        }}>
          {missingCount > 0 ? `${missingCount} missing` : `${requirements.length} OK`}
        </span>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.02)" }}>
            {["Cat", "Appliance", "Image / File", "Status", "ID"].map((h) => (
              <th key={h} style={{
                padding: "7px 12px", textAlign: "left",
                fontWeight: 700, color: "rgba(255,255,255,0.25)",
                fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
                fontFamily: "monospace",
                borderBottom: `1px solid ${BORDER}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requirements.map((req, i) => {
            const scfg = STATUS_CFG[req.status] || STATUS_CFG.missing;
            const catColor = CAT_COLOR[req.category] || "#6B7280";
            return (
              <tr key={i} style={{
                borderBottom: i < requirements.length - 1 ? `1px solid ${BORDER}` : "none",
                transition: "background .1s",
              }}
                onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseOut={(e)  => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                    color: catColor,
                    background: `${catColor}15`,
                    border: `1px solid ${catColor}30`,
                    padding: "2px 6px", borderRadius: 3,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {req.category}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                  {req.name}
                </td>
                <td style={{
                  padding: "9px 12px",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "monospace", fontSize: 10.5,
                  maxWidth: 180, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {req.image_file || <span style={{ color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>built-in</span>}
                </td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 10.5, fontWeight: 600, color: scfg.color,
                    fontFamily: "monospace",
                  }}>
                    <span style={{ fontSize: 12 }}>{scfg.icon}</span>
                    {scfg.label}
                  </span>
                </td>
                <td style={{ padding: "9px 12px" }}>
                  <span style={{
                    fontSize: 10, fontFamily: "monospace",
                    color: "rgba(255,255,255,0.3)",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${BORDER}`,
                    padding: "2px 6px", borderRadius: 4,
                  }}>
                    {req.node_id}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
