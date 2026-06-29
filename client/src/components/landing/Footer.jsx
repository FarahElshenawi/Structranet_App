import { Link } from 'react-router-dom';

/**
 * Footer — 4-column dark footer with brand block, product, resources, architecture.
 */
const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Capabilities', href: '#networks' },
      { label: 'Hardware catalog', href: '#catalog' },
      { label: 'Architecture', href: '#architecture' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'Use cases', href: '#' },
      { label: 'Cisco KB', href: '#' },
      { label: 'Setup guide', href: '#' },
    ],
  },
  {
    title: 'Architecture',
    links: [
      { label: 'Three-Gate Safe Merge', href: '#architecture' },
      { label: 'Auto-Repair Pipeline', href: '#architecture' },
      { label: '11-Check Validator', href: '#architecture' },
      { label: 'SSE Streaming', href: '#architecture' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-navy-800">
      <div className="max-w-7xl mx-auto px-6 py-14">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-500/30">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2" />
                  <circle cx="18" cy="6" r="2" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="18" cy="18" r="2" />
                  <path d="M8 6h8M6 8v8M18 8v8M8 18h8" />
                </svg>
              </span>
              <span className="font-semibold text-white text-base tracking-tight">
                StructuraNet <span className="text-brand-400">AI</span>
              </span>
            </Link>
            <p className="text-sm text-navy-400 leading-relaxed mb-4">
              Graduation project. Built with Express, React, and Python. Powered by LLM tool-calling.
            </p>
            <div className="flex items-center gap-2 text-xs text-navy-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-navy-400 hover:text-brand-400 transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-8 h-px bg-navy-800" />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-navy-500">
          <p>© 2026 StructuraNet AI · Graduation Project</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              v2.0.0
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Enterprise-grade
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              Open architecture
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
