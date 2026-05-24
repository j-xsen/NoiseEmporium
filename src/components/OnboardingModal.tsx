import { useState } from 'react'

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

const STEPS = 3

export default function OnboardingModal({ onDismiss, onGoToShop }: Props) {
  const [step, setStep] = useState(0)

  const showPWATip = isIOSDevice() && !isStandaloneMode()

  function next() {
    if (step < STEPS - 1) setStep(s => s + 1)
    else onDismiss()
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="App introduction">
      <div className="onboarding-card">
        <button className="onboarding-skip" onClick={onDismiss} aria-label="Skip introduction">
          Skip
        </button>

        <div className="onboarding-body">
          {step === 0 && <StepWelcome showPWATip={showPWATip} />}
          {step === 1 && <StepBrowse />}
          {step === 2 && <StepMembership onGoToShop={onGoToShop} />}
        </div>

        <div className="onboarding-footer">
          <div className="onboarding-dots" aria-hidden="true">
            {Array.from({ length: STEPS }).map((_, i) => (
              <span key={i} className={`onboarding-dot${i === step ? ' onboarding-dot--active' : ''}`} />
            ))}
          </div>
          <button className="onboarding-next" onClick={next}>
            {step === STEPS - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepWelcome({ showPWATip }: { showPWATip: boolean }) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-icon" aria-hidden="true">🎵</div>
      <h2 className="onboarding-title">Welcome to<br />Noise Emporium</h2>
      <p className="onboarding-desc">
        Jaxsen Honeycutt's music — stream the full catalog, explore releases, and support the work directly.
      </p>

      {showPWATip && (
        <div className="onboarding-pwa-card">
          <div className="onboarding-pwa-header">
            <span className="onboarding-pwa-badge">Recommended</span>
          </div>
          <p className="onboarding-pwa-title">Add to your Home Screen</p>
          <p className="onboarding-pwa-desc">
            Get the full app experience — lock-screen controls, no browser chrome, and faster loading.
          </p>
          <ol className="onboarding-pwa-steps">
            <li>
              <span className="onboarding-pwa-num">1</span>
              <span>
                Tap the{' '}
                <span className="onboarding-pwa-share" aria-label="Share button">
                  {/* iOS share icon */}
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
  )
}

function StepBrowse() {
  return (
    <div className="onboarding-step">
      <div className="onboarding-icon" aria-hidden="true">🎛️</div>
      <h2 className="onboarding-title">Browse &amp; Listen</h2>
      <p className="onboarding-desc">Everything you need is right on the home screen.</p>
      <ul className="onboarding-features">
        <li className="onboarding-feature">
          <span className="onboarding-feature-icon" aria-hidden="true">🌐</span>
          <div>
            <strong>Two views</strong>
            <p>Toggle between the classic grid and the 3D bubble world using the button in the top corner.</p>
          </div>
        </li>
        <li className="onboarding-feature">
          <span className="onboarding-feature-icon" aria-hidden="true">💿</span>
          <div>
            <strong>Open a release</strong>
            <p>Tap any release to see its full track list.</p>
          </div>
        </li>
        <li className="onboarding-feature">
          <span className="onboarding-feature-icon" aria-hidden="true">▶️</span>
          <div>
            <strong>Play</strong>
            <p>Tap a track to start listening. The mini-player appears at the bottom — tap it for the full player.</p>
          </div>
        </li>
      </ul>
    </div>
  )
}

function StepMembership({ onGoToShop }: { onGoToShop: () => void }) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-icon" aria-hidden="true">⭐</div>
      <h2 className="onboarding-title">Emporium Enthusiast</h2>
      <p className="onboarding-desc">
        A <strong>$5/month</strong> membership that unlocks the full experience.
      </p>
      <ul className="onboarding-features">
        <li className="onboarding-feature">
          <span className="onboarding-feature-icon" aria-hidden="true">🔓</span>
          <div>
            <strong>Exclusive tracks</strong>
            <p>Access all member-only and unreleased songs — the ones marked with a lock icon on free accounts.</p>
          </div>
        </li>
        <li className="onboarding-feature">
          <span className="onboarding-feature-icon" aria-hidden="true">💸</span>
          <div>
            <strong>Major discounts</strong>
            <p>Big savings on digital downloads, physical CDs, and instrumental licenses in the store.</p>
          </div>
        </li>
      </ul>
      <p className="onboarding-free-note">
        Free accounts still get full access to all public tracks.
      </p>
      <button className="onboarding-shop-btn" onClick={onGoToShop}>
        Explore the Shop
      </button>
    </div>
  )
}
