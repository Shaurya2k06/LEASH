import { useState } from 'react'

const nodesData = {
  swarm: {
    title: 'HOSTILE AGENT SWARM',
    category: 'Ingress Vector',
    location: 'Untrusted Environment',
    invariants: 'Enrolled agents sign individual permit issuance. Even compromised agents have zero membership to inspect sibling accounts.',
    seeds: 'N/A (External Agent Keypair)',
  },
  rpc: {
    title: 'READ-ONLY RPC RELAY',
    category: 'Transport Boundary',
    location: 'Relay Proxy / Public RPC',
    invariants: 'Allowlisted read-only JSON-RPC payloads. Rejects write injection, rate limits callers, and cannot sign or choose outcomes.',
    seeds: 'relay/health',
  },
  controller: {
    title: 'CONTROLLER DAEMON',
    category: 'Policy Authority',
    location: 'Operator Host',
    invariants: 'Allocates empty policy on Solana, delegates to PER, pins validator, and configures bounded budget inside enclave.',
    seeds: 'policy/controller/policy_id',
  },
  hub: {
    title: 'MAGICBLOCK PRIVATE TEE ENCLAVE',
    category: 'Confidential Kernel',
    location: 'Hardware PER',
    invariants: 'TEE-backed hardware isolation. SecretPolicy and SessionLedger remain encrypted in enclave memory; zero bytes leaked to base layer.',
    seeds: 'ephemeral/permission/session',
  },
  receipt: {
    title: 'SANITIZED SETTLEMENT RECEIPT',
    category: 'Egress Metadata',
    location: 'Delegated Solana Account',
    invariants: 'Contains only routing metadata, status, and nonce. Omits transfer amounts, policy hashes, and private digests.',
    seeds: 'receipt/session',
  },
  action: {
    title: 'SPL MAGIC ACTION',
    category: 'Settlement Escrow',
    location: 'MagicBlock Ephemeral Action',
    invariants: 'Verifies injected escrow signer, exact token mint, destination vault, and pending receipt before releasing funds atomically.',
    seeds: 'escrow/signer/vault',
  },
  terminal: {
    title: 'TERMINAL MARKER PDA',
    category: 'Public Consensus',
    location: 'Solana Base Layer',
    invariants: 'Public single-terminal PDA. Can terminate strictly as Spent or Expired, never both. Monotonic nonces prevent replay.',
    seeds: 'terminal/session',
  },
}

const lifecycleSteps = [
  { id: 'idle', label: '1. Idle', desc: 'Policy bounded; agent enrolled with clean SessionLedger.' },
  { id: 'reserved', label: '2. Reserved', desc: 'Permit atomically reserved against SecretPolicy; losing race attempts rejected.' },
  { id: 'pending', label: '3. Pending Receipt', desc: 'Sanitized settlement receipt prepared; reservation remains locked.' },
  { id: 'settled', label: '4. Settled (or Expired)', desc: 'SPL Magic Action executes; terminal PDA flips to Spent or Expired.' },
]

export default function PipelineDiagram() {
  const [selectedNode, setSelectedNode] = useState('hub')
  const [activeStep, setActiveStep] = useState('reserved')

  const activeInfo = nodesData[selectedNode] || nodesData.hub

  return (
    <section id="architecture" className="pipeline-section">
      <div className="section-header">
        <span className="section-kicker">01 / ARCHITECTURAL PIPELINE</span>
        <h2 className="section-title">Confidential pipeline topology.</h2>
        <p className="section-desc">
          High-assurance capability execution across untrusted agent swarms,
          TEE-isolated ephemeral rollups, and immutable base-layer Solana settlements.
        </p>
      </div>

      <div className="pipeline-diagram-card">
        <div className="diagram-header-bar">
          <div className="diagram-header-title">
            Data Pipeline & Capability Flow
          </div>
          <div className="diagram-header-meta">
            HAIRLINE ASH CONNECTORS · 1PX BOUNDARY · TEE NORMALIZATION HUB
          </div>
        </div>

        <div className="diagram-canvas-wrap">
          {/* Background thin curved Ash connector lines */}
          <svg
            className="diagram-svg-connectors"
            viewBox="0 0 1200 480"
            preserveAspectRatio="none"
          >
            {/* Left to center paths */}
            <path
              d="M 280 110 C 420 110, 430 240, 520 240"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
              strokeDasharray={activeStep === 'reserved' ? '4 4' : 'none'}
            />
            <path
              d="M 280 240 L 520 240"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
            />
            <path
              d="M 280 370 C 420 370, 430 240, 520 240"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
            />

            {/* Center to right paths */}
            <path
              d="M 680 240 C 770 240, 780 110, 920 110"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
              strokeDasharray={activeStep === 'settled' ? '4 4' : 'none'}
            />
            <path
              d="M 680 240 L 920 240"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
            />
            <path
              d="M 680 240 C 770 240, 780 370, 920 370"
              fill="none"
              stroke="#cecac8"
              strokeWidth="1.5"
            />
          </svg>

          {/* Left Column: Ingress Sources */}
          <div className="diagram-column">
            <div className="column-label">INGRESS SOURCES</div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'swarm' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('swarm')}
            >
              <span className="node-icon">⚡</span>
              <span>HOSTILE AGENT SWARM</span>
            </div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'rpc' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('rpc')}
            >
              <span className="node-icon">⌁</span>
              <span>READ-ONLY RPC RELAY</span>
            </div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'controller' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('controller')}
            >
              <span className="node-icon">⌘</span>
              <span>CONTROLLER DAEMON</span>
            </div>
          </div>

          {/* Center Hub: MagicBlock TEE PER with soft mint green radial glow */}
          <div
            className="enclave-hub-container"
            onClick={() => setSelectedNode('hub')}
            style={{ cursor: 'pointer' }}
          >
            <div className="enclave-glow" />
            <div className="enclave-hub-content">
              <span className="enclave-hub-kicker">
                <span className="announcement-dot" />
                CONFIDENTIAL HARDWARE ENCLAVE
              </span>
              <h3 className="enclave-hub-title">
                MagicBlock PER Kernel
              </h3>

              <div className="enclave-subnodes">
                <div className="enclave-subnode-pill">
                  <span className="subnode-title">SecretPolicy</span>
                  <span className="subnode-badge">Bounded Budget</span>
                </div>
                <div className="enclave-subnode-pill">
                  <span className="subnode-title">SessionLedger</span>
                  <span className="subnode-badge">Single-Use Permit</span>
                </div>
                <div className="enclave-subnode-pill">
                  <span className="subnode-title">EphemeralPermission</span>
                  <span className="subnode-badge">Zero Sibling Read</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Egress & Settlement Sinks */}
          <div className="diagram-column">
            <div className="column-label">EGRESS & SETTLEMENT</div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'receipt' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('receipt')}
            >
              <span className="node-icon">✓</span>
              <span>SANITIZED RECEIPT</span>
            </div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'action' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('action')}
            >
              <span className="node-icon">⚙</span>
              <span>SPL MAGIC ACTION</span>
            </div>

            <div
              className={`pipeline-node-tag interactive ${selectedNode === 'terminal' ? 'active-node' : ''}`}
              onClick={() => setSelectedNode('terminal')}
            >
              <span className="node-icon">◈</span>
              <span>MUTUAL EXCLUSION PDA</span>
            </div>
          </div>
        </div>

        {/* Node Inspector Bar */}
        <div className="node-inspector-strip">
          <div className="inspector-info">
            <span className="inspector-label">INSPECTING:</span>
            <strong className="inspector-value">{activeInfo.title}</strong>
            <span className="brand-badge">{activeInfo.category}</span>
          </div>
          <div className="inspector-info">
            <span className="inspector-label">LOCATION:</span>
            <span className="inspector-value">{activeInfo.location}</span>
          </div>
          <div className="inspector-info">
            <span className="inspector-label">CANONICAL SEED:</span>
            <code style={{ fontSize: '12px', color: 'var(--color-off-black)' }}>
              {activeInfo.seeds}
            </code>
          </div>
        </div>

        {/* Invariant callout */}
        <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
          <strong>Security Guarantee:</strong> {activeInfo.invariants}
        </div>

        {/* Interactive Permit Lifecycle Stepper */}
        <div className="lifecycle-stepper">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-smoke)', fontWeight: '500' }}>
              PERMIT LIFECYCLE:
            </span>
            <div className="lifecycle-steps">
              {lifecycleSteps.map((step, idx) => (
                <div key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className={`step-node ${activeStep === step.id ? 'active' : ''}`}
                    onClick={() => setActiveStep(step.id)}
                  >
                    {step.label}
                  </button>
                  {idx < lifecycleSteps.length - 1 && <span className="step-arrow">→</span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-graphite)' }}>
            {lifecycleSteps.find((s) => s.id === activeStep)?.desc}
          </div>
        </div>
      </div>
    </section>
  )
}
