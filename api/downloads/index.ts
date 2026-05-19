// api/downloads/index.ts — GET /api/downloads
//
// ?purchases
//   Returns { purchases: string[] } — Contentful release IDs the authenticated
//   user has purchased. Called once on app load to gate streaming + show buttons.
//
// ?release=<contentfulId>
//   Verifies purchase, reads the private Blob URL from the release's
//   `downloadFile` field in Contentful, and returns a short-lived signed URL.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { issueSignedToken, presignUrl } from '@vercel/blob'
import { createClient } from 'contentful'
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
    // Verify the user has purchased this release
    const rows = await sql`
      SELECT 1 FROM orders WHERE user_id = ${userId} AND contentful_id = ${contentfulId} LIMIT 1
    `
    if (!rows[0]) return res.status(403).json({ error: 'No purchase found' })

    // Fetch the downloadUrl from Contentful
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await client.getEntry<any>(contentfulId, { include: 1 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields = entry.fields as any
    const url = fields?.downloadUrl as string | undefined
    if (!url) return res.status(404).json({ error: 'No download file on this release' })

    // Generate a short-lived signed URL so the raw private Blob URL is never exposed to clients
    const pathname = new URL(url).pathname.slice(1)
    const signedToken = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil: Date.now() + 60 * 60 * 1000, // 1 hour
      token: process.env.BLOB_READ_WRITE_TOKEN ?? '',
    })
    const { presignedUrl } = await presignUrl(signedToken, { operation: 'get', pathname, access: 'private' })
    return res.json({ url: presignedUrl })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
}
