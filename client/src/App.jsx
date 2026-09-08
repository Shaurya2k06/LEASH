import { useCallback, useEffect, useState } from 'react'
import './App.css'

const programId = import.meta.env.VITE_PROGRAM_ID || ''
const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || ''
const relayUrl = import.meta.env.VITE_RELAY_URL || ''

const attacks = [
  { label: 'Sibling ledger read', detail: 'GET /session + batch', result: 'Denied', tone: 'danger' },
  { label: 'Replay settlement', detail: 'same receipt / nonce', result: 'Rejected', tone: 'warning' },
  { label: 'Underfunded payment', detail: 'SPL action rollback', result: 'Preserved', tone: 'success' },
]

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json()
  if (body.error) throw new Error(body.error.message)
  return body.result
}

function App() {
  const [runtime, setRuntime] = useState({ state: 'CHECKING', slot: '—', deployed: '—', relay: '—', error: '' })
  const [events, setEvents] = useState([])

  const refresh = useCallback(async () => {
    setRuntime((current) => ({ ...current, state: 'CHECKING', error: '' }))
    try {
      const [slot, account, relay] = await Promise.all([
        rpc('getSlot', [{ commitment: 'confirmed' }]),
        rpc('getAccountInfo', [programId, { encoding: 'base64', commitment: 'confirmed' }]),
        fetch(`${relayUrl}/health`).then((response) => response.ok),
      ])
      setRuntime({ state: 'READY', slot: slot.toLocaleString(), deployed: account?.value?.executable ? 'YES' : 'NO', relay: relay ? 'READY' : 'OFFLINE', error: '' })
    } catch (error) {
      setRuntime((current) => ({ ...current, state: 'DEGRADED', error: error.message }))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const record = (event) => {
    setEvents((current) => [{ ...event, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...current].slice(0, 4))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span /><span /><span /></div><div><strong>LEASH</strong><small>PRIVATE CAPABILITY</small></div></div>
        <div className="sidebar-label">OPERATOR</div>
        <nav className="nav-list" aria-label="Primary"><span className="nav-item active">◈ Overview</span><span className="nav-item">⌁ Runtime</span><span className="nav-item">⌘ Attack console</span><span className="nav-item">≡ Evidence</span></nav>
        <div className="sidebar-bottom"><div className="sidebar-label">TRUST BOUNDARY</div><div className="runtime-card"><div className="runtime-top"><span className="pulse" /> PUBLIC RPC <span className="runtime-live">{runtime.state}</span></div><span className="runtime-url">{rpcUrl}</span><div className="runtime-meta"><span>Base slot</span><strong>{runtime.slot}</strong></div></div><small className="operator-note">No wallet, policy secret, or outcome authority lives here.</small></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumbs"><span>LEASH</span><b>/</b><span className="muted">OPERATOR VIEW</span></div><button className="refresh-button" onClick={refresh}>↻ Refresh runtime</button></header>
        <div className="page-wrap">
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />PRIVATE BUDGET / DEVNET EVIDENCE</div><h1>Capabilities stay<br /><em>on a short leash.</em></h1><p className="heading-copy">Private policy and agent ledgers run in one PER. This cockpit reads public health and shows reproducible gates; it never reads secret policy state.</p></div><div className="heading-actions"><span className={`status-pill ${runtime.state === 'READY' ? 'success' : 'warning'}`}><span className="status-dot" />PUBLIC RPC {runtime.state}</span><span className="simulated-label">TEE GATES: CLI ONLY</span></div></section>

          <section className="metric-grid" aria-label="LEASH metrics">
            <div className="metric-card"><div className="metric-label">PUBLIC RPC</div><strong className="accent-text">{runtime.state}</strong><div className="metric-foot">{runtime.error || 'Slot and program account health'}</div></div>
            <div className="metric-card"><div className="metric-label">BUDGET RACE</div><strong>20<span> agents</span></strong><div className="metric-foot"><span className="green-text">1 winner</span> · 19 rejected</div></div>
            <div className="metric-card"><div className="metric-label">TERMINAL STATES</div><strong>2<span> paths</span></strong><div className="metric-foot">spent / expired · one PDA</div></div>
            <div className="metric-card"><div className="metric-label">TRANSPORT</div><strong className="accent-text">{runtime.relay}</strong><div className="metric-foot">read-only relay</div></div>
          </section>

          <div className="section-heading"><div><span className="section-kicker">01 / PUBLIC RUNTIME</span><h2>Operator status</h2></div><span className="simulated-label">NO AUTHORITATIVE SERVER</span></div>
          <section className="status-grid"><div className="panel-card status-card"><div className="panel-heading"><div><span className="card-title">DEPLOYED PROGRAM</span><span className="card-subtitle">PUBLIC ACCOUNT HEALTH</span></div><span className="shield">◇</span></div><dl><div><dt>Program</dt><dd>{programId}</dd></div><div><dt>Base slot</dt><dd>{runtime.slot}</dd></div><div><dt>Executable</dt><dd className="green-text">{runtime.deployed}</dd></div><div><dt>Relay</dt><dd>{runtime.relay}</dd></div></dl></div><div className="panel-card status-card"><div className="panel-heading"><div><span className="card-title">PRIVATE BOUNDARY</span><span className="card-subtitle">WHAT THIS VIEW DOES NOT FETCH</span></div><span className="lock-icon">⌑</span></div><div className="boundary-list"><p><span>✓</span> SecretPolicy budget</p><p><span>✓</span> SessionLedger reservations</p><p><span>✓</span> Agent authorization tokens</p><p><span>✓</span> Settlement decision authority</p></div></div></section>

          <div className="section-heading lower-heading"><div><span className="section-kicker">02 / ADVERSARIAL PROOF</span><h2>Attack console</h2></div><span className="simulated-label">RECORDED GATES · CLI ONLY</span></div>
          <section className="attack-grid"><div className="attack-copy"><p>These controls only reveal recorded evidence labels. They do not execute transactions; the signed CLI gates in <code>contracts/tests</code> are the authority.</p><div className="claim-row"><span className="claim-icon">⌁</span><div><strong>Privacy claim</strong><small>Sibling RPC reads do not reveal a private reservation.</small></div></div><div className="claim-row"><span className="claim-icon">⊘</span><div><strong>Payment claim</strong><small>Failed SPL action preserves reservation; success pays once.</small></div></div></div><div className="attack-actions">{attacks.map((attack) => <button className="attack-button" onClick={() => record(attack)} key={attack.label}><span><strong>Show {attack.label}</strong><small>{attack.detail} · recorded result</small></span><span className="attack-arrow">→</span></button>)}{events.length > 0 && <div className="attack-log">{events.map((event, index) => <div className="log-row" key={`${event.label}-${index}`}><span className={`log-result ${event.tone}`}>{event.result}</span><span>{event.label}</span><small>{event.at}</small></div>)}</div>}</div></section>

          <footer className="page-footer"><span>LEASH / PRIVATE CAPABILITY KERNEL</span><span>RELAY <i /> {runtime.relay}</span><span>PROGRAM {programId.slice(0, 6)}…{programId.slice(-4)}</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
