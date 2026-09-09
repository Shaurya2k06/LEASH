export default function LeashFooter({ onOpenCockpit }) {
  return (
    <footer className="leash-footer">
      <div className="leash-shell footer-cta">
        <h2>
          Autonomous agents propose.<br />
          <em>The enclave decides.</em>
        </h2>
        <p>
          Build multi-agent swarms with bounded capability budgets. Run reproducible Anchor gates
          on Solana devnet, inspect TEE-isolated ephemeral rollups, and ensure private policies stay
          strictly on a leash.
        </p>
        <button type="button" className="leash-btn-primary" onClick={onOpenCockpit}>
          Launch operator cockpit
        </button>
      </div>
    </footer>
  )
}
