# Features

## Accounts

Users authenticate with email + password. JWT tokens are issued on login (30-day expiration).

### Current state
- Registration and login endpoints exist (`api/auth/register.ts`, `api/auth/login.ts`, `api/auth/me.ts`)
- Frontend auth screen exists (`src/components/AuthScreen.tsx`)
- **Bug:** Login currently errors — needs investigation
- **Restriction:** Currently gated so only Jaxsen can log in (Phase 1 intent)

### Planned
- Open registration for Phase 2
- User profile (display name, avatar)
- Password reset flow

---

## Memberships

The membership model is the economic backbone of the platform.

### Free Tier
- Access to **Jaxsen's music only**
- No subscription required — just create an account
- Full playback features (queue, shuffle, repeat, etc.)

### Paid Tier
- Access to the **full catalog**, including Louisville artists Jaxsen has invited to the platform
- Three price points: **$1 / $3 / $5 per month**
  - All tiers unlock the same catalog; higher tiers contribute more to artists
- Revenue split per subscription:
  - **90%** distributed to artists proportionally based on songs listened to that month
  - **10%** goes to Noise Emporium to fund infrastructure and operations

### Revenue Distribution Logic
Each paid subscription month:
1. Record every song play for the subscriber
2. At billing cycle end, calculate each song's share of total plays
3. Distribute 90% of subscription amount to song owners proportionally
4. Retain 10% for the platform

> Example: A $3/month subscriber listens to 100 songs. Song A played 20 times = 20% share = $0.54 to Song A's artist.

### Not Yet Implemented
- Stripe or payment processor integration
- Subscription management UI
- Play-weighted revenue calculation
- Artist payout system

---

## Playlists

Users can create named playlists and add/remove songs.

### Current state (fully implemented)
- List playlists (`api/playlists/index.ts`)
- Create playlist
- Rename playlist
- Delete playlist
- Add song to playlist (`api/playlists/[id]/songs/songs.ts`)
- Remove song from playlist (`api/playlists/[id]/songs/[songId].ts`)
- View playlist and play all songs in it
- Frontend: `src/components/Playlists.tsx`, `src/components/PlaylistDetail.tsx`
- Hook: `src/hooks/usePlaylists.ts`

### Planned
- Playlist cover art (auto-generated or user-set)
- Collaborative playlists (Phase 3)
- Public/shareable playlists

---

## Music Library

All music metadata and audio files are stored in **Contentful CMS**. The database does not store song data — it only stores user-generated data (playlists, play counts).

### Contentful Schema
- **Release** — an album or EP (title, cover image)
  - **Tracks** — ordered list of songs within a release (title, audio file, position)

### Current state (fully implemented)
- `src/lib/contentful.ts` — fetches releases and flattens to track list
- `src/hooks/useSongs.ts` — loads and exposes song list
- `src/components/Library.tsx` — displays song list

### Planned
- **Play count** — track how many times each song has been played (stored in Supabase)
- Play count display on song cards
- "Most played" sort/filter
- Artist pages (when multi-artist platform opens)

---

## Music Player

The player is the core UX — it should feel as close to the Spotify desktop/mobile app as possible, but running in a browser tab.

### Current state (fully implemented)
- HTML5 `<audio>` element managed by `src/hooks/useAudio.ts`
- Play / pause
- Skip next / previous
- Seek scrubber with current time + total duration
- Loop modes: off / repeat-one / repeat-all
- Auto-advance to next song in queue
- Queue management (play from library or playlist context)
- Lock-screen / notification controls via Media Session API (iOS/Android)
- Full-screen Now Playing view (`src/components/NowPlaying.tsx`)
- Mini player bar at bottom when on other tabs (`src/components/MiniPlayer.tsx`)
- Cover art with gradient fallback (`src/components/CoverArt.tsx`)

### Planned
- Shuffle mode
- "Add to queue" action
- Volume control
- Playback speed control (stretch goal)
- Cross-fade between tracks (stretch goal)

---

## Offline / Downloads

Songs can be downloaded to the browser's IndexedDB for offline playback.

### Current state (fully implemented)
- `src/hooks/useDownloads.ts` — download, cache, remove
- Downloads persist across sessions
- Player falls back to HTTP if not cached
- `src/components/DownloadButton.tsx`

### Future consideration
- This feature may be re-evaluated once the membership model is active (licensing implications)
