import { useState, useMemo } from "react";

const G = "#166534";
const BD = "#E5E7EB";
const MT = "#F3F4F6";

/**
 * RequirementsPanel — Appliance requirements with status dots, image filenames.
 * Walkthrough spec: white card, each device shows status dot + template name + count + category,
 * image filename in green monospace box or red "Image not configured" box.
 */
export default function RequirementsPanel({ requirements = [] }) {
  if (!requirements.length) return null;

  const missing = requirements.filter((r) => r.status === "missing").length;
  const totalDevices = requirements.reduce((sum, r) => sum + (r.count || 1), 0);

  // Group by template_name
  const grouped = useMemo(() => {
    const map = {};
    for (const r of requirements) {
      const key = r.name || r.template_name || "Unknown";
      if (!map[key]) {
        map[key] = { ...r, count: 0, nodeNames: [] };
      }
      map[key].count += (r.count || 1);
      if (r.node_id) map[key].nodeNames.push(r.node_id);
    }
    return Object.values(map);
  }, [requirements]);

  return (
    <div style={{
      border: `1px solid ${BD}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
      background: "white",
      fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${BD}`,
        background: "#FAFAFA",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 13 }}>📦</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#111" }}>
          Appliance Requirements
        </span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          — {totalDevices} devices
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          fontFamily: "monospace",
          color: missing > 0 ? "#DC2626" : G,
          background: missing > 0 ? "#FEF2F2" : "#F0FDF4",
          border: `1px solid ${missing > 0 ? "#FECACA" : "#BBF7D0"}`,
          padding: "1px 7px",
          borderRadius: 4,
        }}>
          {missing > 0 ? `${missing} missing` : "All OK"}
        </span>
      </div>

      {/* Device list */}
      <div style={{ padding: "10px 14px" }}>
        {grouped.map((r, i) => {
          const isOk = r.status === "ok";
          const isMissing = r.status === "missing";
          const isBuiltin = !r.image_required;
          const category = (r.category || "").toUpperCase();

          return (
            <div key={i} style={{
              padding: "8px 0",
              borderBottom: i < grouped.length - 1 ? `1px solid ${MT}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {/* Status dot */}
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: isOk ? "#22C55E" : isMissing ? "#EF4444" : "#9CA3AF",
                }}/>

                {/* Template name */}
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{r.name}</span>

                {/* Count */}
                <span style={{ fontSize: 11, color: "#6B7280" }}>x{r.count}</span>

                {/* Category */}
                <span style={{
                  fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                  color: "#6B7280",
                  background: MT,
                  padding: "1px 6px",
                  borderRadius: 3,
                  letterSpacing: "0.04em",
                }}>
                  {category}
                </span>
              </div>

              {/* Node names */}
              {r.nodeNames?.length > 0 && (
                <div style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 15, marginBottom: 4 }}>
                  {r.nodeNames.join(", ")}
                </div>
              )}

              {/* Image filename / status */}
              <div style={{ marginLeft: 15 }}>
                {isBuiltin ? (
                  <span style={{
                    fontSize: 11, color: "#6B7280", fontStyle: "italic",
                  }}>
                    Built-in — no image required
                  </span>
                ) : r.image_file ? (
                  <div style={{
                    fontSize: 11, fontFamily: "monospace",
                    color: G,
                    background: "rgba(22,101,52,0.06)",
                    border: "1px solid rgba(22,101,52,0.15)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    display: "inline-block",
                    wordBreak: "break-all",
                  }}>
                    {r.image_file}
                    <span style={{ fontSize: 10, color: "#9CA3AF", display: "block", marginTop: 2 }}>
                      Source: Profile / Appliance defaults
                    </span>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 11, fontFamily: "monospace",
                    color: "#DC2626",
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    padding: "3px 8px",
                    borderRadius: 4,
                    display: "inline-block",
                  }}>
                    Image not configured — set in profile
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
