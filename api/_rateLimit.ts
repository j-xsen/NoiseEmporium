// api/_rateLimit.ts — in-memory sliding-window rate limiter.
//
// Per-instance only: serverless functions don't share memory across instances,
// so this provides single-instance protection against bursts. For distributed
// rate limiting across all instances, swap this for an Upstash Redis solution.

import type { VercelRequest } from '@vercel/node'

const windows = new Map<string, number[]>()

// Returns true if the request should be rate-limited.
export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const hits = (windows.get(key) ?? []).filter(t => t > windowStart)
  if (hits.length >= maxRequests) return true
  hits.push(now)
  windows.set(key, hits)
  return false
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded)) return forwarded[0].split(',')[0].trim()
  return (req.socket as { remoteAddress?: string })?.remoteAddress ?? 'unknown'
}
