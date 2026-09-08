export default function HeroSection({ onOpenCockpit, runtime }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" className="hero-section">
      <div className="hero-stack">
        <div className="hero-tag">
          <span className="pipeline-node-tag">
            <span className="node-icon">◈</span>
            SOLANA DEVNET // TEE-BACKED EPHEMERAL ROLLUP
          </span>
        </div>

        <h1 className="hero-title">
          Capabilities stay on a short leash.
        </h1>

        <p className="hero-subtext">
          A confidential spending-capability kernel for hostile agent swarms.
          Private policy and session state execute in a MagicBlock Private Ephemeral Rollup;
          public Solana state exposes only sanitized settlement markers.
        </p>

        <div className="hero-cta-row">
          <button
            type="button"
            className="btn-primary-blue"
            onClick={() => scrollTo('architecture')}
          >
            INSPECT PIPELINE <span className="btn-arrow" aria-hidden="true">▸</span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onOpenCockpit}
          >
            LAUNCH OPERATOR CONSOLE
          </button>
        </div>

        <div className="hero-meta-strip">
          <div className="meta-item">
            <span className="meta-dot" />
            <span>PROGRAM: <strong>3hYb36...WiTUe</strong></span>
          </div>
          <div className="meta-item">
            <span>CONSENSUS: <strong>SOLANA L1 + TEE PER</strong></span>
          </div>
          <div className="meta-item">
            <span>ISOLATION: <strong>ZERO SIBLING READ</strong></span>
          </div>
          <div className="meta-item">
            <span>RPC STATUS: <strong style={{ color: runtime.state === 'READY' ? '#1b7e47' : '#995a0a' }}>{runtime.state}</strong></span>
          </div>
        </div>
      </div>
    </section>
  )
}
