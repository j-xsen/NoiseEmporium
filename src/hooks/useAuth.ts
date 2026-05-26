// useAuth.ts — JWT-based authentication.
//
// Tokens are stored in localStorage under TOKEN_KEY and are valid for 30 days
// (expiry enforced server-side). On mount we re-validate the stored token via
// /api/auth/me so that expired or revoked tokens are cleaned up automatically.
//
// Email verification: if ?emailToken= is in the URL on mount, we attempt to
// verify it and log the user in directly. verificationError is set on failure.

import { useState, useEffect, useCallback } from 'react'

const TOKEN_KEY = 'ne-token'

export interface AuthUser {
  id: string
  email: string
  tier: 'free' | 'premium'
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const emailToken = params.get('emailToken')

    if (emailToken) {
      // Clear the token from the URL immediately so it isn't reused on refresh.
      params.delete('emailToken')
      const qs = params.toString()
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)

      fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: emailToken }),
      })
        .then(r => r.json().then((data: unknown) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          const d = data as Record<string, unknown>
          if (!ok) { setVerificationError((d.error as string) ?? 'Invalid or expired link'); return }
          const jwtToken = d.token as string
          localStorage.setItem(TOKEN_KEY, jwtToken)
          setToken(jwtToken)
          setUser(d.user as AuthUser)
        })
        .catch(() => setVerificationError('Verification failed. Please try again.'))
        .finally(() => setLoading(false))
      return
    }

    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) { setLoading(false); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user: u }: { user: AuthUser }) => { setUser(u); setToken(stored) })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json() as Record<string, unknown>
    if (!r.ok) {
      const err = new Error((data.error as string) ?? 'Login failed') as Error & { code?: string }
      err.code = data.code as string | undefined
      throw err
    }
    const jwtToken = data.token as string
    localStorage.setItem(TOKEN_KEY, jwtToken)
    setToken(jwtToken)
    setUser(data.user as AuthUser)
  }, [])

  const register = useCallback(async (email: string, password: string): Promise<{ pending: true; email: string } | void> => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json() as Record<string, unknown>
    if (!r.ok) throw new Error((data.error as string) ?? 'Registration failed')
    if (data.pending) return { pending: true, email: data.email as string }
    // Fallback path — should not occur with email verification enabled.
    localStorage.setItem(TOKEN_KEY, data.token as string)
    setToken(data.token as string)
    setUser(data.user as AuthUser)
  }, [])

  const resendVerification = useCallback(async (email: string): Promise<void> => {
    const r = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!r.ok) {
      const data = await r.json() as Record<string, unknown>
      throw new Error((data.error as string) ?? 'Failed to resend verification email')
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return
    try {
      const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      if (!r.ok) return
      const { user: u } = await r.json() as { user: AuthUser }
      setUser(u)
    } catch { /* ignore */ }
  }, [])

  return { user, token, loading, verificationError, login, register, resendVerification, logout, refreshUser }
}
