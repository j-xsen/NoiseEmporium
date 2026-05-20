# Noise Emporium — Overview

## What It Is

Noise Emporium is a **browser-based music platform** — part streaming service, part music store. It is the third and final building in Jaxsenville — a fictional city that Jaxsen Honeycutt is building across the web.

The platform starts as a personal hub for Jaxsen's music, then expands to let Louisville-area artists stream their music, sell physical CDs, and offer name-your-price digital downloads through the same storefront.

## The Jaxsenville Context

Jaxsenville is a universe of interconnected web apps, each conceived as a "building" in a city:

- **Building 1:** `clinic.jaxsenville.com`
- **Building 2:** `museum.jaxsenville.com`
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

## Public Release Plan

Noise Emporium launches publicly in two parts, in this order:

### Part 1 — Music Store
The store ships first. The primary product is **physical CDs** — browsable, purchasable, with name-your-price digital downloads alongside them. This is the "Bandcamp" half of the platform.

The store section is built in **3D using React Three Fiber**, making it visually distinct from the rest of the 2D app. This is intentional: Jaxsenville's other two buildings are both fully 3D experiences, and the store is the callback to that universe. The rest of the app (player, library, playlists) stays 2D — the gimmick there is being a genuine Spotify-competitor running in the browser. The two halves have different identities on purpose.

**3D cost management:** 3D rendering in the browser is expensive. The store uses low-polygon models and low-resolution textures throughout to keep frame rates healthy across mid-range hardware without a GPU. This is a deliberate constraint, not a compromise — it's part of the aesthetic.

### Part 2 — Artist Platform
After the store is live and running for Jaxsen, the platform opens to other artists — primarily Louisville-area musicians. Artists can upload their music to the streaming catalog and list their own CDs and merch in the store.

This is also when the **subscription model becomes meaningful**: with multiple artists in the catalog, the 90/10 revenue split and play-weighted royalty distribution kick in. Jaxsen's Part 1 subscriptions are simple enough to not need this machinery yet.

Royalty payouts use **Stripe Connect** (see `technical.md` for the full architecture).

---

## Audience

**Phase 1:** Jaxsen himself — personal music app with login barrier.

**Phase 2:** Friends, fans, Louisville locals. Free tier for Jaxsen's music; paid tier for the broader catalog.

**Phase 3:** Scaling as interest grows. Architecture is designed to support this from day one (Vercel + Neon).

## Hosting & Infrastructure

| Concern | Solution |
|---------|----------|
| Frontend | Vercel (static) |
| API | Vercel Serverless Functions (`api/` directory) |
| Database | Neon (serverless PostgreSQL) |
| Music content/metadata | Contentful CMS |
| Domain | Porkbun → `*.jaxsenville.com` |

Initial traffic is expected to be very low. Neon free tier + Vercel hobby plan are sufficient to start. Both scale without re-architecting.
