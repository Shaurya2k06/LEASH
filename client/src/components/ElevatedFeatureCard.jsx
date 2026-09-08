export default function ElevatedFeatureCard() {
  return (
    <section className="elevated-feature-section">
      <div className="elevated-feature-card">
        <div className="elevated-card-content">
          <span className="elevated-card-kicker">
            HARDWARE-ISOLATED EXECUTION · TEE ENCLAVE
          </span>
          <h3 className="elevated-card-title">
            In-flight Capability Transforms
          </h3>
          <p className="elevated-card-body">
            Dynamic policy evaluation happens strictly inside confidential TEE enclaves.
            Agent reservations are bounded against monotonic nonces without ever exposing
            transaction payload commitments, secret allowances, or destination addresses
            to public validator gossip or sibling nodes.
          </p>
          <a href="#specifications" className="link-arrow">
            REVIEW TEE ENCLAVE SPECS <span>→</span>
          </a>
        </div>

        <div className="elevated-illustration-wrapper">
          <div className="gradient-artwork">
            <div className="translucent-shape-1" />
            <div className="translucent-shape-2">
              <span>ZERO LEAKAGE</span>
            </div>
            <div className="art-badge-center">
              <span style={{ color: 'var(--color-lake-blue)', marginRight: '8px' }}>●</span>
              MAGIC ACTION SETTLEMENT
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
