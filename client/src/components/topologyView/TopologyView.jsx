import { useEffect, useRef, useMemo } from "react";
import "./topologyView.css";

/**
 * TopologyView — Renders a network topology graph from FastAPI TopologyData.
 *
 * Uses pure SVG with a force-directed-like layout (Dagre-style topological sort).
 * No external graph library needed — keeps bundle small.
 *
 * Props:
 *   topology: { name, nodes: [{node_id, name, node_type, template_name, link_count}], links: [{from_node, to_node, link_type}] }
 */
const NODE_COLORS = {
  router:   "#3b82f6",
  switch:   "#22c55e",
  host:     "#a78bfa",
  firewall: "#ef4444",
  server:   "#f59e0b",
  cloud:    "#06b6d4",
  iou:      "#8b5cf6",
  dynamips: "#ec4899",
  qemu:     "#14b8a6",
  docker:   "#f97316",
  default:  "#64748b",
};

const NODE_ICONS = {
  router: "🔀",
  switch: "🔗",
  host: "🖥️",
  firewall: "🛡️",
  server: "🗄️",
  cloud: "☁️",
  default: "📦",
};

function getNodeColor(nodeType) {
  const key = (nodeType || "").toLowerCase();
  return NODE_COLORS[key] || NODE_COLORS.default;
}

function getNodeIcon(nodeType) {
  const key = (nodeType || "").toLowerCase();
  if (key.includes("router")) return NODE_ICONS.router;
  if (key.includes("switch")) return NODE_ICONS.switch;
  if (key.includes("firewall") || key.includes("asa")) return NODE_ICONS.firewall;
  if (key.includes("host") || key.includes("pc")) return NODE_ICONS.host;
  if (key.includes("server")) return NODE_ICONS.server;
  if (key.includes("cloud") || key.includes("nat")) return NODE_ICONS.cloud;
  return NODE_ICONS.default;
}

/**
 * Simple hierarchical layout: assign layers by BFS from roots,
 * then distribute nodes within each layer.
 */
function layoutNodes(nodes, links) {
  if (!nodes.length) return {};

  const nodeIds = new Set(nodes.map((n) => n.node_id));
  const incoming = {};
  const outgoing = {};

  nodes.forEach((n) => {
    incoming[n.node_id] = [];
    outgoing[n.node_id] = [];
  });

  links.forEach((link) => {
    if (nodeIds.has(link.from_node) && nodeIds.has(link.to_node)) {
      outgoing[link.from_node].push(link.to_node);
      incoming[link.to_node].push(link.from_node);
    }
  });

  // BFS to assign layers
  const layers = {};
  const visited = new Set();
  const queue = [];

  // Start from nodes with no incoming links (roots)
  nodes.forEach((n) => {
    if (incoming[n.node_id].length === 0) {
      layers[n.node_id] = 0;
      queue.push(n.node_id);
    }
  });

  // If no roots, pick the first node
  if (queue.length === 0) {
    layers[nodes[0].node_id] = 0;
    queue.push(nodes[0].node_id);
  }

  while (queue.length > 0) {
    const current = queue.shift();
    visited.add(current);

    for (const child of outgoing[current]) {
      const newLayer = (layers[current] || 0) + 1;
      if (layers[child] === undefined || layers[child] < newLayer) {
        layers[child] = newLayer;
      }
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }

  // Assign unvisited nodes
  nodes.forEach((n) => {
    if (layers[n.node_id] === undefined) {
      layers[n.node_id] = 0;
    }
  });

  // Group by layer
  const layerGroups = {};
  nodes.forEach((n) => {
    const l = layers[n.node_id];
    if (!layerGroups[l]) layerGroups[l] = [];
    layerGroups[l].push(n);
  });

  // Calculate positions
  const NODE_W = 150;
  const NODE_H = 64;
  const LAYER_GAP = 180;
  const NODE_GAP = 30;

  const positions = {};
  const maxLayer = Math.max(...Object.keys(layerGroups).map(Number));

  Object.entries(layerGroups).forEach(([layer, groupNodes]) => {
    const totalWidth = groupNodes.length * NODE_W + (groupNodes.length - 1) * NODE_GAP;
    const startX = -totalWidth / 2;

    groupNodes.forEach((n, i) => {
      positions[n.node_id] = {
        x: startX + i * (NODE_W + NODE_GAP) + NODE_W / 2,
        y: Number(layer) * LAYER_GAP,
      };
    });
  });

  return positions;
}

const TopologyView = ({ topology }) => {
  const containerRef = useRef(null);

  const positions = useMemo(() => {
    if (!topology?.nodes) return {};
    return layoutNodes(topology.nodes, topology.links || []);
  }, [topology]);

  useEffect(() => {
    if (containerRef.current && topology?.nodes?.length) {
      const svg = containerRef.current.querySelector("svg");
      if (svg) {
        // Center the view
        const bbox = svg.getBBox();
        const padding = 80;
        const vb = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`;
        svg.setAttribute("viewBox", vb);
      }
    }
  }, [topology, positions]);

  if (!topology || !topology.nodes || topology.nodes.length === 0) {
    return null;
  }

  const { nodes, links, name, node_count, link_count } = topology;

  // Compute SVG dimensions
  const posValues = Object.values(positions);
  const minX = posValues.length ? Math.min(...posValues.map((p) => p.x)) - 100 : 0;
  const maxX = posValues.length ? Math.max(...posValues.map((p) => p.x)) + 100 : 800;
  const minY = posValues.length ? Math.min(...posValues.map((p) => p.y)) - 80 : 0;
  const maxY = posValues.length ? Math.max(...posValues.map((p) => p.y)) + 80 : 600;

  const nodeMap = {};
  nodes.forEach((n) => { nodeMap[n.node_id] = n; });

  return (
    <div className="sn-topology-view">
      <div className="sn-topology-header">
        <div className="sn-topology-title-row">
          <span className="sn-topology-icon">🌐</span>
          <h3 className="sn-topology-name">{name || "Network Topology"}</h3>
        </div>
        <div className="sn-topology-stats">
          <span className="sn-stat"><strong>{node_count}</strong> nodes</span>
          <span className="sn-stat-sep">•</span>
          <span className="sn-stat"><strong>{link_count}</strong> links</span>
        </div>
      </div>

      <div className="sn-topology-canvas" ref={containerRef}>
        <svg
          width="100%"
          height="100%"
          viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
            </marker>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Links */}
          {links.map((link, i) => {
            const from = positions[link.from_node];
            const to = positions[link.to_node];
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const shorten = 55; // stop short of node center

            const sx = from.x + (dx / dist) * shorten;
            const sy = from.y + (dy / dist) * shorten;
            const ex = to.x - (dx / dist) * shorten;
            const ey = to.y - (dy / dist) * shorten;

            return (
              <line
                key={`link-${i}`}
                x1={sx}
                y1={sy}
                x2={ex}
                y2={ey}
                stroke="#475569"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                opacity="0.7"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions[node.node_id];
            if (!pos) return null;

            const color = getNodeColor(node.node_type);
            const icon = getNodeIcon(node.node_type);

            return (
              <g key={node.node_id} transform={`translate(${pos.x}, ${pos.y})`}>
                {/* Glow effect */}
                <rect
                  x="-68" y="-28"
                  width="136" height="56"
                  rx="14"
                  fill={color}
                  opacity="0.15"
                  filter="url(#nodeShadow)"
                />
                {/* Main node rect */}
                <rect
                  x="-65" y="-25"
                  width="130" height="50"
                  rx="12"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Icon */}
                <text x="-48" y="2" fontSize="16" textAnchor="middle" dominantBaseline="middle">
                  {icon}
                </text>
                {/* Name */}
                <text
                  x="8" y="-4"
                  fontSize="11"
                  fontWeight="600"
                  fill="#f1f5f9"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name}
                </text>
                {/* Type badge */}
                <text
                  x="8" y="12"
                  fontSize="8"
                  fill={color}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight="700"
                  textTransform="uppercase"
                >
                  {node.node_type}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="sn-topology-legend">
        {["router", "switch", "firewall", "host", "server", "cloud"].map((type) => (
          <div key={type} className="sn-legend-item">
            <span className="sn-legend-dot" style={{ background: getNodeColor(type) }} />
            <span className="sn-legend-label">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopologyView;
