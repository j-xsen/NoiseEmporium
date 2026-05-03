# Noise Emporium — Overview

## What It Is

Noise Emporium is a **browser-based music platform** — part streaming service, part music store. It is the third and final building in Jaxsenville — a fictional city that Jaxsen Honeycutt is building across the web.

The platform starts as a personal hub for Jaxsen's music, then expands to let Louisville-area artists stream their music, sell physical CDs, and offer name-your-price digital downloads through the same storefront.

## The Jaxsenville Context

Jaxsenville is a universe of interconnected web apps, each conceived as a "building" in a city:

- **Building 1:** `museum.jaxsenville.com`
- **Building 2:** *(existing)*
- **Building 3:** Noise Emporium ← this app

Domain is registered at **Porkbun**. Subdomains are free, so the final URL is TBD between:
- `noise.jaxsenville.com` *(preferred lean)*
- `emporium.jaxsenville.com`

## Core Concept

> Spotify meets Bandcamp — but for Jaxsenville.

Key differentiators:
- **No app required** — runs entirely in the browser
- **Hyperlocal** — curated Louisville artists, not a global catalog
- **Artist-first revenue model** — 90% of subscription revenue goes directly to the music being listened to
- **Low barrier to entry** — $1/month minimum for access to the full streaming catalog
- **Music store built in** — buy physical CDs or download music for free (pay what you want)

## Audience

**Phase 1:** Jaxsen himself — personal music app with login barrier.

**Phase 2:** Friends, fans, Louisville locals. Free tier for Jaxsen's music; paid tier for the broader catalog.

**Phase 3:** Scaling as interest grows. Architecture is designed to support this from day one (Vercel + Supabase).

## Hosting & Infrastructure

| Concern | Solution |
|---------|----------|
| Frontend | Vercel (static) |
| API | Vercel Serverless Functions (`api/` directory) |
| Database | Neon (serverless PostgreSQL) |
| Music content/metadata | Contentful CMS |
| Domain | Porkbun → `*.jaxsenville.com` |

Initial traffic is expected to be very low. Neon free tier + Vercel hobby plan are sufficient to start. Both scale without re-architecting.
