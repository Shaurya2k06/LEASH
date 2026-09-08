export default function ArchitectureMatrix({ programId }) {
  return (
    <section className="leash-section" id="architecture">
      <div className="section-header-wrap" data-aos="fade-up">
        <span className="leash-micro">SYSTEM TOPOLOGY</span>
        <h2 className="section-title">
          Three-tier confidential architecture.
        </h2>
        <p className="section-desc">
          Strict separation between untrusted multi-agent swarms, TEE-isolated ephemeral rollups,
          and public base-layer Solana consensus.
        </p>
      </div>

      <div className="arch-matrix-container">
        {/* Tier 1: Ingress */}
        <div className="arch-tier-card" data-aos="fade-up" data-aos-delay="100">
          <span className="tier-kicker">TIER 01 // UNTRUSTED BOUNDARY</span>
          <h3 className="tier-title">Swarm Ingress & Relays</h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', lineHeight: '1.45' }}>
            External autonomous swarms submit single-use permit requests. Read-only relays validate and rate-limit JSON-RPC payloads without signing or decision authority.
          </p>

          <div className="tier-nodes">
            <div className="node-pill">
              <span>Hostile Agent Swarms</span>
              <span className="leash-micro">UNTRUSTED</span>
            </div>
            <div className="node-pill">
              <span>Read-Only JSON-RPC Relay</span>
              <span className="leash-micro">RATE-LIMITED</span>
            </div>
            <div className="node-pill">
              <span>Operator CLI / MCP</span>
              <span className="leash-micro">PUBLIC AUDITOR</span>
            </div>
          </div>
        </div>

        {/* Tier 2: Confidential Enclave */}
        <div className="arch-tier-card highlight" data-aos="fade-up" data-aos-delay="150">
          <span className="tier-kicker" style={{ color: 'var(--accent-moss)' }}>
            TIER 02 // CONFIDENTIAL KERNEL
          </span>
          <h3 className="tier-title">MagicBlock TEE PER</h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', lineHeight: '1.45' }}>
            Hardware-isolated enclaves execute private policy constraints, enforce monotonic nonces, deny sibling reads, and manage atomic reservations with zero public leakage.
          </p>

          <div className="tier-nodes">
            <div className="node-pill" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent-moss)' }}>
              <span>SecretPolicy (Private Budget)</span>
              <span className="leash-micro" style={{ color: 'var(--accent-moss)' }}>ENCRYPTED</span>
            </div>
            <div className="node-pill" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent-moss)' }}>
              <span>SessionLedger (Per-Agent)</span>
              <span className="leash-micro" style={{ color: 'var(--accent-moss)' }}>ISOLATED</span>
            </div>
            <div className="node-pill" style={{ background: 'var(--bg-card)', borderColor: 'var(--accent-moss)' }}>
              <span>EphemeralPermission</span>
              <span className="leash-micro" style={{ color: 'var(--accent-moss)' }}>ZERO SIBLING READ</span>
            </div>
          </div>
        </div>

        {/* Tier 3: Settlement */}
        <div className="arch-tier-card" data-aos="fade-up" data-aos-delay="200">
          <span className="tier-kicker">TIER 03 // BASE SETTLEMENT</span>
          <h3 className="tier-title">Solana Consensus</h3>
          <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', lineHeight: '1.45' }}>
            Public settlement markers and SPL Token transfers finalize on Solana devnet. The terminal PDA guarantees mutual exclusivity: spent or expired, never replayable.
          </p>

          <div className="tier-nodes">
            <div className="node-pill">
              <span>SPL Magic Action Escrow</span>
              <span className="leash-micro">TWO-PHASE</span>
            </div>
            <div className="node-pill">
              <span>TerminalMarker PDA</span>
              <span className="leash-micro">MUTUALLY EXCLUSIVE</span>
            </div>
            <div className="node-pill">
              <span>Solana Devnet L1</span>
              <span className="leash-micro">
                PROGRAM {programId ? `${programId.slice(0, 8)}…${programId.slice(-4)}` : 'NOT CONFIGURED'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
