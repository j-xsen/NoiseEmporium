import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db'
import { requireAuth } from '../_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = requireAuth(req, res)
  if (!userId) return

  const { id } = req.query as { id: string }

  // Verify ownership
  const rows = await sql`SELECT id FROM playlists WHERE id = ${id} AND user_id = ${userId}`
  if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' })

  if (req.method === 'PATCH') {
    const { name } = req.body ?? {}
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
    await sql`UPDATE playlists SET name = ${name.trim()} WHERE id = ${id}`
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM playlists WHERE id = ${id}`
    return res.json({ ok: true })
  }

  res.status(405).end()
}
