import { useState } from 'react'

const faqs = [
  {
    q: 'How does LEASH guarantee that private budgets remain confidential on Solana?',
    a: 'LEASH uses a MagicBlock Private Ephemeral Rollup (PER). The SecretPolicy account is allocated empty on the Solana base layer, delegated into the PER, and only initialized and configured once inside the confidential hardware TEE enclave. Neither policy limits, hashes, nor per-agent allowances ever touch public base-layer state, gossip, logs, or simulation output.',
  },
  {
    q: 'Can a compromised agent in a swarm steal or inspect other agents’ permits?',
    a: 'No. Ephemeral permissions in the PER are created with strict per-session boundaries. An enrolled agent can only read and mutate its own SessionLedger. Sibling agents have no permission membership and are rejected by the hardware enclave from reading sibling ledgers or receipts via direct RPC, batch calls, or subscription listeners.',
  },
  {
    q: 'What prevents double-spending or replay of an expired capability permit?',
    a: 'Each permit carries a monotonically increasing nonce issued by the private policy counter. Settlement commits an authenticated SPL Magic Action and transitions a deterministic Solana Terminal PDA into either Spent or Expired. Because the same PDA can never transition twice, replay attacks fail deterministically at consensus.',
  },
  {
    q: 'What happens if a settlement transaction fails due to network or escrow faults?',
    a: 'Settlement uses an atomic two-phase commit: settle_permit generates a sanitized pending receipt without consuming the budget reservation. The SPL Magic Action then verifies escrow signatures and balances before release. If the action reverts (e.g. underfunded vault), the private reservation and receipt remain retryable without loss of funds.',
  },
  {
    q: 'How is state cleaned up when an ephemeral session completes?',
    a: 'Before an account is undelegated from the PER back to base-layer Solana, all confidential bytes are scrubbed and private permissions closed. No secret-bearing delegated account is ever undelegated without sanitization, preserving zero-knowledge hygiene on the public ledger.',
  },
]

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState(0)

  const toggle = (idx) => {
    setOpenIdx((prev) => (prev === idx ? -1 : idx))
  }

  return (
    <section id="faq" className="faq-section">
      <div className="section-header">
        <span className="section-kicker">05 / FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Architectural inquiries & invariants.</h2>
        <p className="section-desc">
          Key questions regarding confidential execution, threat modeling, and TEE trust boundaries.
        </p>
      </div>

      <div className="faq-list">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx
          return (
            <div
              key={faq.q}
              className={`faq-item ${isOpen ? 'expanded' : ''}`}
              onClick={() => toggle(idx)}
            >
              <div className="faq-question-row">
                <h3 className="faq-question">
                  {faq.q}
                </h3>
                <span className="faq-chevron" aria-hidden="true">
                  {isOpen ? '↑' : '↓'}
                </span>
              </div>
              {isOpen && (
                <p className="faq-answer">
                  {faq.a}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
