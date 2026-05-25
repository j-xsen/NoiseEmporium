// api/auth/[action].ts — handles /api/auth/login, /api/auth/register, /api/auth/me
// Consolidated into a single function to stay within the Vercel Hobby plan's 12-function limit.
// Vercel routes /api/auth/login → req.query.action = 'login', etc.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { signToken, requireAuth } from '../_auth.js'
import { isRateLimited, clientIp } from '../_rateLimit.js'
import { setSecurityHeaders } from '../_headers.js'

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (isRateLimited(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
  try {
    const rows = await sql`
      SELECT id, email, password_hash, tier FROM users WHERE email = ${email.toLowerCase().trim()}
    `
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, tier: user.tier } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (isRateLimited(`register:${clientIp(req)}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const rows = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email.toLowerCase().trim()}, ${hash})
      RETURNING id, email, tier
    `
    const user = rows[0]
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, tier: user.tier } })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'Email already in use' })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const userId = requireAuth(req, res)
  if (!userId) return
  try {
    const rows = await sql`SELECT id, email, tier FROM users WHERE id = ${userId}`
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  const { action } = req.query
  if (action === 'login')    return handleLogin(req, res)
  if (action === 'register') return handleRegister(req, res)
  if (action === 'me')       return handleMe(req, res)
  res.status(404).end()
}
