export default function Footer({ onOpenCockpit }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="monad-footer" role="contentinfo">
      <div className="monad-container">
        <div className="footer-top-grid">
          <div className="footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-mark-circle" />
              <strong style={{ fontSize: '16px', margin: 0 }}>LEASH // MONAD</strong>
            </div>
            <p className="footer-brand-bio">
              Confidential capability & bounded policy spending kernel for hostile agent swarms on Solana and MagicBlock Private Ephemeral Rollups.
            </p>
          </div>

          <div className="footer-col">
            <strong>ARCHITECTURE</strong>
            <ul>
              <li><button type="button" onClick={() => scrollTo('architecture')}>Pipeline Topology</button></li>
              <li><button type="button" onClick={() => scrollTo('capabilities')}>Core Guarantees</button></li>
              <li><button type="button" onClick={() => scrollTo('specifications')}>Account Model</button></li>
              <li><button type="button" onClick={() => scrollTo('adversarial-proofs')}>Adversarial Proofs</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <strong>DEVELOPER</strong>
            <ul>
              <li><button type="button" onClick={onOpenCockpit}>Operator View</button></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer">Contracts Repo</a></li>
              <li><a href="https://rpc.magicblock.app/devnet" target="_blank" rel="noreferrer">MagicBlock RPC</a></li>
              <li><button type="button" onClick={() => scrollTo('faq')}>Technical FAQ</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <strong>DESIGN TOKENS</strong>
            <ul style={{ fontSize: '12px' }}>
              <li>CANVAS: #f6f3f1 (PARCHMENT)</li>
              <li>ACCENT: #2b59d1 (LAKE BLUE)</li>
              <li>TYPOGRAPHY: NEWSREADER / MONO</li>
              <li>BORDERS: 1PX SOLID ASH (#cecac8)</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>
            PROGRAM ID: <code>3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe</code>
          </div>
          <div>
            DESIGNED ON MONAD EDITORIAL SYSTEM · THEME: LIGHT
          </div>
          <div>
            MIT LICENSE · NO SENSITIVE KEYS STORED
          </div>
        </div>
      </div>
    </footer>
  )
}
