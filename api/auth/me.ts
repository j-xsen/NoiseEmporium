// api/auth/me.ts — GET /api/auth/me
// Validates the stored JWT and returns fresh user data (including current tier).
// Called on every page load to restore session and pick up tier changes from webhooks.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
