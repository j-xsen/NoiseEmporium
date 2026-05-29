// api/_headers.ts — security headers applied to all API responses.
import type { VercelResponse } from '@vercel/node'

export function setSecurityHeaders(res: VercelResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.ctfassets.net; media-src 'self' https://assets.ctfassets.net https://*.public.blob.vercel-storage.com; connect-src 'self' https://cdn.contentful.com; frame-ancestors 'none'",
  )
}
