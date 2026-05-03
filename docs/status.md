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

---

## Backlog

Items are ordered so each one unblocks or sets up the next. Don't skip ahead — later items have dependencies on earlier ones.

### Part 1 — Music Store (Jaxsen only)

- [ ] **1. Wire up play count** — endpoint exists (`api/plays/index.ts`), needs to hook into the player and display on song cards. Do this first; play data needs to accumulate before Part 2 royalties are meaningful.
- [ ] **2. Stripe account setup** — add Noise Emporium account under the Jaxsenville org, get API keys, add env vars. Prerequisite for all payment work.
- [ ] **3. 3D store environment** — React Three Fiber foundation: scene, lighting, camera. Low-poly/low-res textures throughout. No purchases yet — just the browsable environment.
- [ ] **4. CD listing pages** — tie each shelf/display item in the 3D environment to a Contentful release (cover art, tracklist, price).
- [ ] **5. Stripe Checkout for CDs** — purchase flow for physical CDs. Needs Stripe keys (2) and CD listings (4).
- [ ] **6. Name-your-price digital downloads** — $0 minimum, Stripe for any paid amount. Needs Stripe keys (2).
- [ ] **7. Download delivery** — email buyer a download link on purchase. Needs purchase flow (5, 6).

### Part 2 — Artist Platform

- [ ] **8. Open registration** — remove the single-user gate. Everything in Part 2 requires real user accounts.
- [ ] **9. Free tier access control** — enforce free vs. premium in the player (full stream vs. 30s preview based on `freeStream` flag in Contentful).
- [ ] **10. Membership UI** — show the user their tier, surface the upgrade prompt. Needs open registration (8).
- [ ] **11. Stripe Subscriptions** — paid membership billing ($1/$3/$5/month). Needs Stripe already configured (2) and membership UI (10).
- [ ] **12. Link songs to artist records** — create `artists` table and `song_artist_map` in the DB, map existing Contentful songs to Jaxsen as the first artist. Prerequisite for royalty splitting.
- [ ] **13. Artist application flow** — "Join as an artist" form, stored as `status = 'pending'`, manual approval by Jaxsen.
- [ ] **14. Stripe Connect onboarding** — on approval, create Express account, generate Account Link, redirect artist through Stripe KYC. Store `stripe_account_id`. Needs Stripe configured (2) and artist records (12).
- [ ] **15. Stripe dashboard link** — "Go to Stripe Dashboard" button for artists; calls `stripe.accounts.createLoginLink()` on click. Needs Connect onboarding (14).
- [ ] **16. Monthly play-count aggregation** — cron job to group `song_plays` by artist per subscriber per billing period. Needs play counts accumulating (1) and artist linking (12).
- [ ] **17. Royalty calculation** — compute each artist's share (90% of subscription × play fraction). Needs aggregation (16) and subscriptions (11).
- [ ] **18. Stripe Transfers** — issue one transfer per artist per month, respect minimum threshold, roll under-threshold balances forward. Needs royalty calculation (17) and Connect accounts (14).
- [ ] **19. Artist storefronts** — artists list their own CDs and merch in the store. Needs artist onboarding (13) and Connect (14).
- [ ] **20. Artist payout dashboard** — show artists their play counts, monthly royalty, payout history. Needs transfers running (18).

### Player Polish (no hard dependencies — pick up anytime)

- [ ] Shuffle mode
- [ ] "Add to queue" action
- [ ] Volume control

---

## Architecture Decisions Pending

- **`noise.jaxsenville.com` vs `emporium.jaxsenville.com`** — either works; subdomains are free on Porkbun
- **`@neondatabase/serverless` vs raw `pg`** — current Neon client is fine; no reason to change
- **Contentful vs self-hosted audio** — Contentful CDN is fast and free at current scale; revisit if catalog grows significantly
