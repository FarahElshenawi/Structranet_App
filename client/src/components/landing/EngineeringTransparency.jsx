/**
 * EngineeringTransparency — 6 architecture highlight cards on dark navy.
 */

const HIGHLIGHTS = [
  {
    title: 'Three-Gate Safe Merge',
    eyebrow: 'Config Safety',
    desc: 'The LLM can never corrupt hardware properties. Every config merge passes through whitelist → no-overwrite → type check. Slots, adapters, ports_mapping, and internal metadata keys are structurally protected.',
    points: [
      'Gate 1 — Whitelist: only software config keys accepted',
      'Gate 2 — No-overwrite: existing values never replaced',
      'Gate 3 — Type check: value must match allowed types',
    ],
    codeRef: 'config_agent.safe_merge_configs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    title: 'Auto-Repair Pipeline',
    eyebrow: 'Self-Healing',
    desc: 'Three repair functions run before validation, automatically fixing common topology issues. The LLM never sees these — they happen transparently in Python.',
    points: [
      'Duplicate connection removal (parallel links)',
      'Single-port violation repair (inserts inter-SW)',
      'Disconnected graph bridge via Union-Find',
    ],
    codeRef: 'agent._run_auto_repairs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    title: '11-Check Structural Validator',
    eyebrow: 'Quality Gate',
    desc: 'Every export passes 11 structural checks before a single byte is written to disk. Issues classified as CRITICAL, ERROR, WARNING, or INFO.',
    points: [
      'ZIP structure + JSON schema validation',
      'Dynamips compatibility matrix check',
      'Port reference integrity + VLAN sanity',
      'UUID format + duplicate link detection',
    ],
    codeRef: 'export/validator.py',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: 'SSE Streaming',
    eyebrow: 'Real-Time Glass-Box',
    desc: 'Watch the AI think in real-time. 11 event types flow from Python → Node.js → browser via Server-Sent Events. No black boxes, no spinners that lie.',
    points: [
      'token_delta — live text streaming',
      'tool_progress — flashing step updates',
      'topology_ready — instant preview',
      'deployment_ready — file list + download',
    ],
    codeRef: 'chat.orchestrator.js + sse.service.js',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: 'Enterprise Security Profiles',
    eyebrow: 'Production-Grade Hardening',
    desc: 'Three security profiles apply real Cisco IOS hardening — from no security to full enterprise with Zone-Based Firewall, TCP Intercept, DAI, and uRPF.',
    points: [
      'Basic: SSHv2, AAA, NTP, Syslog, SNMP removal',
      'Enterprise: ZBF, TCP Intercept, OSPF MD5, HSRP',
      'Switch hardening: DAI, DHCP Snooping, Port Security',
    ],
    codeRef: 'ai/security_prompts.py',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: '1,127-Line Cisco IOS KB',
    eyebrow: 'Built-In Expertise',
    desc: 'A plain-text Cisco IOS reference covering all 7 OSI layers in two passes — operational commands and security commands. Ask any networking question, get answers with proper syntax.',
    points: [
      'L1-L7 operational commands (interfaces, VLANs, routing)',
      'L1-L7 security commands (port security, ZBF, IPS)',
      'Section extractor scores by keyword overlap',
      'Lazy-loaded with @lru_cache for performance',
    ],
    codeRef: 'knowledge/cisco_knowledge_base.txt',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
];

export default function EngineeringTransparency() {
  return (
    <section id="architecture" className="relative py-20 lg:py-28 bg-navy-900 border-y border-navy-800 overflow-hidden">
      <div className="absolute inset-0 bg-grid-dark opacity-30" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-brand-400 tracking-wider uppercase mb-3">Engineering transparency</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            Built like an enterprise tool, <span className="text-gradient-brand">not a demo.</span>
          </h2>
          <p className="text-lg text-navy-300">Every architectural decision is documented in source. No magic, no black boxes.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {HIGHLIGHTS.map((item, i) => (
            <div
              key={item.title}
              className="group card p-6 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300 animate-fade-in-up flex flex-col"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-500/10 text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                  {item.icon}
                </div>
                <span className="text-[11px] font-semibold text-brand-400 uppercase tracking-wider">{item.eyebrow}</span>
              </div>

              <h3 className="text-base font-semibold text-white mb-2 leading-tight">{item.title}</h3>
              <p className="text-sm text-navy-300 leading-relaxed mb-4 flex-1">{item.desc}</p>

              <ul className="space-y-1.5 mb-4">
                {item.points.map((point, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-navy-200">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400 mt-0.5 flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-3 border-t border-navy-800">
                <code className="text-[10px] text-navy-500 font-mono">
                  <span className="text-brand-500">⟨</span> {item.codeRef} <span className="text-brand-500">⟩</span>
                </code>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-navy-400">
            Every claim above is verifiable in source code — file paths and function names shown on each card.
          </p>
        </div>
      </div>
    </section>
  );
}
