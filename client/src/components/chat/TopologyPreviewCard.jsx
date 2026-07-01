import { useState, useMemo } from 'react';
import { Network, Maximize2, Check } from 'lucide-react';
import TopologyFullCanvas from '../topology/TopologyFullCanvas.jsx';

/**
 * TopologyPreviewCard — inline topology summary shown in the conversation
 * when the AI finishes generating a topology.
 *
 * Renders a compact card with:
 *  - Topology name + device/link counts
 *  - A mini SVG preview (first ~12 nodes laid out in a circle)
 *  - A "View full topology" button that opens TopologyFullCanvas (full-screen
 *    d3-force modal with zoom/pan/click-to-inspect)
 *
 * Reads `chatStore.topology` which is populated by the SSE `topology_ready`
 * event. The data shape is { topologyId, topology_dict, topology_data, ... }
 * where topology_dict.topology.nodes/links is the nested GNS3 structure.
 */
export default function TopologyPreviewCard({ topology }) {
  const [showFull, setShowFull] = useState(false);

  const nodes = useMemo(
    () => topology?.topology_dict?.topology?.nodes || [],
    [topology]
  );
  const links = useMemo(
    () => topology?.topology_dict?.topology?.links || [],
    [topology]
  );

  if (!topology || nodes.length === 0) return null;

  const name = topology?.topology_data?.name || topology?.name || 'Topology';
  const nodeCount = topology?.topology_data?.node_count || nodes.length;
  const linkCount = topology?.topology_data?.link_count || links.length;

  // ── Mini preview layout: arrange first 12 nodes in a circle ──
  const previewNodes = nodes.slice(0, 12);
  const radius = 38;
  const cx = 50, cy = 50;
  const positioned = previewNodes.map((n, i) => {
    const angle = (i / Math.max(previewNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      px: cx + radius * Math.cos(angle),
      py: cy + radius * Math.sin(angle),
    };
  });
  const previewLinks = links.slice(0, 20).map(l => {
    const a = l.nodes?.[0]?.node_id;
    const b = l.nodes?.[1]?.node_id;
    const na = positioned.find(n => n.node_id === a);
    const nb = positioned.find(n => n.node_id === b);
    return na && nb ? { x1: na.px, y1: na.py, x2: nb.px, y2: nb.py } : null;
  }).filter(Boolean);

  // ── Node type color (mirrors TopologyFullCanvas) ──────────
  function color(node) {
    const t = (node.node_type || '').toLowerCase();
    const n = (node.name || '').toLowerCase();
    if (t.includes('router') || n.match(/^r\d/)) return '#3b82f6';
    if (t.includes('firewall') || n.includes('fw')) return '#ef4444';
    if (t.includes('nat') || n.includes('nat')) return '#f59e0b';
    if (t.includes('switch') || n.startsWith('sw')) return '#22d3ee';
    if (t.includes('vpcs') || t.includes('pc') || n.startsWith('pc')) return '#94a3b8';
    return '#64748b';
  }

  return (
    <>
      {/* Main card (renders inline — no avatar, the parent MessageItem provides it) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Network size={15} className="text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate flex-1">{name}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
            <Check size={10} strokeWidth={3} />
            Ready
          </span>
        </div>

        {/* Body: mini preview + stats + button */}
        <div className="flex items-center gap-4 px-4 py-3">
          {/* Mini SVG preview */}
          <div className="flex-shrink-0 w-24 h-24 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Links */}
              {previewLinks.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="#475569" strokeWidth="0.8" opacity="0.6" />
              ))}
              {/* Nodes */}
              {positioned.map((n) => (
                <circle key={n.node_id} cx={n.px} cy={n.py} r="3.5"
                  fill={color(n)} stroke="white" strokeWidth="0.6" />
              ))}
              {nodes.length > 12 && (
                <text x="50" y="96" textAnchor="middle" fontSize="6" fill="#71717a">
                  +{nodes.length - 12} more
                </text>
              )}
            </svg>
          </div>

          {/* Stats + action */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-xl font-semibold text-white">{nodeCount}</span>
              <span className="text-xs text-zinc-500">devices</span>
              <span className="text-zinc-700">·</span>
              <span className="text-xl font-semibold text-white">{linkCount}</span>
              <span className="text-xs text-zinc-500">links</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed mb-2.5">
              Review the generated topology, then ask for changes or approve &amp; export.
            </p>
            <button
              onClick={() => setShowFull(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium px-3 py-1.5 transition-colors border border-zinc-600"
            >
              <Maximize2 size={12} />
              View full topology
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen topology modal */}
      {showFull && (
        <TopologyFullCanvas topology={topology} onClose={() => setShowFull(false)} />
      )}
    </>
  );
}
