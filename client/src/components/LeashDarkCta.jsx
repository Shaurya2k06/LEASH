export default function LeashDarkCta({ programId, evidence, onOpenCockpit }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="leash-dark-section" data-aos="fade-up">
      <div className="leash-shell">
        <span className="leash-micro" style={{ color: 'var(--accent-green)', marginBottom: '14px', display: 'inline-block' }}>
          {evidence?.status === 'passed' ? 'DEPLOYMENT VERIFIED' : 'DEPLOYMENT EVIDENCE UNAVAILABLE'} // DEVNET BINARY {programId ? `${programId.slice(0, 8)}…${programId.slice(-4)}` : 'NOT CONFIGURED'}
        </span>

        <h2 className="dark-title">
          Autonomous agents propose.<br />
          <em>The enclave decides.</em>
        </h2>

        <p className="dark-desc">
          Build multi-agent swarms with bounded capability budgets.
          Run reproducible Anchor gates on Solana devnet, inspect TEE-isolated ephemeral rollups,
          and ensure private policies stay strictly on a leash.
        </p>

        <div className="dark-cta-row">
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
            style={{ color: '#efe9e1', borderColor: 'rgba(239, 233, 225, 0.4)' }}
            onClick={() => scrollTo('adversarial-gates')}
          >
            Review Devnet Gates
          </button>
          <button
            type="button"
            className="leash-btn-ghost"
            style={{ color: '#efe9e1' }}
            onClick={() => scrollTo('specification')}
          >
            Read System Contract →
          </button>
        </div>
      </div>
    </section>
  )
}
