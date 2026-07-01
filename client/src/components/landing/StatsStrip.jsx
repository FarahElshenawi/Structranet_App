/**
 * StatsStrip — 4 product-focused stats.
 * No internal implementation details — just what the user gets.
 */
const STATS = [
  { value: '45+',    label: 'Device Models',     sublabel: 'Cisco · Juniper · Arista · and more' },
  { value: '3',      label: 'Security Profiles',  sublabel: 'None · Basic · Enterprise' },
  { value: '∞',      label: 'Network Designs',    sublabel: 'Describe anything — we build it' },
  { value: '1-Click', label: 'GNS3 Export',       sublabel: 'Import and run immediately' },
];

export default function StatsStrip() {
  return (
    <section className="bg-navy-900 border-y border-navy-800">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="text-center lg:text-left relative animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {i > 0 && (
                <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-px h-12 bg-navy-700" aria-hidden />
              )}
              <dt className="text-4xl lg:text-5xl font-bold text-gradient-brand tracking-tight">
                {stat.value}
              </dt>
              <dd className="mt-2">
                <div className="text-sm font-medium text-white">{stat.label}</div>
                <div className="text-xs text-navy-400 mt-0.5">{stat.sublabel}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
