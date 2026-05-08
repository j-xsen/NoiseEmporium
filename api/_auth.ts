// _auth.ts — JWT helpers shared by all API routes.
//
// JWT_SECRET must be set in Vercel environment variables. Rotating it will
// immediately invalidate all existing tokens (all users are logged out).
// Tokens expire after 30 days; the client re-validates on every page load.

import jwt from 'jsonwebtoken'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SECRET = process.env.JWT_SECRET!

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string }
    return payload.sub
  } catch {
    return null
  }
}

/** Extracts and verifies the Bearer token. Returns userId or sends 401 and returns null. */
export function requireAuth(req: VercelRequest, res: VercelResponse): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const userId = verifyToken(header.slice(7))
  if (!userId) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return userId
}
