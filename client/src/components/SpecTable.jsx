export default function SpecTable() {
  const accounts = [
    {
      name: 'SecretPolicy',
      location: 'Private PER',
      isPer: true,
      publicData: 'Controller & empty PDA metadata prior to enclave delegation',
      privateData: 'Policy hash, destination discriminator, token mint, budget, expiry, nonce',
      invariant: 'Allocated empty on Solana; configured strictly after enclave privacy is established',
    },
    {
      name: 'SessionLedger',
      location: 'Private PER',
      isPer: true,
      publicData: 'None (scrubbed prior to base-layer undelegation)',
      privateData: 'Agent identity, active reservation, spent balance, monotonic sequence',
      invariant: 'Read restricted strictly to issuing agent; siblings denied by hardware permission',
    },
    {
      name: 'SettlementReceipt',
      location: 'Delegated PER',
      isPer: true,
      publicData: 'Sanitized routing metadata, monotonic nonce, transaction status',
      privateData: 'Transfer amount and raw digests are omitted from receipt bytes',
      invariant: 'Retains reservation on SPL action failure; unconsumed until payment succeeds',
    },
    {
      name: 'TerminalMarker',
      location: 'Solana L1',
      isPer: false,
      publicData: 'Permit digest, payment amount, terminal kind (Spent or Expired)',
      privateData: 'Publicly readable audit marker',
      invariant: 'Strictly Spent or Expired, never both. One PDA per session with bounded history',
    },
    {
      name: 'EphemeralPermission',
      location: 'MagicBlock PER',
      isPer: true,
      publicData: 'None',
      privateData: 'Authorized enclave member public keys',
      invariant: 'Created post-delegation; closed before scrubbed accounts undelegate to Solana',
    },
  ]

  return (
    <section id="specifications" className="spec-section">
      <div className="section-header">
        <span className="section-kicker">03 / FORMAL CONTRACT SPECIFICATION</span>
        <h2 className="section-title">Account model & trust boundaries.</h2>
        <p className="section-desc">
          State invariants enforce complete separation between private policy logic in
          ephemeral rollups and verifiable settlement markers published to Solana consensus.
        </p>
      </div>

      <div className="spec-table-card">
        <table className="monad-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Runtime Enclave</th>
              <th>Public State Exposure</th>
              <th>Confidential State</th>
              <th>Enforced Invariant</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.name}>
                <td className="account-name">
                  <code>{acc.name}</code>
                </td>
                <td>
                  <span className={`badge-location ${acc.isPer ? 'per' : ''}`}>
                    {acc.location}
                  </span>
                </td>
                <td>{acc.publicData}</td>
                <td>{acc.privateData}</td>
                <td style={{ color: 'var(--color-off-black)' }}>{acc.invariant}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-smoke)' }}>
          OFFICIAL DEVNET BINARY:
        </span>
        <code style={{ fontSize: '13px', background: '#ffffff', padding: '6px 14px', borderRadius: '9999px', border: '1px solid var(--color-ash)' }}>
          3hYb364V9zcgzW5rVN2Q3khuLUE39XPN1nBJgLkWiTUe
        </code>
        <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-smoke)' }}>
          ANCHOR 1.0.2 · SOLANA 3.1.9 · RUST 1.89.0
        </span>
      </div>
    </section>
  )
}
