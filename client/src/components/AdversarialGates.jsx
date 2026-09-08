import { useMemo, useState } from 'react'

const gateTestsFor = (evidence) => {
  const privacy = evidence?.gates?.privacy
  const settlement = evidence?.gates?.settlement
  const expiry = evidence?.gates?.expiry
  const race = evidence?.gates?.race
  const passed = (gate) => gate?.status === 'passed'
  const result = (gate, value) => (passed(gate) ? value : 'UNVERIFIED')

  return [
    {
      id: 'privacy',
      name: 'Sibling Read Denial',
      kicker: 'ENCLAVE PRIVACY',
      desc: 'Direct, batch, subscription, transaction, and simulation reads from sibling agents reveal no private bytes.',
      result: result(privacy, 'DENIED'),
      badge: passed(privacy) ? 'PASS' : '—',
      artifact: 'contracts/artifacts/leash-per-gate.json',
    },
    {
      id: 'race',
      name: '20-Agent Contention',
      kicker: 'ATOMIC CONCURRENCY',
      desc: 'Concurrent private sessions compete for one remaining budget permit.',
      result: passed(race) ? `${race.successfulReservations} WON / ${race.losingReservations} REJECTED` : 'UNVERIFIED',
      badge: passed(race) ? 'PASS' : '—',
      artifact: 'contracts/artifacts/leash-race-gate.json',
    },
    {
      id: 'settlement',
      name: 'SPL Action Rollback',
      kicker: 'FAULT RESILIENCE',
      desc: 'An underfunded action preserves the reservation; repairing the vault permits one authenticated retry.',
      result: passed(settlement) ? 'PRESERVED / PAID ONCE' : 'UNVERIFIED',
      badge: passed(settlement) ? 'PASS' : '—',
      artifact: 'contracts/artifacts/leash-settlement-gate.json',
    },
    {
      id: 'expiry',
      name: 'Expiry / Replay Exclusion',
      kicker: 'CONSENSUS MUTUAL EXCLUSION',
      desc: 'An expired permit publishes its terminal and rejects later settlement and expiry replay.',
      result: passed(expiry) ? 'REJECTED' : 'UNVERIFIED',
      badge: passed(expiry) ? 'PASS' : '—',
      artifact: 'contracts/artifacts/leash-expiry-gate.json',
    },
  ]
}

export default function AdversarialGates({ runtime, evidence, evidenceError, onRefresh }) {
  const gateTests = useMemo(() => gateTestsFor(evidence), [evidence])
  const [log, setLog] = useState([])

  const triggerGate = (gate) => {
    if (gate.result === 'UNVERIFIED') return
    const newEntry = {
      gate: gate.name,
      outcome: gate.result,
      detail: `Verified artifact: ${gate.artifact}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    setLog((prev) => [newEntry, ...prev].slice(0, 5))
  }

  return (
    <section className="leash-section" id="adversarial-gates">
      <div className="section-header-wrap" data-aos="fade-up">
        <span className="leash-micro">VERIFICATION SUITE</span>
        <h2 className="section-title">Adversarial gate proofs.</h2>
        <p className="section-desc">
          These cards read the sanitized artifacts produced by the live devnet gate suite.
          The browser can inspect evidence, but it cannot execute, sign, or declare a gate result.
        </p>
      </div>

      <div className="gates-grid">
        {gateTests.map((gate) => (
          <button
            key={gate.id}
            type="button"
            className="gate-card"
            data-aos="fade-up"
            onClick={() => triggerGate(gate)}
            disabled={gate.result === 'UNVERIFIED'}
            style={{ textAlign: 'left', cursor: gate.result === 'UNVERIFIED' ? 'not-allowed' : 'pointer' }}
          >
            <div className="gate-header">
              <span className="leash-micro">{gate.kicker}</span>
              <span className={`gate-tag ${gate.badge === 'PASS' ? 'pass' : ''}`}>{gate.badge}</span>
            </div>
            <h4>{gate.name}</h4>
            <p>{gate.desc}</p>
            <div className="gate-meta">
              <span>Recorded result: </span>
              <strong style={{ color: 'var(--ink-primary)' }}>{gate.result}</strong>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: '32px',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)',
          padding: '24px',
        }}
        data-aos="fade-up"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="leash-micro">RECORDED GATE AUDIT LOG</span>
            <span className="logo-badge">SLOT: {runtime.slot}</span>
          </div>
          <button type="button" className="theme-switch-btn" onClick={onRefresh}>
            ↻ Re-check public runtime
          </button>
        </div>

        {evidenceError && (
          <p style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            Evidence unavailable: {evidenceError}
          </p>
        )}
        {!evidenceError && !evidence && (
          <p style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            Waiting for the sanitized evidence manifest.
          </p>
        )}
        <div style={{ display: 'grid', gap: '8px' }}>
          {log.map((entry, idx) => (
            <div
              key={`${entry.gate}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-xs)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}
            >
              <div>
                <strong style={{ color: 'var(--ink-primary)', marginRight: '8px' }}>{entry.gate}:</strong>
                <span style={{ color: 'var(--ink-secondary)' }}>{entry.detail}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--accent-moss)', fontWeight: 600 }}>{entry.outcome}</span>
                <span style={{ color: 'var(--ink-muted)' }}>{entry.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
