import { useState } from 'react'

function isIOSNotStandalone(): boolean {
  return (
    /iPhone|iPad/.test(navigator.userAgent) &&
    !window.matchMedia('(display-mode: standalone)').matches
  )
}

export default function PwaTipButton() {
  const [open, setOpen] = useState(false)

  if (!isIOSNotStandalone()) return null

  return (
    <div className="pwa-tip-wrapper">
      <button
        className="pwa-tip-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="Add to Home Screen tip"
      >
        !
      </button>
      {open && (
        <div className="pwa-tip-popover">
          <div className="account-pwa-tip-header">
            <span className="account-pwa-tip-title">Add to Home Screen</span>
            <span className="account-pwa-tip-badge">Recommended</span>
          </div>
          <ol className="account-pwa-tip-steps">
            <li>
              <span className="account-pwa-tip-num">1</span>
              <span>
                <strong>Safari:</strong> Tap the{' '}
                <span className="account-pwa-share" aria-label="Share button">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </span>{' '}
                Share button — or <strong>Chrome:</strong> tap <strong>⋯</strong> then Share
              </span>
            </li>
            <li>
              <span className="account-pwa-tip-num">2</span>
              <span>Scroll down (or tap <strong>"More"</strong>) if needed</span>
            </li>
            <li>
              <span className="account-pwa-tip-num">3</span>
              <span>Tap <strong>"Add to Home Screen"</strong></span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
