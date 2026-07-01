/**
 * Full-canvas topology viewer — full-screen modal.
 * Dark backdrop (backdrop-blur-md bg-zinc-950/80) with d3-force layout,
 * zoom/pan, and click-to-inspect node details panel.
 */
import { useEffect, useRef, useState } from 'react';
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { X, Cpu, Network, Shield, Globe, Monitor, Server } from 'lucide-react';

const COLORS = {
  router: '#3b82f6',
  switch: '#22d3ee',
  pc: '#94a3b8',
  firewall: '#ef4444',
  nat: '#f59e0b',
  default: '#64748b',
};

const LEGEND = [
  { label: 'Router', color: COLORS.router },
  { label: 'Switch', color: COLORS.switch },
  { label: 'PC / Host', color: COLORS.pc },
  { label: 'Firewall', color: COLORS.firewall },
  { label: 'NAT', color: COLORS.nat },
];

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

function nodeIcon(node) {
  const t = (node.node_type || '').toLowerCase();
  const n = (node.name || '').toLowerCase();
  if (t.includes('router') || n.match(/^r\d/)) return <Cpu size={16} />;
  if (t.includes('firewall') || n.includes('fw')) return <Shield size={16} />;
  if (t.includes('nat') || n.includes('nat')) return <Globe size={16} />;
  if (t.includes('switch') || n.startsWith('sw')) return <Network size={16} />;
  if (t.includes('vpcs') || t.includes('pc') || n.startsWith('pc')) return <Monitor size={16} />;
  return <Server size={16} />;
}

export default function TopologyFullCanvas({ topology, onClose }) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [selected, setSelected] = useState(null);

  // Build nodes + links, run force simulation
  useEffect(() => {
    const rawNodes = topology?.topology_dict?.topology?.nodes || [];
    const rawLinks = topology?.topology_dict?.topology?.links || [];

    const simNodes = rawNodes.map(n => ({ ...n }));
    const simLinks = rawLinks.map((l, i) => ({
      id: i,
      source: l.nodes?.[0]?.node_id,
      target: l.nodes?.[1]?.node_id,
    })).filter(l => l.source && l.target);

    const sim = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-520))
      .force('link', forceLink(simLinks).id(d => d.node_id).distance(165).strength(0.12))
      .force('center', forceCenter(500, 350))
      .force('collide', forceCollide(74))
      .stop();

    for (let i = 0; i < 80; i++) sim.tick();

    setNodes(simNodes.map(n => ({ ...n })));
    setLinks(simLinks.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? l.source.node_id : l.source,
      target: typeof l.target === 'object' ? l.target.node_id : l.target,
      sx: simNodes.find(n => n.node_id === (l.source?.node_id || l.source))?.x,
      sy: simNodes.find(n => n.node_id === (l.source?.node_id || l.source))?.y,
      tx: simNodes.find(n => n.node_id === (l.target?.node_id || l.target))?.x,
      ty: simNodes.find(n => n.node_id === (l.target?.node_id || l.target))?.y,
    })));
  }, [topology]);

  // d3-zoom
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const g = svg.select('g.zoom-layer');
    const z = zoom().scaleExtent([0.3, 3]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(z);
    svg.call(z.transform, zoomIdentity);
  }, [nodes]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-md flex flex-col animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 flex items-center justify-center">
            <Network size={18} />
          </div>
          <div>
            <h2 className="text-white font-semibold leading-none">
              {topology?.topology_data?.name || 'Topology'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {topology?.topology_data?.node_count || nodes.length} devices ·{' '}
              {topology?.topology_data?.link_count || links.length} links · Click a node for details
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-800/60 rounded-md px-2.5 py-1.5 ring-1 ring-inset ring-zinc-700">
            <kbd className="font-mono text-zinc-300">Scroll</kbd> to zoom ·
            <kbd className="font-mono text-zinc-300 ml-1">Drag</kbd> to pan ·
            <kbd className="font-mono text-zinc-300 ml-1">Esc</kbd> to close
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 active:scale-[0.98] transition-all shadow-sm"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 relative bg-zinc-950">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%2334d399' stroke-opacity='0.08' stroke-width='1'/%3E%3C/svg%3E\")",
          }}
        />

        <svg ref={svgRef} className="w-full h-full relative">
          <defs>
            <linearGradient id="sn-edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="sn-edge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <style>{`
            @keyframes sn-flow-anim { to { stroke-dashoffset: -24; } }
            .sn-flow-edge { stroke-dasharray: 5 6; animation: sn-flow-anim 1s linear infinite; }
            .sn-node-card { transition: box-shadow .15s ease, border-color .15s ease; }
            .sn-node-card:hover { border-color: rgba(16,185,129,0.55) !important; }
          `}</style>
          <g className="zoom-layer">
            {/* Links — emerald→cyan gradient bezier with animated flow */}
            {links.map((l, i) => {
              const involves = selected && (l.source === selected.node_id || l.target === selected.node_id);
              const mx = (l.sx + l.tx) / 2;
              const my = (l.sy + l.ty) / 2;
              const d = `M ${l.sx} ${l.sy} C ${l.sx} ${my} ${l.tx} ${my} ${l.tx} ${l.ty}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={involves ? '#34d399' : 'url(#sn-edge-grad)'}
                  strokeWidth={involves ? 2.6 : 1.7}
                  strokeLinecap="round"
                  className="sn-flow-edge"
                  opacity={involves ? 0.95 : 0.62}
                  filter="url(#sn-edge-glow)"
                />
              );
            })}
            {/* Nodes — card glyphs (icon + accent bar + label) */}
            {nodes.map((n) => {
              const color = nodeColor(n);
              const isSelected = selected?.node_id === n.node_id;
              return (
                <g
                  key={n.node_id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer"
                  onClick={() => setSelected(n)}
                >
                  {/* selection ping ring */}
                  {isSelected && (
                    <circle r="34" fill="none" stroke="#10b981" strokeWidth="1.6" opacity="0.7">
                      <animate attributeName="r" values="30;48" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <foreignObject x={-72} y={-24} width={144} height={48}>
                    <div
                      className="sn-node-card"
                      style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        width: '100%',
                        height: '100%',
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: 'rgba(24,24,27,0.96)',
                        border: isSelected
                          ? '1px solid #10b981'
                          : '1px solid rgba(63,63,70,0.9)',
                        boxShadow: isSelected
                          ? `0 0 0 1px ${color}55, 0 0 26px -6px ${color}cc`
                          : '0 1px 0 0 rgba(255,255,255,0.03)',
                      }}
                    >
                      {/* colored left accent bar */}
                      <span
                        style={{
                          width: 4,
                          flexShrink: 0,
                          background: color,
                          boxShadow: `0 0 10px -2px ${color}`,
                        }}
                      />
                      {/* icon chip */}
                      <span
                        style={{
                          margin: '6px 0',
                          marginLeft: 8,
                          display: 'inline-flex',
                          width: 30,
                          height: 30,
                          flexShrink: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 7,
                          background: `${color}22`,
                          color,
                        }}
                      >
                        {nodeIcon(n)}
                      </span>
                      {/* label + model/template */}
                      <span
                        style={{
                          marginLeft: 8,
                          marginRight: 10,
                          alignSelf: 'center',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            lineHeight: '1.15',
                            color: '#fafafa',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.name}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 10,
                            lineHeight: '1.15',
                            color: '#a1a1aa',
                            fontFamily:
                              'ui-monospace, SFMono-Regular, Menlo, monospace',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.template_name || n.node_type}
                        </span>
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute top-4 left-4 rounded-xl border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-xl p-3.5 shadow-xl">
          <div className="text-[11px] font-semibold text-white uppercase tracking-wider mb-2.5">Legend</div>
          <div className="space-y-1.5">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs">
                <span className="inline-block w-3 h-3 rounded-full ring-2 ring-white/20" style={{ background: l.color }} />
                <span className="text-zinc-300">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 right-4 rounded-xl border border-zinc-700/60 bg-zinc-900/80 backdrop-blur-xl px-4 py-2.5 shadow-xl">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Topology</div>
          <div className="text-sm font-semibold text-white">
            {nodes.length} <span className="text-zinc-400 font-normal">nodes</span>
            <span className="text-zinc-600 mx-1.5">·</span>
            {links.length} <span className="text-zinc-400 font-normal">links</span>
          </div>
        </div>

        {/* Node detail panel (slides in from right) */}
        {selected && (
          <div className="absolute top-0 right-0 h-full w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl animate-fade-in-up overflow-y-auto">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: nodeColor(selected) }}>
                    {nodeIcon(selected)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base leading-none">{selected.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1">Device details</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3 py-2 border-b border-zinc-800">
                  <dt className="text-zinc-500 font-medium">Node ID</dt>
                  <dd className="font-mono text-zinc-300 truncate">{selected.node_id}</dd>
                </div>
                <div className="flex justify-between gap-3 py-2 border-b border-zinc-800">
                  <dt className="text-zinc-500 font-medium">Type</dt>
                  <dd className="text-zinc-300">{selected.node_type}</dd>
                </div>
                {selected.template_name && (
                  <div className="flex justify-between gap-3 py-2 border-b border-zinc-800">
                    <dt className="text-zinc-500 font-medium">Template</dt>
                    <dd className="font-mono text-zinc-300 truncate text-right">{selected.template_name}</dd>
                  </div>
                )}
                {selected.properties?._hardware_summary && (
                  <div className="py-2 border-b border-zinc-800">
                    <dt className="text-zinc-500 font-medium mb-1">Hardware</dt>
                    <dd className="text-zinc-300 text-xs">{selected.properties._hardware_summary}</dd>
                  </div>
                )}
                {selected.properties?._link_count !== undefined && (
                  <div className="flex justify-between gap-3 py-2 border-b border-zinc-800">
                    <dt className="text-zinc-500 font-medium">Links</dt>
                    <dd className="text-zinc-300">{selected.properties._link_count}</dd>
                  </div>
                )}
                {selected.properties?._image_required !== undefined && (
                  <div className="flex justify-between gap-3 py-2 border-b border-zinc-800">
                    <dt className="text-zinc-500 font-medium">Image Required</dt>
                    <dd className={selected.properties._image_required ? 'text-amber-400' : 'text-emerald-400'}>
                      {selected.properties._image_required ? 'Yes' : 'No (builtin)'}
                    </dd>
                  </div>
                )}
                {selected.properties?.startup_config_content && (
                  <div className="py-2">
                    <dt className="text-zinc-500 font-medium mb-2">Startup Config</dt>
                    <dd>
                      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-emerald-400 font-mono overflow-x-auto max-h-48">
                        {selected.properties.startup_config_content.slice(0, 500)}
                        {selected.properties.startup_config_content.length > 500 && '\n...'}
                      </pre>
                    </dd>
                  </div>
                )}
                {selected.properties?._interfaces && (
                  <div className="py-2">
                    <dt className="text-zinc-500 font-medium mb-2">Interfaces ({selected.properties._interfaces.length})</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {selected.properties._interfaces.slice(0, 12).map((iface, i) => (
                        <span key={i} className="inline-flex items-center rounded-md bg-zinc-800 text-zinc-300 font-mono text-[10px] px-2 py-1 border border-zinc-700">
                          {iface}
                        </span>
                      ))}
                      {selected.properties._interfaces.length > 12 && (
                        <span className="text-zinc-500 text-[10px] self-center">+{selected.properties._interfaces.length - 12} more</span>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}