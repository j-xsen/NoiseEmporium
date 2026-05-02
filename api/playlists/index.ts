import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = requireAuth(req, res)
  if (!userId) return

  if (req.method === 'GET') {
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
    `
    return res.json({
      playlists: rows.map(r => ({
        id: r.id,
        name: r.name,
        songIds: r.song_ids,
        createdAt: new Date(r.created_at).getTime(),
      })),
    })
  }

  if (req.method === 'POST') {
    const { name } = req.body ?? {}
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

    const rows = await sql`
      INSERT INTO playlists (user_id, name) VALUES (${userId}, ${name.trim()})
      RETURNING id, name, created_at
    `
    const p = rows[0]
    return res.status(201).json({
      playlist: { id: p.id, name: p.name, songIds: [], createdAt: new Date(p.created_at).getTime() },
    })
  }

  res.status(405).end()
}
