import { useMemo, useState } from 'react'

const yesNo = (value) => (value === undefined ? '—' : value ? 'YES' : 'NO')

const phasesFor = (evidence) => {
  const privacy = evidence?.gates?.privacy
  const settlement = evidence?.gates?.settlement
  const expiry = evidence?.gates?.expiry
  const race = evidence?.gates?.race
  const raceResult = race
    ? `${race.successfulReservations} won / ${race.losingReservations} rejected`
    : '—'

  return [
    {
      id: 'delegation',
      number: '01',
      label: 'Delegation & Seal',
      title: 'Allocated empty on Solana. Sealed in TEE.',
      desc: 'The controller creates an empty SecretPolicy account on Solana L1 and delegates it to the MagicBlock Private Ephemeral Rollup. Policy limits, hashes, and budget allocations are configured strictly after enclave isolation is active.',
      quote: 'No budget limits or policy bytes are presented as public evidence.',
      specs: [
        { label: 'Storage Location', value: 'Solana L1 → Delegated PER' },
        { label: 'Policy Hash', value: 'Private; not in public manifest' },
        { label: 'Public State', value: 'Controller and PDA metadata only' },
        { label: 'Validator Lock', value: 'Configured validator is pinned' },
      ],
      live: false,
    },
    {
      id: 'issuance',
      number: '02',
      label: 'Typed Permit',
      title: 'Monotonic sequence & strict discriminator match.',
      desc: 'An enrolled agent signs a capability request. The TEE engine validates the intent against destination program discriminator, token mint, recipient, source vault, amount cap, and monotonic sequence counter before touching budget.',
      quote: 'Permit fields are bounded by the private typed policy before reservation.',
      specs: [
        { label: 'Permit Signer', value: 'Enrolled agent keypair' },
        { label: 'Nonce Counter', value: 'Monotonic; private state' },
        { label: 'Discriminator Check', value: 'Typed policy match' },
        { label: 'Spend Limit', value: 'Strictly bounded per permit' },
      ],
      live: false,
    },
    {
      id: 'isolation',
      number: '03',
      label: 'Sibling Shield',
      title: 'Hardware-enforced zero sibling leakage.',
      desc: 'Ephemeral permissions isolate each agent’s SessionLedger. Authenticated sibling agents attempting direct RPC queries, batch inspection, subscription listeners, or simulated calls are denied at the hardware enclave boundary.',
      quote: privacy ? `Base secret bytes: ${yesNo(privacy.baseLedgerSecretBytes)} · sibling simulation bytes: ${yesNo(privacy.siblingSimulationSecretBytes)}` : 'No privacy artifact loaded.',
      specs: [
        { label: 'Enclave Boundary', value: 'MagicBlock EphemeralPermission' },
        { label: 'Direct RPC Read', value: privacy ? (privacy.siblingDirectVisible ? 'LEAKED' : 'DENIED') : '—' },
        { label: 'Batch / Subscription', value: privacy ? `${yesNo(privacy.siblingBatchVisible)} / ${yesNo(privacy.siblingSubscriptionLeaked)}` : '—' },
        { label: 'Contention Race', value: raceResult },
      ],
      live: Boolean(privacy),
    },
    {
      id: 'escrow',
      number: '04',
      label: 'SPL Magic Action',
      title: 'Atomic settlement with safe rollback.',
      desc: 'Settlement triggers an authenticated SPL Magic Action. The action verifies escrow signers, balances, and pending receipts. If the source vault is drained or underfunded, the action rolls back without losing the private reservation.',
      quote: settlement ? `Reservation preserved: ${yesNo(settlement.failedActionPreservedReservation)} · retry paid once: ${yesNo(settlement.retryPaidOnce)}` : 'No settlement artifact loaded.',
      specs: [
        { label: 'Action Provider', value: 'MagicBlock Ephemeral Action' },
        { label: 'Two-Phase Commit', value: 'settle_permit → commit_action' },
        { label: 'Underfunded Fault', value: settlement ? (settlement.failedActionPreservedReservation ? 'ROLLBACK PRESERVED' : 'FAILED') : '—' },
        { label: 'Replay Defense', value: settlement ? (settlement.replayRejected ? 'REJECTED' : 'UNVERIFIED') : '—' },
      ],
      live: Boolean(settlement),
    },
    {
      id: 'terminal',
      number: '05',
      label: 'Terminal PDA',
      title: 'Mutually exclusive public settlement.',
      desc: 'Final settlement writes to a public Solana Terminal PDA that can transition strictly into Spent or Expired, never both. Once settled, permissions are closed and enclave accounts are scrubbed before base-layer synchronization.',
      quote: expiry ? `Expired terminal: ${yesNo(expiry.expiredTerminalPublished)} · later settlement: ${yesNo(expiry.settlementAfterExpiryRejected)}` : 'No expiry artifact loaded.',
      specs: [
        { label: 'Consensus Target', value: 'Solana Devnet L1' },
        { label: 'Terminal State', value: expiry ? 'SPENT or EXPIRED' : '—' },
        { label: 'Replay Defense', value: expiry ? (expiry.expiryReplayRejected ? 'REJECTED' : 'UNVERIFIED') : '—' },
        { label: 'Teardown Hygiene', value: 'Private accounts scrubbed before undelegation' },
      ],
      live: Boolean(expiry),
    },
  ]
}

export default function LifecycleTimeline({ evidence }) {
  const phases = useMemo(() => phasesFor(evidence), [evidence])
  const [activePhaseId, setActivePhaseId] = useState('delegation')
  const currentPhase = phases.find((p) => p.id === activePhaseId) || phases[0]

  return (
    <section className="leash-section" id="lifecycle">
      <div className="section-header-wrap" data-aos="fade-up">
        <span className="leash-micro">CRYPTOGRAPHIC LIFECYCLE</span>
        <h2 className="section-title">The 5-phase capability lifecycle.</h2>
        <p className="section-desc">
          How a spending permit flows from untrusted agent intent to hardware-isolated verification,
          SPL Magic Action escrow, and immutable base-layer settlement.
        </p>
      </div>

      <div className="lifecycle-card" data-aos="fade-up" data-aos-delay="100">
        <div className="lifecycle-phases-nav" role="tablist">
          {phases.map((phase) => (
            <button
              key={phase.id}
              type="button"
              role="tab"
              aria-selected={activePhaseId === phase.id}
              className={`phase-nav-btn ${activePhaseId === phase.id ? 'is-active' : ''}`}
              onClick={() => setActivePhaseId(phase.id)}
            >
              <span className="phase-num">{phase.number}</span>
              <strong>{phase.label}</strong>
            </button>
          ))}
        </div>

        <div className="lifecycle-split-panel">
          <div className="lifecycle-content">
            <span className="leash-micro" style={{ color: currentPhase.live ? 'var(--accent-moss)' : 'var(--accent-amber)' }}>
              PHASE {currentPhase.number} // {currentPhase.live ? 'LIVE GATE VERIFIED' : 'SPECIFICATION'}
            </span>
            <h3>{currentPhase.title}</h3>
            <p>{currentPhase.desc}</p>
            <div className="lifecycle-quote">“{currentPhase.quote}”</div>
          </div>

          <div className="lifecycle-spec-box">
            <div className="spec-box-header">
              <span className="leash-micro">STATE MACHINE METRICS</span>
              <span className="logo-badge">{currentPhase.live ? 'ARTIFACT LOADED' : 'PUBLIC SPEC'}</span>
            </div>

            <div className="spec-data-list">
              {currentPhase.specs.map((spec) => (
                <div key={spec.label} className="spec-data-row">
                  <span>{spec.label}</span>
                  <strong>{spec.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
