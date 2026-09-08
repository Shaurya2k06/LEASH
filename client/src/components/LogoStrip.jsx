export default function LogoStrip() {
  const partners = [
    {
      name: 'MAGICBLOCK PER',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      name: 'SOLANA DEVNET',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M4 6h14l3 3H7L4 6zm0 12h14l3-3H7l-3 3zm3-6h14l-3-3H4l3 3z" fill="currentColor" />
        </svg>
      ),
    },
    {
      name: 'SOVEREIGN TEE',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9 9h6v6H9z" fill="currentColor" />
        </svg>
      ),
    },
    {
      name: 'TRITON RPC',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v10M8 10l4-3 4 3M8 14l4 3 4-3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      name: 'HELIUS INFRA',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <polygon points="12,2 22,20 2,20" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="14" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      name: 'SQUADS POLICY',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      name: 'DIALECT ACTIONS',
      icon: (
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
  ]

  return (
    <section className="logo-strip-section" aria-label="Ecosystem Integration">
      <div className="logo-strip-label">
        INTEGRATED INFRASTRUCTURE & VALIDATOR NETWORKS
      </div>
      <div className="logo-strip-row">
        {partners.map((p) => (
          <div key={p.name} className="partner-logo-item">
            {p.icon}
            <span>{p.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
