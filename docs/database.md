# Database

## Provider: Neon

Noise Emporium uses **Neon** (serverless PostgreSQL). The client lives in `api/_db.ts` using `@neondatabase/serverless`.

Neon is chosen for:
- Serverless-native — scales to zero between requests, fits Vercel's function model
- Standard PostgreSQL — no proprietary APIs
- Generous free tier

## Current Schema (`schema.sql`)

```sql
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  tier          TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  stripe_customer_id TEXT,

  CONSTRAINT users_email_lower        CHECK (email = lower(email)),
  CONSTRAINT users_email_unique       UNIQUE (email),
  CONSTRAINT users_tier_valid         CHECK (tier IN ('free', 'premium')),
  CONSTRAINT users_stripe_cust_unique UNIQUE (stripe_customer_id)
);

CREATE TABLE playlists (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  featured       BOOLEAN     NOT NULL DEFAULT false,
  featured_order INTEGER,                            -- sort order in home Featured section
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT playlists_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX playlists_user_id_idx ON playlists (user_id);

CREATE TABLE playlist_songs (
  playlist_id UUID    NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT    NOT NULL,   -- Contentful entry ID
  position    INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (playlist_id, song_id),
  CONSTRAINT playlist_songs_position_nonneg CHECK (position >= 0)
);

CREATE INDEX playlist_songs_playlist_id_idx ON playlist_songs (playlist_id);

CREATE TABLE song_plays (
  id        BIGSERIAL   PRIMARY KEY,
  user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  song_id   TEXT        NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX song_plays_song_id_idx   ON song_plays (song_id);
CREATE INDEX song_plays_user_id_idx   ON song_plays (user_id);
CREATE INDEX song_plays_played_at_idx ON song_plays (played_at);

CREATE VIEW song_play_counts AS
  SELECT song_id, COUNT(*) AS play_count
  FROM song_plays
  GROUP BY song_id;
```

```sql
-- ─── Permanent download purchases ────────────────────────────────────────────

-- One row per completed purchase. UNIQUE on stripe_session_id makes INSERT ... ON CONFLICT DO NOTHING
-- safe to call from both the webhook and the fulfill redirect (whichever fires first wins).
-- Purchasability is validated against Contentful (downloadUrl field) at checkout time — no separate
-- release_assets table is needed.
CREATE TABLE orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_id     TEXT        NOT NULL,   -- Contentful release entry ID
  stripe_session_id TEXT        NOT NULL UNIQUE,
  amount_total      INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, contentful_id)
);

CREATE INDEX orders_user_id_idx ON orders (user_id);
```

### To activate a release for purchase

1. Upload the WAV ZIP to Vercel Blob as a **private** blob:
   ```
   npx vercel blob put releases/<contentful_id>/wav.zip ./your-album-wav.zip
   ```
2. Copy the resulting Blob URL into the `downloadUrl` Short text field on the Contentful release entry.
3. Optionally set `price` / `memberPrice` Integer fields (cents) on the entry to override default pricing.
4. That's it — the Buy button appears automatically on the release detail page.

### Migrations applied (run these on an existing database)

```sql
-- Add featured playlist support
ALTER TABLE playlists
  ADD COLUMN featured       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN featured_order INTEGER;
```

```sql
-- Add stripe_customer_id for subscription downgrade lookups
ALTER TABLE users
  ADD COLUMN stripe_customer_id TEXT,
  ADD CONSTRAINT users_stripe_cust_unique UNIQUE (stripe_customer_id);
```

```sql
-- Add permanent download purchase table
CREATE TABLE orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_id     TEXT        NOT NULL,
  stripe_session_id TEXT        NOT NULL UNIQUE,
  amount_total      INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, contentful_id)
);

CREATE INDEX orders_user_id_idx ON orders (user_id);
```

### Featuring a playlist (no admin UI yet)

```sql
-- Feature a playlist on the home screen
UPDATE playlists SET featured = true, featured_order = 1 WHERE id = '<uuid>';

-- Un-feature
UPDATE playlists SET featured = false, featured_order = NULL WHERE id = '<uuid>';
```

---

## Planned Schema Additions

### Shareable playlists + liked albums
```sql
-- Add to playlists table
ALTER TABLE playlists
  ADD COLUMN share_token UUID UNIQUE DEFAULT NULL,  -- null = private
  ADD COLUMN is_public   BOOLEAN NOT NULL DEFAULT false;

-- Albums a user has liked (Contentful release ID, not a DB record)
CREATE TABLE liked_albums (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contentful_id  TEXT NOT NULL,   -- Contentful release entry ID
  liked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contentful_id)
);

-- Playlists a user has saved from another owner (linked, not forked)
CREATE TABLE liked_playlists (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  playlist_id  UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, playlist_id)
);
```

Notes:
- `share_token` is generated on demand when an owner makes a playlist public; cleared when set back to private
- `liked_playlists` rows reference the original playlist — deletions or un-publishing cascade automatically via the foreign key
- `liked_albums.contentful_id` mirrors the Contentful entry ID used throughout the app; no separate albums table is needed

### Memberships (billing detail)
The authoritative tier is `users.tier`. This table holds Stripe billing detail and is updated
by webhooks, which then flip `users.tier` accordingly.

```sql
CREATE TABLE memberships (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  monthly_amount_cents   INTEGER NOT NULL,      -- 100, 300, or 500
  stripe_subscription_id TEXT,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  renewed_at             TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ           -- when set, webhook sets users.tier = 'free'
);
```

### Music Store (future — CD orders and name-your-price downloads)
The `orders` table (already created above) covers permanent download purchases. When CD sales and name-your-price guest downloads are implemented, a separate `cd_orders` table and a guest download flow will be needed — those don't require a user account and have different fulfillment logic (physical shipping vs. single-use email link).

### Revenue distribution (future)
```sql
CREATE TABLE revenue_distributions (
  id             BIGSERIAL PRIMARY KEY,
  membership_id  UUID REFERENCES memberships(id),
  billing_period DATE NOT NULL,
  song_id        TEXT NOT NULL,
  play_share     NUMERIC(6,5),
  amount_cents   INTEGER NOT NULL,
  distributed_at TIMESTAMPTZ
);
```
