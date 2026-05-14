// api/playlists/[id]/songs/[songId].ts — DELETE /api/playlists/:id/songs/:songId
// Removes a song from a playlist. Requires the requesting user to own the playlist.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../../../_db.js'
import { requireAuth } from '../../../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { id: playlistId, songId } = req.query as { id: string; songId: string }

  // Verify ownership
  const rows = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}`
  if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

  await sql`DELETE FROM playlist_songs WHERE playlist_id = ${playlistId} AND song_id = ${songId}`
  res.json({ ok: true })
}
