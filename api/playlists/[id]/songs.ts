import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../../_db.js'
import { requireAuth } from '../../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { id: playlistId } = req.query as { id: string }
  const { songId } = req.body ?? {}
  if (!songId) return res.status(400).json({ error: 'songId is required' })

  // Verify ownership
  const rows = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}`
  if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

  await sql`
    INSERT INTO playlist_songs (playlist_id, song_id, position)
    VALUES (
      ${playlistId}, ${songId},
      COALESCE((SELECT MAX(position) + 1 FROM playlist_songs WHERE playlist_id = ${playlistId}), 0)
    )
    ON CONFLICT DO NOTHING
  `
  res.json({ ok: true })
}
