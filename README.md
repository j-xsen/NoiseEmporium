# Noise Emporium

A browser-based music platform — streaming + store — scoped to Jaxsen Honeycutt's music. Part of the Jaxsenville universe at `noise.jaxsenville.com`.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Vercel Serverless Functions (`api/`)
- **Database:** Neon (serverless PostgreSQL)
- **CMS:** Contentful (music catalog source of truth)
- **Auth:** JWT (30-day), stored in localStorage
- **Payments:** Stripe Checkout

## Getting Started

```bash
pnpm install
pnpm dev
```

This runs Vite (frontend) and an Express dev server (API) concurrently. The API server proxies all `api/` routes locally.

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
```

## Project Structure

```
src/                  React frontend
  components/         UI components
  hooks/              Auth, audio, playlists, downloads
  lib/contentful.ts   Contentful CMS client
  shopData.ts         Stripe product definitions
  types.ts            Shared TypeScript types
api/                  Vercel serverless functions
  auth/               register, login, me
  playlists/          CRUD + song management
  stripe/             checkout session, webhook
  account/            password change, account deletion
schema.sql            Database schema
server.ts             Local Express dev server
```

## Shop Products

Products are defined in `src/shopData.ts`. Replace the placeholder Stripe Price IDs with real ones from your Stripe dashboard before going live.

## Deployment

Deployed on Vercel. The `api/` directory is automatically served as serverless functions. Set all environment variables in the Vercel project settings.
