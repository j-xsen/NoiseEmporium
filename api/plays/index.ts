import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { songId } = req.body as { songId?: unknown }
  if (!songId || typeof songId !== 'string') {
    return res.status(400).json({ error: 'songId required' })
  }

  await sql`INSERT INTO song_plays (user_id, song_id) VALUES (${userId}, ${songId})`

  return res.status(201).end()
}
