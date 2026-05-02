# Noise Emporium — LLM Quick Reference

Noise Emporium is a **browser-based music streaming platform** — the third building in the fictional city of Jaxsenville. Think Spotify in the browser, scoped initially to Jaxsen Honeycutt's music with a path to onboarding Louisville-area artists.

## Docs Index

| File | What it covers |
|------|----------------|
| [docs/overview.md](docs/overview.md) | Vision, Jaxsenville context, domain, hosting |
| [docs/features.md](docs/features.md) | All planned features — accounts, memberships, player, library |
| [docs/technical.md](docs/technical.md) | Stack, architecture, data flow |
| [docs/database.md](docs/database.md) | Schema, Neon setup, planned additions |
| [docs/status.md](docs/status.md) | Current state — what works, what's broken, what's next |

## Project Root at a Glance

```
src/                   React frontend (Vite + TypeScript + Tailwind v4)
  components/          UI components
  hooks/               Domain hooks (auth, songs, playlists, audio, downloads)
  lib/contentful.ts    Contentful CMS client (music source of truth)
  types.ts             Shared TypeScript interfaces
api/                   Serverless-style API handlers (Vercel Functions)
  _auth.ts             JWT utilities
  _db.ts               Database client
  auth/                register, login, me
  playlists/           CRUD + song management
server.ts              Local Express dev server (proxies api/ handlers)
schema.sql             Database schema (Neon PostgreSQL)
```

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
- `museum.jaxsenville.com` — existing building #1
- Building #2 — existing
- `noise.jaxsenville.com` *(or `emporium.jaxsenville.com`)* — **this app**, building #3
- Domain registered at Porkbun; hosted on Vercel
