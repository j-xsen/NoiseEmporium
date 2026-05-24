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
//
// Release download purchases use Stripe price_data (inline pricing) so the
// amount is always read from Contentful — no separate Stripe Price ID needed.
// Subscriptions and fixed products (memberships, instrumental licenses) use pre-created
// Stripe Price IDs validated against STRIPE_ALLOWED_PRICE_IDS.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from 'contentful'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'
import { DEFAULT_RELEASE_PRICES, INSTRUMENTAL_LICENSE_PRICES } from '../_prices.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Server-side allowlist of valid Stripe Price IDs for subscriptions and fixed products.
// Set STRIPE_ALLOWED_PRICE_IDS in Vercel env vars as a comma-separated list.
// Release downloads are NOT in this list — they use inline price_data instead.
const ALLOWED_PRICE_IDS = new Set(
  (process.env.STRIPE_ALLOWED_PRICE_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
)

// Typed shape of the Contentful entry fields we access during checkout.
interface CfPurchasableFields {
  downloadUrl?: string
  name?: string
  title?: string
  releaseType?: string
  memberPrice?: number
}

function appOrigin(req: VercelRequest): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN
  const host  = req.headers.host ?? 'noise.jaxsenville.com'
  const isLocal = host.startsWith('localhost') || host.startsWith('127.')
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? (isLocal ? 'http' : 'https')
  return `${proto}://${host}`
}

async function createCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { priceId, mode, contentfulId, songId, songTitle, licenseType } = req.body ?? {}
  if (!mode) return res.status(400).json({ error: 'Missing required fields' })
  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`
  const customerEmail = rows[0]?.email as string | undefined
  const origin = appOrigin(req)

  // Release download: validate via Contentful — downloadUrl must be set on the entry
  if (mode === 'payment' && typeof contentfulId === 'string' && contentfulId) {
    const cf = createClient({
      space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
      accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
    })
    const entry = await cf.getEntry(contentfulId)
    const fields = entry.fields as unknown as CfPurchasableFields
    if (!fields.downloadUrl) return res.status(400).json({ error: 'Release not available for purchase' })
    const releaseName = fields.name ?? fields.title ?? 'Music Download'
    const releaseType = (fields.releaseType ?? 'album').toLowerCase()
    const defaults = DEFAULT_RELEASE_PRICES[releaseType] ?? DEFAULT_RELEASE_PRICES.album
    // All authenticated users get the member (discounted) price for release downloads.
    const priceCents = fields.memberPrice ?? defaults.member

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: { name: releaseName },
        },
      }],
      success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
      client_reference_id: userId,
      metadata: { contentful_id: contentfulId, purchase_type: 'release_download' },
      ...(customerEmail && { customer_email: customerEmail }),
    })
    return res.json({ url: session.url })
  }

  // Instrumental license — compute price server-side; apply member discount if tier === 'premium'
  if (mode === 'payment' && typeof songId === 'string' && songId) {
    const prices = INSTRUMENTAL_LICENSE_PRICES[licenseType as string]
    if (!prices) return res.status(400).json({ error: 'Invalid license type' })
    const [user] = await sql`SELECT tier FROM users WHERE id = ${userId}`
    const isPremium = user?.tier === 'premium'
    const priceCents = isPremium ? prices.member : prices.full
    const licenseLabel = licenseType === 'commercial' ? 'Commercial' : 'Personal'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: { name: `${licenseLabel} Instrumental License — ${songTitle ?? songId}` },
        },
      }],
      success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
      client_reference_id: userId,
      metadata: {
        purchase_type: 'instrumental_license',
        song_id: String(songId),
        song_title: String(songTitle ?? ''),
        license_type: String(licenseType ?? 'personal'),
      },
      ...(customerEmail && { customer_email: customerEmail }),
    })
    return res.json({ url: session.url })
  }

  // Subscription (membership): validate priceId against allowlist
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' })
  if (!ALLOWED_PRICE_IDS.has(priceId)) return res.status(400).json({ error: 'Invalid price' })

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
    client_reference_id: userId,
    ...(customerEmail && { customer_email: customerEmail }),
  })
  res.json({ url: session.url })
}

async function fulfillCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { sessionId } = req.body ?? {}
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.status !== 'complete') return res.status(400).json({ error: 'Session not complete' })
  if (session.client_reference_id !== userId) return res.status(403).json({ error: 'Session mismatch' })

  if (session.mode === 'subscription') {
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
