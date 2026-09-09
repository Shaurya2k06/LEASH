const accounts = [
  {
    name: 'SecretPolicy',
    tier: 'Private PER',
    publicData: 'Controller address & empty PDA metadata prior to enclave delegation',
    privateData: 'Policy hash, destination discriminator, token mint, budget, expiry, nonce',
    invariant: 'Allocated empty on Solana; configured strictly after enclave privacy is established',
  },
  {
    name: 'SessionLedger',
    tier: 'Private PER',
    publicData: 'Zero bytes (scrubbed prior to base-layer undelegation)',
    privateData: 'Agent identity, active reservation, spent balance, monotonic sequence',
    invariant: 'Read restricted strictly to issuing agent; siblings denied by hardware permission',
  },
  {
    name: 'SettlementReceipt',
    tier: 'Delegated PER',
    publicData: 'Sanitized routing metadata, monotonic nonce, transaction status',
    privateData: 'Transfer amount and raw digests are omitted from receipt bytes',
    invariant: 'Retains reservation on SPL action failure; unconsumed until payment succeeds',
  },
  {
    name: 'TerminalMarker',
    tier: 'Solana L1',
    publicData: 'Permit digest, payment amount, terminal kind (Spent or Expired)',
    privateData: 'Publicly readable audit marker on consensus',
    invariant: 'Strictly Spent or Expired, never both. One PDA per session with bounded history',
  },
  {
    name: 'EphemeralPermission',
    tier: 'MagicBlock PER',
    publicData: 'None',
    privateData: 'Authorized enclave member public keys',
    invariant: 'Created post-delegation; closed before scrubbed accounts undelegate to Solana',
  },
]

export default function TrustLedgerTable() {
  return (
    <section className="leash-section" id="specification">
      <div className="section-header-wrap" data-aos="fade-up">
        <h2 className="section-title">
          Account model & privacy boundaries.
        </h2>
        <p className="section-desc">
          State invariants enforce complete separation between private policy logic in
          ephemeral rollups and verifiable settlement markers on Solana.
        </p>
      </div>

      <div
        className="trust-ledger-wrap"
        style={{
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          overflowX: 'auto',
          padding: '24px',
        }}
        data-aos="fade-up"
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
              <th style={{ padding: '14px 16px', color: 'var(--ink-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Account
              </th>
              <th style={{ padding: '14px 16px', color: 'var(--ink-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Storage Tier
              </th>
              <th style={{ padding: '14px 16px', color: 'var(--ink-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Public State Exposure
              </th>
              <th style={{ padding: '14px 16px', color: 'var(--ink-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Cryptographic Invariant
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr
                key={acc.name}
                className="trust-ledger-row"
              >
                <td style={{ padding: '16px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                  <code>{acc.name}</code>
                </td>
                <td style={{ padding: '16px' }}>
                  {acc.tier}
                </td>
                <td style={{ padding: '16px', color: 'var(--ink-secondary)' }}>
                  {acc.publicData}
                </td>
                <td style={{ padding: '16px', color: 'var(--ink-primary)', fontSize: '12px' }}>
                  {acc.invariant}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
