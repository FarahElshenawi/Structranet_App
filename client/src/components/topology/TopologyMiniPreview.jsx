/**
 * Mini topology preview — inline card in chat flow.
 * LIGHT THEME: white card with slate border, dark canvas SVG.
 */
import { useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';

const COLORS = {
  router: '#3b82f6',
  switch: '#22d3ee',
  pc: '#94a3b8',
  firewall: '#ef4444',
  nat: '#f59e0b',
  default: '#64748b',
};

function nodeColor(node) {
  const t = (node.node_type || '').toLowerCase();
  const n = (node.name || '').toLowerCase();
  if (t.includes('router') || n.match(/^r\d/)) return COLORS.router;
  if (t.includes('firewall') || n.includes('fw')) return COLORS.firewall;
  if (t.includes('nat') || n.includes('nat')) return COLORS.nat;
  if (t.includes('switch') || n.startsWith('sw')) return COLORS.switch;
  if (t.includes('vpcs') || t.includes('pc') || n.startsWith('pc')) return COLORS.pc;
  return COLORS.default;
}

export default function TopologyMiniPreview({ topology, onExpand, onApprove, onEdit }) {
  const [showReview, setShowReview] = useState(false);
  const nodes = topology?.topology_dict?.topology?.nodes || [];
  const links = topology?.topology_dict?.topology?.links || [];

  const layout = useMemo(() => {
    const cx = 200, cy = 110, r = 70;
    return nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [nodes]);

  const nodeMap = useMemo(() => {
    const m = new Map();
    layout.forEach(n => m.set(n.node_id, n));
    return m;
  }, [layout]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
              <path d="M6 8v8M18 8v8M8 6h8M8 18h8" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {topology?.topology_data?.name || topology?.name || 'Topology'}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>{topology?.topology_data?.node_count || nodes.length} devices</span>
              <span>·</span>
              <span>{topology?.topology_data?.link_count || links.length} links</span>
            </div>
          </div>
        </div>
        {onExpand && (
          <button
            onClick={onExpand}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            title="Expand topology"
          >
            <Maximize2 size={14} />
            Expand
          </button>
        )}
      </div>

      {/* Mini SVG — dark canvas for contrast */}
      <div className="relative bg-slate-900 p-3">
        <svg viewBox="0 0 400 220" className="relative w-full h-auto">
          {links.map((link, i) => {
            const [a, b] = link.nodes || [];
            const na = nodeMap.get(a?.node_id);
            const nb = nodeMap.get(b?.node_id);
            if (!na || !nb) return null;
            return (
              <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                stroke="#475569" strokeWidth="1.5" />
            );
          })}
          {layout.map((n) => {
            const color = nodeColor(n);
            return (
              <g key={n.node_id} transform={`translate(${n.x}, ${n.y})`}>
                <circle r="10" fill={color} opacity="0.2" />
                <circle r="7" fill={color} stroke="#1e293b" strokeWidth="1.5" />
                <text y="20" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="500">
                  {n.name?.length > 10 ? n.name.slice(0, 9) + '…' : n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Design review */}
      {topology?.design_review && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setShowReview(!showReview)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 text-emerald-600 transition-transform ${showReview ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Design Review
          </button>
          {showReview && (
            <div className="px-4 pb-3 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap border-l-2 border-emerald-300 ml-4 pl-3">
              {Array.isArray(topology.design_review) ? topology.design_review.join('\n') : topology.design_review}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(onApprove || onEdit) && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-sm shadow-emerald-600/20"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Approve & Generate Configs
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              I need edits
            </button>
          )}
        </div>
      )}
    </div>
  );
}
