
function isIOSDevice(): boolean {
  return /iPhone|iPad/.test(navigator.userAgent)
}

function isStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
}

interface Props {
  onDismiss: () => void
  onGoToShop: () => void
}

export default function OnboardingModal({ onDismiss, onGoToShop }: Props) {
  const showPWATip = isIOSDevice() && !isStandaloneMode()

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="App introduction">
      <div className="onboarding-card">
        <button className="onboarding-skip" onClick={onDismiss} aria-label="Skip introduction">
          Skip
        </button>

        <div className="onboarding-body">
          <div className="onboarding-step">
            <img src="/android-chrome-192x192.png" alt="Noise Emporium" className="onboarding-icon" width="80" height="80" />
            <h2 className="onboarding-title">Welcome to<br />The Noise Emporium</h2>
            <p className="onboarding-desc">
              The complete collection of all noise-things Jaxsen.
            </p>

            <ul className="onboarding-features">
              <li className="onboarding-feature">
                <span className="onboarding-feature-icon" aria-hidden="true">▶️</span>
                <div>
                  <strong>Stream everything</strong>
                  <p>Browse and stream all public releases.</p>
                </div>
              </li>
              <li className="onboarding-feature">
                <span className="onboarding-feature-icon" aria-hidden="true">⭐</span>
                <div>
                  <strong>Emporium Enthusiast — $5/month</strong>
                  <p>Unlocks exclusive tracks, plus big discounts on everything in the shop.</p>
                </div>
              </li>
            </ul>

            {showPWATip && (
              <div className="onboarding-pwa-card">
                <div className="onboarding-pwa-header">
                  <span className="onboarding-pwa-badge">Recommended</span>
                </div>
                <p className="onboarding-pwa-title">Add to your Home Screen</p>
                <p className="onboarding-pwa-desc">
                  Get the full app experience — lock-screen controls, no address bar, and faster loading.
                </p>
                <ol className="onboarding-pwa-steps">
                  <li>
                    <span className="onboarding-pwa-num">1</span>
                    <span>
                      Tap the{' '}
                      <span className="onboarding-pwa-share" aria-label="Share button">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                      </span>{' '}
                      Share button in Safari
                    </span>
                  </li>
                  <li>
                    <span className="onboarding-pwa-num">2</span>
                    <span>Tap <strong>"Add to Home Screen"</strong></span>
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-shop-btn" onClick={onGoToShop}>
            Explore the Shop
          </button>
          <button className="onboarding-next" onClick={onDismiss}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
