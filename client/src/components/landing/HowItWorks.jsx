/**
 * HowItWorks — 3-step workflow cards on dark navy.
 */

const STEPS = [
  {
    num: '01',
    title: 'Describe',
    headline: 'Type what you want in plain English.',
    body: 'No wizards, no dropdowns, no forms. Just describe the network you want — "campus with 3 VLANs", "spine-leaf data center", "home lab with VPN". The LLM orchestrator picks the right tool and starts designing.',
    bullets: ['Natural language input', 'LLM tool-calling orchestration', 'Up to 6 reasoning rounds'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Review',
    headline: 'Watch the AI reason in real-time.',
    body: 'No black boxes. Token-by-token streaming shows the AI thinking. When it calls a tool, a glass-box indicator flashes every step — "Analyzing security zones…", "Placing routers…", "Injecting hardware configs…". Approve, or ask for edits.',
    bullets: ['Live token streaming (SSE)', 'Glass-box tool progress', 'Iterative editing'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Export',
    headline: 'Get a ready-to-run GNS3 project.',
    body: 'Download a portable .gns3project ZIP with full Cisco IOS configurations, an image requirements manifest, and a validation report. Import into GNS3, start the devices, and you\'re running.',
    bullets: ['.gns3project portable ZIP', 'Full Cisco IOS configs', '11-check validation report'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 lg:py-28 overflow-hidden bg-navy-950">
      <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-brand-400 tracking-wider uppercase mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            From prompt to deployment{' '}
            <span className="text-gradient-brand">in three steps.</span>
          </h2>
          <p className="text-lg text-navy-300">No wizards. No forms. No config files. Just describe, review, and export.</p>
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-brand-500/30 via-brand-500/50 to-brand-500/30" aria-hidden />

          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className="relative card p-7 hover:border-brand-500/50 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
                  {step.icon}
                </div>
                <span className="text-3xl font-bold text-navy-700 tabular-nums">{step.num}</span>
              </div>

              <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1.5">{step.title}</h3>
              <p className="text-base font-semibold text-white mb-3 leading-snug">{step.headline}</p>
              <p className="text-sm text-navy-300 leading-relaxed mb-5">{step.body}</p>

              <ul className="space-y-2">
                {step.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-xs text-navy-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400 mt-0.5 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
