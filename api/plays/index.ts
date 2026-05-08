// api/plays/index.ts — records a song play event for the authenticated user.
//
// The client only calls this after PLAY_THRESHOLD seconds of actual listening
// (enforced in useAudio.ts), so each row represents a genuine play, not an
// accidental tap. song_id is a Contentful entry ID, not a database FK —
// Contentful is the music source of truth and songs aren't stored in the DB.

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
