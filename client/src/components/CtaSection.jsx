export default function CtaSection({ onOpenCockpit }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="cta-section">
      <div className="cta-box">
        <span className="pipeline-node-tag" style={{ marginBottom: '24px' }}>
          <span className="node-icon">⌘</span>
          DEPLOY THE CONFIDENTIAL KERNEL
        </span>

        <h2 className="cta-title">
          Keep your autonomous swarm on a verified leash.
        </h2>

        <p className="cta-subtext">
          Run reproducible Anchor gates on Solana devnet, inspect TEE-isolated
          ephemeral rollups, and audit capability settlement without exposing private policy state.
        </p>

        <div className="cta-buttons">
          <button
            type="button"
            className="btn-primary-blue"
            onClick={onOpenCockpit}
          >
            LAUNCH OPERATOR CONSOLE <span className="btn-arrow" aria-hidden="true">▸</span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => scrollTo('specifications')}
          >
            VIEW SPECIFICATION
          </button>
        </div>
      </div>
    </section>
  )
}
