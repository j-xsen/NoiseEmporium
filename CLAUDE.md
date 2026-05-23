# Noise Emporium — LLM Quick Reference

Noise Emporium is a **browser-based music platform** (streaming + store) — the third building in the fictional city of Jaxsenville. Think Spotify meets Bandcamp in the browser, scoped initially to Jaxsen Honeycutt's music. The store sells physical CDs and offers name-your-price digital downloads. Long-term goal: onboard Louisville-area artists for both streaming and store sales.

## Docs Index

| File | What it covers |
|------|----------------|
| [docs/overview.md](docs/overview.md) | Vision, Jaxsenville context, domain, hosting |
| [docs/features.md](docs/features.md) | All planned features — accounts, memberships, player, library |
| [docs/technical.md](docs/technical.md) | Stack, architecture, data flow, content pipeline |
| [docs/database.md](docs/database.md) | Schema, Neon setup, planned additions |
| [docs/status.md](docs/status.md) | Current state — what works, what's broken, what's next |
| [docs/design.md](docs/design.md) | Color palette, typography, custom asset specs |
| [conversion/CLAUDE.md](conversion/CLAUDE.md) | NoiseConverter quick reference (separate repo — audio pipeline + Contentful console) |

## Investigation Workflow

Before spawning Explore agents or running code searches, always read the relevant docs/ files first:
- `docs/status.md` — what works, what's broken, what's next
- `docs/features.md` — feature design, auth/access patterns, membership rules
- `docs/technical.md` — stack, architecture, data flow

Use docs to form a hypothesis, then verify in code. Never skip straight to grep/glob/Explore.

## Project Root at a Glance

```
src/                   React frontend (Vite + TypeScript + Tailwind v4)
  components/          UI components (including SongActionsSheet for per-song actions)
  hooks/               Domain hooks (auth, songs, playlists, audio, downloads)
  lib/api.ts           Typed fetch wrapper — use for all API calls (auth headers, error handling)
  lib/contentful.ts    Contentful CMS client (music source of truth)
  types.ts             Shared TypeScript interfaces
api/                   Serverless-style API handlers (Vercel Functions)
  _auth.ts             JWT utilities
  _db.ts               Database client
  _prices.ts           Release price defaults (server-side; keep in sync with src/utils/format.ts)
  auth/                register, login, me
  playlists/           CRUD + song management
server.ts              Local Express dev server (proxies api/ handlers)
schema.sql             Database schema (Neon PostgreSQL)
conversion/            Separate git repo — local audio pipeline + Contentful management console
                       (converts audio to M4A, uploads songs/releases to Contentful, packages WAV ZIPs)
```

## Worktree Setup

When operating inside a git worktree (path contains `.claude/worktrees/`), run `pnpm install` at the start of the session before doing any dev work. This ensures `node_modules` is linked correctly — pnpm reuses the global store so it's fast.

## Key Facts for Code Generation

- **Framework:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- **Auth:** JWT (30-day), stored in localStorage, sent as `Authorization: Bearer <token>`
- **Music content:** Fetched from Contentful CMS (not the database)
- **Database:** Neon (serverless PostgreSQL), client at `api/_db.ts`
- **Deployment:** Vercel (serverless functions in `api/`)
- **Package manager:** pnpm
- **No component library** — everything is custom Tailwind
- **No global state manager** — React hooks only, coordinated in App.tsx

## The Jaxsenville Universe

Jaxsenville is a city built by Jaxsen Honeycutt across multiple web properties:
- `clinic.jaxsenville.com` — existing building #1
- `museum.jaxsenville.com` — existing building #2
- `noise.jaxsenville.com` *(or `emporium.jaxsenville.com`)* — **this app**, building #3
- Domain registered at Porkbun; hosted on Vercel
