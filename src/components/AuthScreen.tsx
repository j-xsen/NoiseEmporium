import { useState } from 'react'

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (email: string, password: string) => Promise<{ pending: true; email: string } | void>
  onResendVerification: (email: string) => Promise<void>
  verificationError?: string | null
  onDismiss?: () => void
}

export default function AuthScreen({ onLogin, onRegister, onResendVerification, verificationError, onDismiss }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleResend(emailAddr: string) {
    setResendStatus('sending')
    try {
      await onResendVerification(emailAddr)
      setResendStatus('sent')
    } catch {
      setResendStatus('idle')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setResendStatus('idle')
    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin(email, password)
      } else {
        const result = await onRegister(email, password)
        if (result?.pending) setPendingEmail(result.email)
      }
    } catch (err: unknown) {
      const e = err as Error & { code?: string }
      setError(e.message)
      if (e.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(email)
    } finally {
      setLoading(false)
    }
  }

  const card = pendingEmail ? (
    <div className="auth-card">
      <div className="auth-pending">
        <p className="auth-pending-title">Check your email</p>
        <p className="auth-pending-body">
          We sent a verification link to <strong>{pendingEmail}</strong>.<br />
          Click the link to activate your account.
        </p>
        {resendStatus === 'sent' ? (
          <p className="auth-resend-confirm">Sent! Check your inbox.</p>
        ) : (
          <button
            className="auth-resend"
            onClick={() => handleResend(pendingEmail)}
            disabled={resendStatus === 'sending'}
          >
            {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
          </button>
        )}
        <button className="auth-back" onClick={() => { setPendingEmail(null); setResendStatus('idle') }}>
          Back to sign in
        </button>
      </div>
    </div>
  ) : (
    <div className="auth-card">
      <div className="auth-tabs">
        <button
          className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
          onClick={() => { setMode('login'); setError(null); setUnverifiedEmail(null); setResendStatus('idle') }}
        >
          Sign in
        </button>
        <button
          className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
          onClick={() => { setMode('register'); setError(null); setUnverifiedEmail(null); setResendStatus('idle') }}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete={mode === 'login' ? 'email' : 'new-password'}
          required
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={12}
          required
        />
        {verificationError && (
          <p className="auth-error">
            {verificationError}{' '}
            {email && (
              <button type="button" className="auth-resend-inline" onClick={() => handleResend(email)}>
                Resend link
              </button>
            )}
          </p>
        )}
        {error && <p className="auth-error">{error}</p>}
        {unverifiedEmail && (
          <div className="auth-unverified">
            {resendStatus === 'sent' ? (
              <p className="auth-resend-confirm">Verification email sent! Check your inbox.</p>
            ) : (
              <button
                type="button"
                className="auth-resend"
                onClick={() => handleResend(unverifiedEmail)}
                disabled={resendStatus === 'sending'}
              >
                {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )

  if (onDismiss) {
    return (
      <div className="auth-screen auth-screen--modal" onClick={onDismiss}>
        <button className="auth-modal-close" onClick={onDismiss} aria-label="Close">✕</button>
        <div onClick={e => e.stopPropagation()}>
          {card}
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-top">
        <img src="/wordmark.webp" alt="Noise Emporium" className="auth-wordmark" />
      </div>
      {card}
      <div className="grass-divider" aria-hidden="true" />
    </div>
  )
}
