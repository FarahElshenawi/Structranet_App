/**
 * UseCases — "What You Can Build" — concrete scenarios users can create.
 * Shows product breadth without revealing implementation details.
 */

const USE_CASES = [
  {
    title: 'Enterprise Networks',
    desc: 'Multi-site corporate networks with core, distribution, and access layers. Redundant routers, firewall segmentation, and OSPF routing.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    tags: ['Routers', 'Firewalls', 'OSPF', 'HSRP'],
  },
  {
    title: 'Campus Networks',
    desc: 'University or office campus with multiple buildings, VLAN segmentation, inter-building fiber links, and centralized DHCP.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
    ),
    tags: ['VLANs', 'Switches', 'Trunking', 'DHCP'],
  },
  {
    title: 'Branch Offices',
    desc: 'Small remote sites with a router, a switch, a few PCs, and a VPN tunnel back to headquarters. Perfect for testing SD-WAN scenarios.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    tags: ['VPN', 'NAT', 'Routers', 'PCs'],
  },
  {
    title: 'Security Labs',
    desc: 'Dedicated environments for testing firewalls, ACLs, zone-based policies, DHCP snooping, ARP inspection, and port security.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    tags: ['ASAv', 'ZBF', 'ACLs', 'DAI'],
  },
  {
    title: 'Data Center Topologies',
    desc: 'Spine-leaf architectures, multi-tier server farms, and high-availability clusters with redundant uplinks and load balancing.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    tags: ['Spine-Leaf', 'Servers', 'HSRP', 'Nexus'],
  },
  {
    title: 'Home & Education Labs',
    desc: 'Simple topologies for learning: a router, a switch, a few PCs. Practice routing protocols, VLANs, and IOS commands without setup overhead.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h20v14H2zM8 21h8M12 17v4" />
      </svg>
    ),
    tags: ['VPCS', 'IOSv', 'Learning', 'CCNA'],
  },
];

export default function UseCases() {
  return (
    <section id="use-cases" className="relative py-20 lg:py-28 bg-navy-950 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400 mb-3">
            What You Can Build
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
            If you can describe it, you can build it
          </h2>
          <p className="text-zinc-400 mt-3 max-w-xl mx-auto text-[15px] leading-relaxed">
            From a 2-device learning lab to a 20-device enterprise network —
            StructuraNet handles the design, configuration, and wiring.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {USE_CASES.map((uc) => (
            <div
              key={uc.title}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-brand-500/30 hover:bg-zinc-900/80 transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-400 ring-1 ring-inset ring-brand-500/20 flex items-center justify-center mb-4 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                {uc.icon}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-white mb-2">{uc.title}</h3>

              {/* Description */}
              <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">{uc.desc}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {uc.tags.map(tag => (
                  <span key={tag} className="text-[10px] font-medium text-zinc-400 bg-zinc-800 rounded-md px-2 py-0.5">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
