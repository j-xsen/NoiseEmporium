# Current Status

## What Works

| Feature | Status | Notes |
|---------|--------|-------|
| Audio playback | ✅ Working | Queue, skip, seek, loop, auto-advance |
| Volume control | ✅ Working | Toggleable slider in MiniPlayer; `volume`/`setVolume` on `PlayerAPI` |
| Media Session API | ✅ Working | Lock-screen controls on iOS |
| Home screen | ✅ Working | Releases grid + Featured section (collections + featured playlists) |
| Mini player + Now Playing | ✅ Working | |
| Playlist CRUD | ✅ Working | Create, rename, delete, add/remove songs |
| Featured playlists | ✅ Working | Set via DB; appear in home Featured section alongside collections |
| Collections | ✅ Working | Contentful `collection` content type; premium gate at collection level |
| Lyrics page | ✅ Working | Per-song lyrics from Contentful; auto-plays on open; gated for memberOnly songs |
| Premium access enforcement | ✅ Working | `handlePlay` filters memberOnly songs; UI shows lock icons |
| Song preview (3 s) | ✅ Working | Non-premium users hear 3 s; play blocked after; blob URL revoked |
| Offline downloads | ✅ Working | IndexedDB cache |
| Cover art + gradient fallback | ✅ Working | |
| Bottom navigation | ✅ Working | |
| Sign out | ✅ Working | Available on Home screen header and Now Playing screen |
| Shop UI | ✅ Working | `Shop.tsx` — filter by category, collapsible sections, Stripe Checkout for memberships, downloads, and per-song instrumental licenses; Downloads tab auto-populated from Contentful releases with `downloadUrl` set; CD listings ready to populate |
| Stripe Checkout + webhook | ✅ Working | `api/stripe/checkout.ts` creates sessions + fulfills; `api/stripe/webhook.ts` upgrades `users.tier` on `checkout.session.completed` |
| Account modal | ✅ Working | `AccountModal.tsx` — shows tier, change password, delete account |
| 3D bubble world | ✅ Working | Two-row carousel (releases + collections); drag/swipe, arrow nav, auto-scroll to now-playing release, mobile + desktop layouts |
| Permanent download purchase | ✅ Working | One-time Stripe payment grants permanent streaming rights (bypasses `memberOnly` gate) + WAV ZIP download via Vercel Blob. Pricing read from Contentful at checkout time (`price`/`memberPrice` fields with type-based defaults). `orders` table; `api/downloads/index.ts`; `usePurchases` hook; Buy/Download WAV buttons on release pages; Resend purchase confirmation email |

---

## Backlog

Items are ordered so each one unblocks or sets up the next.

### Navigation & Library Redesign

- [ ] **N1. Liked albums** — heart button on album cards; `liked_albums` table + `POST/DELETE /api/albums/[id]/like` + `GET /api/albums/liked`. Library screen shows only liked albums under an "Albums" section.
- [ ] **N2. Library screen redesign** — restructure into two sections: liked albums (N1) and playlists (owned + saved). Remove standalone Playlists tab from bottom nav.
- [ ] **N3. Shareable playlists** — `PATCH /api/playlists/[id]/share` generates a `share_token`; `GET /api/playlists/share/[token]` is a public endpoint. Share button in playlist header copies the link.
- [ ] **N4. Save shared playlist to library** — `POST/DELETE /api/playlists/share/[token]/like` creates a `liked_playlists` row. Needs N3.
- [ ] **N5. Featured playlist admin UI** — a simple UI (probably just a settings screen for Jaxsen) to toggle `featured` on playlists without raw SQL.
- [ ] **N6. Artist pages** — critical for scaling to multiple artists. Artist page holds their releases + collections. Home screen shows only pinned/curated content, not everything from every artist.

### Part 1 — Music Store (Jaxsen only)

- [ ] **1. Wire up play count display** — endpoint exists (`api/plays/index.ts`), needs to display on song cards. Play data already accumulates.
- [ ] **4. CD listing pages** — tie each shelf/display item in the 3D environment to a Contentful release. Add CD entries to `shopData.ts`.
- [ ] **5. Stripe Checkout for CDs** — Shop UI is ready; just needs CD products in `shopData.ts`.
- [ ] **6. Name-your-price digital downloads** — $0 minimum, Stripe for any paid amount. (Distinct from the permanent purchase model already implemented — this is a guest/no-account flow, Bandcamp-style.)

### Part 2 — Artist Platform

- [ ] **8. Open registration** — remove the single-user gate.
- [ ] **10. Membership UI** — tier shown in `AccountModal.tsx`; upgrade CTA surfaces the Shop. ✅ Basic version done.
- [ ] **12. Link songs to artist records** — `artists` table and `song_artist_map` in the DB.
- [ ] **13. Artist application flow** — "Join as an artist" form, manual approval.
- [ ] **14. Stripe Connect onboarding** — Express account, Account Link, Stripe KYC.
- [ ] **15. Stripe dashboard link** — "Go to Stripe Dashboard" button for artists.
- [ ] **16. Monthly play-count aggregation** — cron job to group `song_plays` by artist per billing period.
- [ ] **17. Royalty calculation** — compute each artist's share (90% of subscription × play fraction).
- [ ] **18. Stripe Transfers** — one transfer per artist per month, respect minimum threshold.
- [ ] **19. Artist storefronts** — artists list their own CDs and merch in the store.
- [ ] **20. Artist payout dashboard** — show artists their play counts, monthly royalty, payout history.

### Player Polish (no hard dependencies)

- [ ] Shuffle mode
- [ ] "Add to queue" action
- [ ] Playback speed control (stretch goal)
- [ ] Cross-fade between tracks (stretch goal)

---

## Architecture Decisions Pending

- **`noise.jaxsenville.com` vs `emporium.jaxsenville.com`** — either works; subdomains are free on Porkbun
- **`@neondatabase/serverless` vs raw `pg`** — current Neon client is fine; no reason to change
- **Contentful vs self-hosted audio** — Contentful CDN is fast and free at current scale; revisit if catalog grows significantly
- **Server-side audio gating** — implemented in `api/plays/index.ts`. JWT verified via query param (since `<audio src>` can't send headers); non-members get a 3-second preview blob instead of a 302 redirect to the CDN URL.
- **Home screen architecture at scale** — currently shows all releases flat. When multiple artists join, artist pages become the primary navigation layer and the home screen should only show pinned/curated content. Collections and featured playlists are already designed for this model; the missing piece is artist pages (N6 above).

---

## Song Preview Feature

Non-premium users can click any `memberOnly` track to hear a 3-second preview. After 3 seconds the audio stops, the progress bar shows 100%, and the play button is disabled. The preview Blob URL is revoked immediately so the raw audio bytes are no longer accessible. See `docs/technical.md` → **Song Preview System** for full implementation details.

**File format requirement:** Songs must be uploaded as M4A to Contentful. MP3 files will return a 502 preview error. Run them through the conversion pipeline first.

---

## Known Issues

- JWT tokens stored in `localStorage` — any XSS can steal them. Deferred; migrating to HttpOnly cookies requires CSRF infrastructure and breaks the current bearer-token flow.
- No CSRF token on state-changing endpoints — low risk while auth is Bearer-header-only. Will address if/when cookie auth is added.
