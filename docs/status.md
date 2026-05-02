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

## Known Bugs

### Login Error
**Symptom:** Attempting to log in results in an error. The auth screen renders but the login/register flow fails.

**Likely causes to investigate:**
- `DATABASE_URL` environment variable not set or pointing to a stale Neon instance
- `JWT_SECRET` not set in the environment
- API endpoint returning a non-2xx response the frontend doesn't handle gracefully
- CORS or proxy misconfiguration in local dev

**Files to check:**
- `api/auth/login.ts`
- `api/_db.ts` — is the DB connection valid?
- `.env` — are `DATABASE_URL` and `JWT_SECRET` present?
- `src/hooks/useAuth.ts` — how does it handle error responses?
- `src/components/AuthScreen.tsx` — does it surface the error to the user?

## Immediate Next Steps

1. **Fix login** — diagnose and resolve the auth error
2. **Implement play count tracking** — record plays in `song_plays` table, display on song cards
4. **Decide on domain** — `noise.jaxsenville.com` vs `emporium.jaxsenville.com`
5. **Deploy to Vercel** — set env vars, connect domain

## Planned Work (Prioritized)

### Phase 1 — Foundation
- [ ] Fix login bug
- [ ] Deploy to Vercel with domain

### Phase 2 — Open to Users
- [ ] Play count recording + display
- [ ] Open registration (remove single-user gate)
- [ ] Free tier: Jaxsen's music only
- [ ] Membership UI (free vs paid)
- [ ] Stripe integration for paid memberships

### Phase 3 — Artist Platform
- [ ] Invite Louisville artists to the platform
- [ ] Artist onboarding flow
- [ ] Revenue distribution calculations
- [ ] Artist payout dashboard
- [ ] Shuffle mode
- [ ] "Add to queue" action

## Architecture Decisions Pending

- **`noise.jaxsenville.com` vs `emporium.jaxsenville.com`** — either works; subdomains are free on Porkbun
- **`@neondatabase/serverless` vs raw `pg`** — current Neon client is fine; no reason to change
- **Contentful vs self-hosted audio** — Contentful CDN is fast and free at current scale; revisit if catalog grows significantly
