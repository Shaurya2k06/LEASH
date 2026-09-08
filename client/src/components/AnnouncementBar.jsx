import { useState } from 'react'

export default function AnnouncementBar({ onOpenSpec }) {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <aside className="announcement-bar" role="region" aria-label="Announcement">
      <div className="announcement-content">
        <span className="announcement-tag">
          <span className="announcement-dot" />
          SPEC REF 048
        </span>
        <span>
          LEASH 2.4 — Confidential spending capability kernel on MagicBlock Private Ephemeral Rollups.
        </span>
      </div>
      <div className="announcement-actions">
        <button
          type="button"
          className="announcement-btn"
          onClick={onOpenSpec}
        >
          VIEW INVARIANTS
        </button>
        <button
          type="button"
          className="announcement-close"
          onClick={() => setVisible(false)}
          aria-label="Dismiss announcement"
        >
          ×
        </button>
      </div>
    </aside>
  )
}
