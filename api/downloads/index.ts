// api/downloads/index.ts — GET /api/downloads
//
// ?purchases
//   Returns { purchases: string[] } — Contentful release IDs the authenticated
//   user has purchased. Called once on app load to gate streaming + show buttons.
//
// ?release=<contentfulId>
//   Verifies purchase and returns { url } — the Contentful asset URL for the
//   release's high-fidelity ZIP. The URL is fetched live from Contentful so it
//   always reflects the current asset (no DB row to keep in sync).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from 'contentful'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

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

    // Fetch the downloadFile URL from Contentful
    const client = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = await client.getEntry<any>(contentfulId, { include: 1 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = assetUrl((entry.fields as any)?.downloadFile?.fields?.file?.url as string | undefined)
    if (!url) return res.status(404).json({ error: 'No download file on this release' })

    return res.json({ url })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
}
