// api/playlists/featured.ts — publicly readable curator playlists.
//
// Featured playlists are regular playlist rows with featured = true set
// directly in the database (no UI for this yet). featured_order controls
// display order on the home screen; playlists without it fall to the end.
// No auth required — these are visible to all visitors.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const rows = await sql`
      SELECT
        p.id, p.name, p.created_at,
        COALESCE(
          ARRAY_AGG(ps.song_id ORDER BY ps.position) FILTER (WHERE ps.song_id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS song_ids
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      WHERE p.featured = true
      GROUP BY p.id
      ORDER BY p.featured_order ASC NULLS LAST, p.created_at ASC
    `
    res.json({
      playlists: rows.map(r => ({
        id: r.id,
        name: r.name,
        songIds: r.song_ids,
        createdAt: new Date(r.created_at).getTime(),
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
