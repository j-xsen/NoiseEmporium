import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import sql from '../_db.js'
import { requireAuth } from '../_auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function createCheckout(req: VercelRequest, res: VercelResponse, userId: string) {
  const { priceId, mode, successUrl, cancelUrl } = req.body ?? {}
  if (!priceId || !mode || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid mode' })
  }

  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`
  const customerEmail = rows[0]?.email as string | undefined

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
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
    await sql`UPDATE users SET tier = 'premium' WHERE id = ${userId}`
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
