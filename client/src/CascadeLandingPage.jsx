import { useEffect, useState } from 'react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import EvidenceBoard from './components/EvidenceBoard.jsx'
import CascadeArchitecture from './components/CascadeArchitecture.jsx'

const PHOTOS = [
  {
    src: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    alt: 'Glass office towers',
  },
  {
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=600&q=80',
    alt: 'Checkout counter',
  },
  {
    src: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=600&q=80',
    alt: 'Desk with documents',
  },
]

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 7h9M7.5 3.5 11 7l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

export default function CascadeLandingPage({
  theme,
  onToggleTheme,
  onOpenCockpit,
  runtime,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    AOS.init({
      duration: 900,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
      mirror: false,
    })
    const refresh = () => AOS.refresh()
    window.addEventListener('load', refresh)
    return () => window.removeEventListener('load', refresh)
  }, [])

  useEffect(() => {
    AOS.refresh()
  }, [theme])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const scrollTo = (id) => {
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">
      {/* Top Navigation Shell */}
      <div className="landing-shell">
        <header className="landing-nav">
          <a
            className="landing-wordmark"
            href="#hero"
            onClick={(e) => {
              e.preventDefault()
              scrollTo('hero')
            }}
          >
            <span>LE</span>ASH
          </a>

          <div className="landing-nav-actions">
            <button
              className="landing-theme-btn"
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={onToggleTheme}
            >
              <span className="landing-theme-dot" aria-hidden="true" />
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>

            <button
              className="landing-menu-btn"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="landing-menu"
              onClick={() => setMenuOpen(true)}
            >
              Menu
              <span className="landing-menu-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </header>
      </div>

      {/* Slide-out Menu Panel */}
      <div
        className={`landing-menu-panel${menuOpen ? ' is-open' : ''}`}
        id="landing-menu"
        aria-hidden={!menuOpen}
      >
        <button
          className="landing-menu-close"
          type="button"
          onClick={() => setMenuOpen(false)}
        >
          Close
        </button>
        <nav aria-label="Primary">
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onOpenCockpit()
            }}
          >
            Operator Cockpit
          </button>
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => scrollTo('evidence')}
          >
            Evidence Path
          </button>
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => scrollTo('flow')}
          >
            How it works
          </button>
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => scrollTo('architecture')}
          >
            Architecture
          </button>
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => scrollTo('authority')}
          >
            Authority & Trust
          </button>
          <button
            className="landing-btn-ghost"
            type="button"
            onClick={() => scrollTo('demo')}
          >
            See Devnet Demo
          </button>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="landing-hero" id="hero">
        <div className="landing-shell">
          <p
            className="landing-micro landing-hero-kicker"
            data-aos="fade-down"
            data-aos-delay="0"
          >
            CONFIDENTIAL SPENDING KERNEL · GOVERNED ON SOLANA DEVNET & TEE PER
          </p>

          <h1 className="landing-hero-title">
            <span
              className="landing-hero-line"
              data-aos="fade-up"
              data-aos-delay="80"
            >
              From an
              <img
                className="landing-photo"
                src={PHOTOS[0].src}
                alt={PHOTOS[0].alt}
              />
              agent ask
            </span>
            <span
              className="landing-hero-line"
              data-aos="fade-up"
              data-aos-delay="180"
            >
              to a
              <img
                className="landing-photo"
                src={PHOTOS[1].src}
                alt={PHOTOS[1].alt}
              />
              <em>settlement</em>
            </span>
            <span
              className="landing-hero-line"
              data-aos="fade-up"
              data-aos-delay="280"
            >
              with
              <img
                className="landing-photo"
                src={PHOTOS[2].src}
                alt={PHOTOS[2].alt}
              />
              proof.
            </span>
          </h1>

          <p
            className="landing-body landing-hero-support"
            data-aos="fade-up"
            data-aos-delay="360"
          >
            LEASH turns an autonomous agent capability request into a private,
            bounded spending permit inside a MagicBlock Private Ephemeral Rollup,
            enforces zero sibling leakage, and settles through an authenticated SPL Magic Action.
          </p>

          <div
            className="landing-hero-actions"
            data-aos="zoom-in"
            data-aos-delay="460"
          >
            <button
              className="landing-btn"
              type="button"
              onClick={onOpenCockpit}
            >
              Launch Operator Cockpit
              <Arrow />
            </button>
            <button
              className="landing-btn"
              type="button"
              onClick={() => scrollTo('evidence')}
            >
              Inspect Evidence
              <Arrow />
            </button>
            <button
              className="landing-link"
              type="button"
              onClick={() => scrollTo('architecture')}
              style={{ background: 'none', border: 0, padding: 0 }}
            >
              Explore the architecture
            </button>
          </div>
        </div>
      </section>

      <hr className="landing-rule" data-aos="zoom-in" />

      {/* Vol. 01 · Evidence Path (Interactive Dossier Loop) */}
      <section className="landing-section" id="evidence">
        <div className="landing-shell">
          <p className="landing-micro landing-section-label" data-aos="fade-up">
            Vol. 01 · Evidence path
          </p>
          <h2
            className="landing-section-title"
            data-aos="fade-up"
            data-aos-delay="80"
          >
            Ask once. Settle with evidence.
          </h2>
          <p
            className="landing-section-copy"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            A looping walk through the sealed cryptographic artifacts of a spending permit.
            Hover to pause; step with Previous and Next anytime.
          </p>
          <EvidenceBoard />
        </div>
      </section>

      {/* Flow Section: The Smallest Safe Path */}
      <section className="landing-section" id="flow">
        <div className="landing-shell">
          <div className="landing-section-label landing-tag" data-aos="fade-up">
            Contract · Evidence · Authority · Settlement
          </div>
          <h2
            className="landing-section-title"
            data-aos="fade-up"
            data-aos-delay="60"
          >
            The smallest safe path.
          </h2>
          <p
            className="landing-section-copy"
            data-aos="fade-up"
            data-aos-delay="120"
          >
            Models propose. Deterministic code owns money and state.
            No search agent holds a wallet. No AI advances a financial state alone.
          </p>
          <div className="landing-flow">
            {[
              {
                index: '01',
                title: 'Policy',
                body: 'The controller delegates SecretPolicy into the private TEE enclave. Neither spending limits nor balances ever touch public gossip.',
              },
              {
                index: '02',
                title: 'Verify',
                body: 'Permit requests are validated against monotonic counters and typed constraints: destination program, discriminator, mint, and cap.',
              },
              {
                index: '03',
                title: 'Authorize',
                body: 'SessionLedger isolates the agent. Authenticated siblings attempting direct or batch RPC queries are rejected with zero leakage.',
              },
              {
                index: '04',
                title: 'Settle',
                body: 'SPL Magic Action executes atomically. Public Terminal PDA transitions to Spent or Expired exactly once without replay risk.',
              },
            ].map((step, i) => (
              <article
                className="landing-flow-step"
                key={step.index}
                data-aos="fade-up"
                data-aos-delay={i * 100}
              >
                <span className="landing-micro landing-flow-index">
                  {step.index}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <hr className="landing-rule" data-aos="zoom-in" />

      {/* Architecture Section */}
      <section className="landing-section" id="architecture">
        <div className="landing-shell">
          <p className="landing-micro landing-section-label" data-aos="fade-up">
            Architecture · Tech stack
          </p>
          <h2
            className="landing-section-title"
            data-aos="fade-up"
            data-aos-delay="60"
          >
            Channels in. Kernel decides. Consensus out.
          </h2>
          <p
            className="landing-section-copy"
            data-aos="fade-up"
            data-aos-delay="100"
          >
            One Rust kernel behind multi-agent swarms and read-only relays.
            Policy and ledger stay inside the MagicBlock TEE PER.
            Solana base layer verifies public terminal PDA outcomes.
          </p>
          <CascadeArchitecture />
        </div>
      </section>

      {/* Dark Authority Section */}
      <section className="landing-section-dark" id="authority">
        <div className="landing-shell">
          <p className="landing-micro landing-section-label" data-aos="fade-up">
            Adaptive autonomy with proof of authority
          </p>
          <h2
            className="landing-section-title"
            data-aos="zoom-in"
            data-aos-delay="80"
          >
            Agents propose. Code decides.
          </h2>
          <p
            className="landing-section-copy"
            data-aos="fade-up"
            data-aos-delay="140"
          >
            LEASH routes capability requests to hardware-isolated ephemeral rollups.
            Losing concurrent attempts in a 20-agent race are rejected atomically without mutating state.
          </p>
          <div className="landing-dark-grid">
            <button
              className="landing-btn-ghost"
              type="button"
              onClick={onOpenCockpit}
              data-aos="flip-up"
              data-aos-delay="0"
            >
              Open Operator View
            </button>
            <button
              className="landing-btn-ghost"
              type="button"
              onClick={() => scrollTo('flow')}
              data-aos="flip-up"
              data-aos-delay="100"
            >
              Inspect Safe Path
            </button>
            <button
              className="landing-btn-ghost"
              type="button"
              onClick={() => scrollTo('demo')}
              data-aos="flip-up"
              data-aos-delay="200"
            >
              Review Test Gates
            </button>
          </div>
        </div>
      </section>

      {/* Modes in Print */}
      <section className="landing-section">
        <div className="landing-shell">
          <p className="landing-micro landing-section-label" data-aos="fade-up">
            Modes in print
          </p>
          <h2
            className="landing-section-title"
            data-aos="fade-up"
            data-aos-delay="60"
          >
            Built for one agent — and twenty.
          </h2>
          <div className="landing-modes">
            {[
              {
                tag: 'Direct Permit',
                title: 'Confidential capability',
                body: 'One typed request, atomic reservation against SecretPolicy, and single-use settlement with zero public bytes leaked.',
              },
              {
                tag: 'Swarm Race',
                title: '20-agent contention',
                body: 'Twenty autonomous agents competing for one remaining budget permit. Exactly 1 wins; 19 are rejected cleanly.',
              },
              {
                tag: 'Rollback & Retry',
                title: 'Atomic resilience',
                body: 'If an SPL Magic Action fails due to an underfunded vault or network fault, the private reservation remains intact for safe retry.',
              },
              {
                tag: 'Terminal PDA',
                title: 'Mutual exclusion',
                body: 'Public Solana terminal PDA finishes either Spent or Expired, never both. Hardware nonces bar double-spending.',
              },
            ].map((mode, i) => (
              <article
                className="landing-mode"
                key={mode.tag}
                data-aos={i % 2 === 0 ? 'fade-right' : 'fade-left'}
                data-aos-delay={(i % 2) * 80}
              >
                <span className="landing-tag">{mode.tag}</span>
                <h3>{mode.title}</h3>
                <p>{mode.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="landing-section">
        <div className="landing-shell">
          <div className="landing-stats">
            {[
              {
                tag: 'Swarm contention',
                value: '20',
                body: 'Concurrent agent sessions tested competing for 1 remaining budget unit. Exactly one winner.',
              },
              {
                tag: 'Terminal PDA',
                value: '1°',
                body: 'Mutually exclusive terminal marker. Ends as Spent or Expired, never both.',
              },
              {
                tag: 'Leakage standard',
                value: '0',
                body: 'Private bytes leaked to base-layer Solana RPC, gossip, transaction logs, or simulation.',
              },
            ].map((stat, i) => (
              <article
                key={stat.tag}
                data-aos="zoom-in"
                data-aos-delay={i * 120}
              >
                <span className="landing-tag">{stat.tag}</span>
                <p className="landing-stat-value">{stat.value}</p>
                <p>{stat.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <hr className="landing-rule" data-aos="zoom-in" />

      {/* Demo Section */}
      <section className="landing-section" id="demo">
        <div className="landing-shell">
          <div className="landing-demo">
            <div data-aos="fade-up">
              <p className="landing-micro landing-section-label">
                Forty-five seconds
              </p>
              <p className="landing-demo-quote">
                Request → private reservation → SPL action → settlement.
              </p>
            </div>
            <div
              className="landing-demo-aside"
              data-aos="fade-up"
              data-aos-delay="120"
            >
              <p className="landing-body">
                The landing page proves the product in one screen. The
                operator dashboard shows live Devnet RPC slot and program health — not a spinner.
              </p>
              <ol>
                {[
                  'Compile agent intent into private typed permit',
                  'Isolate session in MagicBlock TEE PER enclave',
                  'Execute SPL Magic Action with rollback protection',
                  'Publish terminal marker to Solana consensus',
                ].map((item, i) => (
                  <li
                    key={item}
                    data-aos="fade-left"
                    data-aos-delay={160 + i * 80}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    {item}
                  </li>
                ))}
              </ol>
              <div
                style={{
                  marginTop: 30,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <button
                  className="landing-btn"
                  type="button"
                  onClick={onOpenCockpit}
                >
                  Launch Operator Cockpit
                  <Arrow />
                </button>
                <button
                  className="landing-btn"
                  type="button"
                  onClick={() => scrollTo('evidence')}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--ui-ink)',
                    color: 'var(--ui-ink)',
                    boxShadow: 'none',
                  }}
                >
                  Inspect Evidence
                  <Arrow />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-shell">
          <div className="landing-footer-grid">
            <div data-aos="fade-up">
              <h2>LEASH</h2>
              <p>
                From an agent ask to a governed settlement, with hardware-isolated ephemeral rollups.
              </p>
            </div>
            <div
              className="landing-footer-col"
              data-aos="fade-up"
              data-aos-delay="60"
            >
              <span className="landing-micro">Console</span>
              <button
                type="button"
                className="landing-micro"
                onClick={onOpenCockpit}
              >
                Operator Cockpit
              </button>
              <span className="landing-micro">
                RPC: {runtime.state}
              </span>
              <span className="landing-micro">
                Slot: {runtime.slot}
              </span>
            </div>
            <div
              className="landing-footer-col"
              data-aos="fade-up"
              data-aos-delay="120"
            >
              <span className="landing-micro">Architecture</span>
              <button
                type="button"
                className="landing-micro"
                onClick={() => scrollTo('flow')}
              >
                How it works
              </button>
              <button
                type="button"
                className="landing-micro"
                onClick={() => scrollTo('architecture')}
              >
                Topology
              </button>
              <button
                type="button"
                className="landing-micro"
                onClick={() => scrollTo('authority')}
              >
                Trust boundary
              </button>
              <button
                type="button"
                className="landing-micro"
                onClick={() => scrollTo('evidence')}
              >
                Evidence path
              </button>
            </div>
            <div
              className="landing-footer-col"
              data-aos="fade-up"
              data-aos-delay="180"
            >
              <span className="landing-micro">Program</span>
              <span className="landing-micro">
                3hYb...WiTUe
              </span>
              <span className="landing-micro">
                MagicBlock DEVNET
              </span>
              <span className="landing-micro">
                Anchor 1.0.2
              </span>
            </div>
          </div>
          <div className="landing-footer-meta" data-aos="fade-up">
            <span className="landing-micro">
              Proposal is not settlement.
            </span>
            <span className="landing-micro">
              CONFIDENTIAL CAPABILITY KERNEL · DEVNET EVIDENCE ANCHORED
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
