import { useEffect, useMemo, useState } from 'react'
import { createEvidenceBeats, EVIDENCE_HOLD_MS, nextEvidenceIndex } from '../lib/evidence-board.js'

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 7h9M7.5 3.5 11 7l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

export default function EvidenceBoard({ evidence }) {
  const beats = useMemo(() => createEvidenceBeats(evidence), [evidence])
  const [beatId, setBeatId] = useState(beats[0].id)
  const [playing, setPlaying] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  const beat = beats.find((item) => item.id === beatId) || beats[0]
  const index = beats.findIndex((b) => b.id === beat.id)

  const goTo = (i) => {
    setBeatId(beats[nextEvidenceIndex(i, beats.length)].id)
  }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!playing || reduceMotion) return undefined
    const timer = window.setTimeout(() => {
      setBeatId((current) => {
        const currentIndex = beats.findIndex((b) => b.id === current)
        return beats[nextEvidenceIndex(currentIndex + 1, beats.length)].id
      })
    }, EVIDENCE_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [beatId, beats, playing, reduceMotion])

  return (
    <section
      className="landing-dossier"
      aria-label="Capability evidence path"
      data-aos="fade-up"
      data-aos-delay="120"
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocusCapture={() => setPlaying(false)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPlaying(true)
      }}
    >
      <div className="landing-dossier-top">
        <div
          className="landing-dossier-tabs"
          role="tablist"
          aria-label="Capability evidence path"
        >
          {beats.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`evidence-tab-${item.id}`}
              aria-selected={item.id === beatId}
              aria-controls="evidence-panel"
              className={
                item.id === beatId
                  ? 'is-active'
                  : i < index
                    ? 'is-done'
                    : undefined
              }
              onClick={() => goTo(i)}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="landing-dossier-play"
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing && !reduceMotion ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="landing-dossier-progress" aria-hidden={reduceMotion}>
        <div
          key={`${beatId}-${playing}`}
          className={`landing-dossier-progress-bar${playing && !reduceMotion ? ' is-running' : ''}`}
          style={{ animationDuration: `${EVIDENCE_HOLD_MS}ms` }}
        />
      </div>

      <div
        className="landing-dossier-panel"
        id="evidence-panel"
        role="tabpanel"
        aria-labelledby={`evidence-tab-${beat.id}`}
      >
        <div className="landing-dossier-copy">
          <p className="landing-micro">{beat.eyebrow}</p>
          <h3>{beat.title}</h3>
          <p>{beat.body}</p>
          <blockquote>{beat.quote}</blockquote>
          <div className="landing-dossier-nav">
            <button
              type="button"
              className="landing-dossier-btn"
              onClick={() => goTo(index - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="landing-dossier-btn is-primary"
              onClick={() => goTo(index + 1)}
            >
              Next
              <Arrow />
            </button>
          </div>
        </div>

        <article
          className={`landing-dossier-artifact is-${beat.artifact.kind}`}
          aria-label={beat.artifact.heading}
        >
          <header>
            <span className="landing-micro">Sealed Artifact</span>
            <strong>{beat.artifact.heading}</strong>
            <span className="landing-dossier-badge">{beat.stamp}</span>
          </header>
          <dl>
            {beat.artifact.lines.map((line) => (
              <div key={line.k}>
                <dt>{line.k}</dt>
                <dd>{line.v}</dd>
              </div>
            ))}
          </dl>
          <footer>
            <span className="landing-micro">
              {index + 1} / {beats.length}
            </span>
            <span className="landing-micro">
              {playing && !reduceMotion ? 'Looping' : 'Paused'}
            </span>
          </footer>
        </article>
      </div>
    </section>
  )
}
