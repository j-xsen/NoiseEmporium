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
| Play counts | Neon `song_plays` table *(planned)* |
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

## Performance Considerations

- **Speed is paramount** for the player — audio should start as fast as possible
- Contentful CDN serves audio files globally
- Neon is on the same region as Vercel functions (co-locate for low latency)
- IndexedDB caching eliminates repeat fetches for downloaded songs
- Contentful data is fetched once on app load and held in memory
