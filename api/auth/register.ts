import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { signToken } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  try {
    const hash = await bcrypt.hash(password, 10)
    const rows = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email.toLowerCase().trim()}, ${hash})
      RETURNING id, email
    `
    const user = rows[0]
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'Email already in use' })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
