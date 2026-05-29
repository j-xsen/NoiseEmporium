// api/playlists/[id]/songs.ts — POST /api/playlists/:id/songs
// Appends a song to the end of a playlist. Silently ignores duplicates (ON CONFLICT DO NOTHING).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../../_db.js'
import { requireAuth } from '../../_auth.js'
import { setSecurityHeaders } from '../../_headers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SONG_ID_RE = /^[a-zA-Z0-9]{10,30}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  if (req.method !== 'POST') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { id: playlistId } = req.query as { id: string }
  if (!UUID_RE.test(playlistId)) return res.status(400).json({ error: 'Invalid playlist id' })

  const { songId } = req.body ?? {}
  if (!songId || typeof songId !== 'string') return res.status(400).json({ error: 'songId is required' })
  if (!SONG_ID_RE.test(songId)) return res.status(400).json({ error: 'Invalid songId' })

  try {
    const rows = await sql`SELECT id FROM playlists WHERE id = ${playlistId} AND user_id = ${userId}`
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

    // Position = current max + 1, or 0 for the first song.
    // Note: concurrent adds to the same playlist can produce duplicate position values;
    // position is used for display ordering only, not uniqueness.
    await sql`
      INSERT INTO playlist_songs (playlist_id, song_id, position)
      VALUES (
        ${playlistId}, ${songId},
        COALESCE((SELECT MAX(position) + 1 FROM playlist_songs WHERE playlist_id = ${playlistId}), 0)
      )
      ON CONFLICT DO NOTHING
    `
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
