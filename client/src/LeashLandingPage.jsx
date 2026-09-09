import { useEffect } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { initLenis } from './lib/lenis'
import LeashNav from './components/LeashNav'
import LeashHero from './components/LeashHero'
import ThreatModelSection from './components/ThreatModelSection'
import LifecycleTimeline from './components/LifecycleTimeline'
import ArchitectureMatrix from './components/ArchitectureMatrix'
import AdversarialGates from './components/AdversarialGates'
import TrustLedgerTable from './components/TrustLedgerTable'
import LeashFaq from './components/LeashFaq'
import LeashFooter from './components/LeashFooter'

export default function LeashLandingPage({
  onOpenCockpit,
  onOpenDemo,
  runtime,
  onRefresh,
  programId,
  evidence,
  evidenceError,
}) {
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60,
      mirror: false,
    })
    initLenis()
    const refresh = () => AOS.refresh()
    window.addEventListener('load', refresh)
    return () => window.removeEventListener('load', refresh)
  }, [])

  return (
    <div className="leash-page leash-landing-page">
      <div className="leash-shell">
        {/* Navigation */}
        <LeashNav
          onOpenCockpit={onOpenCockpit}
          onOpenDemo={onOpenDemo}
        />

        {/* Hero Section with Interactive Permit Playground */}
        <LeashHero
          runtime={runtime}
          programId={programId}
          evidence={evidence}
          onOpenCockpit={onOpenCockpit}
          onOpenDemo={onOpenDemo}
        />

        {/* Threat Matrix Section: Why Swarms Break Standard Wallets */}
        <ThreatModelSection />

        {/* 5-Phase Cryptographic Lifecycle Interactive Machine */}
        <LifecycleTimeline evidence={evidence} />

        {/* Three-Tier System Topology Matrix */}
        <ArchitectureMatrix programId={programId} />

        {/* Live Adversarial Gate Verification Suite */}
        <AdversarialGates
          runtime={runtime}
          evidence={evidence}
          evidenceError={evidenceError}
          onRefresh={onRefresh}
        />

        {/* Formal Account Model & Trust Boundary Specification */}
        <TrustLedgerTable />

        {/* Frequently Asked Questions */}
        <LeashFaq />
      </div>

      {/* Technical Colophon Footer */}
      <LeashFooter
        onOpenCockpit={onOpenCockpit}
      />
    </div>
  )
}
