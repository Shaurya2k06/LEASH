export default function Navbar({ onOpenCockpit }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="monad-navbar" role="banner">
      <a href="#hero" className="brand-logo" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>
        <span className="brand-mark-circle" aria-hidden="true" />
        <span className="brand-title">LEASH</span>
        <span className="brand-badge">TEE KERNEL</span>
      </a>

      <nav aria-label="Main Navigation">
        <ul className="nav-links">
          <li className="nav-link-item">
            <a href="#architecture" onClick={(e) => { e.preventDefault(); scrollTo('architecture'); }}>
              ARCHITECTURE
            </a>
          </li>
          <li className="nav-link-item">
            <a href="#capabilities" onClick={(e) => { e.preventDefault(); scrollTo('capabilities'); }}>
              CAPABILITIES
            </a>
          </li>
          <li className="nav-link-item">
            <a href="#specifications" onClick={(e) => { e.preventDefault(); scrollTo('specifications'); }}>
              SPECIFICATION
            </a>
          </li>
          <li className="nav-link-item">
            <a href="#adversarial-proofs" onClick={(e) => { e.preventDefault(); scrollTo('adversarial-proofs'); }}>
              EVIDENCE
            </a>
          </li>
          <li className="nav-link-item">
            <a href="#faq" onClick={(e) => { e.preventDefault(); scrollTo('faq'); }}>
              FAQ
            </a>
          </li>
        </ul>
      </nav>

      <div className="nav-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={onOpenCockpit}
          title="Open Live Operator Cockpit"
        >
          OPERATOR VIEW
        </button>
        <a
          href="#architecture"
          className="btn-primary-blue"
          onClick={(e) => { e.preventDefault(); scrollTo('architecture'); }}
        >
          EXPLORE SPEC <span className="btn-arrow" aria-hidden="true">▸</span>
        </a>
      </div>
    </header>
  )
}
