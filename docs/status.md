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
| Offline downloads | ✅ Working | IndexedDB cache |
| Cover art + gradient fallback | ✅ Working | |
| Bottom navigation | ✅ Working | |
| Sign out | ✅ Working | Available on Home screen header and Now Playing screen |

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
- [ ] **2. Stripe account setup** — add Noise Emporium account under the Jaxsenville org, get API keys, add env vars. Prerequisite for all payment work.
- [ ] **3. 3D store environment** — React Three Fiber foundation: scene, lighting, camera. Low-poly/low-res textures throughout. No purchases yet — just the browsable environment.
- [ ] **4. CD listing pages** — tie each shelf/display item in the 3D environment to a Contentful release.
- [ ] **5. Stripe Checkout for CDs** — purchase flow for physical CDs. Needs Stripe keys (2) and CD listings (4).
- [ ] **6. Name-your-price digital downloads** — $0 minimum, Stripe for any paid amount.
- [ ] **7. Download delivery** — email buyer a download link on purchase.

### Part 2 — Artist Platform

- [ ] **8. Open registration** — remove the single-user gate.
- [ ] **9. Preview enforcement** — 30-second preview for free users on memberOnly songs instead of hard block (current behavior is full lock).
- [ ] **10. Membership UI** — show the user their tier, surface the upgrade prompt.
- [ ] **11. Stripe Subscriptions** — paid membership billing ($1/$3/$5/month).
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
- **Server-side audio gating** — current `memberOnly` enforcement is client-side only (Contentful CDN URLs are public). A server-side audio proxy would provide hard enforcement but adds infrastructure complexity. Deferred until premium membership is live and worth protecting.
- **Home screen architecture at scale** — currently shows all releases flat. When multiple artists join, artist pages become the primary navigation layer and the home screen should only show pinned/curated content. Collections and featured playlists are already designed for this model; the missing piece is artist pages (N6 above).
