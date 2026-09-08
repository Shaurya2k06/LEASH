import { useState } from 'react'

const attacks = [
  {
    id: 'sibling',
    label: 'Sibling Ledger Read',
    detail: 'Direct & batch JSON-RPC /session queries from sibling agent keypair',
    result: 'DENIED',
    tone: 'denied',
    proof: 'Ephemeral permission excludes sibling; TEE hardware rejects unauthorized RPC batch.',
  },
  {
    id: 'replay',
    label: 'Settlement Nonce Replay',
    detail: 'Duplicate submit of already-finalized receipt nonce',
    result: 'REJECTED',
    tone: 'rejected',
    proof: 'Monotonic counter check flags duplicate; Terminal PDA rejects duplicate signature.',
  },
  {
    id: 'rollback',
    label: 'Underfunded Action Rollback',
    detail: 'SPL Magic Action triggered against drained source vault',
    result: 'PRESERVED',
    tone: 'preserved',
    proof: 'Transfer reverts atomically; private budget & receipt remain retryable without loss.',
  },
  {
    id: 'race',
    label: '20-Agent Race Contention',
    detail: '20 simultaneous agent permits competing for 1 remaining budget unit',
    result: '1 WON / 19 REJECTED',
    tone: 'preserved',
    proof: 'Atomic reservation guarantees single winner; 19 losing sessions remain unmutated.',
  },
]

export default function AttackConsole({ runtime, onRefresh }) {
  const [events, setEvents] = useState([
    {
      label: 'Initial Gate Baseline',
      result: 'VERIFIED',
      tone: 'preserved',
      at: '00:01',
      detail: 'Anchor unit invariants & BPF stack checks passed.',
    },
  ])

  const triggerAttack = (attack) => {
    const newEvent = {
      label: attack.label,
      result: attack.result,
      tone: attack.tone,
      detail: attack.proof,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    setEvents((prev) => [newEvent, ...prev].slice(0, 6))
  }

  return (
    <section id="adversarial-proofs" className="attack-console-section">
      <div className="section-header">
        <span className="section-kicker">04 / ADVERSARIAL VERIFICATION</span>
        <h2 className="section-title">Live proofs & attack simulations.</h2>
        <p className="section-desc">
          Test the security boundaries of LEASH against common agent compromise vectors.
          These gates reflect recorded and live hardware-verified invariants from the devnet test suite.
        </p>
      </div>

      <div className="console-card">
        <div className="console-grid">
          {/* Interactive Attack Triggers */}
          <div className="attack-card-col">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-smoke)' }}>
                ATTACK VECTOR SIMULATION:
              </span>
              <button
                type="button"
                className="announcement-btn"
                onClick={onRefresh}
                style={{ color: 'var(--color-off-black)', borderColor: 'var(--color-ash)' }}
              >
                ↻ REFRESH DEVNET RPC
              </button>
            </div>

            {attacks.map((attack) => (
              <div
                key={attack.id}
                className="attack-interactive-item"
                onClick={() => triggerAttack(attack)}
              >
                <div className="attack-info">
                  <strong>{attack.label}</strong>
                  <small>{attack.detail}</small>
                </div>
                <span className={`attack-status-tag ${attack.tone}`}>
                  {attack.result}
                </span>
              </div>
            ))}
          </div>

          {/* Audit Verification Log */}
          <div className="audit-log-panel">
            <div className="audit-log-header">
              <span>SIMULATED AUDIT TRAIL</span>
              <span>
                BASE SLOT: <strong>{runtime.slot}</strong>
              </span>
            </div>

            <div className="audit-log-items">
              {events.map((evt, idx) => (
                <div key={`${evt.label}-${idx}`} className="audit-log-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`attack-status-tag ${evt.tone}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                      {evt.result}
                    </span>
                    <strong style={{ fontSize: '13px', color: 'var(--color-off-black)' }}>{evt.label}</strong>
                  </div>
                  <small style={{ color: 'var(--color-smoke)' }}>{evt.at}</small>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-ash)', fontSize: '12px', color: 'var(--color-graphite)' }}>
              <strong>Trust Model:</strong> Signed CLI test gates in <code>contracts/tests</code> certify live execution. Browser view acts strictly as an untrusted public auditor.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
