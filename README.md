<p align="center">
  <img src="https://raw.githubusercontent.com/j-xsen/NoiseEmporium/main/public/wordmark-black.webp" alt="Noise Emporium" width="320" />
</p>

A browser-based music platform — streaming + store — built for Jaxsen Honeycutt's music. Part of the [Jaxsenville](https://clinic.jaxsenville.com) universe at `noise.jaxsenville.com`.

> Spotify meets Bandcamp — but for Jaxsenville.

## Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- **Backend:** Vercel Serverless Functions (`api/`)
- **Database:** Neon (serverless PostgreSQL)
- **CMS:** Contentful (music catalog — releases, songs, collections, lyrics)
- **Auth:** JWT (30-day), stored in localStorage
- **Payments:** Stripe Checkout (memberships, permanent downloads, CDs)
- **3D:** React Three Fiber (store environment)

## Getting Started

```bash
pnpm install
pnpm dev
```

Runs Vite (frontend) and Express (API) concurrently. All `api/` routes are proxied locally via `server.ts`.

## Environment Variables

Create a `.env` file in the project root:

```env
# Contentful
VITE_CONTENTFUL_SPACE_ID=
VITE_CONTENTFUL_ACCESS_TOKEN=

# Database
DATABASE_URL=

# Auth
JWT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Vercel Blob (WAV downloads)
BLOB_READ_WRITE_TOKEN=

# Resend (purchase confirmation emails)
RESEND_API_KEY=
```

## Project Structure

```
src/                   React frontend
  components/          UI components (player, shop, modals, 3D bubble world)
  hooks/               Auth, audio, playlists, downloads, purchases
  lib/api.ts           Typed fetch wrapper — use for all API calls
  lib/contentful.ts    Contentful CMS client
  types.ts             Shared TypeScript interfaces
api/                   Vercel serverless functions
  auth/                register, login, me
  playlists/           CRUD + song management
  stripe/              checkout session, webhook
  account/             password change, account deletion
  downloads/           permanent purchase + WAV ZIP delivery
  plays/               server-side audio gating + play count tracking
schema.sql             Database schema
server.ts              Local Express dev server
conversion/            Separate git repo — audio pipeline + Contentful management console
```

## Key Features

- **3D bubble world** — releases and collections as floating bubbles; drag/swipe navigation
- **Audio gating** — `memberOnly` tracks stream only for paid members; guests hear a 3-second preview
- **Permanent downloads** — one-time Stripe payment grants permanent streaming rights + WAV ZIP via Vercel Blob
- **Playlists** — full CRUD; featured playlists curated by Jaxsen appear on the home screen
- **Collections** — Contentful-managed; premium-gated at the collection level
- **Offline downloads** — IndexedDB cache for downloaded tracks
- **Shop** — memberships, instrumental licenses, and (soon) CD purchases via Stripe Checkout

## Deployment

Deployed on Vercel. The `api/` directory is automatically served as serverless functions. Set all environment variables in the Vercel project dashboard.

Hobby plan is capped at 12 serverless functions — merge routes rather than adding new files when at the limit.

## Audio Pipeline

Songs must be uploaded as **M4A** to Contentful. MP3 files will break the 3-second preview system. Run source audio through the conversion pipeline in `conversion/` first.
