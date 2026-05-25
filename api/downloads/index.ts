// api/downloads/index.ts — GET /api/downloads
//
// ?purchases
//   Returns { purchases: PurchaseDetail[], licenses: LicenseDetail[] } for the
//   authenticated user. Used by usePurchases to gate streaming + populate Library.
//
// ?release=<contentfulId>
//   Verifies purchase, reads the private Blob URL from the release's
//   `downloadFile` field in Contentful, and returns a short-lived signed URL.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { head, issueSignedToken, presignUrl } from '@vercel/blob'
import { createClient } from 'contentful'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'
import { setSecurityHeaders } from '../_headers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  if (req.method !== 'GET') return res.status(405).end()

  // ?size=<contentfulId> — file size lookup, no auth required (size is non-sensitive)
  if ('size' in req.query) {
    const sizeId = req.query.size
    if (typeof sizeId !== 'string' || !sizeId) return res.status(400).json({ error: 'Missing size parameter' })
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Blob not configured' })
    try {
      const client = createClient({
        space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
        accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
      })
      const entry = await client.getEntry(sizeId, { include: 1 })
      interface CfDownloadFields { downloadUrl?: string }
      const { downloadUrl } = entry.fields as unknown as CfDownloadFields
      if (!downloadUrl) return res.status(404).json({ error: 'No download file' })
      const info = await head(downloadUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
      return res.json({ size: info.size })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  const userId = requireAuth(req, res)
  if (!userId) return

  // ?purchases — list all purchases and licenses for this user
  if ('purchases' in req.query) {
    try {
      const [orderRows, licenseRows] = await Promise.all([
        sql`SELECT contentful_id, amount_total, created_at FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT song_id, song_title, amount_total, created_at FROM instrumental_licenses WHERE user_id = ${userId} ORDER BY created_at DESC`,
      ])
      return res.json({ purchases: orderRows, licenses: licenseRows })
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not configured')
    return res.status(503).json({ error: 'Downloads not configured' })
  }

  try {
    // Verify the user has purchased this release
    const rows = await sql`
      SELECT 1 FROM orders WHERE user_id = ${userId} AND contentful_id = ${contentfulId} LIMIT 1
    `
    if (!rows[0]) return res.status(403).json({ error: 'No purchase found' })

    // Fetch the downloadUrl from Contentful
    interface CfDownloadFields { downloadUrl?: string }
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    const entry = await client.getEntry(contentfulId, { include: 1 })
    const { downloadUrl } = entry.fields as unknown as CfDownloadFields
    if (!downloadUrl) return res.status(404).json({ error: 'No download file on this release' })

    // Generate a short-lived signed URL so the raw private Blob URL is never exposed to clients
    const pathname = new URL(downloadUrl).pathname.slice(1)
    const signedToken = await issueSignedToken({
      pathname,
      operations: ['get'],
      validUntil: Date.now() + 60 * 60 * 1000, // 1 hour
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    const { presignedUrl } = await presignUrl(signedToken, { operation: 'get', pathname, access: 'private' })
    return res.json({ url: presignedUrl })

  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
}
