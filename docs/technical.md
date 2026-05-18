# Technical Architecture

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + TypeScript | Vite 8 for bundling |
| Styling | Tailwind CSS v4 | Vite plugin; no component library |
| API | Vercel Serverless Functions | `api/` directory; Express used locally |
| Database | **Neon** (serverless PostgreSQL) | |
| CMS | Contentful | Music metadata + audio file hosting |
| File storage | Vercel Blob | WAV ZIP downloads (private blobs, UUID-based URLs) |
| Auth | JWT (jsonwebtoken) | 30-day tokens, localStorage |
| Email | Resend | Purchase confirmation emails |
| Package manager | pnpm | |

## Frontend Architecture

**No global state manager.** State lives in domain-specific hooks, coordinated by `App.tsx`.

```
src/hooks/
  useAuth.ts               Auth state, token storage, login/logout
  useSongs.ts              Fetches releases AND collections from Contentful; exposes songs, releases, collections
  usePlaylists.ts          Playlist CRUD for the logged-in user; syncs with API
  useFeaturedPlaylists.ts  Fetches featured playlists from /api/playlists/featured (public, no auth)
  useAudio.ts              HTML5 audio, queue, playback state, volume
  useDownloads.ts          IndexedDB cache for offline songs
  usePurchases.ts          Fetches purchased release IDs from /api/downloads?purchases on login; exposes hasPurchased(contentfulId)
```

`App.tsx` wires these hooks together and passes state down to components. No prop drilling — hooks are called at the top level and relevant slices are passed to child components.

**Tab navigation** (BottomNav): Home → Player → Library (Playlists)

**Routing** uses React Router v6 (`BrowserRouter` in `main.tsx`). `App.tsx` wraps its content in `<Routes>` and defines the route tree. The bottom-nav tabs are driven by a `tab` state variable in `App.tsx`, but navigating into a release or collection uses real URL routes so the browser back button works.

```
/                        BubbleWorld (3D) or Library (2D) depending on viewMode toggle
/album/:slug             ReleaseDetail
/ep/:slug                ReleaseDetail
/single/:slug            ReleaseDetail
/collection/:slug        CollectionDetail
  └── LyricsView         rendered in-place over CollectionDetail (no route, local state)
/playlist/:id            FeaturedPlaylistDetail
```

**Player layout:**
- Full-screen `NowPlaying` when on Player tab
- `MiniPlayer` bar when on Home or Library tab (hidden on Player tab)
- Both driven by the same `useAudio` state

## Audio State and Re-render Budget

`useAudio` returns a `player` object. Not all fields on it are equally stable — some change every tick, some only change when the user actually does something. This matters for performance because `App.tsx` re-renders every time any `useAudio` value changes.

| Value | Changes when | Stability |
|-------|-------------|-----------|
| `player.currentSong` | Song changes (new track starts) | Stable between track changes |
| `player.currentSong?.id` | Song changes | Stable string; safe as an effect dep |
| `player.isPlaying` | Play/pause | Stable between user actions |
| `player.currentTime` | Every `timeupdate` event (~4× per second) | **Noisy — changes constantly** |
| `player.duration` | Song loads | Stable per track |

Because `currentTime` ticks constantly, `App.tsx` re-renders ~4 times per second during playback. Components that don't need the current time should be wrapped in `React.memo()` and should not receive `player` directly — receive only the stable slices they need.

**Current memo boundaries:**
- `BubbleWorld` — `memo()`'d; receives `releases`, `collections` (both stable refs from `useSongs` useState), and `currentSongId` (stable string). Does **not** re-render on audio ticks.
- `Library` — `memo()`'d; same pattern.

**`useSongs` stability:** `releases` and `collections` are `useState` arrays that are set once on app load from Contentful. Their object references never change after the initial fetch, so `memo()` comparisons always pass for those props.

### The auto-scroll pattern in BubbleWorld

`BubbleWorld` auto-scrolls the release carousel to show whichever release contains the currently playing song. The effect is gated with a ref to prevent re-applying the same scroll within a single mount session:

```ts
useEffect(() => {
  if (!currentSongId) return
  const idx = releases.findIndex(r => r.songs.some(s => s.id === currentSongId))
  if (idx < 0) return
  setPageRow0(idx)
  row0Api.current?.settle(idx)
}, [currentSongId])
```

The effect only has `currentSongId` as a dep (releases is intentionally omitted — it's stable and including it would cause a double-scroll on load). Because `currentSongId` is a stable string while the same song plays, this fires once per song change, not continuously. BubbleWorld remounts on every route navigation, so returning to home always triggers one fresh auto-scroll.

**Pitfall — `[rowFocused]` stale closure:** `CarouselRow` had an effect that snapped the spring to `-page * spacing` whenever `rowFocused` changed, but `page` wasn't in the deps (intentional stale closure for the mobile row-switch case). React Strict Mode double-fires effects; the second fire used the stale `page = 0` from the initial render, snapping the spring to 0 even after auto-scroll had moved it to the correct position. Fixed by only snapping when a row goes **off**-screen (`!rowFocused && wasRowFocused`), skipping mount and focus-gain entirely.

## API Architecture

Handlers live in `api/` and are written as Vercel Serverless Functions. Locally, `server.ts` wraps them in Express.

> **Function limit:** The current plan allows a maximum of **12 serverless functions**. Files prefixed with `_` (`_auth.ts`, `_db.ts`) are shared utilities and do not count toward the limit. All other files in `api/` count as one function each. **The project is currently at 11/12.** Before adding a new route file, consolidate an existing one instead (e.g. combine two related endpoints into one handler that branches on method/action).
>
> The three original auth files (login/me/register) were merged into a single `api/auth/[action].ts` catch-all, freeing 2 slots. Vercel routes `/api/auth/login`, `/api/auth/me`, and `/api/auth/register` through `req.query.action` — the URLs are unchanged.

```
api/
  _auth.ts                      JWT sign/verify helpers
  _db.ts                        Neon database client
  auth/
    [action].ts                 POST /api/auth/login
                                POST /api/auth/register
                                GET  /api/auth/me
                                (single file, routes on req.query.action)
  account/
    index.ts                    POST   /api/account   (change password; auth required)
                                DELETE /api/account   (delete account; auth required)
  downloads/
    index.ts                    GET /api/downloads?purchases   (list purchased release IDs; auth required)
                                GET /api/downloads?release=id  (verify purchase + return blob URL; auth required)
  playlists/
    index.ts                    GET/POST /api/playlists           (auth required)
    featured.ts                 GET      /api/playlists/featured  (public)
    [id].ts                     PATCH/DELETE /api/playlists/:id   (auth + ownership)
    [id]/
      songs.ts                  POST   /api/playlists/:id/songs
      songs/
        [songId].ts             DELETE /api/playlists/:id/songs/:songId
  plays/
    index.ts                    GET  /api/plays?stream=id  (stream proxy; checks premium OR purchase)
                                POST /api/plays             (record a song play; auth optional)
  stripe/
    checkout.ts                 POST /api/stripe/checkout  (create session or fulfill; auth required)
    webhook.ts                  POST /api/stripe/webhook   (Stripe events; no auth — signature verified)
```

> **Important:** In `server.ts`, the `/api/playlists/featured` route must be registered **before** `/api/playlists/:id`, otherwise Express matches "featured" as an ID.

All mutating playlist endpoints verify JWT and ownership (`WHERE user_id = $userId`).

## Authentication Flow

1. User submits email + password
2. `POST /api/auth/login` → bcrypt verify → issue JWT
3. Token stored in `localStorage`
4. On app load: `GET /api/auth/me` with `Authorization: Bearer <token>` → restore session
5. All protected API calls include the Bearer header

## Contentful Data Model

Collections and songs are fetched from Contentful via `src/lib/contentful.ts`. Both `fetchReleases()` and `fetchCollections()` are called in parallel by `useSongs` on app load.

```
Release (content type: "release")
  name         — Short text  (display field)
  date         — Date
  cover        — Asset       (shared cover art for all tracks in this release)
  spotify      — Short text  (optional)
  tracks       — References  (ordered Song entries; sort by Song.pos)

Song (content type: "song")
  pos          — Integer     (track number within a release; ignored for collections)
  name         — Short text  (display field)
  file         — Asset       (audio file)
  memberOnly   — Boolean     (true = premium only; controls playback AND lyrics access)
  lyrics       — Long text   (optional; line breaks preserved)

For `memberOnly` tracks in a release, `fetchReleases()` builds the stream proxy URL as
`/api/plays?stream=<songId>&releaseId=<releaseContentfulId>`. The `releaseId` lets the
stream proxy check purchase rights in addition to the premium tier (see `api/plays/index.ts`).

Collection (content type: "collection")
  title        — Short text  (display field)
  description  — Short text  (optional subtitle)
  coverImage   — Asset       (optional cover art)
  premiumOnly  — Boolean     (true = entire collection locked for non-premium users)
  tracks       — References  (Song entries; order controlled by drag in Contentful editor)
```

## Data Sources

| Data | Where it lives |
|------|---------------|
| Song metadata (title, audio URL, cover art, lyrics) | Contentful CMS |
| Collections (curated playlists with premium gate) | Contentful CMS |
| Users | Neon `users` table |
| Playlists | Neon `playlists` + `playlist_songs` tables |
| Featured playlists | `playlists.featured` flag + `playlists.featured_order` |
| Play counts | Neon `song_plays` table + `song_play_counts` view |
| Memberships / subscriptions | Neon *(planned)* |
| Payments | Stripe *(planned)* |

Songs are identified by their **Contentful entry ID**. The database never stores audio files — only references to Contentful IDs.

## Premium Access Enforcement

Tier checking happens in `App.tsx`:

```ts
const isPremium = auth.user?.tier === 'premium'
```

This value is passed down to all components that need it. Enforcement points:

1. **`handlePlay`** — filters `memberOnly` songs from the queue; blocks play entirely if the target song is locked. Checks `isPremium || hasPurchased(releaseId)` — the `releaseId` is parsed from the song's `src` URL. This is the primary guard — even if UI buttons are bypassed, playback won't start.
2. **`ReleaseDetail`** — shows lock icon and disables buttons for `memberOnly` tracks; tracks are unlocked if `isPremium || hasPurchasedRelease`
3. **`CollectionDetail`** — blocks the entire collection if `premiumOnly && !isPremium`; also locks individual `memberOnly` tracks within an accessible collection
4. **`LyricsView`** — only reachable from `CollectionDetail`; `App.tsx` guards `setLyricsSong` with a `isPremium || !song.memberOnly` check
5. **`api/plays` stream proxy** — server-side gate; validates JWT, then checks `users.tier = 'premium'` OR an `orders` row for the release. `releaseId` is embedded in the stream URL by `contentful.ts`.

> **Note:** Contentful CDN URLs are public. Client-side enforcement (points 1–4) is the UX layer. The stream proxy (point 5) is server-side enforcement for the audio stream itself — it does not protect album art or metadata.

## Deployment

- **Vercel** hosts both the static frontend and the serverless API
- `api/` directory is auto-detected by Vercel as serverless functions
- Environment variables set in Vercel dashboard (not committed)
- Domain configured via Porkbun DNS → Vercel project

### Required Environment Variables

```
VITE_CONTENTFUL_SPACE_ID=
VITE_CONTENTFUL_ACCESS_TOKEN=
DATABASE_URL=                  # Neon connection string
JWT_SECRET=                    # Strong random string
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ALLOWED_PRICE_IDS=      # Comma-separated list of valid Stripe Price IDs
VITE_STRIPE_PUBLISHABLE_KEY=
BLOB_READ_WRITE_TOKEN=         # Auto-set when a Vercel Blob store is created on the project
RESEND_API_KEY=                # From resend.com — used for purchase confirmation emails
```

## Stripe Architecture (Part 2 — Artist Payouts)

### Account Structure

Noise Emporium lives under the **Jaxsenville Stripe Organization** (`org_xxx`), alongside the other Jaxsenville properties. Each property is its own account (`acct_xxx`) — separate balance, separate payout schedule, separate tax reporting.

```
Jaxsenville Organization (org_xxx)
  ├── Jaxsen Web Services   (acct_xxx)
  ├── Museum of Jaxsen      (acct_xxx)
  ├── Philanthropy Clinic   (acct_xxx)
  └── Noise Emporium        (acct_xxx)  ← platform account for Connect
```

The org provides centralized dashboard management and unified reporting. Connect operates at the account level — artist Express accounts connect to the Noise Emporium `acct_` specifically, not to the org.

### Why Stripe Connect

Royalty splitting requires paying out to multiple third parties. Stripe Connect is the right product for this. Use **Express accounts** for artists — Stripe handles identity verification (KYC), the payout dashboard, and 1099-K tax forms for artists earning $600+/year. You only write the business logic.

**Part 1 (Jaxsen only) does not need Connect.** Revenue flows directly to the Noise Emporium Stripe account. Connect is introduced when outside artists join.

### Payment Flow

```
Subscriber pays ($1/$3/$5/month)
  → Stripe Subscription → lands in platform Stripe account
  
[end of billing period]
  → cron job: aggregate song_plays for all subscribers this month
  → group by artist, calculate each artist's share
  → stripe.transfers.create() → artist's connected Express account
  → artist's Express account pays out to their bank on Stripe's normal schedule
```

This is the **separate charges and transfers** pattern (not destination charges). You collect everything first, then distribute at month end after all payments have settled. This is important — you can't split a subscription charge mid-month.

### Royalty Calculation

For each subscriber each month:
1. Query `song_plays` for that `user_id` in the billing window
2. Group by `artist_id`, count plays per artist
3. `artist_share_fraction = artist_plays / total_plays`
4. `artist_payout = artist_share_fraction × 0.90 × subscription_amount`

Sum each artist's payout across **all subscribers** to get their monthly total, then issue one `stripe.transfers.create()` per artist.

```ts
await stripe.transfers.create({
  amount: Math.round(artistTotalCents),  // Stripe works in cents
  currency: 'usd',
  destination: artist.stripe_account_id,
  description: `Royalties ${year}-${month}`,
});
```

### Key Constraints and Gotchas

**Minimum transfer threshold.** Stripe charges ~$0.25 per transfer regardless of amount. Never transfer less than $1 — accumulate unpaid balance in the `artists` table and only pay out when the threshold is met. An artist with 3 plays across all subscribers in a month might earn $0.04; that should roll over to next month.

**Timing.** Run the cron job after the last subscription invoice for the month has settled (use the `invoice.paid` webhook). Don't calculate from `invoice.payment_succeeded` — cards can still fail after that.

**Cancellations mid-month.** Decide a policy and document it: either prorate (complex) or only count completed billing periods (simpler and standard). Recommended: only pay out for completed periods.

**Stripe Connect fees.** Stripe charges 0.25% + $0.25 per payout to a US bank through Express. Decide whether this comes out of the 10% platform cut or the artist's 90%. Recommended: take it from the platform cut so artists receive exactly their calculated share.

**Chargebacks and refunds.** If a subscriber is refunded after payouts have already been transferred, the platform absorbs that loss. Keep a small buffer in the platform Stripe balance.

**1099-Ks.** With Express accounts, Stripe handles these automatically for artists crossing the $600/year threshold. You do not need to generate tax forms yourself.

### Database Additions Required (Part 2)

```sql
-- Artists (separate from users — an artist may or may not have a user account)
CREATE TABLE artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  stripe_account_id TEXT,
  payout_threshold_cents INT DEFAULT 100,
  unpaid_balance_cents   INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE song_artist_map (
  contentful_song_id TEXT PRIMARY KEY,
  artist_id UUID REFERENCES artists(id)
);

CREATE TABLE monthly_royalties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID REFERENCES artists(id),
  period      DATE NOT NULL,
  plays       INT NOT NULL,
  gross_payout_cents INT NOT NULL,
  transfer_id TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Artist Onboarding Flow

**Phase 1 — Noise Emporium application (you build)**
Artist submits name, email, music links, short bio. Stored in `artists` table with `status = 'pending'`. Jaxsen reviews and approves manually.

**Phase 2 — Stripe Express onboarding (Stripe hosts)**
Once approved:
1. `stripe.accounts.create({ type: 'express' })` → store `acct_xxx` in `artists.stripe_account_id`
2. `stripe.accountLinks.create(...)` → get one-time URL
3. Redirect artist to Stripe for KYC
4. On return, confirm `payouts_enabled: true`

### Stripe Dashboard Login Link

```
Artist clicks button
  → GET /api/artists/stripe-dashboard (authenticated)
  → server calls stripe.accounts.createLoginLink(acct_xxx)
  → returns { url }
  → frontend redirects to url
```

### Stripe Environment Variables

```
STRIPE_SECRET_KEY=              # Required — server-side Stripe API key
STRIPE_WEBHOOK_SECRET=          # Required — from Stripe dashboard webhook settings
VITE_STRIPE_PUBLISHABLE_KEY=    # Required — used client-side (not yet wired; for future Elements use)
STRIPE_CONNECT_CLIENT_ID=       # Future — needed only when Connect onboarding is added
```

---

## Performance Considerations

- **Speed is paramount** for the player — audio should start as fast as possible
- Contentful CDN serves audio files globally
- Neon is on the same region as Vercel functions (co-locate for low latency)
- IndexedDB caching eliminates repeat fetches for downloaded songs
- Contentful data (releases + collections) is fetched once on app load in parallel and held in memory
