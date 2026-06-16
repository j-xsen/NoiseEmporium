// api/account/index.ts — account self-service actions (requires auth).
//
//   POST   — change password. Body: { currentPassword, newPassword }
//   DELETE — delete account.  Body: { password }
//            Uses a DB transaction so all rows are removed atomically.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import sql from '../_db.js'
import { requireAuth, signToken } from '../_auth.js'
import { isRateLimited } from '../_rateLimit.js'
import { setSecurityHeaders } from '../_headers.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  const userId = requireAuth(req, res)
  if (!userId) return

  if (isRateLimited(`account:${userId}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // POST — change password
  if (req.method === 'POST') {
    const { currentPassword, newPassword } = req.body ?? {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid input' })
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters' })
    }
    try {
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
      if (!rows[0]) return res.status(404).json({ error: 'User not found' })
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash)
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
      const hash = await bcrypt.hash(newPassword, 10)
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`
      return res.json({ ok: true, token: signToken(userId) })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  // DELETE — delete account (all deletes wrapped in a transaction)
  if (req.method === 'DELETE') {
    const { password } = req.body ?? {}
    if (!password) return res.status(400).json({ error: 'Password is required' })
    if (typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
    try {
      const rows = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
      if (!rows[0]) return res.status(404).json({ error: 'User not found' })
      const valid = await bcrypt.compare(password, rows[0].password_hash)
      if (!valid) return res.status(401).json({ error: 'Incorrect password' })
      await sql.transaction([
        sql`DELETE FROM playlist_songs WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ${userId})`,
        sql`DELETE FROM playlists WHERE user_id = ${userId}`,
        sql`DELETE FROM song_plays WHERE user_id = ${userId}`,
        sql`DELETE FROM users WHERE id = ${userId}`,
      ])
      return res.json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server error' })
    }
  }

  // PATCH — subscription actions
  if (req.method === 'PATCH') {
    const { action } = req.body ?? {}

    if (action === 'cancel_subscription') {
      try {
        const rows = await sql`SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = ${userId}`
        let subscriptionId = rows[0]?.stripe_subscription_id as string | null
        const customerId = rows[0]?.stripe_customer_id as string | null

        // Existing premium users subscribed before stripe_subscription_id was stored —
        // look it up from Stripe by customer ID and backfill the column.
        if (!subscriptionId && customerId) {
          const list = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
          const found = list.data[0]
          if (found) {
            subscriptionId = found.id
            await sql`UPDATE users SET stripe_subscription_id = ${subscriptionId} WHERE id = ${userId}`
          }
        }

        if (!subscriptionId) return res.status(400).json({ error: 'No active subscription found' })

        const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
        const periodEnd = sub.current_period_end
        const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

        await sql`
          UPDATE users
          SET cancel_at_period_end = true, subscription_ends_at = ${endsAt}
          WHERE id = ${userId}
        `

        return res.json({ ok: true, cancel_at_period_end: true, subscription_ends_at: endsAt })
      } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Server error' })
      }
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  res.status(405).end()
}
