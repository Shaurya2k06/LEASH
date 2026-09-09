import PermitPlayground from './PermitPlayground'
import { scrollToTarget } from '../lib/lenis'

export default function LeashHero({ runtime, programId, evidence, onOpenCockpit, onOpenDemo }) {
  return (
    <section className="leash-hero" id="hero">
      <h1 className="hero-display-title" data-aos="fade-up">
        Give agents spending power.<br />
        <em>Never give them the keys.</em>
      </h1>

      <p className="hero-subtitle" data-aos="fade-up" data-aos-delay="60">
        A confidential spending-capability kernel for hostile agent swarms.
        Private policy and session state execute in a MagicBlock Private Ephemeral Rollup;
        public Solana state contains only sanitized settlement markers.
      </p>

      <div className="hero-actions-row" data-aos="fade-up" data-aos-delay="100">
        <button
          type="button"
          className="leash-btn-primary"
          onClick={onOpenCockpit}
        >
          Launch Operator Cockpit ↵
        </button>
        <button
          type="button"
          className="leash-btn-secondary"
          onClick={() => scrollToTarget('#lifecycle')}
        >
          Inspect 5-Phase Lifecycle
        </button>
        <button
          type="button"
          className="leash-btn-secondary"
          onClick={onOpenDemo}
        >
          Watch Live Devnet Demo
        </button>
        <button
          type="button"
          className="leash-btn-ghost"
          onClick={() => scrollToTarget('#threat-model')}
        >
          Why Swarms Break Standard Wallets →
        </button>
      </div>

      {/* Live Interactive Permit Playground */}
      <PermitPlayground evidence={evidence} />

      {/* Telemetry metadata strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '36px',
          flexWrap: 'wrap',
        }}
        data-aos="fade-up"
        data-aos-delay="140"
      >
        <span className="leash-micro">
          PROGRAM: <strong>{programId ? `${programId.slice(0, 8)}…${programId.slice(-6)}` : 'NOT CONFIGURED'}</strong>
        </span>
        <span className="leash-micro">
          BASE SLOT: <strong>{runtime.slot}</strong>
        </span>
        <span className="leash-micro">
          TEE PRIVACY: <strong>{evidence?.gates?.privacy?.status === 'passed' ? 'VERIFIED' : 'UNVERIFIED'}</strong>
        </span>
        <span className="leash-micro">
          RPC HEALTH: <strong style={{ color: 'var(--ink-primary)' }}>{runtime.state}</strong>
        </span>
      </div>
    </section>
  )
}
