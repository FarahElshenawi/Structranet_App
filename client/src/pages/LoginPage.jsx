import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';

const BrandLogo = ({ className = 'w-9 h-9' }) => (
  <div className={`${className} rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/30`}>
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 8v8M18 8v8M8 6h8M8 18h8M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" />
    </svg>
  </div>
);

// ── Animated network topology background (left panel) ────────
// Subtle pulsing nodes + connections at low opacity.
// Communicates "AI + Networking" without distracting.
const NetworkBackground = () => {
  const nodes = [
    { x: 80, y: 60, r: 4, delay: '0s' },
    { x: 200, y: 40, r: 3, delay: '0.5s' },
    { x: 320, y: 80, r: 5, delay: '1s' },
    { x: 440, y: 50, r: 3, delay: '1.5s' },
    { x: 120, y: 160, r: 4, delay: '0.3s' },
    { x: 260, y: 200, r: 3, delay: '0.8s' },
    { x: 380, y: 180, r: 4, delay: '1.3s' },
    { x: 60, y: 280, r: 3, delay: '0.6s' },
    { x: 200, y: 320, r: 5, delay: '1.1s' },
    { x: 340, y: 300, r: 3, delay: '0.4s' },
    { x: 460, y: 260, r: 4, delay: '0.9s' },
  ];
  const links = [
    [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6],
    [4, 5], [5, 6], [4, 7], [5, 8], [6, 9], [7, 8],
    [8, 9], [9, 10], [3, 10], [6, 10],
  ];
  return (
    <svg
      viewBox="0 0 520 360"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.08 }}
      aria-hidden
    >
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="#34d399"
          strokeWidth="1"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill="#34d399"
          style={{
            animation: `auth-node-pulse 3s ease-in-out infinite`,
            animationDelay: n.delay,
            transformOrigin: `${n.x}px ${n.y}px`,
          }}
        />
      ))}
    </svg>
  );
};

// ── Feature items with unique icons ──────────────────────────
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4.5 4.5 0 0 1 4.5 4.5c0 1.5-.5 2.5-1.5 3.5s-1.5 2-1.5 3.5" />
        <path d="M8 14a4 4 0 0 0 8 0c0-1.5-.5-2.5-1.5-3.5s-1.5-2-1.5-3.5" />
        <path d="M12 18v3" />
      </svg>
    ),
    text: 'Glass-box AI reasoning with full tool-call visibility',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    text: 'One-click GNS3 project export with Cisco IOS configs',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    text: 'Iterative editing — surgically modify any topology',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[3fr_2fr] bg-zinc-950">
      {/* ─────────────── Left: Brand panel (60%) ─────────────── */}
      <div className="relative hidden lg:flex flex-col justify-between bg-zinc-950 text-white overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950" />
        {/* Animated network topology (subtle, 8% opacity) */}
        <NetworkBackground />
        {/* Glow blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-3xl" />

        {/* Top: Logo */}
        <div className="relative p-10 z-10">
          <Link to="/" className="flex items-center gap-2.5 group">
            <BrandLogo />
            <span className="font-semibold text-lg tracking-tight">
              StructuraNet<span className="text-emerald-400"> AI</span>
            </span>
          </Link>
        </div>

        {/* Middle: Headline + features */}
        <div className="relative px-10 pb-10 max-w-lg z-10">
          <h1 className="text-4xl font-bold tracking-tight leading-tight mb-4">
            Design networks<br />
            <span className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-emerald-300 bg-clip-text text-transparent">
              in plain English.
            </span>
          </h1>
          <p className="text-zinc-400 leading-relaxed mb-8">
            Sign in to pick up where you left off — your topologies, exports, and
            calibration are waiting.
          </p>

          {/* Feature list with unique icons */}
          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20 text-emerald-400">
                  {f.icon}
                </span>
                <span className="pt-1">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: copyright */}
        <div className="relative p-10 text-xs text-zinc-600 z-10">
          © {new Date().getFullYear()} StructuraNet AI · Graduation Project
        </div>
      </div>

      {/* ─────────────── Right: Form panel (40%) ─────────────── */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12 relative bg-zinc-950">
        {/* Mobile logo */}
        <div className="lg:hidden absolute top-6 left-6">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="w-8 h-8" />
            <span className="font-semibold text-white">StructuraNet AI</span>
          </Link>
        </div>

        {/* Form card — subtle container with border + radius */}
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-sm p-8 shadow-2xl shadow-black/20">
            <div className="mb-7">
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Welcome back</h2>
              <p className="text-zinc-500 mt-1.5 text-sm">Sign in to StructuraNet AI to continue designing.</p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-fade-in-down">
                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input rounded-xl"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-zinc-300">Password</label>
                  <button type="button" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input rounded-xl"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-transform"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline underline-offset-2">
                Create one
              </Link>
            </div>
          </div>

          <div className="mt-5 text-center">
            <Link to="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>

      {/* ── Animations ────────────────────────────────────────── */}
      <style>{`
        @keyframes auth-node-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
