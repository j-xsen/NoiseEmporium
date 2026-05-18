// api/downloads/index.ts — GET /api/downloads
//
// ?purchases
//   Returns { purchases: string[] } — Contentful release IDs the authenticated
//   user has purchased. Called once on app load to gate streaming + show buttons.
//
// ?release=<contentfulId>
//   Verifies purchase and returns { url } — the Vercel Blob CDN URL for the
//   release's WAV ZIP. The URL itself is stored in release_assets and is a
//   UUID-based public blob (unguessable without this endpoint).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  // ?purchases — list all purchased contentful IDs for this user
  if ('purchases' in req.query) {
    try {
      const rows = await sql`SELECT contentful_id FROM orders WHERE user_id = ${userId}`
      return res.json({ purchases: rows.map(r => r.contentful_id as string) })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  // ?release=<contentfulId> — verify purchase and return download URL
  const contentfulId = req.query.release
  if (typeof contentfulId !== 'string' || !contentfulId) {
    return res.status(400).json({ error: 'Missing release parameter' })
  }

  try {
    const rows = await sql`
      SELECT ra.blob_url FROM orders o
      JOIN release_assets ra ON ra.contentful_id = o.contentful_id
      WHERE o.user_id = ${userId} AND o.contentful_id = ${contentfulId}
    `
    if (!rows[0]) return res.status(403).json({ error: 'No purchase found' })
    return res.json({ url: rows[0].blob_url as string })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
}
