/**
 * Vision — company vision and mission statement.
 * Positions StructuraNet as a product company, not a student project.
 */

export default function Vision() {
  return (
    <section className="relative py-20 lg:py-28 bg-navy-950 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-brand-500/6 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400 mb-6">
          Our Vision
        </span>

        {/* Big statement */}
        <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug mb-6">
          Every network engineer should be able to{' '}
          <span className="text-brand-400">design, configure, and test</span>{' '}
          any network in minutes — not days.
        </h2>

        {/* Body */}
        <p className="text-[15px] lg:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-12">
          Network engineering has been stuck in the past. You describe a topology on paper,
          configure each device by hand, and pray it works when you power it on. StructuraNet
          changes that. You describe what you want in plain English, and you get a fully
          configured, ready-to-run network lab. No more CLI marathons. No more wiring mistakes.
          No more guessing.
        </p>

        {/* Mission cards */}
        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-500/20 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Speed</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              What took hours of manual configuration now takes a single sentence.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-500/20 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Reliability</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Every topology is validated before export. Broken connections are auto-repaired.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-500/20 flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Accessibility</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              No CLI expertise required. If you can describe it, you can build it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
