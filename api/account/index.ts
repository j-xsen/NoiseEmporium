import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { password } = req.body ?? {}
  if (!password) return res.status(400).json({ error: 'Password is required' })

  try {
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Incorrect password' })

    // Delete playlists first (foreign key), then the user
    await sql`DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ${userId})`
    await sql`DELETE FROM playlists WHERE user_id = ${userId}`
    await sql`DELETE FROM play_events WHERE user_id = ${userId}`
    await sql`DELETE FROM users WHERE id = ${userId}`

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
