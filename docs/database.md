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
  -- bcrypt embeds a random salt inside the hash value; no separate salt column is needed
  password_hash TEXT        NOT NULL,
  tier          TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_lower  CHECK (email = lower(email)),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_tier_valid   CHECK (tier IN ('free', 'premium'))
);

CREATE TABLE playlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_songs (
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL,  -- Contentful entry ID
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE song_plays (
  id        BIGSERIAL PRIMARY KEY,
  user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  song_id   TEXT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE VIEW song_play_counts AS
  SELECT song_id, COUNT(*) AS play_count
  FROM song_plays
  GROUP BY song_id;
```

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

### Music Store (future)
```sql
-- A purchasable item: either a physical CD or a digital download
CREATE TYPE product_type AS ENUM ('cd', 'download');

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contentful_id   TEXT NOT NULL,     -- links to a Contentful release entry
  type            product_type NOT NULL,
  title           TEXT NOT NULL,
  price_cents     INTEGER NOT NULL DEFAULT 0,  -- base price; 0 = free/name-your-price
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES users(id) ON DELETE SET NULL,  -- null = guest
  buyer_email            TEXT NOT NULL,
  product_id             UUID NOT NULL REFERENCES products(id),
  amount_cents           INTEGER NOT NULL DEFAULT 0,   -- actual amount paid (>= price_cents)
  stripe_payment_intent  TEXT,                         -- null for free downloads
  status                 TEXT NOT NULL DEFAULT 'pending',  -- pending | complete | refunded
  download_token         TEXT,                         -- signed token for download link
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at           TIMESTAMPTZ
);
```

### Revenue distribution (future)
```sql
CREATE TABLE revenue_distributions (
  id             BIGSERIAL PRIMARY KEY,
  membership_id  UUID REFERENCES memberships(id),
  billing_period DATE NOT NULL,        -- first day of the month
  song_id        TEXT NOT NULL,
  play_share     NUMERIC(6,5),         -- fraction of plays (0.0–1.0)
  amount_cents   INTEGER NOT NULL,     -- artist payout in cents
  distributed_at TIMESTAMPTZ
);
```
