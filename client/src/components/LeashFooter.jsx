export default function LeashFooter({ runtime, programId, evidence, onOpenCockpit }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="leash-footer">
      <div className="leash-shell">
        <div className="footer-main-grid">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div className="logo-symbol">L</div>
              <strong style={{ fontSize: '18px', fontFamily: 'var(--font-sans)', color: 'var(--ink-primary)' }}>
                LEASH
              </strong>
              <span className="logo-badge">v2.4 KERNEL</span>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', lineHeight: '1.5', maxWidth: '340px' }}>
              Confidential capability & bounded policy spending kernel for hostile agent swarms on Solana and MagicBlock Private Ephemeral Rollups.
            </p>
          </div>

          <div className="footer-col">
            <strong>Architecture</strong>
            <ul>
              <li><button type="button" onClick={() => scrollTo('threat-model')}>Threat Model</button></li>
              <li><button type="button" onClick={() => scrollTo('lifecycle')}>5-Phase Lifecycle</button></li>
              <li><button type="button" onClick={() => scrollTo('architecture')}>System Topology</button></li>
              <li><button type="button" onClick={() => scrollTo('specification')}>Account Model</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <strong>Verification</strong>
            <ul>
              <li><button type="button" onClick={() => scrollTo('adversarial-gates')}>Adversarial Gates</button></li>
              <li><button type="button" onClick={onOpenCockpit}>Operator Cockpit</button></li>
              <li><button type="button" onClick={() => scrollTo('faq')}>FAQ & Invariants</button></li>
              <li><a href="https://rpc.magicblock.app/devnet" target="_blank" rel="noreferrer">MagicBlock RPC</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <strong>Devnet Anchors</strong>
            <ul>
              <li><span className="leash-micro">PROGRAM: {programId ? `${programId.slice(0, 8)}…${programId.slice(-4)}` : 'NOT CONFIGURED'}</span></li>
              <li><span className="leash-micro">BINARY: {evidence?.program?.binarySha256?.slice(0, 12) || '—'}</span></li>
              <li><span className="leash-micro">SLOT: {runtime.slot}</span></li>
              <li><span className="leash-micro">RPC: {runtime.state}</span></li>
              <li><span className="leash-micro">RELAY: {runtime.relay}</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-strip">
          <div>
            LEASH KERNEL · CONFIDENTIAL CAPABILITY EXECUTION · ZERO KEYS EXPOSED
          </div>
          <div>
            SOLANA DEVNET + MAGICBLOCK TEE PER · ANCHOR 1.0.2 · RUST 1.89.0
          </div>
          <div>
            MIT LICENSE
          </div>
        </div>
      </div>
    </footer>
  )
}
