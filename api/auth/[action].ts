// api/auth/[action].ts — handles /api/auth/login, /api/auth/register, /api/auth/me,
//                         /api/auth/verify-email, /api/auth/resend-verification
// Consolidated into a single function to stay within the Vercel Hobby plan's 12-function limit.
// Vercel routes /api/auth/login → req.query.action = 'login', etc.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import sql from '../_db.js'
import { signToken, requireAuth } from '../_auth.js'
import { isRateLimited, clientIp } from '../_rateLimit.js'
import { setSecurityHeaders } from '../_headers.js'
import { sendEmail } from '../_email.js'

const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://noise.jaxsenville.com'

function verificationEmailHtml(link: string): string {
  return `<p>Welcome to Noise Emporium!</p>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${link}">Verify my email</a></p>
          <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
}

const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuvuDummyHashToPreventTimingAttack'

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (isRateLimited(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
  try {
    const rows = await sql`
      SELECT id, email, password_hash, tier, email_verified FROM users WHERE email = ${email.toLowerCase().trim()}
    `
    const user = rows[0]
    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH)
    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password' })
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' })
    }
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, tier: user.tier } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (isRateLimited(`register:${clientIp(req)}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' })
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const token = crypto.randomUUID()
    const rows = await sql`
      INSERT INTO users (email, password_hash, email_verification_token, email_verification_expires_at)
      VALUES (
        ${email.toLowerCase().trim()},
        ${hash},
        ${token},
        NOW() + INTERVAL '24 hours'
      )
      RETURNING id, email
    `
    const user = rows[0]
    const link = `${APP_ORIGIN}/?emailToken=${token}`
    try {
      await sendEmail(user.email, 'Verify your Noise Emporium email', verificationEmailHtml(link))
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr)
    }
    res.json({ pending: true, email: user.email })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') return res.status(409).json({ error: 'Email already in use' })
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const userId = requireAuth(req, res)
  if (!userId) return
  try {
    const rows = await sql`SELECT id, email, tier, cancel_at_period_end, subscription_ends_at FROM users WHERE id = ${userId}`
    if (!rows[0]) return res.status(401).json({ error: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleVerifyEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { token } = req.body ?? {}
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Token is required' })
  try {
    const rows = await sql`
      UPDATE users
      SET email_verified = true,
          email_verification_token = NULL,
          email_verification_expires_at = NULL
      WHERE email_verification_token = ${token}
        AND email_verification_expires_at > NOW()
        AND email_verified = false
      RETURNING id, email, tier
    `
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired verification link' })
    const user = rows[0]
    res.json({ token: signToken(user.id), user: { id: user.id, email: user.email, tier: user.tier } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function handleResendVerification(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (isRateLimited(`resend-verify:${clientIp(req)}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests' })
  }
  const { email } = req.body ?? {}
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email is required' })
  try {
    const token = crypto.randomUUID()
    const rows = await sql`
      UPDATE users
      SET email_verification_token = ${token},
          email_verification_expires_at = NOW() + INTERVAL '24 hours'
      WHERE email = ${email.toLowerCase().trim()} AND email_verified = false
      RETURNING email
    `
    // Always return 200 — don't reveal whether the email exists or is already verified.
    if (rows[0]) {
      const link = `${APP_ORIGIN}/?emailToken=${token}`
      try {
        await sendEmail(rows[0].email, 'Verify your Noise Emporium email', verificationEmailHtml(link))
      } catch (emailErr) {
        console.error('Failed to resend verification email:', emailErr)
      }
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res)
  const { action } = req.query
  if (action === 'login')               return handleLogin(req, res)
  if (action === 'register')            return handleRegister(req, res)
  if (action === 'me')                  return handleMe(req, res)
  if (action === 'verify-email')        return handleVerifyEmail(req, res)
  if (action === 'resend-verification') return handleResendVerification(req, res)
  res.status(404).end()
}
