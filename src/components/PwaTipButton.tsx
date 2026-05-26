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
              <span>Open your browser's Share menu</span>
            </li>
            <li>
              <span className="account-pwa-tip-num">2</span>
              <span>Tap <strong>"Add to Home Screen"</strong></span>
            </li>
          </ol>
        </div>
      )}
    </div>
  )
}
