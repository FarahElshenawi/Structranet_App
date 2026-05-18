import { useMemo } from "react";

// ── Color scheme from reference design §3.4 ───────────────────────────────────
// FIX: maps GNS3 node_type strings (what backend actually sends)
// to visual config. Original code used "router"/"switch" which never matched.
const NODE_COLORS = {
  // Routers / L3
  dynamips:   { fill: "rgba(22,101,52,0.10)",   stroke: "rgba(22,101,52,0.55)",   text: "#166534",  abbr: "R"   },
  iou:        { fill: "rgba(22,101,52,0.10)",   stroke: "rgba(22,101,52,0.55)",   text: "#166534",  abbr: "IOU" },
  qemu:       { fill: "rgba(22,101,52,0.10)",   stroke: "rgba(22,101,52,0.55)",   text: "#166534",  abbr: "VM"  },
  // Firewalls (qemu with specific template names — handled in getColor())
  // Switches
  ethernet_switch: { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "SW"  },
  ethernet_hub:    { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "HUB" },
  frame_relay_switch: { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "FR" },
  atm_switch:      { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8", abbr: "ATM" },
  // Hosts
  vpcs:    { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "PC"  },
  traceng: { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "TR"  },
  cloud:   { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "CLO" },
  nat:     { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "NAT" },
  // Docker
  docker:      { fill: "rgba(99,102,241,0.08)",  stroke: "rgba(99,102,241,0.45)",  text: "#4338CA", abbr: "DK"  },
  virtualbox:  { fill: "rgba(99,102,241,0.08)",  stroke: "rgba(99,102,241,0.45)",  text: "#4338CA", abbr: "VB"  },
  vmware:      { fill: "rgba(99,102,241,0.08)",  stroke: "rgba(99,102,241,0.45)",  text: "#4338CA", abbr: "VMW" },
};

const FIREWALL_COLORS = {
  fill: "rgba(234,88,12,0.08)", stroke: "rgba(234,88,12,0.45)", text: "#C2410C", abbr: "FW",
};

const DEFAULT_COLORS = {
  fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151", abbr: "N",
};

function getNodeConfig(node) {
  const nt  = node.node_type || "";
  const tmpl = (node.template_name || "").toLowerCase();

  // Detect firewalls: qemu with firewall-like template name
  if (nt === "qemu" && (tmpl.includes("pfsense") || tmpl.includes("firewall") || tmpl.includes("fortinet") || tmpl.includes("asa"))) {
    return FIREWALL_COLORS;
  }
  return NODE_COLORS[nt] || DEFAULT_COLORS;
}

// ── Tier for layout (higher tier = outer ring) ────────────────────────────────
function getTier(node) {
  const nt = node.node_type || "";
  if (nt === "cloud" || nt === "nat") return 1;
  if (["dynamips", "iou", "qemu", "vmware", "virtualbox"].includes(nt)) return 2;
  if (nt.includes("switch") || nt.includes("hub")) return 3;
  if (nt === "docker") return 3;
  return 4; // vpcs, traceng, hosts
}

// ── Layout: concentric rings by tier ─────────────────────────────────────────
function computeMiniLayout(nodes, W, H) {
  if (!nodes.length) return {};
  const cx = W / 2;
  const cy = H / 2;
  const maxR = Math.min(W, H) * 0.42;

  const tiers = {};
  nodes.forEach((n) => {
    const t = getTier(n);
    if (!tiers[t]) tiers[t] = [];
    tiers[t].push(n);
  });

  const RING_R = { 1: 0.28, 2: 0.52, 3: 0.75, 4: 0.95 };
  const positions = {};

  Object.entries(tiers).forEach(([tier, group]) => {
    const r = maxR * (RING_R[tier] || 0.8);
    group.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(group.length, 1) - Math.PI / 2;
      // FIX: use index-based fallback key to prevent stacking when node_id is duplicate/missing
      const key = n.node_id || `_node_${i}`;
      positions[key] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  });

  return positions;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MiniTopologyPreview({ topology, requirements, onClick }) {
  const W = 340;
  const H = 200;

  const nodes = topology?.nodes || [];
  const links = topology?.links || [];

  // FIX: build position map using index fallback for duplicate/empty node_ids
  const positions = useMemo(() => computeMiniLayout(nodes, W, H), [nodes]);

  function getPos(nodeId, fallbackIdx) {
    return positions[nodeId] || positions[`_node_${fallbackIdx}`] || { x: W / 2, y: H / 2 };
  }

  // Build a node_id → index map for fallback lookups
  const nodeIndexMap = useMemo(() => {
    const m = {};
    nodes.forEach((n, i) => { m[n.node_id] = i; });
    return m;
  }, [nodes]);

  if (!nodes.length) return null;

  return (
    <button
      onClick={onClick}
      title="Click to open full topology viewer"
      style={{
        display: "block",
        width: "100%",
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: 0,
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = "#166534";
        e.currentTarget.style.boxShadow = "0 2px 12px rgba(22,101,52,0.1)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Mini header */}
      <div style={{
        padding: "7px 12px",
        borderBottom: "1px solid #F3F4F6",
        display: "flex", alignItems: "center", gap: 7,
        background: "#FAFAFA",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="2" width="6" height="4" rx="1"/>
          <rect x="9" y="18" width="6" height="4" rx="1"/>
          <rect x="2" y="10" width="6" height="4" rx="1"/>
          <rect x="16" y="10" width="6" height="4" rx="1"/>
          <line x1="12" y1="6" x2="12" y2="10"/>
          <line x1="12" y1="14" x2="12" y2="18"/>
          <line x1="8" y1="12" x2="5" y2="12"/>
          <line x1="19" y1="12" x2="16" y2="12"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
          {topology?.name || "Network Topology"}
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: "auto" }}>
          {nodes.length}N · {links.length}L · Click to expand
        </span>
      </div>

      {/* SVG */}
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", background: "#FAFAFA" }}
      >
        {/* Grid dots */}
        <defs>
          <pattern id="minigrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.5" fill="rgba(0,0,0,0.07)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#minigrid)"/>

        {/* Links */}
        {links.map((l, i) => {
          const aIdx = nodeIndexMap[l.from_node] ?? -1;
          const bIdx = nodeIndexMap[l.to_node]   ?? -1;
          const a = getPos(l.from_node, aIdx);
          const b = getPos(l.to_node,   bIdx);
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={l.link_type === "serial" ? "rgba(245,158,11,0.4)" : "rgba(0,0,0,0.1)"}
              strokeWidth="1"
              strokeDasharray={l.link_type === "serial" ? "3 2" : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const pos = getPos(n.node_id, i);
          const cfg = getNodeConfig(n);
          const W2 = 30, H2 = 17;
          return (
            <g key={n.node_id || i}>
              <rect
                x={pos.x - W2 / 2} y={pos.y - H2 / 2}
                width={W2} height={H2} rx={3}
                fill={cfg.fill}
                stroke={cfg.stroke}
                strokeWidth="0.8"
              />
              <text
                x={pos.x} y={pos.y + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="7" fontWeight="700"
                fill={cfg.text}
                fontFamily="monospace"
              >
                {cfg.abbr}
              </text>
              <text
                x={pos.x} y={pos.y + H2 / 2 + 7}
                textAnchor="middle"
                fontSize="7"
                fill="rgba(0,0,0,0.45)"
                fontFamily="system-ui"
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>
    </button>
  );
}
