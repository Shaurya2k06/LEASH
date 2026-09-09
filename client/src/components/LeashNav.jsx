import { scrollToTarget } from '../lib/lenis'

export default function LeashNav({ onOpenCockpit, onOpenDemo }) {
  const scrollTo = (id) => scrollToTarget(`#${id}`, -80)

  return (
    <header className="leash-topbar">
      <div
        className="leash-logo"
        onClick={() => scrollToTarget('body', 0)}
      >
        <div className="logo-symbol">L</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span className="logo-text">LEASH</span>
          <span className="logo-badge">TEE KERNEL</span>
        </div>
      </div>

      <nav aria-label="Main Navigation">
        <ul className="leash-nav-links">
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={onOpenDemo}
            >
              Live Demo
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('threat-model')}
            >
              Threat Matrix
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('lifecycle')}
            >
              Lifecycle
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('architecture')}
            >
              Topology
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('adversarial-gates')}
            >
              Gate Proofs
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('specification')}
            >
              Account Spec
            </button>
          </li>
          <li>
            <button
              type="button"
              className="leash-nav-link"
              onClick={() => scrollTo('faq')}
            >
              FAQ
            </button>
          </li>
        </ul>
      </nav>

      <div className="leash-header-actions">
        <button
          type="button"
          className="leash-btn-primary"
          style={{ padding: '8px 18px', fontSize: '11px' }}
          onClick={onOpenCockpit}
        >
          Operator View ↵
        </button>
      </div>
    </header>
  )
}
