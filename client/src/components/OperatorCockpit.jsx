import { useState } from 'react'
import DemoProofTape from './DemoProofTape'

const gateRowsFor = (evidence) => {
  const gates = evidence?.gates || {}
  const passed = (gate) => gate?.status === 'passed'
  return [
    {
      id: 'privacy',
      label: 'Sibling read privacy',
      detail: 'Direct, batch, subscription, transaction, and simulation paths',
      result: passed(gates.privacy) ? 'DENIED' : 'UNVERIFIED',
      source: 'leash-per-gate.json',
    },
    {
      id: 'settlement',
      label: 'Settlement rollback / retry',
      detail: 'Underfunded action preserves reservation; retry pays once',
      result: passed(gates.settlement) ? 'PRESERVED' : 'UNVERIFIED',
      source: 'leash-settlement-gate.json',
    },
    {
      id: 'expiry',
      label: 'Expiry payment exclusion',
      detail: 'Expired terminal blocks settlement and replay',
      result: passed(gates.expiry) ? 'REJECTED' : 'UNVERIFIED',
      source: 'leash-expiry-gate.json',
    },
    {
      id: 'race',
      label: 'Twenty-agent budget race',
      detail: 'Concurrent sessions competing for one remaining unit',
      result: passed(gates.race)
        ? `${gates.race.successfulReservations} WON / ${gates.race.losingReservations} REJECTED`
        : 'UNVERIFIED',
      source: 'leash-race-gate.json',
    },
  ]
}

export default function OperatorCockpit({
  runtime,
  programId,
  rpcUrl,
  evidence,
  evidenceError,
  onRefresh,
  onBackToLanding,
  demo,
  demoError,
}) {
  const [selectedGate, setSelectedGate] = useState(null)
  const gates = gateRowsFor(evidence)
  const passedCount = gates.filter((gate) => gate.result !== 'UNVERIFIED').length
  const race = evidence?.gates?.race

  return (
    <main className="leash-page" style={{ minHeight: '100vh' }}>
      <div className="leash-shell">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '24px 0', borderBottom: '1px solid var(--border-strong)', flexWrap: 'wrap' }}>
          <button type="button" className="leash-btn-secondary" onClick={onBackToLanding}>← Back to landing</button>
          <span className="logo-text">LEASH / OPERATOR COCKPIT</span>
          <button type="button" className="theme-switch-btn" onClick={onRefresh}>↻ Refresh public runtime</button>
        </header>

        <section style={{ padding: '64px 0 32px' }}>
          <span className="leash-micro">PUBLIC OBSERVER · NO SIGNING AUTHORITY</span>
          <h1 className="section-title" style={{ marginTop: '12px' }}>Kernel health & live auditing.</h1>
          <p className="section-desc" style={{ maxWidth: '720px' }}>
            This view reads public RPC health and a sanitized evidence manifest. It never fetches private policy/session state or runs a transaction.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '40px' }} aria-label="Runtime metrics">
          {[
            ['RPC health', runtime.state],
            ['Base slot', runtime.slot],
            ['Gate evidence', `${passedCount}/4`],
            ['Race', race ? `${race.successfulReservations} / ${race.contenders}` : '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '20px', border: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}>
              <span className="leash-micro">{label}</span>
              <strong style={{ display: 'block', marginTop: '10px', fontSize: '24px', color: 'var(--ink-primary)' }}>{value}</strong>
            </div>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          <article style={{ padding: '24px', border: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}>
            <span className="leash-micro">PUBLIC DEPLOYMENT</span>
            <h2 style={{ margin: '10px 0 20px' }}>Devnet program</h2>
            <dl style={{ display: 'grid', gap: '12px', margin: 0, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <div><dt className="leash-micro">Program ID</dt><dd style={{ wordBreak: 'break-all', margin: '4px 0 0' }}>{programId || '—'}</dd></div>
              <div><dt className="leash-micro">RPC</dt><dd style={{ wordBreak: 'break-all', margin: '4px 0 0' }}>{rpcUrl || '—'}</dd></div>
              <div><dt className="leash-micro">Executable</dt><dd style={{ margin: '4px 0 0' }}>{runtime.deployed}</dd></div>
              <div><dt className="leash-micro">Relay</dt><dd style={{ margin: '4px 0 0' }}>{runtime.relay}</dd></div>
            </dl>
          </article>

          <article style={{ padding: '24px', border: '1px solid var(--border-strong)', background: 'var(--bg-card)' }}>
            <span className="leash-micro">EVIDENCE MANIFEST</span>
            <h2 style={{ margin: '10px 0 20px' }}>{evidence ? 'Loaded from live gate run' : 'Not loaded'}</h2>
            <dl style={{ display: 'grid', gap: '12px', margin: 0, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              <div><dt className="leash-micro">Verified at</dt><dd style={{ margin: '4px 0 0' }}>{evidence?.verifiedAt || '—'}</dd></div>
              <div><dt className="leash-micro">Binary SHA-256</dt><dd style={{ wordBreak: 'break-all', margin: '4px 0 0' }}>{evidence?.program?.binarySha256 || '—'}</dd></div>
              <div><dt className="leash-micro">Deployment slot</dt><dd style={{ margin: '4px 0 0' }}>{evidence?.program?.deployedInSlot ?? '—'}</dd></div>
              <div><dt className="leash-micro">Sources</dt><dd style={{ margin: '4px 0 0' }}>{evidence?.sources?.length ?? 0} sanitized artifacts</dd></div>
            </dl>
          </article>
        </section>

        <section style={{ padding: '24px', border: '1px solid var(--border-strong)', background: 'var(--bg-card)', marginBottom: '64px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div>
              <span className="leash-micro">FOUR LIVE GATES</span>
              <h2 style={{ margin: '10px 0 4px' }}>Recorded invariant results</h2>
            </div>
            <span className="leash-micro">READ-ONLY</span>
          </div>

          {evidenceError && <p style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Evidence unavailable: {evidenceError}</p>}

          <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
            {gates.map((gate) => (
              <button
                key={gate.id}
                type="button"
                onClick={() => setSelectedGate(gate.id)}
                disabled={gate.result === 'UNVERIFIED'}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', width: '100%', padding: '16px', textAlign: 'left', border: '1px solid var(--border-hairline)', background: 'var(--bg-canvas)', color: 'var(--ink-primary)', cursor: gate.result === 'UNVERIFIED' ? 'not-allowed' : 'pointer' }}
              >
                <span>
                  <strong style={{ display: 'block' }}>{gate.label}</strong>
                  <small style={{ display: 'block', marginTop: '4px', color: 'var(--ink-secondary)' }}>{gate.detail} · {gate.source}</small>
                </span>
                <strong>{gate.result}</strong>
              </button>
            ))}
          </div>

          {selectedGate && (
            <p style={{ margin: '18px 0 0', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              Selected: {gates.find((gate) => gate.id === selectedGate)?.source}. This browser action only reveals the recorded result.
            </p>
          )}
        </section>

        <DemoProofTape demo={demo} demoError={demoError} compact />
      </div>
    </main>
  )
}
