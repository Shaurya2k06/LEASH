import { useState } from 'react'

const faqs = [
  {
    q: 'Why is LEASH TEE-backed rather than using zero-knowledge proofs?',
    a: 'Autonomous agent swarms require sub-second transaction sequencing and dynamic concurrent state mutations (e.g. atomic reservations across 20 competing agents). MagicBlock Private Ephemeral Rollups run on trusted execution environments (TEE) to provide hardware-enforced memory encryption and instant finality without the multi-second prover latency of ZK rollups.',
  },
  {
    q: 'How does LEASH prevent sibling agents in a swarm from eavesdropping on transactions?',
    a: 'Each agent session is isolated by an EphemeralPermission PDA inside the PER enclave. The TEE runtime rejects any direct RPC, batch query, or subscription listener originating from sibling keys. Sibling agents have zero permission membership to read another agent’s SessionLedger or pending SettlementReceipt.',
  },
  {
    q: 'What occurs during atomic contention when 20 agents race for 1 budget unit?',
    a: 'Budget reservations are atomic. When 20 simultaneous permit requests arrive, the hardware sequencer awards the permit to exactly 1 agent and cleanly rejects the remaining 19. Losing sessions remain completely unmutated, preventing desynchronized ledgers or corrupted budgets.',
  },
  {
    q: 'How does SPL Magic Action rollback protect against failed settlement?',
    a: 'Settlement uses two-phase verification: settle_permit creates a sanitized pending receipt without consuming the reservation. The SPL Magic Action then verifies escrow balances and signers. If the target vault is underfunded, the transfer reverts cleanly, leaving the private reservation and receipt intact for safe retry.',
  },
  {
    q: 'Can an expired capability permit ever race with a late payment?',
    a: 'No. The public TerminalMarker PDA on Solana consensus is mutually exclusive: it transitions either to Spent or Expired, never both. Expiry refunds the private budget only before the authenticated expiry action completes, making replay or double-spending impossible.',
  },
]

export default function LeashFaq() {
  const [openIndex, setOpenIndex] = useState(0)

  const toggle = (idx) => {
    setOpenIndex((curr) => (curr === idx ? -1 : idx))
  }

  return (
    <section className="leash-section" id="faq">
      <div className="section-header-wrap" data-aos="fade-up" style={{ textAlign: 'center' }}>
        <h2 className="section-title">
          Architectural questions & answers.
        </h2>
        <p className="section-desc" style={{ margin: '0 auto' }}>
          Deep-dive into cryptographic invariants, hardware security assumptions, and swarm scalability.
        </p>
      </div>

      <div className="faq-grid" data-aos="fade-up" data-aos-delay="100">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={faq.q}
              className={`faq-row ${isOpen ? 'is-open' : ''}`}
              onClick={() => toggle(idx)}
            >
              <div className="faq-question-wrap">
                <h3>{faq.q}</h3>
                <span className="faq-arrow" aria-hidden="true">
                  {isOpen ? '↓' : '→'}
                </span>
              </div>
              {isOpen && (
                <p className="faq-answer-text">
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
