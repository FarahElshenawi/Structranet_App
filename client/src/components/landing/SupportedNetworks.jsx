/**
 * SupportedNetworks — 6 capability cards on dark navy.
 */

const NETWORKS = [
  {
    title: 'Campus Networks',
    desc: 'Multi-tier designs with VLANs, inter-VLAN routing via router-on-a-stick, core/access switching hierarchy, and NAT path to the internet.',
    tags: ['VLANs', 'Router-on-a-Stick', 'OSPF', 'NAT'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
      </svg>
    ),
  },
  {
    title: 'Multi-Site Enterprise',
    desc: 'Branch offices with per-branch NAT, WAN serial links between perimeter routers, OSPF MD5 authentication, and HSRP for gateway redundancy.',
    tags: ['WAN Links', 'OSPF MD5', 'HSRP', 'Multi-Branch'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: 'Home Lab & SMB',
    desc: 'Firewall + VPN + NAT + DMZ — all from one prompt. Built on pfSense, VyOS, or Cisco ASAv depending on your requirements.',
    tags: ['pfSense', 'VyOS', 'ASAv', 'VPN'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: 'Data Center Spine-Leaf',
    desc: 'L3 fabric with BGP using Arista vEOS, Cumulus VX, or Cisco Nexus 9000v. Built for high-throughput, low-latency east-west traffic.',
    tags: ['Spine-Leaf', 'BGP', 'Nexus 9000v', 'Arista vEOS'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    title: 'Secure Environments',
    desc: 'Zone-Based Firewall, TCP Intercept for SYN floods, Dynamic ARP Inspection, DHCP Snooping, Port Security, and uRPF — all under the enterprise profile.',
    tags: ['ZBF', 'TCP Intercept', 'DAI', 'Port Security'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    title: 'Cisco Knowledge Base',
    desc: 'Built-in 1,127-line Cisco IOS reference covering all 7 OSI layers. Ask any networking question — OSPF, BGP, VLANs, ACLs — get answers with proper syntax.',
    tags: ['7 OSI Layers', 'IOS Syntax', 'Verification', 'Security'],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
];

export default function SupportedNetworks() {
  return (
    <section id="networks" className="relative py-20 lg:py-28 bg-navy-900 border-y border-navy-800">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-brand-400 tracking-wider uppercase mb-3">Capabilities</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">What can you build?</h2>
          <p className="text-lg text-navy-300">From a single switch to a multi-branch enterprise — one prompt, one tool.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {NETWORKS.map((net, i) => (
            <div
              key={net.title}
              className="group card p-6 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                {net.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{net.title}</h3>
              <p className="text-sm text-navy-300 leading-relaxed mb-4">{net.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {net.tags.map((tag) => (
                  <span key={tag} className="badge-neutral text-[11px]">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
