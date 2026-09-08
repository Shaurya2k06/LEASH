import { useState } from 'react'
import './App.css'

const players = [
  { id: 'P1', name: 'You', color: 'cyan', position: { left: '21%', top: '68%' }, health: 100 },
  { id: 'P2', name: 'Ghost', color: 'violet', position: { left: '78%', top: '24%' }, health: 82 },
  { id: 'P3', name: 'Nox', color: 'amber', position: { left: '67%', top: '72%' }, health: 100 },
  { id: 'P4', name: 'Null', color: 'pink', position: { left: '32%', top: '19%' }, health: 64 },
]

const attacks = [
  { label: 'Raw World read', detail: 'GET /world', result: 'Denied', tone: 'danger' },
  { label: 'Foreign PlayerView', detail: 'P2 → P1', result: 'Denied', tone: 'danger' },
  { label: 'Replay input', detail: 'sequence 184', result: 'Rejected', tone: 'warning' },
]

function StatusPill({ children, tone = 'success' }) {
  return <span className={`status-pill ${tone}`}><span className="status-dot" />{children}</span>
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [tick, setTick] = useState(184)
  const [demoRunning, setDemoRunning] = useState(false)
  const [attackLog, setAttackLog] = useState([])

  const runAttack = (attack) => {
    setAttackLog((current) => [
      { ...attack, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ...current,
    ].slice(0, 3))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>BLACKOUT</strong><small>PRIVATE ARENA</small></div>
        </div>

        <div className="sidebar-label">COMMAND</div>
        <nav className="nav-list" aria-label="Primary">
          {['Overview', 'Match room', 'Attack console', 'Evidence'].map((item) => (
            <button className={`nav-item ${activeNav === item ? 'active' : ''}`} key={item} onClick={() => setActiveNav(item)}>
              <span className="nav-icon" aria-hidden="true">{item === 'Overview' ? '◈' : item === 'Match room' ? '⌁' : item === 'Attack console' ? '⌘' : '≡'}</span>
              {item}
              {item === 'Attack console' && <span className="nav-count">3</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-label">RUNTIME</div>
          <div className="runtime-card">
            <div className="runtime-top"><span className="pulse" /> TEE DEVNET <span className="runtime-live">PREVIEW</span></div>
            <span className="runtime-url">endpoint pending Phase 1</span>
            <div className="runtime-meta"><span>Latency</span><strong>—</strong></div>
          </div>
          <div className="profile-row"><div className="avatar">SK</div><div><strong>shadow-key</strong><small>PLAYER 01</small></div><span className="more">•••</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>BLACKOUT</span><b>/</b><span className="muted">{activeNav.toUpperCase()}</span></div>
          <div className="top-actions"><StatusPill>PER PREVIEW</StatusPill><button className="wallet-button"><span className="wallet-dot" />8xK7...m2Q<span className="chevron">⌄</span></button></div>
        </header>

        <div className="page-wrap">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />PRIVATE EXECUTION / MATCH 001</div>
              <h1>See what the chain<br /><em>can&apos;t see.</em></h1>
              <p className="heading-copy">A four-player stealth arena running inside a Private Ephemeral Rollup. Your client gets a view, never the world.</p>
            </div>
            <div className="heading-actions"><button className="ghost-button">View architecture <span>↗</span></button><button className={`primary-button ${demoRunning ? 'running' : ''}`} onClick={() => setDemoRunning((running) => !running)}><span className="button-light" />{demoRunning ? 'Demo running' : 'Launch demo'}</button></div>
          </section>

          <section className="metric-grid" aria-label="Match metrics">
            <div className="metric-card"><div className="metric-label">TICK RATE <span className="metric-live">LIVE</span></div><strong>20<span>Hz</span></strong><div className="metric-foot"><span className="sparkline cyan-line" />50 ms target</div></div>
            <div className="metric-card"><div className="metric-label">PREVIEW PLAYERS</div><strong>04<span>/04</span></strong><div className="metric-foot"><span className="player-dots"><i /><i /><i /><i /></span> Mock roster</div></div>
            <div className="metric-card"><div className="metric-label">WORLD ACCESS</div><strong className="accent-text">PENDING</strong><div className="metric-foot"><span className="lock-icon">⌑</span> Phase 1 gate</div></div>
            <div className="metric-card"><div className="metric-label">PRIZE POOL</div><strong>—</strong><div className="metric-foot"><span className="vault-icon">▣</span> Settlement pending</div></div>
          </section>

          <div className="section-heading"><div><span className="section-kicker">01 / LIVE MATCH</span><h2>Match room</h2></div><div className="match-controls"><span className="live-indicator"><i /> {demoRunning ? 'RUNNING' : 'READY'}</span><button className="icon-button" onClick={() => setTick((value) => value + 1)} aria-label="Advance one tick">↗</button></div></div>

          <section className="match-grid">
            <div className="arena-card">
              <div className="card-bar"><div><span className="card-title">ARENA / ECHO-01</span><span className="card-subtitle">FIXED MAP · 20,000 × 12,000</span></div><span className="tick-counter">TICK <strong>{String(tick).padStart(3, '0')}</strong></span></div>
              <div className="arena">
                <div className="arena-grid" />
                <div className="wall wall-a" /><div className="wall wall-b" /><div className="wall wall-c" />
                {players.map((player) => <div className={`arena-player ${player.color}`} style={player.position} key={player.id}><span className="player-ring" /><span className="player-core" /><span className="player-label">{player.id}</span></div>)}
                <div className="visibility-cone" />
                <div className="arena-legend"><span><i className="legend-dot cyan" /> YOU</span><span><i className="legend-dot violet" /> VISIBLE</span><span><i className="legend-dot dim" /> HIDDEN</span></div>
              </div>
              <div className="arena-footer"><div><span className="footer-label">YOUR VIEW</span><strong>4 entities / 2 visible</strong></div><div><span className="footer-label">SIMULATION</span><strong className="green-text">LOCAL PREVIEW</strong></div><div><span className="footer-label">CONFIRMATION</span><strong>Not connected</strong></div></div>
            </div>

            <div className="side-stack">
              <div className="panel-card players-card"><div className="panel-heading"><div><span className="card-title">ROSTER</span><span className="card-subtitle">ANONYMOUS BY DEFAULT</span></div><span className="panel-action">VIEW ALL ↗</span></div><div className="roster-list">{players.map((player) => <div className="roster-row" key={player.id}><span className={`roster-avatar ${player.color}`}>{player.id}</span><div className="roster-name"><strong>{player.name}</strong><small>{player.id === 'P1' ? 'YOU · AUTHORIZED VIEW' : player.id === 'P2' ? 'VISIBLE · LINE OF SIGHT' : 'HIDDEN · NO DATA'}</small></div><div className="health"><div className="health-bar"><i style={{ width: `${player.health}%` }} /></div><span>{player.health}%</span></div></div>)}</div></div>
              <div className="panel-card integrity-card"><div className="panel-heading"><div><span className="card-title">INTEGRITY</span><span className="card-subtitle">CONTRACT PREVIEW</span></div><span className="shield">◇</span></div><div className="integrity-row"><span className="check">✓</span><div><strong>Input bounds defined</strong><small>Sequence and tick checks planned</small></div></div><div className="integrity-row"><span className="check">✓</span><div><strong>World state private</strong><small>Blocked until PER gate passes</small></div></div><div className="integrity-row"><span className="check">✓</span><div><strong>Result not yet committed</strong><small>Settlement follows private execution</small></div></div></div>
            </div>
          </section>

          <div className="section-heading lower-heading"><div><span className="section-kicker">02 / ADVERSARIAL PROOF</span><h2>Attack console</h2></div><span className="simulated-label">SIMULATED ATTACKS <span className="info">i</span></span></div>
          <section className="attack-grid">
            <div className="attack-copy"><p>The game is only private if the player cannot read what they shouldn&apos;t. Try the obvious paths.</p><div className="claim-row"><span className="claim-icon">⌁</span><div><strong>Privacy claim</strong><small>Unauthorized reads return no secret state.</small></div></div><div className="claim-row"><span className="claim-icon">⊘</span><div><strong>Trust boundary</strong><small>TEE protects world state; program owns outcomes.</small></div></div></div>
            <div className="attack-actions">{attacks.map((attack) => <button className="attack-button" onClick={() => runAttack(attack)} key={attack.label}><span><strong>{attack.label}</strong><small>{attack.detail}</small></span><span className="attack-arrow">→</span></button>)}{attackLog.length > 0 && <div className="attack-log">{attackLog.map((event, index) => <div className="log-row" key={`${event.label}-${index}`}><span className={`log-result ${event.tone}`}>{event.result}</span><span>{event.label}</span><small>{event.at}</small></div>)}</div>}</div>
          </section>
          <footer className="page-footer"><span>BLACKOUT / BUILDING PRIVATE PLAY</span><span>CORE STATUS <i /> LOCAL PREVIEW</span><span>v0.1.0 · DEVNET PENDING</span></footer>
        </div>
      </main>
    </div>
  )
}

export default App
