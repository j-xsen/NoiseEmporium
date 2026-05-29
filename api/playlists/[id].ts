// api/playlists/[id].ts — PATCH (rename) and DELETE for a single playlist.
// Both methods require the requesting user to own the playlist.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'
import { setSecurityHeaders } from '../_headers.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  const userId = requireAuth(req, res)
  if (!userId) return

  const { id } = req.query as { id: string }
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid playlist id' })

  try {
    const rows = await sql`SELECT id FROM playlists WHERE id = ${id} AND user_id = ${userId}`
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

    if (req.method === 'PATCH') {
      const { name } = req.body ?? {}
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
      if (name.trim().length > 100) return res.status(400).json({ error: 'Name must be 100 characters or fewer' })
      await sql`UPDATE playlists SET name = ${name.trim()} WHERE id = ${id}`
      return res.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM playlists WHERE id = ${id}`
      return res.json({ ok: true })
    }

    res.status(405).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
