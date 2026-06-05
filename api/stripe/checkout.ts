// api/stripe/checkout.ts — GET + POST /api/stripe/checkout
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
import { isRateLimited } from '../_rateLimit.js'
import { DEFAULT_RELEASE_PRICES, INSTRUMENTAL_LICENSE_PRICES, CD_PRICES } from '../_prices.js'
import { setSecurityHeaders } from '../_headers.js'

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
  price?: number
  memberPrice?: number
}

const ALLOWED_HOSTS = ['noise.jaxsenville.com', 'emporium.jaxsenville.com']

function appOrigin(req: VercelRequest): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN
  const raw = req.headers.host ?? ''
  const hostname = raw.split(':')[0]
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  if (!isLocal && !ALLOWED_HOSTS.includes(hostname)) {
    // Reject unknown hosts to prevent Host Header Injection; fall back to primary domain.
    return `https://${ALLOWED_HOSTS[0]}`
  }
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? (isLocal ? 'http' : 'https')
  return `${proto}://${raw}`
}

async function createCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { priceId, mode, contentfulId, songId, songTitle, licenseType, cdId } = req.body ?? {}
  if (!mode) return res.status(400).json({ error: 'Missing required fields' })
  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  const rows = await sql`SELECT email, tier FROM users WHERE id = ${userId}`
  const customerEmail = rows[0]?.email as string | undefined
  const isPremium = rows[0]?.tier === 'premium'
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
    const priceCents = isPremium
      ? (fields.memberPrice ?? defaults.member)
      : (fields.price ?? defaults.full)

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
      allow_promotion_codes: true,
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
    const normalizedLicenseType = typeof licenseType === 'string' ? licenseType.trim().toLowerCase() : ''
    const prices = INSTRUMENTAL_LICENSE_PRICES[normalizedLicenseType]
    if (!prices) return res.status(400).json({ error: 'Invalid license type' })
    const priceCents = isPremium ? prices.member : prices.full
    const licenseLabel = normalizedLicenseType === 'commercial' ? 'Commercial' : 'Personal'
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
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
      client_reference_id: userId,
      metadata: {
        purchase_type: 'instrumental_license',
        song_id: String(songId),
        song_title: String(songTitle ?? ''),
        license_type: normalizedLicenseType || 'personal',
      },
      ...(customerEmail && { customer_email: customerEmail }),
    })
    return res.json({ url: session.url })
  }

  // Physical CD purchase — inventory check + inline pricing based on user tier
  if (mode === 'payment' && typeof cdId === 'string' && cdId) {
    const cdConfig = CD_PRICES[cdId]
    if (!cdConfig) return res.status(400).json({ error: 'Invalid CD' })

    const [soldRow] = await sql`SELECT COUNT(*) AS cnt FROM cd_orders WHERE cd_id = ${cdId}`
    if (Number(soldRow.cnt) >= cdConfig.maxQuantity) {
      return res.status(409).json({ error: 'Sold out' })
    }

    const priceCents = isPremium ? cdConfig.member : cdConfig.full
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: { name: `${cdConfig.name} — Physical CD` },
        },
      }],
      shipping_address_collection: {
        allowed_countries: [
          'US', 'CA', 'MX',
          'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 'AT', 'CH',
          'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR',
          'SI', 'EE', 'LV', 'LT', 'GR', 'CY', 'MT',
          'AU', 'NZ', 'JP', 'KR', 'SG', 'HK', 'TW', 'MY', 'TH', 'PH', 'IN',
          'ZA', 'BR', 'AR', 'CL', 'CO', 'PE', 'IL', 'TR', 'AE', 'SA',
        ],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'US Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 2000, currency: 'usd' },
            display_name: 'International Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 7 },
              maximum: { unit: 'business_day', value: 21 },
            },
          },
        },
      ],
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success&tab=shop&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/?checkout=cancelled&tab=shop`,
      client_reference_id: userId,
      metadata: { purchase_type: 'cd_purchase', cd_id: cdId },
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
    allow_promotion_codes: true,
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

  if (session.mode === 'payment' && session.metadata?.purchase_type === 'cd_purchase') {
    const cdId = session.metadata.cd_id
    const amountTotal = session.amount_total ?? 0
    await sql`
      INSERT INTO cd_orders (user_id, cd_id, stripe_session_id, amount_total)
      VALUES (${userId}, ${cdId}, ${session.id}, ${amountTotal})
      ON CONFLICT (stripe_session_id) DO NOTHING
    `
  }

  if (session.mode === 'payment' && session.metadata?.purchase_type === 'instrumental_license') {
    const songId = session.metadata.song_id
    const songTitle = session.metadata.song_title ?? ''
    const amountTotal = session.amount_total ?? 0
    await sql`
      INSERT INTO instrumental_licenses (user_id, song_id, song_title, stripe_session_id, amount_total)
      VALUES (${userId}, ${songId}, ${songTitle}, ${session.id}, ${amountTotal})
      ON CONFLICT (stripe_session_id) DO NOTHING
    `
  }

  res.json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)

  if (req.method === 'GET') {
    const [membershipPriceId] = [...ALLOWED_PRICE_IDS]
    const soldRows = await sql`SELECT cd_id FROM cd_orders`
    const cdSoldIds = soldRows.map(r => r.cd_id as string)
    return res.json({ membershipPriceId: membershipPriceId ?? null, cdSoldIds })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const userId = requireAuth(req, res)
  if (!userId) return

  if (isRateLimited(`checkout:${userId}`, 20, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  const { action } = req.body ?? {}

  try {
    if (action === 'fulfill') return await fulfillCheckout(req, res, userId)
    return await createCheckout(req, res, userId)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Checkout error' })
  }
}
