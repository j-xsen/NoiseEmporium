# Technical Architecture

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + TypeScript | Vite 8 for bundling |
| Styling | Tailwind CSS v4 | Vite plugin; no component library |
| API | Vercel Serverless Functions | `api/` directory; Express used locally |
| Database | **Neon** (serverless PostgreSQL) | |
| CMS | Contentful | Music metadata + audio file hosting |
| Auth | JWT (jsonwebtoken) | 30-day tokens, localStorage |
| Package manager | pnpm | |

## Frontend Architecture

**No global state manager.** State lives in domain-specific hooks, coordinated by `App.tsx`.

```
src/hooks/
  useAuth.ts        Auth state, token storage, login/logout
  useSongs.ts       Fetch songs from Contentful; source of truth for the library
  usePlaylists.ts   Playlist CRUD; syncs with API
  useAudio.ts       HTML5 audio, queue, playback state
  useDownloads.ts   IndexedDB cache for offline songs
```

`App.tsx` wires these hooks together and passes state down to components. No prop drilling — hooks are called at the top level and relevant slices are passed to child components.

**Tab navigation** (BottomNav): Library → Player → Playlists

**Player layout:**
- Full-screen `NowPlaying` when on Player tab
- `MiniPlayer` bar when on Library or Playlists tab
- Both driven by the same `useAudio` state

## API Architecture

Handlers live in `api/` and are written as Vercel Serverless Functions. Locally, `server.ts` wraps them in Express.

```
api/
  _auth.ts              JWT sign/verify helpers
  _db.ts                Neon database client
  auth/
    register.ts         POST /api/auth/register
    login.ts            POST /api/auth/login
    me.ts               GET  /api/auth/me
  playlists/
    index.ts            GET/POST /api/playlists
    [id].ts             PATCH/DELETE /api/playlists/:id
    [id]/songs/
      songs.ts          POST /api/playlists/:id/songs
      [songId].ts       DELETE /api/playlists/:id/songs/:songId
```

All mutating playlist endpoints verify JWT and ownership (`WHERE user_id = $userId`).

## Authentication Flow

1. User submits email + password
2. `POST /api/auth/login` → bcrypt verify → issue JWT
3. Token stored in `localStorage`
4. On app load: `GET /api/auth/me` with `Authorization: Bearer <token>` → restore session
5. All protected API calls include the Bearer header

## Data Sources

| Data | Where it lives |
|------|---------------|
| Song metadata (title, artist, album, audio URL, cover art) | Contentful CMS |
| Users | Neon `users` table |
| Playlists | Neon `playlists` + `playlist_songs` tables |
| Play counts | Neon `song_plays` table + `song_play_counts` view |
| Memberships / subscriptions | Neon *(planned)* |
| Payments | Stripe *(planned)* |

Songs are identified by their **Contentful entry ID**. The database never stores audio files — only references to Contentful IDs.

## Deployment

- **Vercel** hosts both the static frontend and the serverless API
- `api/` directory is auto-detected by Vercel as serverless functions
- Environment variables set in Vercel dashboard (not committed)
- Domain configured via Porkbun DNS → Vercel project

### Required Environment Variables

```
VITE_CONTENTFUL_SPACE_ID=
VITE_CONTENTFUL_ACCESS_TOKEN=
DATABASE_URL=              # Neon connection string
JWT_SECRET=                # Strong random string
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
  stripe_account_id TEXT,          -- null until Connect onboarding complete
  payout_threshold_cents INT DEFAULT 100,  -- don't transfer below this
  unpaid_balance_cents   INT DEFAULT 0,    -- accumulated below threshold
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Link songs to artists (songs live in Contentful; this is the DB-side attribution)
-- Add artist_id to song_plays or store contentful_song_id → artist_id mapping
CREATE TABLE song_artist_map (
  contentful_song_id TEXT PRIMARY KEY,
  artist_id UUID REFERENCES artists(id)
);

-- Audit trail for royalty calculations
CREATE TABLE monthly_royalties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id   UUID REFERENCES artists(id),
  period      DATE NOT NULL,         -- first day of the billing month
  plays       INT NOT NULL,
  gross_payout_cents INT NOT NULL,
  transfer_id TEXT,                  -- Stripe transfer ID, null if below threshold
  status      TEXT DEFAULT 'pending', -- pending | transferred | rolled_over
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Artist Onboarding Flow

Artist onboarding happens in two phases back to back: your form, then Stripe's.

**Phase 1 — Noise Emporium application (you build)**
Artist submits name, email, music links, short bio via a "Join as an artist" page. Stored in `artists` table with `status = 'pending'`. No Stripe account exists yet. Jaxsen reviews and approves manually (fits the curated Louisville-area scope).

**Phase 2 — Stripe Express onboarding (Stripe hosts)**
Once approved:
1. Call `stripe.accounts.create({ type: 'express' })` → store the returned `acct_xxx` in `artists.stripe_account_id`
2. Call `stripe.accountLinks.create({ account, type: 'account_onboarding', return_url, refresh_url })` → get a one-time URL
3. Redirect artist to that URL — Stripe collects legal name, DOB, address, SSN last 4, and bank account
4. Artist lands back on your `return_url`; call `stripe.accounts.retrieve(acct_xxx)` and confirm `payouts_enabled: true`

Stripe saves progress, so artists can close the tab and return. Regenerate the Account Link (step 2) when they come back — links expire and are single-use.

**After onboarding**, artists have their own Stripe Express dashboard at `dashboard.stripe.com` where Stripe shows them their balance, payout history, bank account settings, and annual 1099s. You do not build any of this.

On Noise Emporium, the artist dashboard should show:
- Play counts and calculated royalty for the current month
- Payout setup status ("Active ✓" or "Complete setup →")
- A "Go to Stripe Dashboard" button (see below)

### Stripe Dashboard Login Link

Artists can be redirected to their Express dashboard with a button. Because the link is single-use and short-lived, it must be generated fresh on each click — never pre-generated or stored.

```
Artist clicks button
  → GET /api/artists/stripe-dashboard (authenticated)
  → server calls stripe.accounts.createLoginLink(acct_xxx)
  → returns { url }
  → frontend redirects to url
```

If the artist has no `stripe_account_id` or `payouts_enabled` is false, show "Complete payout setup" instead, which starts the Account Link onboarding flow rather than the login link flow.

### Stripe Environment Variables (to add)

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CONNECT_CLIENT_ID=     # for Express onboarding OAuth flow
VITE_STRIPE_PUBLISHABLE_KEY=
```

---

## Performance Considerations

- **Speed is paramount** for the player — audio should start as fast as possible
- Contentful CDN serves audio files globally
- Neon is on the same region as Vercel functions (co-locate for low latency)
- IndexedDB caching eliminates repeat fetches for downloaded songs
- Contentful data is fetched once on app load and held in memory
