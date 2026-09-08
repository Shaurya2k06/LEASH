const phaseLabel = {
  base: 'BASE',
  private: 'TEE / PRIVATE',
  tee: 'TEE',
  public: 'PUBLIC',
}

function ExternalLink({ href, children }) {
  return (
    <a className="demo-proof-link" href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  )
}

export default function DemoProofTape({ demo, demoError, compact = false }) {
  const passed = demo?.status === 'passed'

  return (
    <section className={`demo-proof-section${compact ? ' demo-proof-section-compact' : ''}`} id={compact ? undefined : 'live-demo'}>
      <div className="demo-proof-header">
        <div>
          <span className="leash-micro">LIVE DEVNET DEMO · PUBLIC PROOF TAPE</span>
          <h2 className="section-title">One permit. One authenticated settlement.</h2>
          <p className="section-desc">
            A real run of the LEASH lifecycle, in order. Private stages expose status only; every published transaction and account link points to Solana devnet.
          </p>
        </div>
        <div className={`demo-proof-status ${passed ? 'is-passed' : ''}`}>
          <span className="demo-proof-status-dot" />
          {demo ? demo.status.toUpperCase() : 'NOT PUBLISHED'}
        </div>
      </div>

      {demoError && <p className="demo-proof-error">Demo artifact unavailable: {demoError}</p>}

      {demo && (
        <>
          <div className="demo-proof-summary">
            <span><strong>{demo.steps?.length || 0}</strong> ordered steps</span>
            <span><strong>{demo.steps?.filter((step) => step.signature).length || 0}</strong> transaction links</span>
            <span><strong>{demo.network || 'solana-devnet'}</strong></span>
            {demo.actionLatencyMeasured === false && <span>latency claim: not measured</span>}
          </div>

          <div className="demo-proof-tape">
            {(demo.steps || []).map((step, index) => (
              <article className={`demo-proof-step demo-proof-step-${step.phase}`} key={`${step.id}-${index}`}>
                <div className="demo-proof-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="demo-proof-step-body">
                  <div className="demo-proof-step-heading">
                    <div>
                      <span className="demo-proof-phase">{phaseLabel[step.phase] || step.phase}</span>
                      <h3>{step.label}</h3>
                    </div>
                    <span className="demo-proof-check">✓ CONFIRMED</span>
                  </div>
                  {step.detail && <p>{step.detail}</p>}
                  <div className="demo-proof-links">
                    {step.explorerUrl && <ExternalLink href={step.explorerUrl}>Explorer transaction</ExternalLink>}
                    {(step.relatedSignatures || []).map((related) => (
                      <ExternalLink key={related.signature} href={related.explorerUrl}>{related.label}</ExternalLink>
                    ))}
                    {(step.accounts || []).slice(0, 2).map((account) => (
                      <ExternalLink key={account.address} href={account.explorerUrl}>Account {account.address.slice(0, 6)}…</ExternalLink>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {demo.program?.explorerUrl && (
            <div className="demo-proof-footer">
              <span className="leash-micro">PROGRAM {demo.program.id}</span>
              <ExternalLink href={demo.program.explorerUrl}>Open program account</ExternalLink>
            </div>
          )}
        </>
      )}
    </section>
  )
}
