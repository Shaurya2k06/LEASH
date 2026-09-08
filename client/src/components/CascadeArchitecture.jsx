const TECH_STACK = [
  {
    group: 'Surfaces',
    items: ['Hostile Swarm Ingress', 'Read-only RPC Relay', 'Operator Dashboard', 'External MCP'],
  },
  {
    group: 'Kernel',
    items: ['MagicBlock PER (TEE)', 'Rust Program 1.89.0', 'Monotonic Nonce Engine', 'Atomic Reservation Ledger'],
  },
  {
    group: 'Integrations',
    items: ['SPL Magic Action', 'Devnet Validator Node', 'Two-Phase Commit Escrow', 'Scrubbed Undelegation'],
  },
  {
    group: 'Consensus',
    items: ['Solana L1 Base Layer', 'Anchor 1.0.2 Binary', 'Mutually Exclusive PDA', 'TerminalMarker: Spent / Expired'],
  },
]

export default function CascadeArchitecture() {
  return (
    <div className="landing-arch">
      <div className="landing-arch-canvas">
        {/* Dynamic Topology Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '36px',
            alignItems: 'center',
            width: '100%',
            maxWidth: '960px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Column 1: Channels & Ingress */}
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="landing-arch-node is-channel">
              <span className="landing-micro">Ingress · Channel</span>
              <strong>Hostile Agent Swarm</strong>
              <em>Untrusted multi-agent actors</em>
            </div>
            <div className="landing-arch-node is-channel">
              <span className="landing-micro">Relay · Gateway</span>
              <strong>Read-Only RPC Relay</strong>
              <em>Payload validation · rate limit</em>
            </div>
            <div className="landing-arch-node is-channel">
              <span className="landing-micro">Interface</span>
              <strong>Operator View / MCP</strong>
              <em>Auditable public health</em>
            </div>
          </div>

          {/* Column 2: Kernel & Enclave */}
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="landing-arch-node is-kernel">
              <span className="landing-micro">Confidential Enclave</span>
              <strong>SecretPolicy Engine</strong>
              <em>Private budget · sealed limits</em>
            </div>
            <div className="landing-arch-node is-kernel">
              <span className="landing-micro">Isolation Gate</span>
              <strong>SessionLedger (PER)</strong>
              <em>Zero sibling read · monotonic nonce</em>
            </div>
            <div className="landing-arch-node is-work">
              <span className="landing-micro">Audit Trail</span>
              <strong>Sanitized Receipt</strong>
              <em>Routing metadata · zero secrets</em>
            </div>
          </div>

          {/* Column 3: Integrations & Consensus */}
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="landing-arch-node is-integration">
              <span className="landing-micro">Settlement Escrow</span>
              <strong>SPL Magic Action</strong>
              <em>Atomic rollback & safe retry</em>
            </div>
            <div className="landing-arch-node is-integration">
              <span className="landing-micro">Public Consensus</span>
              <strong>Terminal Marker PDA</strong>
              <em>Strictly Spent or Expired</em>
            </div>
            <div className="landing-arch-node is-work">
              <span className="landing-micro">Base Layer</span>
              <strong>Solana Consensus L1</strong>
              <em>Devnet verified: 3hYb...WiTUe</em>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-arch-stack">
        {TECH_STACK.map((col) => (
          <div key={col.group}>
            <p className="landing-micro">{col.group}</p>
            <ul>
              {col.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
