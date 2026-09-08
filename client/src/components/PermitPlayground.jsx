const gateCount = (evidence) => {
  const gates = Object.values(evidence?.gates || {})
  return `${gates.filter((gate) => gate.status === 'passed').length}/${gates.length || 4}`
}

export default function PermitPlayground({ evidence }) {
  const privacy = evidence?.gates?.privacy
  const race = evidence?.gates?.race
  const verified = evidence?.status === 'passed'

  return (
    <div className="hero-playground-card" data-aos="fade-up" data-aos-delay="200">
      <div className="playground-top-bar">
        <div>
          <span className="leash-micro">Public Observer</span>
          <strong style={{ display: 'block', fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
            Recorded Gate Evidence
          </strong>
        </div>
        <span className="logo-badge">
          {gateCount(evidence)} GATES VERIFIED
        </span>
      </div>

      <div className="playground-grid">
        <div className="playground-field">
          <label>Evidence Revision</label>
          <input type="text" readOnly value={evidence?.verifiedAt || '—'} />
        </div>

        <div className="playground-field">
          <label>Deployed Binary</label>
          <input type="text" readOnly value={evidence?.program?.binarySha256?.slice(0, 16) || '—'} />
        </div>

        <div className="playground-field">
          <label>Budget Race</label>
          <input
            type="text"
            readOnly
            value={race ? `${race.successfulReservations} winner / ${race.losingReservations} rejected` : '—'}
          />
        </div>

        <div className="playground-field">
          <label>Private Bytes on Base</label>
          <input
            type="text"
            readOnly
            value={privacy ? (privacy.baseLedgerSecretBytes ? 'Observed' : 'Not observed') : '—'}
          />
        </div>
      </div>

      <div className="playground-status-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: verified ? 'var(--accent-moss)' : 'var(--accent-amber)',
            }}
          />
          <span>{verified ? 'Sanitized live gate manifest loaded' : 'No verified evidence manifest loaded'}</span>
        </div>

        <span style={{ color: 'var(--ink-muted)' }}>
          Read-only observer · never signs or issues permits
        </span>
      </div>
    </div>
  )
}
