/**
 * Glass-box tool indicator — like Claude's Artifacts.
 * Shows the current tool name + flashing progress steps.
 */

const TOOL_META = {
  generate_topology: { label: 'Generating topology', icon: 'topology', color: 'brand' },
  edit_topology: { label: 'Editing topology', icon: 'edit', color: 'brand' },
  export_project: { label: 'Building deployment kit', icon: 'package', color: 'success' },
  search_kb: { label: 'Searching knowledge base', icon: 'search', color: 'accent' },
};

function ToolIcon({ name, className = 'w-4 h-4' }) {
  const paths = {
    topology: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 8v8M18 8v8M8 6h8M8 18h8M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </>
    ),
    package: (
      <>
        <path d="M16.5 9.4 7.5 4.21" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.topology}
    </svg>
  );
}

export default function ToolIndicator({ tool, steps = [] }) {
  const meta = TOOL_META[tool] || { label: tool, icon: 'topology', color: 'brand' };
  // Show the last 4 steps, with the most recent one highlighted
  const recentSteps = steps.slice(-4);

  const colorClasses = {
    brand: {
      ring: 'ring-brand-500/20',
      iconBg: 'bg-brand-500/15 text-brand-400',
      label: 'text-brand-300',
      glow: 'from-brand-500/10',
    },
    success: {
      ring: 'ring-success-500/20',
      iconBg: 'bg-success-500/15 text-success-500',
      label: 'text-success-500',
      glow: 'from-success-500/10',
    },
    accent: {
      ring: 'ring-accent-500/20',
      iconBg: 'bg-accent-500/15 text-accent-500',
      label: 'text-accent-500',
      glow: 'from-accent-500/10',
    },
  };
  const c = colorClasses[meta.color] || colorClasses.brand;

  return (
    <div className={`relative animate-fade-in`}>
      {/* Soft glow halo */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${c.glow} to-transparent rounded-2xl blur-xl`} />

      <div className={`relative card-glass overflow-hidden ring-1 ring-inset ${c.ring}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${c.iconBg} ring-1 ring-inset ring-white/10 flex items-center justify-center`}>
            <ToolIcon name={meta.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${c.label}`}>{meta.label}</span>
              <span className="badge bg-white/5 text-ink-400 ring-1 ring-inset ring-white/10 text-[10px] uppercase tracking-wider">
                Tool
              </span>
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5 font-mono">{tool}</div>
          </div>
          {/* Pulsing dots */}
          <span className="inline-flex items-center gap-1.5 ml-2">
            <span className="inline-block w-1.5 h-1.5 bg-brand-400 rounded-full animate-dot-pulse" />
            <span className="inline-block w-1.5 h-1.5 bg-brand-400 rounded-full animate-dot-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="inline-block w-1.5 h-1.5 bg-brand-400 rounded-full animate-dot-pulse" style={{ animationDelay: '0.4s' }} />
          </span>
        </div>

        {/* Steps */}
        <div className="px-4 py-3.5">
          {recentSteps.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-ink-500 italic">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Initializing…
            </div>
          )}

          {recentSteps.length > 0 && (
            <ol className="space-y-2 relative">
              {recentSteps.map((step, i) => {
                const isLast = i === recentSteps.length - 1;
                return (
                  <li key={i} className="flex items-start gap-2.5 relative">
                    {/* Step indicator */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isLast ? (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-brand-500/20 ring-2 ring-brand-500/40">
                          <span className="inline-block w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-success-500/15 ring-1 ring-inset ring-success-500/30">
                          <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-success-500" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>

                    {/* Step text */}
                    <div className={`flex-1 min-w-0 text-xs ${isLast ? 'text-white font-medium' : 'text-ink-500'}`}>
                      {step}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Live progress shimmer line */}
          <div className="mt-3 h-0.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-brand-400 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
