import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Icon, NetworkIcon, PATHS } from "./Icons";

const BG = "#F9FAFB";
const BORDER = "#E5E7EB";
const MUTED = "#F3F4F6";
const PRIMARY = "#166534";

/**
 * Map backend node_type (dynamips, vpcs, ethernet_switch, etc.)
 * to a display category used by the layout algorithm.
 */
function displayType(node) {
  const nt = node.node_type || "";
  const tmpl = (node.template_name || "").toLowerCase();

  // QEMU-based firewalls
  if (nt === "qemu" && (tmpl.includes("pfsense") || tmpl.includes("firewall") || tmpl.includes("fortinet"))) {
    return "firewall";
  }
  // Dynamips / IOU / QEMU routers
  if (["dynamips", "iou"].includes(nt)) return "router";
  if (nt === "qemu") return "router";

  // Ethernet switches / hubs
  if (["ethernet_switch", "ethernet_hub"].includes(nt)) return "switch";

  // Docker containers
  if (nt === "docker") return "docker";

  // VPCS / host-like nodes
  if (["vpcs", "traceng", "cloud", "nat"].includes(nt)) return "host";

  // Frame relay / ATM — treat as switch-like
  if (["frame_relay_switch", "atm_switch"].includes(nt)) return "switch";

  return "host";
}

/**
 * Force-directed layout algorithm.
 *
 * 1. Initial placement: radial by type (routers center, hosts outer)
 * 2. Iterative repulsion to prevent overlaps
 * 3. Link attraction to keep connected nodes reasonably close
 *
 * This avoids the "all devices stacked on top of each other" bug
 * that occurred with the simple radial layout when node_ids
 * were missing or multiple nodes mapped to the same ring position.
 */
function computeLayout(nodes, links, viewW, viewH) {
  if (!nodes || nodes.length === 0) return {};

  const cx = viewW / 2;
  const cy = viewH / 2;
  const maxR = Math.min(viewW, viewH) * 0.38;
  const MIN_DIST = 100; // minimum distance between node centers

  // ── Step 1: Initial radial placement by display type ──
  const RING_FRACTIONS = { router: 0.3, firewall: 0.5, switch: 0.7, docker: 0.82, host: 0.92 };

  const groups = {};
  const nodeTypes = {};
  for (const n of nodes) {
    const t = displayType(n);
    nodeTypes[n.node_id] = t;
    if (!groups[t]) groups[t] = [];
    groups[t].push(n);
  }

  // Build initial positions
  const positions = {};
  const typeOrder = ["router", "firewall", "switch", "docker", "host"];
  for (const type of typeOrder) {
    const group = groups[type] || [];
    const radius = maxR * (RING_FRACTIONS[type] || 0.9);
    const count = group.length;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
      const nodeId = group[i].node_id;
      // Add slight jitter to prevent exact overlap if node_ids are duplicated
      const jitter = count === 1 ? 0 : (Math.random() - 0.5) * 4;
      positions[nodeId] = {
        x: cx + radius * Math.cos(angle) + jitter,
        y: cy + radius * Math.sin(angle) + jitter,
      };
    }
  }

  // ── Handle duplicate/missing node_ids ──
  // If multiple nodes share the same node_id, offset them
  const idCounts = {};
  for (const n of nodes) {
    const id = n.node_id || "";
    if (!idCounts[id]) idCounts[id] = 0;
    idCounts[id]++;
    if (idCounts[id] > 1) {
      // Duplicate id — offset from the shared position
      const base = positions[id] || { x: cx, y: cy };
      const offset = idCounts[id] * 60;
      positions[`${id}_${idCounts[id]}`] = { x: base.x + offset, y: base.y + offset };
    }
  }

  // ── Step 2: Build link adjacency for attraction ──
  const adjacency = {};
  for (const n of nodes) {
    adjacency[n.node_id] = [];
  }
  for (const link of links) {
    const a = link.from_node;
    const b = link.to_node;
    if (adjacency[a]) adjacency[a].push(b);
    if (adjacency[b]) adjacency[b].push(a);
  }

  // ── Step 3: Iterative force-directed refinement ──
  const ITERATIONS = 80;
  const REPULSION = 8000;   // repulsion strength
  const ATTRACTION = 0.005; // link attraction strength
  const DAMPING = 0.85;     // velocity damping per iteration

  // Initialize velocities
  const velocities = {};
  for (const n of nodes) {
    velocities[n.node_id] = { vx: 0, vy: 0 };
  }

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = {};
    for (const n of nodes) {
      forces[n.node_id] = { fx: 0, fy: 0 };
    }

    // Repulsion: every node pair pushes apart
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const pa = positions[a.node_id] || { x: cx, y: cy };
        const pb = positions[b.node_id] || { x: cx, y: cy };
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1; // avoid division by zero

        // Enforce minimum distance more aggressively
        const minD = Math.max(MIN_DIST, 80);
        if (dist < minD) {
          const pushStrength = REPULSION * (minD - dist) / dist;
          forces[a.node_id].fx += dx * pushStrength * 0.01;
          forces[a.node_id].fy += dy * pushStrength * 0.01;
          forces[b.node_id].fx -= dx * pushStrength * 0.01;
          forces[b.node_id].fy -= dy * pushStrength * 0.01;
        }

        // General repulsion (coulomb-like)
        const repForce = REPULSION / (dist * dist);
        const ux = dx / dist;
        const uy = dy / dist;
        forces[a.node_id].fx += ux * repForce;
        forces[a.node_id].fy += uy * repForce;
        forces[b.node_id].fx -= ux * repForce;
        forces[b.node_id].fy -= uy * repForce;
      }
    }

    // Attraction: connected nodes pull toward each other
    for (const link of links) {
      const a = link.from_node;
      const b = link.to_node;
      const pa = positions[a] || { x: cx, y: cy };
      const pb = positions[b] || { x: cx, y: cy };
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Spring-like: stronger pull if far apart
      const idealDist = 180;
      const attrForce = ATTRACTION * (dist - idealDist);
      const ux = dx / dist;
      const uy = dy / dist;
      if (forces[a]) { forces[a].fx += ux * attrForce; forces[a].fy += uy * attrForce; }
      if (forces[b]) { forces[b].fx -= ux * attrForce; forces[b].fy -= uy * attrForce; }
    }

    // Apply forces with damping
    const maxForce = 50; // cap force to prevent explosions
    for (const n of nodes) {
      const id = n.node_id;
      if (!positions[id]) continue;
      const f = forces[id];
      if (!f) continue;

      // Clamp force
      f.fx = Math.max(-maxForce, Math.min(maxForce, f.fx));
      f.fy = Math.max(-maxForce, Math.min(maxForce, f.fy));

      velocities[id].vx = (velocities[id].vx + f.fx) * DAMPING;
      velocities[id].vy = (velocities[id].vy + f.fy) * DAMPING;

      positions[id].x += velocities[id].vx;
      positions[id].y += velocities[id].vy;

      // Keep within viewBox bounds (with padding)
      const pad = 60;
      positions[id].x = Math.max(pad, Math.min(viewW - pad, positions[id].x));
      positions[id].y = Math.max(pad, Math.min(viewH - pad, positions[id].y));
    }
  }

  return positions;
}

// Node type → icon abbreviation
const nodeAbbr = (node) => {
  const t = displayType(node);
  return ({ router: "R", switch: "SW", host: "PC", firewall: "FW", docker: "DK" }[t] || "N");
};

// Node type → fill colors
const nodeColors = {
  router:  { fill: "rgba(22,101,52,0.10)", stroke: "rgba(22,101,52,0.55)", text: "#166534" },
  switch:  { fill: "rgba(59,130,246,0.08)", stroke: "rgba(59,130,246,0.45)", text: "#1D4ED8" },
  host:    { fill: "rgba(107,114,128,0.07)", stroke: "rgba(107,114,128,0.35)", text: "#374151" },
  firewall:{ fill: "rgba(234,88,12,0.08)", stroke: "rgba(234,88,12,0.45)", text: "#C2410C" },
  docker:  { fill: "rgba(99,102,241,0.08)", stroke: "rgba(99,102,241,0.45)", text: "#4338CA" },
};

export default function TopologyViewer({ topology, requirements, onClose }) {
  const [selected, setSelected] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // ViewBox dimensions (internal coordinate system)
  const VB_W = 1200;
  const VB_H = 800;

  const nodes = topology?.nodes || [];
  const links = topology?.links || [];

  // Compute force-directed layout positions
  const positions = useMemo(() => computeLayout(nodes, links, VB_W, VB_H), [nodes, links]);

  const getPos = (id) => positions[id] || { x: VB_W / 2, y: VB_H / 2 };

  // Build a requirements lookup by node_id for image info
  const reqByNodeId = useMemo(() => {
    const map = {};
    if (requirements && Array.isArray(requirements)) {
      for (const r of requirements) {
        if (r.node_id) map[r.node_id] = r;
      }
    }
    return map;
  }, [requirements]);

  // Find the selected node
  const selectedNode = selected ? nodes.find((n) => n.node_id === selected) : null;

  // Find the requirements entry for the selected node
  const selectedReq = selectedNode ? reqByNodeId[selectedNode.node_id] : null;

  // Find connections for selected node
  const selectedConnections = selectedNode
    ? links
        .filter((l) => l.from_node === selected || l.to_node === selected)
        .map((l) => {
          const otherId = l.from_node === selected ? l.to_node : l.from_node;
          const other = nodes.find((n) => n.node_id === otherId);
          return other ? other.name : otherId;
        })
    : [];

  const isConnectedToSelected = (fromId, toId) => {
    if (!selected) return false;
    return fromId === selected || toId === selected;
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.max(0.4, Math.min(3, z + delta)));
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handlePanMove = useCallback((e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Attach wheel listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Node dimensions based on display type
  const nodeDims = (node) => {
    switch (displayType(node)) {
      case "router":   return { w: 90, h: 48 };
      case "switch":   return { w: 80, h: 44 };
      case "firewall": return { w: 90, h: 48 };
      case "docker":   return { w: 80, h: 44 };
      default:         return { w: 68, h: 38 };
    }
  };

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
      {/* ── Header Bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "white",
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <NetworkIcon size={18} />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>
              Network Topology Schematic
            </span>
            <span style={{ fontSize: 14, color: "#6B7280", marginLeft: 12 }}>
              {nodes.length} nodes / {links.length} links
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Close / Minimize button */}
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${BORDER}`,
              background: "white",
              cursor: "pointer",
              color: "#6B7280",
              padding: 8,
              display: "flex",
              alignItems: "center",
              borderRadius: 8,
              transition: "all .15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = MUTED;
              e.currentTarget.style.color = "#111";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "white";
              e.currentTarget.style.color = "#6B7280";
            }}
          >
            <Icon d={PATHS.minimize} size={18} />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SVG Canvas — fills available space */}
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: "hidden", position: "relative", background: "#FAFAFA" }}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform .15s ease-out",
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "block", background: "#FAFAFA" }}
            >
              {/* Grid pattern */}
              <defs>
                <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,0,0,0.03)" strokeWidth="0.5" />
                </pattern>
                <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#smallGrid)" />
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
                </pattern>
                {/* Selection glow filter */}
                <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feFlood floodColor="#166534" floodOpacity="0.3" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="shadow" />
                  <feMerge>
                    <feMergeNode in="shadow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* ── Links ──────────────────────────────────────────────────────── */}
              {links.map((l, i) => {
                const a = getPos(l.from_node);
                const b = getPos(l.to_node);
                const highlighted = isConnectedToSelected(l.from_node, l.to_node);
                return (
                  <g key={`link-${i}`}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={highlighted ? "rgba(22,101,52,0.45)" : "rgba(0,0,0,0.15)"}
                      strokeWidth={highlighted ? 2.5 : 1.5}
                      strokeDasharray={l.link_type && l.link_type !== "ethernet" ? "6 3" : "none"}
                    />
                    {l.link_type && l.link_type !== "ethernet" && (
                      <text
                        x={(a.x + b.x) / 2 + 6}
                        y={(a.y + b.y) / 2 - 6}
                        fontSize="11"
                        fill="rgba(0,0,0,0.35)"
                        fontFamily="monospace"
                      >
                        {l.link_type}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Nodes ──────────────────────────────────────────────────────── */}
              {nodes.map((n) => {
                const pos = getPos(n.node_id);
                const sel = selected === n.node_id;
                const dt = displayType(n);
                const dims = nodeDims(n);
                const colors = nodeColors[dt] || nodeColors.host;
                const req = reqByNodeId[n.node_id];
                const hasImage = req && req.image_file;

                return (
                  <g
                    key={n.node_id}
                    onClick={() => setSelected(sel ? null : n.node_id)}
                    style={{ cursor: "pointer" }}
                    filter={sel ? "url(#glow)" : "none"}
                  >
                    {/* Node rectangle */}
                    <rect
                      x={pos.x - dims.w / 2}
                      y={pos.y - dims.h / 2}
                      width={dims.w}
                      height={dims.h}
                      rx={6}
                      fill={sel ? "rgba(22,101,52,0.12)" : colors.fill}
                      stroke={sel ? "rgba(22,101,52,0.7)" : colors.stroke}
                      strokeWidth={sel ? 2 : 1.2}
                      style={{ transition: "all .15s" }}
                    />
                    {/* Icon abbreviation inside node */}
                    <text
                      x={pos.x}
                      y={pos.y - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="16"
                      fontWeight="700"
                      fill={sel ? PRIMARY : colors.text}
                      fontFamily="monospace"
                    >
                      {nodeAbbr(n)}
                    </text>
                    {/* Node name label below */}
                    <text
                      x={pos.x}
                      y={pos.y + dims.h / 2 + 16}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="500"
                      fill={sel ? PRIMARY : "#6B7280"}
                      fontFamily="'Geist', system-ui, sans-serif"
                    >
                      {n.name}
                    </text>
                    {/* Image indicator dot (green = has image, red = missing) */}
                    {req && req.image_required && (
                      <circle
                        cx={pos.x + dims.w / 2 - 4}
                        cy={pos.y - dims.h / 2 + 4}
                        r={4}
                        fill={hasImage ? "#22C55E" : "#EF4444"}
                        stroke="white"
                        strokeWidth={1}
                      />
                    )}
                  </g>
                );
              })}

              {/* ── Legend ─────────────────────────────────────────────────────── */}
              <g transform="translate(16,16)">
                <rect
                  width="150"
                  height="125"
                  rx="6"
                  fill="rgba(255,255,255,0.92)"
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth="0.8"
                />
                <text x="12" y="22" fontSize="11" fill="rgba(0,0,0,0.5)" fontFamily="'Geist', system-ui, sans-serif" fontWeight="700" letterSpacing="0.08em">
                  LEGEND
                </text>
                {[
                  { abbr: "R", label: "Router", color: nodeColors.router, y: 40 },
                  { abbr: "SW", label: "Switch", color: nodeColors.switch, y: 58 },
                  { abbr: "PC", label: "Host (VPCS)", color: nodeColors.host, y: 76 },
                  { abbr: "FW", label: "Firewall", color: nodeColors.firewall, y: 94 },
                  { abbr: "DK", label: "Docker", color: nodeColors.docker, y: 112 },
                ].map(({ abbr, label, color, y }) => (
                  <g key={abbr}>
                    <rect
                      x="10"
                      y={y - 11}
                      width="28"
                      height="18"
                      rx="3"
                      fill={color.fill}
                      stroke={color.stroke}
                      strokeWidth="0.8"
                    />
                    <text
                      x="24"
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill={color.text}
                      fontFamily="monospace"
                    >
                      {abbr}
                    </text>
                    <text x="44" y={y} dominantBaseline="middle" fontSize="11" fill="#6B7280" fontFamily="'Geist', system-ui, sans-serif">
                      {label}
                    </text>
                  </g>
                ))}
              </g>

              {/* ── Title block ────────────────────────────────────────────────── */}
              <g transform={`translate(${VB_W - 180},${VB_H - 50})`}>
                <rect
                  width="168"
                  height="42"
                  rx="4"
                  fill="rgba(255,255,255,0.92)"
                  stroke="rgba(0,0,0,0.08)"
                  strokeWidth="0.8"
                />
                <text x="84" y="14" textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.45)" fontFamily="monospace" fontWeight="700" letterSpacing="0.1em">
                  STRUCTURANET AI
                </text>
                <text x="84" y="26" textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.35)" fontFamily="monospace" letterSpacing="0.06em">
                  TOPOLOGY SCHEMATIC
                </text>
                <text x="84" y="37" textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.3)" fontFamily="monospace">
                  {topology?.name || "UNTITLED"} / {nodes.length}N {links.length}L
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* ── Inspection Panel (always visible, 280px) ──────────────────────── */}
        <div
          style={{
            width: 280,
            borderLeft: `1px solid ${BORDER}`,
            background: "white",
            overflowY: "auto",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {selectedNode ? (
            <div style={{ padding: 20, flex: 1 }}>
              {/* Selected node header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 18, color: "#111" }}>{selectedNode.name}</span>
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
                  <Icon d={PATHS.x} size={16} />
                </button>
              </div>

              {/* Node details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
                {/* Type chip */}
                <div>
                  <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 6, textTransform: "uppercase" }}>
                    Type
                  </div>
                  <span style={{
                    display: "inline-block",
                    background: (nodeColors[displayType(selectedNode)] || nodeColors.host).fill,
                    border: `1px solid ${(nodeColors[displayType(selectedNode)] || nodeColors.host).stroke}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: (nodeColors[displayType(selectedNode)] || nodeColors.host).text,
                    fontFamily: "monospace",
                  }}>
                    {(displayType(selectedNode) || "HOST").toUpperCase()}
                  </span>
                </div>

                {/* Template */}
                {selectedNode.template_name && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                      Template
                    </div>
                    <div style={{ fontSize: 13, color: "#111", fontFamily: "monospace", wordBreak: "break-all" }}>
                      {selectedNode.template_name}
                    </div>
                  </div>
                )}

                {/* Node Type (raw) */}
                {selectedNode.node_type && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                      Node Type
                    </div>
                    <div style={{ fontSize: 13, color: "#111", fontFamily: "monospace" }}>
                      {selectedNode.node_type}
                    </div>
                  </div>
                )}

                {/* Image File — from requirements (profile first, then appliance.py) */}
                {selectedReq && selectedReq.image_required && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                      Image File
                    </div>
                    {selectedReq.image_file ? (
                      <div style={{
                        fontSize: 12,
                        color: "#166534",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                        background: "rgba(22,101,52,0.06)",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(22,101,52,0.15)",
                      }}>
                        {selectedReq.image_file}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 12,
                        color: "#DC2626",
                        fontFamily: "monospace",
                        background: "#FEF2F2",
                        padding: "6px 8px",
                        borderRadius: 4,
                        border: "1px solid #FECACA",
                      }}>
                        Missing — configure in profile
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                      Source: {selectedReq.image_file ? "Profile / Appliance defaults" : "Not configured"}
                    </div>
                  </div>
                )}

                {/* Image status for built-in nodes */}
                {selectedReq && !selectedReq.image_required && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                      Image Required
                    </div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>
                      No — built-in node type
                    </div>
                  </div>
                )}

                {/* Node ID */}
                <div>
                  <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                    Node ID
                  </div>
                  <div style={{ fontSize: 13, color: "#111", fontFamily: "monospace" }}>
                    {selectedNode.node_id}
                  </div>
                </div>

                {/* Links count */}
                {selectedNode.link_count != null && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 4, textTransform: "uppercase" }}>
                      Links
                    </div>
                    <div style={{ fontSize: 13, color: "#111", fontFamily: "monospace" }}>
                      {selectedNode.link_count}
                    </div>
                  </div>
                )}

                {/* Connections */}
                {selectedConnections.length > 0 && (
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", marginBottom: 8, textTransform: "uppercase" }}>
                      Connections ({selectedConnections.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {selectedConnections.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            background: MUTED,
                            borderRadius: 6,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: PRIMARY,
                            fontWeight: 500,
                          }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "rgba(22,101,52,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#9CA3AF", marginBottom: 12,
              }}>
                <Icon d={PATHS.search} size={22} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>
                Select a node
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>
                Click on any node in the topology to view its details, image requirements, and connections.
              </div>
            </div>
          )}

          {/* Bottom: Zoom controls */}
          <div style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={handleZoomOut}
                style={{
                  border: `1px solid ${BORDER}`,
                  background: "white",
                  borderRadius: 6,
                  width: 30, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#374151", fontSize: 16, fontWeight: 600,
                }}
              >
                -
              </button>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#6B7280", minWidth: 40, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                style={{
                  border: `1px solid ${BORDER}`,
                  background: "white",
                  borderRadius: 6,
                  width: 30, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#374151", fontSize: 16, fontWeight: 600,
                }}
              >
                +
              </button>
              <button
                onClick={handleZoomReset}
                style={{
                  border: `1px solid ${BORDER}`,
                  background: "white",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#6B7280",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Reset
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>
              Scroll to zoom
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
