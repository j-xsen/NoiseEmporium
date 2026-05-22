// api/plays/index.ts
//
// GET  /api/plays?stream=<songId>&token=<jwt>
//   Stream proxy for member-only audio. Validates the JWT and premium tier,
//   then either 302-redirects (full access) or streams the first 3 seconds
//   (preview for free users). The CDN URL is never exposed to non-members.
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

// Bytes to fetch for a preview. 600 KB covers the moov atom (even for long songs)
// plus several seconds of audio data in the mdat, so the browser has enough to
// start decoding. Client-side logic stops playback after PREVIEW_SECONDS.
const PREVIEW_FETCH_BYTES = 600 * 1024

// Walk the top-level MP4 box tree to find the 'mdat' box and rewrite its declared
// size to match what we actually sent. The original size points to the full file;
// without this fix Chrome sees a truncated mdat and refuses to play the audio.
function patchMdatSize(buf: Buffer): Buffer {
  let offset = 0
  while (offset + 8 <= buf.length) {
    const boxSize = buf.readUInt32BE(offset)
    const boxType = buf.toString('ascii', offset + 4, offset + 8)
    if (boxType === 'mdat') {
      buf.writeUInt32BE(buf.length - offset, offset)
      break
    }
    if (boxSize < 8 || offset + boxSize >= buf.length) break
    offset += boxSize
  }
  return buf
}

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
  if (!rows[0]) return res.status(403).json({ error: 'Unauthorized' })

  const isPremium = rows[0].tier === 'premium'
  let hasFullAccess = isPremium
  if (!hasFullAccess) {
    // Also allow if the user purchased the release that contains this song.
    const releaseId = typeof req.query.releaseId === 'string' ? req.query.releaseId : undefined
    const hasPurchase = releaseId
      ? (await sql`SELECT 1 FROM orders WHERE user_id = ${userId} AND contentful_id = ${releaseId} LIMIT 1`).length > 0
      : false
    hasFullAccess = hasPurchase
  }

  try {
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await client.getEntry<any>(songId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileField = (entry.fields.file as any)?.fields?.file
    const raw = fileField?.url as string | undefined
    if (!raw) return res.status(404).json({ error: 'Audio not found' })
    const audioUrl = raw.startsWith('//') ? 'https:' + raw : raw

    if (hasFullAccess) {
      res.setHeader('Cache-Control', 'no-store')
      return res.redirect(302, audioUrl)
    }

    // Preview: stream only the first PREVIEW_SECONDS of audio.
    // We estimate the byte count from file size and duration, then add MOOV_BUFFER_BYTES
    // to guarantee the moov atom is fully included so the browser can decode the clip.
    const fileSize = fileField?.details?.size as number | undefined
    const duration = entry.fields.duration as number | undefined

    if (!fileSize) {
      return res.status(403).json({ error: 'Premium membership required' })
    }

    const fetchBytes = Math.min(fileSize - 1, PREVIEW_FETCH_BYTES)
    const cdnRes = await fetch(audioUrl, { headers: { Range: `bytes=0-${fetchBytes}` } })
    if (!cdnRes.ok && cdnRes.status !== 206) {
      return res.status(502).json({ error: 'Preview unavailable' })
    }

    // Fix the mdat box size so the browser sees a structurally valid (if short) MP4.
    const preview = patchMdatSize(Buffer.from(await cdnRes.arrayBuffer()))
    res.status(200)
    res.setHeader('Content-Type', 'audio/mp4')
    res.setHeader('Content-Length', String(preview.length))
    res.setHeader('Accept-Ranges', 'none')
    res.setHeader('Cache-Control', 'no-store')
    res.end(preview)
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
