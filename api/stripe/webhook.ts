// Stripe webhook — handles checkout completion for both subscriptions and release purchases.
// Requires STRIPE_WEBHOOK_SECRET env var (get from `stripe listen` or dashboard).
// bodyParser is disabled so we can verify the raw Stripe signature.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { createClient } from 'contentful'
import sql from '../_db.js'
import { setSecurityHeaders } from '../_headers.js'

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
  setSecurityHeaders(res)
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
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer | null)?.id ?? null
      try {
        // WHERE clause makes duplicate webhook deliveries explicit no-ops.
        await sql`
          UPDATE users
          SET tier = 'premium', stripe_customer_id = ${stripeCustomerId}
          WHERE id = ${userId} AND tier != 'premium'
        `
      } catch (err) {
        console.error('Failed to upgrade user tier:', err)
        return res.status(500).end()
      }
    }

    if (userId && session.mode === 'payment' && session.metadata?.purchase_type === 'release_download') {
      const contentfulId = session.metadata.contentful_id
      const amountTotal = session.amount_total ?? 0

      // Re-validate the contentfulId against Contentful before fulfilling.
      // A delayed retry with stale metadata could otherwise grant access to the wrong release.
      try {
        const ctf = createClient({
          space: process.env.VITE_CONTENTFUL_SPACE_ID ?? '',
          accessToken: process.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = await ctf.getEntry<any>(contentfulId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const releaseName = ((entry.fields as any)?.name as string | undefined) ?? 'your purchase'

        await sql`
          INSERT INTO orders (user_id, contentful_id, stripe_session_id, amount_total)
          VALUES (${userId}, ${contentfulId}, ${session.id}, ${amountTotal})
          ON CONFLICT (stripe_session_id) DO NOTHING
        `

        // Send purchase confirmation email — failure must never fail the webhook response
        if (process.env.RESEND_API_KEY) {
          try {
            const [userRow] = await sql`SELECT email FROM users WHERE id = ${userId}`
            if (userRow) {
              const resend = new Resend(process.env.RESEND_API_KEY)
              await resend.emails.send({
                from: 'Noise Emporium <noreply@noise.jaxsenville.com>',
                to: userRow.email as string,
                subject: `Your purchase: ${releaseName}`,
                html: `<p>Thanks for your purchase!</p>
                       <p>You now have permanent streaming rights and WAV download access for <strong>${releaseName}</strong>.</p>
                       <p>Log in to <a href="https://noise.jaxsenville.com">Noise Emporium</a> to stream or download your files.</p>`,
              })
            }
          } catch (emailErr) {
            console.error('Failed to send purchase email:', emailErr)
          }
        }
      } catch (err) {
        console.error('Failed to fulfill release_download purchase:', err)
        return res.status(500).end()
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id
    try {
      await sql`UPDATE users SET tier = 'free' WHERE stripe_customer_id = ${stripeCustomerId}`
    } catch (err) {
      console.error('Failed to downgrade user tier on subscription deletion:', err)
      return res.status(500).end()
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'canceled') {
      const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id
      try {
        await sql`UPDATE users SET tier = 'free' WHERE stripe_customer_id = ${stripeCustomerId}`
      } catch (err) {
        console.error('Failed to downgrade user tier on subscription update:', err)
        return res.status(500).end()
      }
    }
  }

  res.json({ received: true })
}
