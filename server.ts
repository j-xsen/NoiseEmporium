import 'dotenv/config'
import express from 'express'
import type { Request, Response, NextFunction } from 'express'

const app = express()

// Stripe webhooks require raw body — register before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req: Request, res: Response, next: NextFunction) => {
  // Expose raw body so the webhook handler can verify the Stripe signature
  ;(req as Request & { rawBody: Buffer }).rawBody = req.body as Buffer
  next()
}, (req: Request, res: Response) => handle('./api/stripe/webhook.ts', {}, req, res))

app.use(express.json())

// Helper: adapt a Vercel handler to Express, injecting URL params into req.query
async function handle(
  handlerPath: string,
  params: Record<string, string>,
  req: express.Request,
  res: express.Response
) {
  const mod = await import(handlerPath)
  const handler = mod.default
  // Merge URL params into query so handlers can do `req.query.id`.
  // Must override the getter with a plain value; Object.assign writes to a
  // throwaway object because req.query re-parses the URL on every access.
  Object.defineProperty(req, 'query', {
    value: { ...req.query, ...params },
    writable: true,
    configurable: true,
  })
  await handler(req, res)
}

// ── Plays ─────────────────────────────────────────────────────────────────────
app.get( '/api/plays', (req, res) => handle('./api/plays/index.ts', {}, req, res))
app.post('/api/plays', (req, res) => handle('./api/plays/index.ts', {}, req, res))

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => handle('./api/auth/[action].ts', { action: 'register' }, req, res))
app.post('/api/auth/login',    (req, res) => handle('./api/auth/[action].ts', { action: 'login' },    req, res))
app.get( '/api/auth/me',                  (req, res) => handle('./api/auth/[action].ts', { action: 'me' },                  req, res))
app.post('/api/auth/verify-email',        (req, res) => handle('./api/auth/[action].ts', { action: 'verify-email' },        req, res))
app.post('/api/auth/resend-verification', (req, res) => handle('./api/auth/[action].ts', { action: 'resend-verification' }, req, res))

// ── Playlists ─────────────────────────────────────────────────────────────────
app.get( '/api/playlists',          (req, res) => handle('./api/playlists/index.ts',    {}, req, res))
app.post('/api/playlists',          (req, res) => handle('./api/playlists/index.ts',    {}, req, res))
app.get( '/api/playlists/featured', (req, res) => handle('./api/playlists/featured.ts', {}, req, res))

app.patch( '/api/playlists/:id', (req, res) => handle('./api/playlists/[id].ts', { id: req.params.id }, req, res))
app.delete('/api/playlists/:id', (req, res) => handle('./api/playlists/[id].ts', { id: req.params.id }, req, res))

app.post(  '/api/playlists/:id/songs',          (req, res) => handle('./api/playlists/[id]/songs.ts',          { id: req.params.id },                            req, res))
app.delete('/api/playlists/:id/songs/:songId',  (req, res) => handle('./api/playlists/[id]/songs/[songId].ts', { id: req.params.id, songId: req.params.songId }, req, res))

// ── Downloads ─────────────────────────────────────────────────────────────────
app.get('/api/downloads', (req, res) => handle('./api/downloads/index.ts', {}, req, res))

// ── Stripe ────────────────────────────────────────────────────────────────────
app.get( '/api/stripe/checkout', (req, res) => handle('./api/stripe/checkout.ts', {}, req, res))
app.post('/api/stripe/checkout', (req, res) => handle('./api/stripe/checkout.ts', {}, req, res))
// webhook route is registered above (needs raw body)

// ── Account ───────────────────────────────────────────────────────────────────
app.post(  '/api/account', (req, res) => handle('./api/account/index.ts', {}, req, res))
app.patch( '/api/account', (req, res) => handle('./api/account/index.ts', {}, req, res))
app.delete('/api/account', (req, res) => handle('./api/account/index.ts', {}, req, res))

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
