// api/account/index.ts — account self-service actions (requires auth).
//
//   POST   — change password. Body: { currentPassword, newPassword }
//   DELETE — delete account.  Body: { password }
//            Cascades: deletes playlists → playlist_songs (via FK), and song_plays.
//            The user row is deleted last; ON DELETE CASCADE handles most cleanup.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = requireAuth(req, res)
  if (!userId) return

  // POST — change password
  if (req.method === 'POST') {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid input' })
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }
    try {
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
      if (!rows[0]) return res.status(404).json({ error: 'User not found' })
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash)
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
      const hash = await bcrypt.hash(newPassword, 10)
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`
      return res.json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  // DELETE — delete account
  if (req.method === 'DELETE') {
    const { password } = req.body ?? {}
    if (!password) return res.status(400).json({ error: 'Password is required' })
    if (typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
    try {
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
      if (!rows[0]) return res.status(404).json({ error: 'User not found' })
      const valid = await bcrypt.compare(password, rows[0].password_hash)
      if (!valid) return res.status(401).json({ error: 'Incorrect password' })
      await sql`DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ${userId})`
      await sql`DELETE FROM playlists WHERE user_id = ${userId}`
      await sql`DELETE FROM song_plays WHERE user_id = ${userId}`
      await sql`DELETE FROM users WHERE id = ${userId}`
      return res.json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  res.status(405).end()
}
