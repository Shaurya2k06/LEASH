import { useEffect, useState } from 'react'

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

export default function DemoProofTape({ demo, demoError }) {
  const steps = demo?.steps || []
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const activeStep = steps[activeIndex]

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActiveIndex(0)
      setPlaying(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [demo])

  useEffect(() => {
    if (!playing || !steps.length) return undefined
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => {
        if (index >= steps.length - 1) {
          setPlaying(false)
          return index
        }
        return index + 1
      })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [activeIndex, playing, steps.length])

  const startOrPause = () => {
    if (activeIndex >= steps.length - 1) setActiveIndex(0)
    setPlaying((value) => !value)
  }

  const reset = () => {
    setPlaying(false)
    setActiveIndex(0)
  }

  const passed = demo?.status === 'passed'

  return (
    <section className="demo-proof-section" id="live-demo">
      <div className="demo-proof-header">
        <div>
          <span className="leash-micro">LIVE DEVNET DEMO · LIFECYCLE REPLAY</span>
          <h2 className="section-title">Click through the authenticated settlement.</h2>
          <p className="section-desc">
            Play the ordered proof from a real devnet run. Private stages expose status only; each confirmed stage keeps its Explorer transaction and account links.
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
            <span><strong>{steps.length}</strong> ordered steps</span>
            <span><strong>{steps.filter((step) => step.signature).length}</strong> transaction links</span>
            <span><strong>{demo.network || 'solana-devnet'}</strong></span>
            {demo.actionLatencyMeasured === false && <span>latency claim: not measured</span>}
          </div>

          <div className="demo-proof-controls">
            <button type="button" className="leash-btn-primary" onClick={startOrPause} disabled={!steps.length}>
              {playing ? 'Pause lifecycle' : activeIndex >= steps.length - 1 ? 'Replay lifecycle' : 'Play lifecycle'}
            </button>
            <button type="button" className="leash-btn-secondary" onClick={reset} disabled={!steps.length}>Reset</button>
            <span className="demo-proof-position">STEP {steps.length ? activeIndex + 1 : 0} / {steps.length}</span>
          </div>

          <div className="demo-proof-path" aria-label="Demo lifecycle steps">
            {steps.map((step, index) => (
              <button
                type="button"
                key={`${step.id}-${index}`}
                className={`demo-proof-node ${index === activeIndex ? 'is-active' : ''} ${index < activeIndex ? 'is-complete' : ''}`}
                onClick={() => {
                  setPlaying(false)
                  setActiveIndex(index)
                }}
                aria-label={`Open step ${index + 1}: ${step.label}`}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <small>{step.label}</small>
              </button>
            ))}
          </div>

          {activeStep && (
            <article className={`demo-proof-active-step demo-proof-step-${activeStep.phase}`}>
              <div className="demo-proof-step-heading">
                <div>
                  <span className="demo-proof-phase">{phaseLabel[activeStep.phase] || activeStep.phase}</span>
                  <h3>{activeStep.label}</h3>
                </div>
                <span className="demo-proof-check">
                  {activeIndex < steps.length - 1 ? '✓ CONFIRMED' : '✓ LIFECYCLE COMPLETE'}
                </span>
              </div>
              {activeStep.detail && <p>{activeStep.detail}</p>}
              <div className="demo-proof-links">
                {activeStep.explorerUrl && <ExternalLink href={activeStep.explorerUrl}>Explorer transaction</ExternalLink>}
                {(activeStep.relatedSignatures || []).map((related) => (
                  <ExternalLink key={related.signature} href={related.explorerUrl}>{related.label}</ExternalLink>
                ))}
                {(activeStep.accounts || []).map((account) => (
                  <ExternalLink key={account.address} href={account.explorerUrl}>Account {account.address.slice(0, 6)}…</ExternalLink>
                ))}
              </div>
            </article>
          )}

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
