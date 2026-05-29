// api/playlists/[id]/songs/[songId].ts — DELETE /api/playlists/:id/songs/:songId
// Removes a song from a playlist. Requires the requesting user to own the playlist.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../../../_db.js'
import { requireAuth } from '../../../_auth.js'
import { setSecurityHeaders } from '../../../_headers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SONG_ID_RE = /^[a-zA-Z0-9]{10,30}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  if (req.method !== 'DELETE') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { id: playlistId, songId } = req.query as { id: string; songId: string }
  if (!UUID_RE.test(playlistId)) return res.status(400).json({ error: 'Invalid playlist id' })
  if (!songId || typeof songId !== 'string' || !SONG_ID_RE.test(songId)) {
    return res.status(400).json({ error: 'Invalid songId' })
  }

  try {
    const rows = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}`
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

    await sql`DELETE FROM playlist_songs WHERE playlist_id = ${playlistId} AND song_id = ${songId}`
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
