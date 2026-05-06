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

**Login required to use the app** (Phase 1 gate — will open in Phase 2). Once logged in, what a user can hear depends on the song's access setting controlled per-track in Contentful:

| Situation | What you hear |
|-----------|--------------|
| Free account | Full stream of songs with `memberOnly: false`; locked out of `memberOnly: true` songs |
| Premium member | Full stream of everything |

**Account required to download.** Any registered user (free or premium) can download songs via IndexedDB.

### Free Tier
- Create an account — no payment needed
- Full stream of any song the artist has marked as freely streamable (`memberOnly: false`)
- Songs marked `memberOnly: true` are visible but locked (lock icon, unplayable)
- Full playback features (queue, skip, repeat, etc.)

### Premium Tier
- Full stream of the entire catalog
- Access to all Collections and Collection tracks regardless of `memberOnly`
- Three price points: **$1 / $3 / $5 per month** — same access, higher tiers contribute more to artists
- Revenue split per subscription:
  - **90%** distributed to artists proportionally based on songs listened to that month
  - **10%** goes to Noise Emporium to fund infrastructure and operations

### Per-Track Access Control (Contentful)
Each track in Contentful has a `memberOnly` boolean field (default: `false`):
- `false` → freely streamable for everyone with an account
- `true` → full stream for premium members only; free users see a lock icon and cannot play or view lyrics

The `handlePlay` function in `App.tsx` enforces this client-side — it filters `memberOnly` songs out of the queue for non-premium users and blocks play entirely if the target song itself is locked. Note: Contentful CDN URLs are public; this is UI-level enforcement only. A server-side audio proxy would be needed for hard enforcement.

### Revenue Distribution Logic
Each paid subscription month:
1. Record every song play for the subscriber
2. At billing cycle end, calculate each song's share of total plays
3. Distribute 90% of subscription amount to song owners proportionally
4. Retain 10% for the platform

> Example: A $3/month subscriber listens to 100 songs. Song A played 20 times = 20% share = $0.54 to Song A's artist.

### Not Yet Implemented
- Preview enforcement in the player (truncate playback at ~30s for non-premium non-free-stream songs — current model locks entirely instead of previewing)
- Auth gate on downloads (currently no check)
- Stripe or payment processor integration
- Subscription management UI and webhook to flip `users.tier`
- Play-weighted revenue calculation
- Artist payout system

---

## Collections

Collections are curator-defined playlists stored in Contentful (not in the database). They differ from user playlists in that they are editorially curated, can carry their own cover art and description, and have a `premiumOnly` gate at the collection level.

### Contentful content type: `collection`

| Field | Field ID | Type | Notes |
|-------|----------|------|-------|
| Title | `title` | Short text | Display field |
| Description | `description` | Short text | Optional subtitle |
| Cover Image | `coverImage` | Media | Optional square cover art |
| Premium Only | `premiumOnly` | Boolean | Default true; gates the entire collection |
| Tracks | `tracks` | References, many | Links to Song entries |

Track order within a collection is controlled by dragging in Contentful's editor. The `pos` field on Song entries is ignored for collections — it only matters for ordering tracks within a Release.

### Access rules
- If `premiumOnly: true` and user is not premium → collection card shows a lock badge; opening it shows a paywall message; no tracks visible
- If `premiumOnly: false` → all users can open the collection; individual tracks respect their own `memberOnly` flag
- Tracks within a collection that have `memberOnly: true` show a lock icon for non-premium users (same as in releases), and clicking them does nothing

### Lyrics page
Clicking any unlocked track in a collection opens a **Lyrics page** (`src/components/LyricsView.tsx`) that:
- Auto-starts playback of that song when it loads
- Shows the song's `lyrics` field content (see Song content type below)
- Has a play/pause button below the cover art
- Shows "No lyrics" placeholder if the field is empty

### Current state (fully implemented)
- `fetchCollections()` in `src/lib/contentful.ts`
- Collections returned alongside releases from `useSongs` hook
- `src/components/CollectionDetail.tsx` — track list with per-track premium gating
- `src/components/LyricsView.tsx` — lyrics page with autoplay
- Collections appear in the "Featured" section on the Home screen

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

### Featured Playlists
Any playlist can be pinned to the Home screen by setting `featured = true` in the database. There is no admin UI yet — use a direct SQL update:

```sql
UPDATE playlists SET featured = true, featured_order = 1 WHERE id = '...';
```

`featured_order` controls sort order within the Featured section (ascending, nulls last). Featured playlists appear alongside Collections in the "Featured" section on the Home screen. They are fetched via `GET /api/playlists/featured` (public, no auth required) and managed by `src/hooks/useFeaturedPlaylists.ts`.

When viewing a featured playlist, the rename button is hidden if the logged-in user does not own it.

### Planned
- Playlist cover art (auto-generated or user-set)
- Admin UI for managing featured playlists
- Collaborative playlists (Phase 3)

### Shareable Playlists
A playlist owner can make their playlist public. This generates a `share_token` (UUID) on the playlist row and produces a shareable URL: `noise.jaxsenville.com/playlist/[token]`. Anyone with the link can view and play the playlist without an account.

**Save to Library:** A logged-in user who visits a shared playlist can "save" it to their library. This creates a row in `liked_playlists` linking their account to the original playlist — it does **not** fork a copy. The liker always sees the owner's current version of the playlist (additions, removals, renames). If the owner deletes or un-publishes the playlist, it disappears from the liker's library.

API surface (planned):
- `PATCH /api/playlists/[id]/share` — owner toggles `is_public`, generates/clears `share_token`
- `GET /api/playlists/share/[token]` — public, no auth required; returns playlist + songs
- `POST /api/playlists/share/[token]/like` — auth required; saves to liker's library
- `DELETE /api/playlists/share/[token]/like` — auth required; removes from liker's library

---

## Navigation

The app has three primary tabs in the bottom navigation bar:

| Tab | Screen | Description |
|-----|---------|-------------|
| **Home** | `Library.tsx` | Releases grid + Featured section (collections + featured playlists) |
| **Library** | `Playlists.tsx` | User's owned playlists |
| **Now Playing** | `NowPlaying.tsx` | Full-screen player |

### Home Screen (current implementation)
Implemented in `src/components/Library.tsx` (name is legacy — it serves as the Home screen). Shows:
1. **Releases** — all Contentful releases in reverse-chronological order
2. **Featured** — collections and featured playlists in a shared grid (only shown if either exists)

Navigation depth from Home:
- Home → Release → `ReleaseDetail`
- Home → Collection → `CollectionDetail` → Song → `LyricsView`
- Home → Featured Playlist → `PlaylistDetail`

Sign-out button is in the Home screen header (top right).

### Planned Home Screen Evolution
The current home screen shows all releases. Long-term, it should show only featured/recent content and serve as the discovery surface. When multiple artists join, artist pages will be the primary navigation layer — the home screen should only show hand-curated featured content, not every collection from every artist.

### Library Screen
Currently shows user-owned playlists only. Planned evolution:
1. **Albums** — releases the user has explicitly liked
2. **Playlists** — owned playlists, followed by saved playlists from other users

---

## Music Library

All music metadata and audio files are stored in **Contentful CMS**. The database does not store song data — it only stores user-generated data (playlists, play counts, likes).

### Contentful Schema

**Release** (content type: `release`)
- `name` — Short text (display field)
- `date` — Date
- `cover` — Media (shared cover art for all tracks in the release)
- `spotify` — Short text (optional Spotify link)
- `tracks` — References, many → Song entries (ordered by `pos` field)

**Song** (content type: `song`)
- `pos` — Integer (sort order within release; ignored for collections)
- `name` — Short text (display field)
- `file` — Media (audio file)
- `memberOnly` — Boolean (if true, only premium members can stream or view lyrics)
- `lyrics` — Long text (optional; line breaks preserved in the lyrics view)

**Collection** (content type: `collection`) — see Collections section above

### Current state (fully implemented)
- `src/lib/contentful.ts` — `fetchReleases()` and `fetchCollections()`
- `src/hooks/useSongs.ts` — loads releases, flattened song list, and collections; exposes all three
- `src/components/Library.tsx` — home screen rendering releases and featured content
- `src/components/ReleaseDetail.tsx` — release track list with per-track premium gating
- `src/components/CollectionDetail.tsx` — collection track list with per-track premium gating
- `src/components/LyricsView.tsx` — song lyrics page with autoplay

### Liked Albums
Users can like/unlike a release. Liked releases appear in the Library screen under Albums. Liking is stored in the `liked_albums` table in Neon (keyed by user + Contentful release ID).

API surface (planned):
- `POST /api/albums/[contentfulId]/like`
- `DELETE /api/albums/[contentfulId]/like`
- `GET /api/albums/liked` — returns list of liked Contentful IDs for the current user

### Planned
- **Play count** — track how many times each song has been played (stored in Neon `song_plays`)
- Play count display on song cards
- "Most played" sort/filter
- Artist pages (when multi-artist platform opens) — critical for scaling beyond one artist without flooding the home screen

---

## Music Player

The player is the core UX — it should feel as close to the Spotify desktop/mobile app as possible, but running in a browser tab.

### Current state (fully implemented)
- HTML5 `<audio>` element managed by `src/hooks/useAudio.ts`
- Play / pause
- Skip next / previous
- Seek scrubber with current time + total duration
- Loop modes: off / repeat-one / repeat-all
- Volume control — `volume` and `setVolume` exposed on `PlayerAPI`; persists within session
- Auto-advance to next song in queue
- Queue management (play from library or playlist context)
- Lock-screen / notification controls via Media Session API (iOS/Android)
- Full-screen Now Playing view (`src/components/NowPlaying.tsx`)
- Mini player bar at bottom when on other tabs (`src/components/MiniPlayer.tsx`)
  - Toggleable volume slider: tap the volume icon to swap title/artist area for a slider; tap again to collapse
- Cover art with gradient fallback (`src/components/CoverArt.tsx`)

### Planned
- Shuffle mode
- "Add to queue" action
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
