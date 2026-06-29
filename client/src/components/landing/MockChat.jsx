import { useEffect, useState } from 'react';

/**
 * MockChat — auto-playing animation that loops through 6 frames.
 * Dark mode: looks like a real terminal/network engineer's screen.
 */

const USER_PROMPT = 'Create a campus network with 3 VLANs and internet access';

const AI_RESPONSE = "I'll design a 3-tier campus with VLANs 10, 20, and 30, router-on-a-stick inter-VLAN routing, and a NAT path to the internet.";

const TOOL_STEPS = [
  'Analyzing security zones...',
  'Placing routers...',
  'Injecting hardware configs...',
];

const TIMING = {
  empty: 1500,
  typing: 35,
  pauseAfterTyping: 600,
  sending: 400,
  aiThinking: 500,
  aiTyping: 28,
  pauseAfterAI: 600,
  toolStart: 400,
  toolStepInterval: 700,
  pauseAfterTool: 500,
  topology: 1500,
};

const TOPO_NODES = [
  { id: 'R1', name: 'R1', x: 60, y: 50, color: '#10b981' },
  { id: 'Core', name: 'Core', x: 150, y: 50, color: '#34d399' },
  { id: 'SW1', name: 'SW1', x: 240, y: 30, color: '#6ee7b7' },
  { id: 'SW2', name: 'SW2', x: 240, y: 70, color: '#6ee7b7' },
  { id: 'SW3', name: 'SW3', x: 240, y: 110, color: '#6ee7b7' },
  { id: 'NAT', name: 'NAT', x: 60, y: 110, color: '#a78bfa' },
  { id: 'PC1', name: 'PC1', x: 320, y: 30, color: '#94a3b8' },
  { id: 'PC2', name: 'PC2', x: 320, y: 70, color: '#94a3b8' },
  { id: 'PC3', name: 'PC3', x: 320, y: 110, color: '#94a3b8' },
];

const TOPO_LINKS = [
  ['R1', 'Core'], ['Core', 'SW1'], ['Core', 'SW2'], ['Core', 'SW3'],
  ['R1', 'NAT'], ['SW1', 'PC1'], ['SW2', 'PC2'], ['SW3', 'PC3'],
];

export default function MockChat() {
  const [frame, setFrame] = useState('empty');
  const [typedChars, setTypedChars] = useState(0);
  const [aiChars, setAiChars] = useState(0);
  const [toolStepIdx, setToolStepIdx] = useState(-1);
  const [showTopology, setShowTopology] = useState(false);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    let timer;

    if (frame === 'empty') {
      timer = setTimeout(() => { setFrame('typing'); setTypedChars(0); }, TIMING.empty);
    } else if (frame === 'typing') {
      if (typedChars < USER_PROMPT.length) {
        timer = setTimeout(() => setTypedChars(c => c + 1), TIMING.typing);
      } else {
        timer = setTimeout(() => setFrame('sent'), TIMING.pauseAfterTyping);
      }
    } else if (frame === 'sent') {
      timer = setTimeout(() => setFrame('aiThinking'), TIMING.sending);
    } else if (frame === 'aiThinking') {
      timer = setTimeout(() => { setFrame('aiTyping'); setAiChars(0); }, TIMING.aiThinking);
    } else if (frame === 'aiTyping') {
      if (aiChars < AI_RESPONSE.length) {
        timer = setTimeout(() => setAiChars(c => c + 1), TIMING.aiTyping);
      } else {
        timer = setTimeout(() => setFrame('tool'), TIMING.pauseAfterAI);
      }
    } else if (frame === 'tool') {
      if (toolStepIdx < TOOL_STEPS.length - 1) {
        const nextIdx = toolStepIdx + 1;
        timer = setTimeout(() => setToolStepIdx(nextIdx), TIMING.toolStepInterval);
      } else {
        timer = setTimeout(() => { setFrame('topology'); setShowTopology(true); }, TIMING.pauseAfterTool);
      }
    } else if (frame === 'topology') {
      timer = setTimeout(() => {
        setFrame('empty'); setTypedChars(0); setAiChars(0);
        setToolStepIdx(-1); setShowTopology(false); setFadeKey(k => k + 1);
      }, TIMING.topology);
    }

    return () => clearTimeout(timer);
  }, [frame, typedChars, aiChars, toolStepIdx]);

  const userText = USER_PROMPT.slice(0, typedChars);
  const aiText = AI_RESPONSE.slice(0, aiChars);
  const isTyping = frame === 'typing';
  const showUserMsg = frame !== 'empty' && frame !== 'typing';
  const showAIMsg = ['aiThinking', 'aiTyping', 'tool', 'topology'].includes(frame);
  const showTool = frame === 'tool' || frame === 'topology';
  const visibleSteps = TOOL_STEPS.slice(0, toolStepIdx + 1);

  return (
    <div key={fadeKey} className="relative">
      {/* Emerald glow behind card */}
      <div className="absolute -inset-4 bg-gradient-to-br from-brand-500/20 via-brand-400/10 to-transparent rounded-3xl blur-2xl" aria-hidden />

      {/* Chat window */}
      <div className="relative card-elevated overflow-hidden">
        {/* Window chrome */}
        <div className="bg-navy-950 px-4 py-2.5 flex items-center gap-2 border-b border-navy-800">
          <span className="w-3 h-3 rounded-full bg-red-400/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-brand-400/80" />
          <span className="ml-3 text-xs text-navy-400 font-mono">structuranet — new chat</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-brand-400">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            live
          </span>
        </div>

        {/* Chat body — FIXED at original 340px. Topology is sized to fit
            inside this height. Content flows from the top (natural position). */}
        <div className="bg-navy-900 p-5 flex flex-col gap-3 overflow-hidden" style={{ height: '340px' }}>
          {/* Empty state */}
          {frame === 'empty' && (
            <div className="flex-1 flex items-center justify-center text-center py-8">
              <p className="text-sm text-navy-500">
                Describe the network you want to build…
                <span className="inline-block w-0.5 h-4 bg-brand-500 ml-1 align-middle animate-blink" />
              </p>
            </div>
          )}

          {/* User message */}
          {showUserMsg && (
            <div className="flex justify-end animate-fade-in-up">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 text-white px-4 py-2.5 text-sm shadow-md shadow-brand-600/20">
                {userText}
                {isTyping && <span className="inline-block w-0.5 h-4 bg-white ml-0.5 align-middle animate-blink" />}
              </div>
            </div>
          )}

          {/* AI message */}
          {showAIMsg && (
            <div className="flex gap-3 animate-fade-in-up">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-md shadow-brand-500/30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2" />
                  <circle cx="18" cy="6" r="2" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                  <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-white">StructuraNet AI</span>
                  {frame === 'aiThinking' && (
                    <span className="text-[10px] text-navy-500 flex items-center gap-1">
                      <span className="w-1 h-1 bg-navy-500 rounded-full animate-pulse" />
                      <span className="w-1 h-1 bg-navy-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1 h-1 bg-navy-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </span>
                  )}
                </div>
                {frame === 'aiThinking' ? (
                  <div className="space-y-2">
                    <div className="h-2.5 bg-navy-800 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-navy-800 rounded animate-pulse w-1/2" />
                  </div>
                ) : (
                  <p className="text-sm text-navy-100 leading-relaxed">
                    {aiText}
                    {frame === 'aiTyping' && <span className="inline-block w-0.5 h-4 bg-brand-500 ml-0.5 align-middle animate-blink" />}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tool indicator (glass-box) */}
          {showTool && (
            <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 backdrop-blur-sm p-4 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-400">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-xs font-semibold text-brand-300">Generating topology</span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                  <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </span>
              </div>
              <div className="space-y-1.5">
                {visibleSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs animate-fade-in">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400 mt-0.5 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-navy-200">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topology preview — compact, fits within fixed frame height */}
          {showTopology && (
            <div className="rounded-lg border border-navy-700 bg-navy-950 overflow-hidden animate-fade-in-up flex-shrink-0">
              <div className="flex items-center justify-between px-2.5 py-1 border-b border-navy-800 bg-navy-900">
                <div className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-brand-400">
                    <circle cx="6" cy="6" r="2" />
                    <circle cx="18" cy="6" r="2" />
                    <circle cx="6" cy="18" r="2" />
                    <path d="M8 6h8M6 8v8" />
                  </svg>
                  <span className="text-[11px] font-medium text-white">Campus Network — 3 VLANs</span>
                </div>
                <span className="badge-brand text-[9px]">9 · 8</span>
              </div>
              <div className="px-1.5 py-1">
                <svg viewBox="0 0 380 150" className="w-full" style={{ height: '70px' }}>
                  {TOPO_LINKS.map(([a, b], i) => {
                    const na = TOPO_NODES.find(n => n.id === a);
                    const nb = TOPO_NODES.find(n => n.id === b);
                    if (!na || !nb) return null;
                    return (
                      <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                        stroke="#334155" strokeWidth="1.5"
                        style={{ animationDelay: `${i * 80}ms` }}
                        className="animate-fade-in" />
                    );
                  })}
                  {TOPO_NODES.map((n, i) => (
                    <g key={n.id}
                      transform={`translate(${n.x}, ${n.y})`}
                      style={{ animationDelay: `${i * 80}ms` }}
                      className="animate-fade-in">
                      <circle r="7" fill={n.color} stroke="#0f172a" strokeWidth="2" />
                      <text y="18" textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="500">
                        {n.name}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Fake input bar */}
        <div className="bg-navy-900 border-t border-navy-800 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-navy-950 border border-navy-700 px-3 py-2">
            <span className="text-xs text-navy-500 flex-1">
              {frame === 'typing' ? userText : (showTopology ? '✓ Topology ready' : 'Describe a network…')}
            </span>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-600 text-white">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
