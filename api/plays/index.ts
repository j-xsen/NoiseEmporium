// api/plays/index.ts
//
// GET  /api/plays?stream=<songId>&token=<jwt>
//   Stream proxy for member-only audio. Validates the JWT and premium tier,
//   fetches the real CDN URL from Contentful server-side, then 302-redirects.
//   The token is passed as a query param because <audio src> cannot send headers.
//
// POST /api/plays
//   Records a song play event for the authenticated user. Called only after
//   PLAY_THRESHOLD seconds of actual listening (enforced in useAudio.ts).
//   song_id is a Contentful entry ID — Contentful is the music source of truth.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from 'contentful'
import sql from '../_db.js'
import { requireAuth, verifyToken } from '../_auth.js'

async function streamHandler(req: VercelRequest, res: VercelResponse) {
  const songId = req.query.stream
  const token  = req.query.token
  if (!songId || typeof songId !== 'string') {
    return res.status(400).json({ error: 'Missing songId' })
  }
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userId = verifyToken(token)
  if (!userId) return res.status(401).json({ error: 'Invalid or expired token' })

  const rows = await sql`SELECT tier FROM users WHERE id = ${userId}`
  if (!rows[0] || rows[0].tier !== 'premium') {
    return res.status(403).json({ error: 'Premium membership required' })
  }

  try {
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await client.getEntry<any>(songId)
    const raw = entry.fields.file?.fields?.file?.url as string | undefined
    if (!raw) return res.status(404).json({ error: 'Audio not found' })
    const audioUrl = raw.startsWith('//') ? 'https:' + raw : raw
    res.setHeader('Cache-Control', 'no-store')
    return res.redirect(302, audioUrl)
  } catch {
    return res.status(404).json({ error: 'Song not found' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET — stream proxy for member-only audio
  if (req.method === 'GET') return streamHandler(req, res)

  // POST — record a play event
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
