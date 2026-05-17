// api/auth/login.ts — POST /api/auth/login
// Returns a JWT + user object on success; 401 on bad credentials.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { signToken } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })

  try {
    const rows = await sql`
      SELECT id, email, password_hash, tier FROM users WHERE email = ${email.toLowerCase().trim()}
    `
    const user = rows[0]
    // Same error for unknown email and wrong password — avoids leaking whether an account exists.
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, tier: user.tier } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
