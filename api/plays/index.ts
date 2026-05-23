// api/plays/index.ts
//
// GET  /api/plays?stream=<songId>&token=<jwt>
//   Stream proxy for member-only audio. Validates the JWT and premium tier,
//   then either 302-redirects (full access) or streams a 3-second preview
//   (for free users). The CDN URL is never exposed to non-members.
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

const PREVIEW_SECONDS = 3
// How much of the start of the file to fetch (ftyp + moov if faststart + audio data).
const AUDIO_FETCH_BYTES = 600 * 1024
// How much of the end of the file to fetch when moov isn't in the first chunk.
// 350 KB is enough for any M4A moov atom.
const MOOV_FETCH_BYTES = 350 * 1024

// Walk fully-contained MP4 boxes in buf[start..end).
// cb receives (type, dataStart, dataEnd); return true to stop walking.
function walkBoxes(
  buf: Buffer,
  start: number,
  end: number,
  cb: (type: string, ds: number, de: number) => boolean | void,
): void {
  let off = start
  while (off + 8 <= end) {
    const size = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    if (size < 8) break
    const boxEnd = off + size
    if (boxEnd > end) break
    if (cb(type, off + 8, boxEnd) === true) return
    off = boxEnd
  }
}

// Patch moovBuf (a copy of the moov box) so it describes a PREVIEW_SECONDS clip:
//   1. mvhd/tkhd/mdhd duration fields → PREVIEW_SECONDS * timescale
//   2. stco/co64 entries → add stcoOffset (layout adjustment), clamp to maxValidOffset
//
// stcoOffset accounts for the difference between the original file layout and the
// preview layout we construct. For faststart files it is 0; for non-faststart files
// (moov was at the end) it equals the moov size, because moving moov to the front
// shifts every mdat chunk offset by that amount.
function patchPreviewMoov(moovBuf: Buffer, stcoOffset: number, maxValidOffset: number): void {
  const moovDs = 8 // skip size(4) + type(4) of moov box itself

  let movieTs = 0
  walkBoxes(moovBuf, moovDs, moovBuf.length, (type, ds) => {
    if (type !== 'mvhd') return
    const v = moovBuf[ds]
    if (v === 0) {
      movieTs = moovBuf.readUInt32BE(ds + 12)
      moovBuf.writeUInt32BE(PREVIEW_SECONDS * movieTs, ds + 16)
    } else {
      movieTs = moovBuf.readUInt32BE(ds + 20)
      moovBuf.writeBigUInt64BE(BigInt(PREVIEW_SECONDS) * BigInt(movieTs), ds + 24)
    }
    return true
  })
  if (!movieTs) return

  walkBoxes(moovBuf, moovDs, moovBuf.length, (type, trakDs, trakDe) => {
    if (type !== 'trak') return

    // tkhd — duration uses movie timescale.
    walkBoxes(moovBuf, trakDs, trakDe, (t, ds) => {
      if (t !== 'tkhd') return
      const v = moovBuf[ds]
      if (v === 0) moovBuf.writeUInt32BE(PREVIEW_SECONDS * movieTs, ds + 20)
      else moovBuf.writeBigUInt64BE(BigInt(PREVIEW_SECONDS) * BigInt(movieTs), ds + 28)
      return true
    })

    walkBoxes(moovBuf, trakDs, trakDe, (t, mdiaDs, mdiaDe) => {
      if (t !== 'mdia') return

      // mdhd — duration uses media timescale (e.g. 44100). Capture mediaTs so
      // the stts trim below can compute how many samples = PREVIEW_SECONDS.
      let mediaTs = 0
      walkBoxes(moovBuf, mdiaDs, mdiaDe, (t2, ds) => {
        if (t2 !== 'mdhd') return
        const v = moovBuf[ds]
        if (v === 0) {
          mediaTs = moovBuf.readUInt32BE(ds + 12)
          moovBuf.writeUInt32BE(PREVIEW_SECONDS * mediaTs, ds + 16)
        } else {
          mediaTs = moovBuf.readUInt32BE(ds + 20)
          moovBuf.writeBigUInt64BE(BigInt(PREVIEW_SECONDS) * BigInt(mediaTs), ds + 24)
        }
        return true
      })

      // stbl — adjust stco offsets, trim stts so the browser doesn't recalculate
      // duration from the full sample count and override our mdhd patch.
      walkBoxes(moovBuf, mdiaDs, mdiaDe, (t2, minfDs, minfDe) => {
        if (t2 !== 'minf') return
        walkBoxes(moovBuf, minfDs, minfDe, (t3, stblDs, stblDe) => {
          if (t3 !== 'stbl') return
          walkBoxes(moovBuf, stblDs, stblDe, (t4, ds, de) => {
            if (t4 === 'stco') {
              const n = moovBuf.readUInt32BE(ds + 4)
              for (let i = 0; i < n; i++) {
                const p = ds + 8 + i * 4
                if (p + 4 > de) break
                let val = moovBuf.readUInt32BE(p) + stcoOffset
                if (val > maxValidOffset) val = maxValidOffset
                moovBuf.writeUInt32BE(val, p)
              }
            } else if (t4 === 'co64') {
              const n = moovBuf.readUInt32BE(ds + 4)
              const max = BigInt(maxValidOffset)
              const adj = BigInt(stcoOffset)
              for (let i = 0; i < n; i++) {
                const p = ds + 8 + i * 8
                if (p + 8 > de) break
                let val = moovBuf.readBigUInt64BE(p) + adj
                if (val > max) val = max
                moovBuf.writeBigUInt64BE(val, p)
              }
            } else if (t4 === 'stts' && mediaTs > 0) {
              // Rewrite time-to-sample entries to cover only PREVIEW_SECONDS.
              // Each entry: { sample_count (4B), sample_delta (4B) }.
              // sum(sample_count * sample_delta) must equal PREVIEW_SECONDS * mediaTs.
              const targetTime = PREVIEW_SECONDS * mediaTs
              const entryCount = moovBuf.readUInt32BE(ds + 4)
              let remaining = targetTime
              let newCount = 0
              for (let i = 0; i < entryCount; i++) {
                const p = ds + 8 + i * 8
                if (p + 8 > de) break
                const sc = moovBuf.readUInt32BE(p)
                const sd = moovBuf.readUInt32BE(p + 4)
                const entryTime = sc * sd
                if (entryTime <= remaining) {
                  remaining -= entryTime
                  newCount++
                  if (remaining === 0) break
                } else {
                  moovBuf.writeUInt32BE(Math.ceil(remaining / sd), p)
                  newCount++
                  break
                }
              }
              moovBuf.writeUInt32BE(newCount, ds + 4)
            }
          })
          return true
        })
        return true
      })
    })
  })
}

// Build a self-contained 3-second preview MP4.
//
// Contentful M4A files are typically NOT faststart (moov is at the end of the file).
// We fetch the start of the file (for ftyp + audio data) and, if moov isn't there,
// fetch the end of the file to get the moov. We then reassemble:
//
//   ftyp  +  moov (patched: duration=3s, stco adjusted)  +  mdat (first ~600 KB of audio)
//
// stcoOffset: in the original file, audio chunks are at absolute offsets counting from
// byte 0 of the full file. After we move moov to the front, every chunk's position
// increases by moovSize. We add that delta to every stco entry so they still point at
// the right bytes in our reassembled buffer.
async function buildPreview(audioUrl: string, fileSize: number): Promise<Buffer | null> {
  const audioEndByte = Math.min(fileSize - 1, AUDIO_FETCH_BYTES - 1)
  const startRes = await fetch(audioUrl, { headers: { Range: `bytes=0-${audioEndByte}` } })
  if (!startRes.ok && startRes.status !== 206) return null

  const startBuf = Buffer.from(await startRes.arrayBuffer())
  console.log('[preview] startBuf=%d bytes', startBuf.length)

  // Walk top-level boxes to locate ftyp, moov (faststart), and mdat.
  // Because the fetch starts at byte 0, the buffer offset equals the file offset for
  // everything in startBuf. We track both so that if mdat is beyond startBuf
  // (e.g. preceded by a large free/skip placeholder), we know where to fetch it.
  let ftypEnd = 0
  let moovBuf: Buffer | null = null
  let mdatStart = -1       // file offset of the mdat box header
  let mdatInStartBuf = false

  {
    let off = 0  // current position — equals both buffer index and file offset
    while (off + 8 <= startBuf.length) {
      const size = startBuf.readUInt32BE(off)
      const type = startBuf.toString('ascii', off + 4, off + 8)
      if (size < 8) break

      if (type === 'ftyp') ftypEnd = off + size
      if (type === 'moov' && off + size <= startBuf.length) {
        moovBuf = Buffer.from(startBuf.slice(off, off + size))
      }
      if (type === 'mdat') { mdatStart = off; mdatInStartBuf = true; break }

      const next = off + size
      if (next > startBuf.length) {
        // This box extends beyond our fetch window. mdat follows immediately after it
        // in the full file; record the file offset and fetch separately below.
        mdatStart = next
        break
      }
      off = next
    }
  }

  console.log('[preview] ftypEnd=%d moovInStart=%s mdatStart=%d inStartBuf=%s', ftypEnd, moovBuf ? 'yes' : 'no', mdatStart, mdatInStartBuf)

  if (ftypEnd === 0 || mdatStart < 0) return null

  // If mdat is beyond startBuf, fetch it now (another ~600 KB starting at mdatStart).
  let mdatBuf = startBuf  // buffer that actually contains the mdat box
  let mdatBufOff = mdatStart  // offset of mdat header within mdatBuf

  if (!mdatInStartBuf) {
    if (mdatStart >= fileSize) return null
    const mdatEnd = Math.min(fileSize - 1, mdatStart + AUDIO_FETCH_BYTES - 1)
    const mdatRes = await fetch(audioUrl, { headers: { Range: `bytes=${mdatStart}-${mdatEnd}` } })
    if (!mdatRes.ok && mdatRes.status !== 206) return null
    mdatBuf = Buffer.from(await mdatRes.arrayBuffer())
    mdatBufOff = 0
    console.log('[preview] mdatBuf=%d bytes starting at file byte %d', mdatBuf.length, mdatStart)
    // Verify the box really is mdat
    if (mdatBuf.length < 8 || mdatBuf.toString('ascii', 4, 8) !== 'mdat') {
      console.log('[preview] expected mdat at file offset %d, got %s', mdatStart, mdatBuf.toString('ascii', 4, 8))
      return null
    }
  }

  // If moov wasn't in startBuf (non-faststart), locate it precisely using the mdat's
  // declared size. For non-faststart files the layout is ftyp + [free] + mdat + moov,
  // so moov begins at exactly mdatStart + mdat_declared_size.
  if (!moovBuf) {
    const mdatDeclaredSize = mdatBuf.readUInt32BE(mdatBufOff)
    const moovStartInFile = mdatStart + mdatDeclaredSize
    console.log('[preview] mdatDeclaredSize=%d moovStartInFile=%d fileSize=%d', mdatDeclaredSize, moovStartInFile, fileSize)

    if (moovStartInFile >= fileSize) return null

    const endRes = await fetch(audioUrl, { headers: { Range: `bytes=${moovStartInFile}-${fileSize - 1}` } })
    if (!endRes.ok && endRes.status !== 206) return null

    const endBuf = Buffer.from(await endRes.arrayBuffer())
    console.log('[preview] endBuf=%d bytes starting at file byte %d', endBuf.length, moovStartInFile)

    if (endBuf.length >= 8) {
      const moovSize = endBuf.readUInt32BE(0)
      const moovType = endBuf.toString('ascii', 4, 8)
      if (moovType === 'moov' && moovSize <= endBuf.length) {
        moovBuf = Buffer.from(endBuf.slice(0, moovSize))
      }
    }

    if (!moovBuf) { console.log('[preview] moov not found at computed offset'); return null }
    console.log('[preview] moov found, size=%d', moovBuf.length)
  }

  // Audio data: everything in mdatBuf after the mdat header (8 bytes).
  const audioDataBuf = mdatBuf.slice(mdatBufOff + 8)
  const ftypBuf = startBuf.slice(0, ftypEnd)

  // Calculate how much each stco entry must shift.
  // In the original file: mdat data starts at (mdatStart + 8).
  // In our preview:       mdat data starts at (ftypEnd + moovBuf.length + 8).
  // delta = new_start - old_start = ftypEnd + moovBuf.length - mdatStart
  // For faststart files, delta = 0 (layout unchanged). For non-faststart, delta = moovSize.
  const stcoOffset = ftypEnd + moovBuf.length - mdatStart
  const previewSize = ftypEnd + moovBuf.length + 8 + audioDataBuf.length

  console.log('[preview] stcoOffset=%d previewSize=%d', stcoOffset, previewSize)

  patchPreviewMoov(moovBuf, stcoOffset, previewSize - 1)

  // Construct the preview: ftyp + moov (patched) + mdat (with correct size header)
  const mdatHeader = Buffer.alloc(8)
  mdatHeader.writeUInt32BE(audioDataBuf.length + 8, 0)
  mdatHeader.write('mdat', 4, 'ascii')

  return Buffer.concat([ftypBuf, moovBuf, mdatHeader, audioDataBuf])
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

  // Typed shape of the Contentful song entry fields we need.
  interface CfAudioSongFields {
    file?: { fields?: { file?: { url?: string; details?: { size?: number } } } }
  }

  try {
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    const entry = await client.getEntry(songId)
    const fields = entry.fields as unknown as CfAudioSongFields
    const fileField = fields.file?.fields?.file
    const raw = fileField?.url
    if (!raw) return res.status(404).json({ error: 'Audio not found' })
    const audioUrl = raw.startsWith('//') ? 'https:' + raw : raw

    if (hasFullAccess) {
      res.setHeader('Cache-Control', 'no-store')
      return res.redirect(302, audioUrl)
    }

    const fileSize = fileField?.details?.size
    if (!fileSize) return res.status(403).json({ error: 'Premium membership required' })

    const preview = await buildPreview(audioUrl, fileSize)
    if (!preview) return res.status(502).json({ error: 'Preview unavailable' })

    res.status(200)
    res.setHeader('Content-Type', 'audio/mp4')
    res.setHeader('Content-Length', String(preview.length))
    res.setHeader('Accept-Ranges', 'none')
    res.setHeader('Cache-Control', 'no-store')
    res.end(preview)
  } catch (err) {
    console.error('[preview] error:', err)
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
