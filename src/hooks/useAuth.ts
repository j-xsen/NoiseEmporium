// useAuth.ts — JWT-based authentication.
//
// Tokens are stored in localStorage under TOKEN_KEY and are valid for 30 days
// (expiry enforced server-side). On mount we re-validate the stored token via
// /api/auth/me so that expired or revoked tokens are cleaned up automatically.

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

  // On mount: verify any stored token. If the server rejects it (expired,
  // tampered, JWT_SECRET rotated) we remove the stale entry and show the
  // login screen instead of looping on 401s.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) { setLoading(false); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user }) => { setUser(user); setToken(stored) })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error ?? 'Login failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error ?? 'Registration failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
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
      const { user: u } = await r.json()
      setUser(u)
    } catch { /* ignore */ }
  }, [])

  return { user, token, loading, login, register, logout, refreshUser }
}
