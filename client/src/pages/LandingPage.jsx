import Header from '../components/landing/Header.jsx';
import Hero from '../components/landing/Hero.jsx';
import StatsStrip from '../components/landing/StatsStrip.jsx';
import HowItWorks from '../components/landing/HowItWorks.jsx';
import SupportedNetworks from '../components/landing/SupportedNetworks.jsx';
import HardwareCatalog from '../components/landing/HardwareCatalog.jsx';
import EngineeringTransparency from '../components/landing/EngineeringTransparency.jsx';
import FinalCTA from '../components/landing/FinalCTA.jsx';
import Footer from '../components/landing/Footer.jsx';

/**
 * LandingPage — container for all landing sections.
 *
 * Sections built:
 *   ✅ Header (sticky nav)
 *   ✅ Hero (headline + mock chat animation)
 *   ✅ StatsStrip (4 real stats)
 *   ✅ HowItWorks (3-step workflow cards)
 *   ✅ SupportedNetworks (6 capability cards)
 *   ✅ HardwareCatalog (interactive filterable device grid)
 *   ✅ EngineeringTransparency (6 architecture highlight cards)
 *   ✅ FinalCTA (green gradient CTA)
 *   ✅ Footer (4-column with brand block)
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main>
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <SupportedNetworks />
        <HardwareCatalog />
        <EngineeringTransparency />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
