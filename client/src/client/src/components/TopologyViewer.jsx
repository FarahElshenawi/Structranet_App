import { useState, useMemo } from "react";
import { Icon, NetworkIcon, PATHS } from "./Icons";

const BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";
const PRIMARY = "#166534";

function Row({ label, value, mono }) {
  return (
    <div>
      <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 500, letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "#111", fontFamily: mono ? "monospace" : "inherit" }}>{value}</div>
    </div>
  );
}

/**
 * Auto-layout: arrange nodes in a circle or hierarchical grid.
 * Backend sends nodes WITHOUT x/y positions, so we compute them here.
 */
function autoLayout(nodes, links) {
  if (nodes.length === 0) return [];

  // Try to find a hierarchical layout based on node types
  const routers = nodes.filter((n) => n.node_type === "router");
  const switches = nodes.filter((n) => n.node_type === "switch");
  const firewalls = nodes.filter((n) => n.node_type === "firewall");
  const hosts = nodes.filter((n) => n.node_type === "host" || n.node_type === "vpcs");
  const others = nodes.filter(
    (n) => !["router", "switch", "firewall", "host", "vpcs"].includes(n.node_type)
  );

  const result = [];
  const cx = 360;
  const cy = 310;

  // Layer 1: Firewalls at top
  firewalls.forEach((n, i) => {
    const x = cx - (firewalls.length - 1) * 80 + i * 160;
    result.push({ ...n, x, y: 80 });
  });

  // Layer 2: Routers
  routers.forEach((n, i) => {
    const x = cx - (routers.length - 1) * 100 + i * 200;
    result.push({ ...n, x, y: 190 });
  });

  // Layer 3: Switches
  switches.forEach((n, i) => {
    const x = cx - (switches.length - 1) * 80 + i * 160;
    result.push({ ...n, x, y: 320 });
  });

  // Layer 4: Hosts
  hosts.forEach((n, i) => {
    const cols = Math.min(hosts.length, 5);
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = cx - (cols - 1) * 70 + col * 140;
    result.push({ ...n, x, y: 440 + row * 70 });
  });

  // Others: place in a circle
  if (others.length > 0) {
    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
      const radius = Math.min(200, 50 * others.length);
      result.push({ ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    });
  }

  // Fallback: if nothing was placed, use circular layout
  if (result.length === 0) {
    return nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      const radius = Math.min(250, 60 * nodes.length);
      return { ...n, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    });
  }

  return result;
}

export default function TopologyViewer({ topology, onClose }) {
  const [selected, setSelected] = useState(null);

  // Backend uses node_id, node_type, from_node, to_node
  const rawNodes = topology?.nodes || [];
  const links = topology?.links || [];

  // Auto-layout nodes (backend doesn't send x/y)
  const nodes = useMemo(() => autoLayout(rawNodes, links), [rawNodes, links]);

  const selectedNode = nodes.find((n) => n.node_id === selected);

  const getPos = (id) => {
    const n = nodes.find((x) => x.node_id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  const isConnectedToSelected = (fromId, toId) => {
    if (!selected) return false;
    return fromId === selected || toId === selected;
  };

  const nodeAbbr = (type) => ({ router: "R", switch: "SW", host: "PC", vpcs: "PC", firewall: "FW" }[type] || "N");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: BG,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Geist', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "white",
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 20px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <NetworkIcon size={16} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>Topology Schematic</span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            {nodes.length} nodes · {links.length} links
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#6B7280",
            padding: 8,
            display: "flex",
            alignItems: "center",
            borderRadius: 8,
            transition: "background .15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = MUTED)}
          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Icon d={PATHS.minimize} size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          <svg width={720} height={620} style={{ display: "block", background: "#fefefe" }}>
            {/* Grid */}
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#smallGrid)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Links — backend uses from_node / to_node */}
            {links.map((l, i) => {
              const a = getPos(l.from_node);
              const b = getPos(l.to_node);
              const highlighted = isConnectedToSelected(l.from_node, l.to_node);
              return (
                <g key={i}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={highlighted ? "rgba(22,101,52,0.35)" : "rgba(0,0,0,0.18)"}
                    strokeWidth={highlighted ? 2 : 1.2}
                  />
                  {l.link_type && l.link_type !== "ethernet" && (
                    <text
                      x={(a.x + b.x) / 2 + 4}
                      y={(a.y + b.y) / 2 - 4}
                      fontSize="8"
                      fill="rgba(0,0,0,0.35)"
                      fontFamily="monospace"
                    >
                      {l.link_type}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes — backend uses node_id, node_type */}
            {nodes.map((n) => {
              const sel = selected === n.node_id;
              const w = n.node_type === "switch" ? 52 : n.node_type === "host" || n.node_type === "vpcs" ? 38 : n.node_type === "firewall" ? 52 : 56;
              const h = n.node_type === "host" || n.node_type === "vpcs" ? 26 : 34;
              const fill = sel ? "rgba(22,101,52,0.08)" : "rgba(22,101,52,0.03)";
              const stroke = sel ? "rgba(22,101,52,0.6)" : "rgba(22,101,52,0.25)";
              return (
                <g key={n.node_id} onClick={() => setSelected(sel ? null : n.node_id)} style={{ cursor: "pointer" }}>
                  <rect
                    x={n.x - w / 2}
                    y={n.y - h / 2}
                    width={w}
                    height={h}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sel ? 1.5 : 1}
                    style={{ transition: "all .15s" }}
                  />
                  <text
                    x={n.x}
                    y={n.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9"
                    fontWeight="500"
                    fill={sel ? PRIMARY : "#374151"}
                    fontFamily="monospace"
                  >
                    {nodeAbbr(n.node_type)}
                  </text>
                  <text
                    x={n.x}
                    y={n.y + h / 2 + 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill={sel ? PRIMARY : "#6B7280"}
                    fontFamily="monospace"
                  >
                    {n.name}
                  </text>
                </g>
              );
            })}

            {/* Legend */}
            <g transform="translate(14,14)">
              <rect
                width="90"
                height="72"
                rx="4"
                fill="rgba(255,255,255,0.85)"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="0.5"
              />
              <text x="8" y="16" fontSize="8" fill="rgba(0,0,0,0.4)" fontFamily="monospace" fontWeight="600">
                LEGEND
              </text>
              {[
                ["R", "Router", 28],
                ["SW", "Switch", 42],
                ["PC", "Host (VPCS)", 56],
                ["FW", "Firewall", 70],
              ].map(([abbr, label, y]) => (
                <g key={abbr}>
                  <rect
                    x="6"
                    y={y - 8}
                    width="18"
                    height="12"
                    rx="2"
                    fill="rgba(22,101,52,0.05)"
                    stroke="rgba(22,101,52,0.25)"
                    strokeWidth="0.7"
                  />
                  <text
                    x="15"
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="6.5"
                    fill="#374151"
                    fontFamily="monospace"
                  >
                    {abbr}
                  </text>
                  <text x="28" y={y} dominantBaseline="middle" fontSize="8" fill="#6B7280" fontFamily="monospace">
                    {label}
                  </text>
                </g>
              ))}
            </g>

            {/* Title block */}
            <g transform="translate(560,570)">
              <rect
                width="148"
                height="36"
                rx="3"
                fill="rgba(255,255,255,0.85)"
                stroke="rgba(0,0,0,0.08)"
                strokeWidth="0.5"
              />
              <text x="74" y="12" textAnchor="middle" fontSize="6.5" fill="rgba(0,0,0,0.4)" fontFamily="monospace">
                STRUCTRANET AI
              </text>
              <text x="74" y="22" textAnchor="middle" fontSize="6.5" fill="rgba(0,0,0,0.3)" fontFamily="monospace">
                TOPOLOGY SCHEMATIC
              </text>
              <text x="74" y="31" textAnchor="middle" fontSize="6.5" fill="rgba(0,0,0,0.3)" fontFamily="monospace">
                SCALE: N/A · REV: 1.0
              </text>
            </g>
          </svg>
        </div>

        {/* Inspection panel */}
        {selectedNode && (
          <div
            style={{
              width: 224,
              borderLeft: `1px solid ${BORDER}`,
              background: "white",
              overflowY: "auto",
              padding: 16,
              flexShrink: 0,
              animation: "slideInRight .15s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 16, color: "#111" }}>{selectedNode.name}</span>
              <button
                onClick={() => setSelected(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "#9CA3AF",
                  padding: 4,
                  display: "flex",
                }}
              >
                <Icon d={PATHS.x} size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
              <Row label="TYPE" value={(selectedNode.node_type || "").toUpperCase()} />
              <Row label="TEMPLATE" value={selectedNode.template_name || "Built-in"} />
              {selectedNode.link_count !== undefined && (
                <Row label="LINKS" value={`${selectedNode.link_count}`} />
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:none } }`}</style>
    </div>
  );
}
