export default function FeatureGrid() {
  const features = [
    {
      icon: '⌑',
      title: 'Zero Sibling Read',
      body: 'Enrolled agents can inspect only their personal ledger. Authenticated sibling agents are rejected through direct, batch, subscription, or simulation RPC paths.',
      tag: 'INVARIANT // TEE MEMORY PRIVACY',
    },
    {
      icon: '⚡',
      title: 'Atomic Contention Race',
      body: 'When 20 concurrent autonomous agents race for one remaining budget permit, exactly one transaction wins. The losing 19 attempts are rejected without state mutation.',
      tag: 'STRESS TEST // 20 CONCURRENT AGENTS',
    },
    {
      icon: '↺',
      title: 'SPL Rollback & Safe Retry',
      body: 'If an SPL settlement Magic Action fails due to an underfunded vault or transient fault, the private reservation and pending receipt remain intact for atomic retry.',
      tag: 'ESCROW // ATOMIC RECOVERY',
    },
    {
      icon: '◈',
      title: 'Mutually Exclusive Terminal',
      body: 'The public terminal PDA on Solana resolves strictly as Spent or Expired, never both. Monotonic counter validation makes double-spending cryptographically impossible.',
      tag: 'L1 SETTLEMENT // NONCE VALIDATION',
    },
    {
      icon: '⌘',
      title: 'Typed Action Commitments',
      body: 'Permit issuance requires strict cryptographic agreement on destination program, instruction discriminator, token mint, recipient, source vault, and budget cap.',
      tag: 'POLICY // DISCRIMINATOR BOUND',
    },
    {
      icon: '🧹',
      title: 'Scrubbed Base Undelegation',
      body: 'Ephemeral permissions are closed and sensitive accounts scrubbed before undelegating back to base-layer Solana. Zero private bytes ever touch public gossip.',
      tag: 'TEARDOWN // ZERO-LEAK HYGIENE',
    },
  ]

  return (
    <section id="capabilities" className="feature-grid-section">
      <div className="section-header">
        <span className="section-kicker">02 / CORE GUARANTEES</span>
        <h2 className="section-title">Built for adversarial multi-agent swarms.</h2>
        <p className="section-desc">
          Autonomous agents operate without trust assumptions. LEASH enforces cryptographic
          and hardware-level boundaries across every step of the spending capability lifecycle.
        </p>
      </div>

      <div className="feature-grid">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <div className="feature-icon-wrapper">
              {feature.icon}
            </div>
            <h3 className="feature-title">
              {feature.title}
            </h3>
            <p className="feature-body">
              {feature.body}
            </p>
            <div className="feature-tag-foot">
              <span>{feature.tag}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
