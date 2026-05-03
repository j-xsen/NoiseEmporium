# Features

## Accounts

Users authenticate with email + password. JWT tokens are issued on login (30-day expiration).

### Current state
- Registration and login endpoints exist (`api/auth/register.ts`, `api/auth/login.ts`, `api/auth/me.ts`)
- Frontend auth screen exists (`src/components/AuthScreen.tsx`)
- **Restriction:** Currently gated so only Jaxsen can log in (Phase 1 intent)

### Planned
- Open registration for Phase 2
- User profile (display name, avatar)
- Password reset flow

---

## Memberships

### Access Model

**No account required to listen.** Anyone who visits the site can stream songs. What they can hear depends on the song's access setting (controlled per-track in Contentful):

| Situation | What you hear |
|-----------|--------------|
| Unauthenticated or free account | Full stream if artist has marked the song as freely streamable; otherwise a short preview (first ~30s) |
| Premium member | Full stream of everything |

**Account required to download.** Any registered user (free or premium) can download songs via IndexedDB.

### Free Tier
- Create an account — no payment needed
- Full stream of any song the artist has opted into free listening
- Preview (~30s) of songs not opted in
- Can download any freely streamable song
- Full playback features (queue, skip, repeat, etc.)

### Premium Tier
- Full stream of the entire catalog
- Three price points: **$1 / $3 / $5 per month** — same access, higher tiers contribute more to artists
- Revenue split per subscription:
  - **90%** distributed to artists proportionally based on songs listened to that month
  - **10%** goes to Noise Emporium to fund infrastructure and operations

### Per-Track Access Control (Contentful)
Each track in Contentful will have a `freeStream` boolean field (default: `false`):
- `true` → freely streamable for everyone, no account needed
- `false` → full stream for premium members only; everyone else gets a ~30s preview

### Revenue Distribution Logic
Each paid subscription month:
1. Record every song play for the subscriber
2. At billing cycle end, calculate each song's share of total plays
3. Distribute 90% of subscription amount to song owners proportionally
4. Retain 10% for the platform

> Example: A $3/month subscriber listens to 100 songs. Song A played 20 times = 20% share = $0.54 to Song A's artist.

### Not Yet Implemented
- `freeStream` field on Contentful Track content type
- Preview enforcement in the player (truncate playback at ~30s for non-premium non-free-stream songs)
- Auth gate on downloads (currently no check)
- `users.tier` column in schema (added to `schema.sql`; needs to be deployed to Neon)
- Stripe or payment processor integration
- Subscription management UI and webhook to flip `users.tier`
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

### Shareable Playlists
A playlist owner can make their playlist public. This generates a `share_token` (UUID) on the playlist row and produces a shareable URL: `noise.jaxsenville.com/playlist/[token]`. Anyone with the link can view and play the playlist without an account.

**Save to Library:** A logged-in user who visits a shared playlist can "save" it to their library. This creates a row in `liked_playlists` linking their account to the original playlist — it does **not** fork a copy. The liker always sees the owner's current version of the playlist (additions, removals, renames). If the owner deletes or un-publishes the playlist, it disappears from the liker's library.

API surface:
- `PATCH /api/playlists/[id]/share` — owner toggles `is_public`, generates/clears `share_token`
- `GET /api/playlists/share/[token]` — public, no auth required; returns playlist + songs
- `POST /api/playlists/share/[token]/like` — auth required; saves to liker's library
- `DELETE /api/playlists/share/[token]/like` — auth required; removes from liker's library

---

## Navigation

The app has three primary tabs in the bottom navigation bar:

| Tab | Screen | Description |
|-----|---------|-------------|
| **Home** | `HomeScreen` | Featured and recent albums; curated playlists |
| **Library** | `LibraryScreen` | User's liked albums + owned and saved playlists |
| **Now Playing** | `NowPlaying` | Full-screen player |

### Home Screen
Pulls content from Contentful. Shows recent releases and any featured/pinned playlists. Serves as the discovery surface — what a user sees before they've built their own library.

### Library Screen
Replaces the current all-releases view. Two sections:
1. **Albums** — releases the user has explicitly liked (heart button on an album)
2. **Playlists** — playlists the user owns, followed by playlists they've saved from other users

---

## Music Library

All music metadata and audio files are stored in **Contentful CMS**. The database does not store song data — it only stores user-generated data (playlists, play counts, likes).

### Contentful Schema
- **Release** — an album or EP (title, cover image)
  - **Tracks** — ordered list of songs within a release (title, audio file, position)

### Current state (fully implemented)
- `src/lib/contentful.ts` — fetches releases and flattens to track list
- `src/hooks/useSongs.ts` — loads and exposes song list
- `src/components/Library.tsx` — displays song list (currently shows all releases; will become liked albums only)

### Liked Albums
Users can like/unlike a release. Liked releases appear in the Library screen under Albums. Liking is stored in the `liked_albums` table in Neon (keyed by user + Contentful release ID).

API surface:
- `POST /api/albums/[contentfulId]/like`
- `DELETE /api/albums/[contentfulId]/like`
- `GET /api/albums/liked` — returns list of liked Contentful IDs for the current user

### Planned
- **Play count** — track how many times each song has been played (stored in Neon `song_plays`)
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

## Music Store

The store is the **first half of the public launch** and ships before the streaming platform opens. The primary product is physical CDs. The store section is built in **3D using React Three Fiber** — a deliberate visual callback to Jaxsenville's other two fully-3D buildings. The rest of the app stays 2D.

**3D rendering constraints:** Low-poly models and low-resolution textures are used throughout the store to keep performance reasonable across mid-range hardware. This is a hard design constraint, not an afterthought.

The store lets listeners buy physical CDs and download music — all from within the same app. The model is Bandcamp-inspired: downloads are free but buyers can pay more if they want to support the artist.

### Physical CDs
- Browse and purchase physical CD releases
- Orders fulfilled manually (Phase 2) or via a print/ship partner (Phase 3)
- Each CD listing tied to a Contentful release entry (same cover art, tracklist)

### Digital Downloads
- Every release available as a free download
- **Name-your-price** — $0 minimum; buyers can choose to pay more
- Buyer enters an email address to receive the download link (no account required to purchase)
- Payments via Stripe (for paid amounts); free downloads skip payment entirely

### Artist Storefronts (Phase 3)
- When other artists join the platform, they get their own store section
- Artists set their own CD prices and download minimums
- Revenue from store sales goes directly to the artist (minus a small platform fee — TBD)

### Not Yet Implemented
- Store UI
- Stripe Checkout integration for CDs and name-your-price downloads
- Order management and fulfillment tracking
- Artist storefront configuration

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
