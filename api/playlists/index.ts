// api/playlists/index.ts — GET (list) and POST (create) for the current user's playlists.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'
import { setSecurityHeaders } from '../_headers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  const userId = requireAuth(req, res)
  if (!userId) return

  if (req.method === 'GET') {
    try {
      // ARRAY_AGG with FILTER drops the NULL row that LEFT JOIN produces when
      // a playlist has no songs, giving an empty array instead of [null].
      const rows = await sql`
        SELECT
          p.id, p.name, p.created_at,
          COALESCE(
            ARRAY_AGG(ps.song_id ORDER BY ps.position) FILTER (WHERE ps.song_id IS NOT NULL),
            ARRAY[]::TEXT[]
          ) AS song_ids
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        WHERE p.user_id = ${userId}
        GROUP BY p.id
        ORDER BY p.created_at
        LIMIT 200
      `
      return res.json({
        playlists: rows.map(r => ({
          id: r.id,
          name: r.name,
          songIds: r.song_ids,
          createdAt: new Date(r.created_at).getTime(),
        })),
      })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  if (req.method === 'POST') {
    const { name } = req.body ?? {}
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    if (name.trim().length > 100) return res.status(400).json({ error: 'Name must be 100 characters or fewer' })

    try {
      const rows = await sql`
        INSERT INTO playlists (user_id, name) VALUES (${userId}, ${name.trim()})
        RETURNING id, name, created_at
      `
      const p = rows[0]
      return res.status(201).json({
        playlist: { id: p.id, name: p.name, songIds: [], createdAt: new Date(p.created_at).getTime() },
      })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  res.status(405).end()
}
