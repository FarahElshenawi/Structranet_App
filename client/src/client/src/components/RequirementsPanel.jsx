import { Icon, PATHS } from "./Icons";

const PRIMARY = "#166534";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";

// Backend sends: { node_id, name, node_type, template_name, category, image_required, image_file, status }
// status is: "ok" | "missing" | "builtin"
export default function RequirementsPanel({ requirements = [] }) {
  if (requirements.length === 0) return null;

  return (
    <div
      style={{
        fontFamily: "'Geist', system-ui, sans-serif",
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
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
        <Icon d={PATHS.shield} size={14} style={{ color: PRIMARY }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>Requirements Manifest</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: MUTED }}>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              CATEGORY
            </th>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              APPLIANCE
            </th>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              IMAGE
            </th>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              STATUS
            </th>
            <th
              style={{
                padding: "8px 14px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6B7280",
                fontSize: 10,
                letterSpacing: "0.05em",
              }}
            >
              NODE ID
            </th>
          </tr>
        </thead>
        <tbody>
          {requirements.map((req, i) => (
            <tr
              key={i}
              style={{ borderBottom: i < requirements.length - 1 ? `1px solid ${BORDER}` : "none" }}
            >
              <td style={{ padding: "10px 14px", color: "#374151", fontFamily: "monospace", fontSize: 11 }}>
                {req.category}
              </td>
              <td style={{ padding: "10px 14px", color: "#111", fontWeight: 500 }}>{req.name}</td>
              <td
                style={{
                  padding: "10px 14px",
                  color: "#6B7280",
                  fontFamily: "monospace",
                  fontSize: 10,
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {req.image_file || "Built-in"}
              </td>
              <td style={{ padding: "10px 14px" }}>
                {req.status === "ok" || req.status === "builtin" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: PRIMARY,
                      fontWeight: 500,
                    }}
                  >
                    <Icon d={PATHS.check} size={12} />
                    {req.status === "builtin" ? "Built-in" : "Installed"}
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: "#DC2626",
                      fontWeight: 500,
                    }}
                  >
                    <Icon d={PATHS.alert} size={12} /> Missing
                  </span>
                )}
              </td>
              <td style={{ padding: "10px 14px" }}>
                <span
                  style={{
                    background: MUTED,
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#374151",
                  }}
                >
                  {req.node_id}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
