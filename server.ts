import 'dotenv/config'
import express from 'express'

const app = express()
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
  // Merge URL params into query so handlers can do `req.query.id`
  Object.assign(req.query, params)
  await handler(req, res)
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', (req, res) => handle('./api/auth/register.ts', {}, req, res))
app.post('/api/auth/login',    (req, res) => handle('./api/auth/login.ts',    {}, req, res))
app.get( '/api/auth/me',       (req, res) => handle('./api/auth/me.ts',       {}, req, res))

// ── Playlists ─────────────────────────────────────────────────────────────────
app.get( '/api/playlists',     (req, res) => handle('./api/playlists/index.ts', {}, req, res))
app.post('/api/playlists',     (req, res) => handle('./api/playlists/index.ts', {}, req, res))

app.patch( '/api/playlists/:id', (req, res) => handle('./api/playlists/[id].ts', { id: req.params.id }, req, res))
app.delete('/api/playlists/:id', (req, res) => handle('./api/playlists/[id].ts', { id: req.params.id }, req, res))

app.post(  '/api/playlists/:id/songs',          (req, res) => handle('./api/playlists/[id]/songs.ts',          { id: req.params.id },                            req, res))
app.delete('/api/playlists/:id/songs/:songId',  (req, res) => handle('./api/playlists/[id]/songs/[songId].ts', { id: req.params.id, songId: req.params.songId }, req, res))

const PORT = process.env.API_PORT ?? 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
