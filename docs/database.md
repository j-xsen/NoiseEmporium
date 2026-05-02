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
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlists (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE playlist_songs (
  playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT NOT NULL,  -- Contentful entry ID
  position    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, song_id)
);
```

## Planned Schema Additions

### Play counts
```sql
CREATE TABLE song_plays (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  song_id     TEXT NOT NULL,           -- Contentful entry ID
  played_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate view for display
CREATE VIEW song_play_counts AS
  SELECT song_id, COUNT(*) AS play_count
  FROM song_plays
  GROUP BY song_id;
```

### Memberships
```sql
CREATE TYPE membership_tier AS ENUM ('free', 'paid');

CREATE TABLE memberships (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tier            membership_tier NOT NULL DEFAULT 'free',
  monthly_amount  NUMERIC(5,2),         -- 1.00, 3.00, or 5.00
  stripe_subscription_id TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  renewed_at      TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ
);
```

### Revenue distribution (future)
```sql
CREATE TABLE revenue_distributions (
  id              BIGSERIAL PRIMARY KEY,
  membership_id   INTEGER REFERENCES memberships(id),
  billing_period  DATE NOT NULL,        -- first day of the month
  song_id         TEXT NOT NULL,
  play_share      NUMERIC(6,5),         -- fraction of plays (0.0–1.0)
  amount_cents    INTEGER NOT NULL,     -- artist payout in cents
  distributed_at  TIMESTAMPTZ
);
```
