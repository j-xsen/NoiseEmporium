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
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
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

### Memberships
```sql
CREATE TYPE membership_tier AS ENUM ('free', 'paid');

CREATE TABLE memberships (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tier                   membership_tier NOT NULL DEFAULT 'free',
  monthly_amount         NUMERIC(5,2),         -- 1.00, 3.00, or 5.00
  stripe_subscription_id TEXT,
  started_at             TIMESTAMPTZ DEFAULT NOW(),
  renewed_at             TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ
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
