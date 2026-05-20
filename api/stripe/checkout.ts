// api/stripe/checkout.ts — POST /api/stripe/checkout
//
// Two actions, selected by `action` in the request body:
//
//   (default) create  — opens a Stripe Checkout session and returns { url }.
//                       The client redirects the browser to that URL.
//
//   "fulfill"         — called on the success redirect after Stripe returns.
//                       Retrieves the completed session from Stripe and:
//                       - upgrades users.tier to 'premium' for subscription purchases
//                       - inserts an orders row for release_download purchases
//                       The webhook (stripe/webhook.ts) does the same thing as a
//                       reliable fallback in case the browser never lands on the
//                       success URL.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Server-side allowlist of valid Stripe Price IDs.
// Set STRIPE_ALLOWED_PRICE_IDS in Vercel env vars as a comma-separated list
// (e.g. "price_abc123,price_def456"). Requests with any other priceId are rejected.
const ALLOWED_PRICE_IDS = new Set(
  (process.env.STRIPE_ALLOWED_PRICE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
)

function appOrigin(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https'
  const host  = req.headers.host ?? 'noise.jaxsenville.com'
  return `${proto}://${host}`
}

async function createCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { priceId, mode, contentfulId } = req.body ?? {}
  if (!priceId || !mode) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid mode' })
  }
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Invalid price' })
  }

  // For release download purchases, validate that the contentfulId + priceId pair
  // matches a real release_assets row. This prevents forged metadata claims.
  const metadata: Record<string, string> = {}
  if (mode === 'payment' && typeof contentfulId === 'string' && contentfulId) {
    const assetRows = await sql`
      SELECT contentful_id FROM release_assets
      WHERE contentful_id = ${contentfulId} AND stripe_price_id = ${priceId}
    `
    if (!assetRows[0]) return res.status(400).json({ error: 'Invalid release product' })
    metadata.contentful_id = contentfulId
    metadata.purchase_type = 'release_download'
  }

  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`
  const customerEmail = rows[0]?.email as string | undefined

  const origin = appOrigin(req)
  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
    client_reference_id: userId,
    ...(Object.keys(metadata).length > 0 && { metadata }),
    ...(customerEmail && { customer_email: customerEmail }),
  })
  res.json({ url: session.url })
}

async function fulfillCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { sessionId } = req.body ?? {}
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items'],
  })
  if (session.status !== 'complete') return res.status(400).json({ error: 'Session not complete' })
  if (session.client_reference_id !== userId) return res.status(403).json({ error: 'Session mismatch' })

  if (session.mode === 'subscription') {
    const purchasedPriceId = session.line_items?.data[0]?.price?.id
    if (!purchasedPriceId || !ALLOWED_PRICE_IDS.has(purchasedPriceId)) {
      return res.status(400).json({ error: 'Invalid purchase' })
    }
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null
    await sql`
      UPDATE users
      SET tier = 'premium', stripe_customer_id = ${stripeCustomerId}
      WHERE id = ${userId}
    `
  }

  if (session.mode === 'payment' && session.metadata?.purchase_type === 'release_download') {
    const contentfulId = session.metadata.contentful_id
    const amountTotal = session.amount_total ?? 0
    await sql`
      INSERT INTO orders (user_id, contentful_id, stripe_session_id, amount_total)
      VALUES (${userId}, ${contentfulId}, ${session.id}, ${amountTotal})
      ON CONFLICT (stripe_session_id) DO NOTHING
    `
  }

  res.json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  const { action } = req.body ?? {}

  try {
    if (action === 'fulfill') return await fulfillCheckout(req, res, userId)
    return await createCheckout(req, res, userId)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Checkout error' })
  }
}
