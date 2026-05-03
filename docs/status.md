# Current Status

## What Works

| Feature | Status | Notes |
|---------|--------|-------|
| Audio playback | ✅ Working | Queue, skip, seek, loop, auto-advance |
| Media Session API | ✅ Working | Lock-screen controls on iOS |
| Library (song list) | ✅ Working | Fetches from Contentful |
| Mini player + Now Playing | ✅ Working | |
| Playlist CRUD | ✅ Working | Create, rename, delete, add/remove songs |
| Offline downloads | ✅ Working | IndexedDB cache |
| Cover art + gradient fallback | ✅ Working | |
| Bottom navigation | ✅ Working | |

## Immediate Next Steps

1. **Wire up play count API** — endpoint to record a play, hook into the player, display counts on song cards
2. **Open registration** — remove single-user gate
3. **Membership UI** — free vs paid tier display
4. **Stripe integration** — paid memberships

## Planned Work (Prioritized)

### Phase 1 — Foundation
- [x] Fix login bug
- [x] Deploy to Vercel with domain

### Phase 2 — Open to Users + Store
- [ ] Play count recording + display
- [ ] Open registration (remove single-user gate)
- [ ] Free tier: Jaxsen's music only
- [ ] Membership UI (free vs paid)
- [ ] Stripe integration for paid memberships
- [ ] Music store UI (browse releases)
- [ ] CD purchasing via Stripe Checkout
- [ ] Name-your-price digital downloads (free minimum, Stripe for paid amounts)
- [ ] Download delivery (email link to buyer)

### Phase 3 — Artist Platform
- [ ] Invite Louisville artists to the platform
- [ ] Artist onboarding flow
- [ ] Artist storefronts (their own CDs + downloads in the store)
- [ ] Revenue distribution calculations (streaming subscriptions)
- [ ] Artist payout dashboard
- [ ] Shuffle mode
- [ ] "Add to queue" action

## Architecture Decisions Pending

- **`noise.jaxsenville.com` vs `emporium.jaxsenville.com`** — either works; subdomains are free on Porkbun
- **`@neondatabase/serverless` vs raw `pg`** — current Neon client is fine; no reason to change
- **Contentful vs self-hosted audio** — Contentful CDN is fast and free at current scale; revisit if catalog grows significantly
