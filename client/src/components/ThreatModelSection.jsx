export default function ThreatModelSection() {
  return (
    <section className="leash-section" id="threat-model">
      <div className="section-header-wrap" data-aos="fade-up">
        <span className="leash-micro">THREAT MATRIX</span>
        <h2 className="section-title">
          Why agent swarms break standard wallets.
        </h2>
        <p className="section-desc">
          Giving autonomous LLMs private keys or unconstrained RPC signers is fatal in hostile multi-agent environments.
          LEASH moves spending authority into a verifiable hardware perimeter.
        </p>
      </div>

      <div className="threat-model-grid">
        {/* Vulnerable Paradigm */}
        <div className="threat-card vulnerable" data-aos="fade-right" data-aos-delay="100">
          <div className="threat-card-header">
            <span className="leash-micro" style={{ color: 'var(--accent-red)' }}>
              VULNERABLE PATTERN
            </span>
            <span className="logo-badge" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)', background: 'transparent' }}>
              HIGH RISK
            </span>
          </div>

          <h3 className="threat-title" style={{ color: 'var(--accent-red)' }}>
            Unbounded Agent Wallets
          </h3>

          <ul className="threat-list">
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-red)' }}>✕</span>
              <div>
                <strong>Prompt Injection Drains:</strong> An attacker tricking one agent can drain the entire balance without bounds.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-red)' }}>✕</span>
              <div>
                <strong>Sibling State Sniffing:</strong> Sibling agents in the swarm can listen to public mempools, simulate RPC queries, and frontrun intents.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-red)' }}>✕</span>
              <div>
                <strong>Silent Partial Failures:</strong> Network disconnects or drained escrow vaults leave budgets permanently consumed or desynced.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-red)' }}>✕</span>
              <div>
                <strong>Replay Vulnerability:</strong> Signed transactions can be intercepted, reordered, or re-broadcast across blocks.
              </div>
            </li>
          </ul>
        </div>

        {/* LEASH Enclave Paradigm */}
        <div className="threat-card enclave" data-aos="fade-left" data-aos-delay="150">
          <div className="threat-card-header">
            <span className="leash-micro" style={{ color: 'var(--accent-moss)' }}>
              THE LEASH KERNEL
            </span>
            <span className="logo-badge" style={{ borderColor: 'var(--accent-moss)', color: 'var(--accent-moss)' }}>
              HARDWARE VERIFIED
            </span>
          </div>

          <h3 className="threat-title" style={{ color: 'var(--ink-primary)' }}>
            Bounded Capability Enclaves
          </h3>

          <ul className="threat-list">
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-moss)' }}>✓</span>
              <div>
                <strong>Single-Use Typed Permits:</strong> Agents never hold treasury keys. They sign single-use intents bounded by monotonic nonces.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-moss)' }}>✓</span>
              <div>
                <strong>Hardware Sibling Isolation:</strong> MagicBlock TEE PER denies sibling reads. Even compromised agents cannot inspect sibling ledgers.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-moss)' }}>✓</span>
              <div>
                <strong>Atomic Rollback & Safe Retry:</strong> SPL Magic Actions execute with two-phase verification. Reverted payments leave reservations intact.
              </div>
            </li>
            <li className="threat-item">
              <span className="threat-icon" style={{ color: 'var(--accent-moss)' }}>✓</span>
              <div>
                <strong>Mutually Exclusive PDA:</strong> Public terminal markers on Solana resolve as Spent or Expired, never both. Zero replay risk.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
