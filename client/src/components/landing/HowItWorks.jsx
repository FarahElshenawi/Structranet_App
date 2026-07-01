/**
 * HowItWorks — 3 simple steps, no technical jargon.
 * Speaks to the user's outcome, not our implementation.
 */

const STEPS = [
  {
    num: '01',
    title: 'Describe',
    headline: 'Tell us what you need.',
    body: 'Just describe the network you want in plain English. "A campus network with 3 buildings and a firewall." "A branch office with 2 routers and 5 PCs." No wizards, no forms, no configuration files.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Review',
    headline: 'See it come to life.',
    body: 'Watch as your topology takes shape in real-time. A visual diagram shows every device and connection. Need a change? Just ask — add a firewall, rewire a switch, or swap a router. It adapts instantly.',
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
    headline: 'Download and run.',
    body: 'Get a ready-to-import GNS3 project file with full device configurations, all cable connections wired, and a checklist of images you need. Import it, start the devices, and you are running.',
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
    <section id="how-it-works" className="relative py-20 lg:py-28 bg-navy-950 overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400 mb-3">
            How It Works
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            From idea to running lab in 3 steps
          </h2>
          <p className="text-zinc-400 mt-3 max-w-xl mx-auto text-[15px] leading-relaxed">
            No command-line tools. No manual device configuration. No cable-wiring spreadsheets.
            Just describe, review, and download.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="relative group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7 hover:border-brand-500/30 transition-all duration-300"
            >
              {/* Number watermark */}
              <span className="absolute top-5 right-6 text-5xl font-black text-zinc-800 group-hover:text-brand-500/15 transition-colors leading-none">
                {step.num}
              </span>

              {/* Icon */}
              <div className="relative w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-500/20 flex items-center justify-center mb-5">
                {step.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
              <p className="text-sm font-medium text-brand-300 mb-3">{step.headline}</p>
              <p className="text-[13px] text-zinc-400 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
