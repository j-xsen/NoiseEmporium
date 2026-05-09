// Stripe webhook — updates user tier after successful membership checkout.
// Requires STRIPE_WEBHOOK_SECRET env var (get from `stripe listen` or dashboard).
// bodyParser is disabled so we can verify the raw Stripe signature.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import sql from '../_db.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const config = { api: { bodyParser: false } }

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).json({ error: 'Missing Stripe signature' })

  let event: Stripe.Event
  try {
    const raw = await getRawBody(req)
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return res.status(400).json({ error: 'Webhook verification failed' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    if (userId && session.mode === 'subscription') {
      try {
        await sql`UPDATE users SET tier = 'premium' WHERE id = ${userId}`
      } catch (err) {
        console.error('Failed to upgrade user tier:', err)
        return res.status(500).end()
      }
    }
  }

  res.json({ received: true })
}
