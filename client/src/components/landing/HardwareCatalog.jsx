import { useState, useMemo } from 'react';

/**
 * HardwareCatalog — interactive filterable device grid on dark navy.
 */

const CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'router',    label: 'Routers' },
  { id: 'switch',    label: 'Switches' },
  { id: 'firewall',  label: 'Firewalls' },
  { id: 'host',      label: 'Hosts' },
  { id: 'other',     label: 'Other' },
];

const DEVICES = [
  { name: 'Cisco 7200', category: 'router', platform: 'c7200', type: 'Dynamips', spec: '512MB RAM · slot0=C7200-IO-FE', desc: 'High-performance edge router. PCI bus supports PA-4T+ serial, PA-8E ethernet.', image: 'c7200-adventerprisek9-mz.124-24.T5.image', vendor: 'Cisco' },
  { name: 'Cisco 3745', category: 'router', platform: 'c3745', type: 'Dynamips', spec: '128MB RAM · NM-4T serial module', desc: 'Modular access router. Common choice for branch office and WAN simulations.', image: 'c3745-adventerprisek9-mz.124-25d.image', vendor: 'Cisco' },
  { name: 'Cisco IOSv', category: 'router', platform: 'qemu', type: 'QEMU', spec: '512MB RAM · 4 adapters (e1000)', desc: 'Modern virtual router running IOS 15.8. Supports GigabitEthernet0/0–0/3.', image: 'vios-adventerprisek9-mz.SPA.158-3.M3.qcow2', vendor: 'Cisco' },
  { name: 'Cisco CSR1000v', category: 'router', platform: 'qemu', type: 'QEMU', spec: '4GB RAM · 4 vmxnet3 adapters', desc: 'Cloud Services Router — IOS-XE. Designed for cloud and SD-WAN deployments.', image: 'csr1000v-universalk9-serial.qcow2', vendor: 'Cisco' },
  { name: 'Juniper vMX', category: 'router', platform: 'qemu', type: 'QEMU', spec: '4GB RAM · ge-0/0/X ports', desc: 'Virtual MX router running Junos. Common in service-provider labs.', image: 'jinstall-vfpx-17.3R1.10.img', vendor: 'Juniper' },
  { name: 'Cisco IOSv-L2', category: 'switch', platform: 'qemu', type: 'QEMU', spec: '1GB RAM · 8 adapters (e1000)', desc: 'Layer-2/3 switch running IOS 15.8. Supports VLANs, trunks, EtherChannel, STP.', image: 'vios_l2-adventerprisek9-mz.SPA.158-3.M3.qcow2', vendor: 'Cisco' },
  { name: 'Cisco Nexus 9000v', category: 'switch', platform: 'qemu', type: 'QEMU', spec: '8GB RAM · 2 CPUs · 8 adapters', desc: 'Data center spine/leaf switch running NX-OS. Supports VXLAN, BGP EVPN.', image: 'n9kv-disk-a.qcow2', vendor: 'Cisco' },
  { name: 'Arista vEOS', category: 'switch', platform: 'qemu', type: 'QEMU', spec: '2GB RAM · Ethernet1/X ports', desc: 'Virtual Arista EOS. Modern data center switch with Linux-based EOS.', image: 'vEOS-lab-4.27.0F.vmdk', vendor: 'Arista' },
  { name: 'Ethernet Switch', category: 'switch', platform: 'builtin', type: 'Built-in', spec: '8 ports · access/dot1q/qinq', desc: 'Built-in GNS3 Ethernet switch. Configurable port types and VLAN mapping.', image: null, vendor: 'GNS3' },
  { name: 'Cisco ASAv', category: 'firewall', platform: 'qemu', type: 'QEMU', spec: '2GB RAM · 4 adapters', desc: 'Adaptive Security Virtual Appliance. Stateful firewall with NAT, VPN, IPS.', image: 'asav-9162-ssh.qcow2', vendor: 'Cisco' },
  { name: 'FortiGate', category: 'firewall', platform: 'qemu', type: 'QEMU', spec: '1GB RAM · portX ports', desc: 'Fortinet FortiGate VM. Next-gen firewall with UTM, IPS, web filtering.', image: 'FGT_VM64_KVM-v7.2.3.qcow2', vendor: 'Fortinet' },
  { name: 'Palo Alto VM-100', category: 'firewall', platform: 'qemu', type: 'QEMU', spec: '4GB RAM · ethernet1/X ports', desc: 'PAN-OS virtual firewall. App-ID, User-ID, Content-ID for enterprise security.', image: 'PA-VM-10.2.3.qcow2', vendor: 'Palo Alto' },
  { name: 'VPCS', category: 'host', platform: 'builtin', type: 'Built-in', spec: '1 port · startup_script', desc: 'Virtual PC Simulator. Lightweight IP host for testing connectivity.', image: null, vendor: 'GNS3' },
  { name: 'Ubuntu', category: 'host', platform: 'qemu', type: 'QEMU', spec: '2GB RAM · ensX interfaces', desc: 'Full Ubuntu 22.04 desktop. For testing services, automation, Ansible, etc.', image: 'ubuntu-22.04-desktop-amd64.qcow2', vendor: 'Canonical' },
  { name: 'Kali Linux', category: 'host', platform: 'qemu', type: 'QEMU', spec: '2GB RAM · ethX interfaces', desc: 'Penetration testing distro. Use for security audits against your topology.', image: 'kali-linux-2023.4-qemu-amd64.qcow2', vendor: 'Offensive Security' },
  { name: 'NAT', category: 'other', platform: 'builtin', type: 'Built-in', spec: '1 port · auto nat0 → virbr0', desc: 'Built-in NAT node. Provides internet access via the host\'s virbr0/vmnet8.', image: null, vendor: 'GNS3' },
  { name: 'pfSense', category: 'other', platform: 'qemu', type: 'QEMU', spec: '2GB RAM · emX interfaces', desc: 'Open-source firewall/router based on FreeBSD. Web UI, VPN, captive portal.', image: 'pfSense-CE-2.7.2-RELEASE-amd64.qcow2', vendor: 'Netgate' },
  { name: 'VyOS', category: 'other', platform: 'qemu', type: 'QEMU', spec: '1GB RAM · ethX interfaces', desc: 'Linux-based open-source router. Supports BGP, OSPF, MPLS, VRF.', image: 'vyos-1.4-rolling-202312120017-amd64.qcow2', vendor: 'VyOS' },
];

const CATEGORY_META = {
  router:   { icon: '◈', color: 'text-brand-400', bg: 'bg-brand-500/10' },
  switch:   { icon: '⬡', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  firewall: { icon: '🛡', color: 'text-red-400', bg: 'bg-red-500/10' },
  host:     { icon: '◷', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  other:    { icon: '◆', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const VENDOR_COLORS = {
  Cisco: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Juniper: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Arista: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Fortinet: 'bg-red-500/10 text-red-400 border-red-500/30',
  'Palo Alto': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Canonical: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  'Offensive Security': 'bg-navy-800 text-navy-300 border-navy-700',
  Netgate: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  VyOS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  GNS3: 'bg-navy-800 text-navy-300 border-navy-700',
};

export default function HardwareCatalog() {
  const [activeCategory, setActiveCategory] = useState('all');

  const categoryCounts = useMemo(() => {
    const counts = { all: DEVICES.length };
    for (const cat of CATEGORIES) {
      if (cat.id === 'all') continue;
      counts[cat.id] = DEVICES.filter(d => d.category === cat.id).length;
    }
    return counts;
  }, []);

  const filteredDevices = useMemo(() => {
    if (activeCategory === 'all') return DEVICES;
    return DEVICES.filter(d => d.category === activeCategory);
  }, [activeCategory]);

  return (
    <section id="catalog" className="relative py-20 lg:py-28 bg-navy-950">
      <div className="absolute inset-0 bg-grid-dark opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-radial-glow-green-top" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-brand-400 tracking-wider uppercase mb-3">Hardware catalog</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            45 devices. <span className="text-gradient-brand">One prompt away.</span>
          </h2>
          <p className="text-lg text-navy-300">Curated highlights from the catalog. Filter by category to explore.</p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                    : 'bg-navy-900 text-navy-300 border border-navy-700 hover:border-brand-500/50 hover:text-brand-400'
                }`}
              >
                {cat.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-navy-800 text-navy-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Device grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevices.map((device, i) => {
            const meta = CATEGORY_META[device.category];
            const vendorColor = VENDOR_COLORS[device.vendor] || 'bg-navy-800 text-navy-300 border-navy-700';
            return (
              <div
                key={device.name}
                className="card p-5 hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${meta.bg} ${meta.color} text-lg`}>
                      {meta.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-tight">{device.name}</h3>
                      <p className="text-[11px] text-navy-400 mt-0.5">{device.platform} · {device.type}</p>
                    </div>
                  </div>
                  <span className={`badge text-[10px] border ${vendorColor}`}>{device.vendor}</span>
                </div>
                <p className="text-xs text-navy-300 leading-relaxed mb-3 min-h-[48px]">{device.desc}</p>
                <div className="text-[11px] text-navy-200 bg-navy-950 border border-navy-700 rounded-md px-2.5 py-1.5 mb-2 font-mono">
                  {device.spec}
                </div>
                {device.image && (
                  <div className="text-[10px] text-navy-500 font-mono truncate" title={device.image}>
                    📦 {device.image}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-navy-400">
            Showing {filteredDevices.length} of {DEVICES.length} curated devices ·{' '}
            <span className="text-navy-200 font-medium">30+ more in the full catalog</span>
          </p>
          <p className="text-xs text-navy-500 mt-1">
            Catalog loaded from <code className="text-brand-400 bg-brand-500/10 px-1 py-0.5 rounded">appliances.py</code> — extensible via user JSON overlay
          </p>
        </div>
      </div>
    </section>
  );
}
