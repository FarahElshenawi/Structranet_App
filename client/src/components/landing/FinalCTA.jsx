import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore.js';

/**
 * FinalCTA — emerald-to-navy gradient CTA section.
 */
export default function FinalCTA() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-900 to-navy-950 py-20 lg:py-28">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%23ffffff' stroke-opacity='0.3' stroke-width='1'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
      {/* Glow blobs */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl" aria-hidden />
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-emerald-300/15 rounded-full blur-3xl" aria-hidden />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-1 text-xs text-white/80 mb-6 animate-fade-in-down">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="font-medium">Ready when you are</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5 animate-fade-in-up">
          Design your first network{' '}
          <span className="bg-gradient-to-r from-emerald-200 via-emerald-100 to-white bg-clip-text text-transparent">
            in the next 60 seconds.
          </span>
        </h2>

        <p className="text-lg text-white/80 max-w-2xl mx-auto mb-9 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Free to try. No credit card. No limits. Just describe what you want and watch the AI build it.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mb-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <Link
            to={isAuthenticated ? '/chat' : '/register'}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-brand-700 hover:bg-navy-50 px-6 py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] w-full sm:w-auto"
          >
            {isAuthenticated ? 'Open Chat' : 'Get Started Free'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 text-white hover:bg-white/10 px-6 py-3 text-base font-medium transition-all w-full sm:w-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Read the Docs
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/60 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Open architecture
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            45-device catalog
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Three-gate safe merge
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            11-check validation
          </span>
        </div>
      </div>
    </section>
  );
}
