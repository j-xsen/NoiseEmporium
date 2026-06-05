-- Noise Emporium — full schema
-- Run in the Neon SQL editor on a fresh database.

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  -- bcrypt hash already embeds a per-user random salt; no separate salt column needed
  password_hash TEXT        NOT NULL,
  tier          TEXT        NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  stripe_customer_id TEXT,

  email_verified                BOOLEAN     NOT NULL DEFAULT false,
  email_verification_token      TEXT,
  email_verification_expires_at TIMESTAMPTZ,

  CONSTRAINT users_email_lower       CHECK (email = lower(email)),
  CONSTRAINT users_email_unique      UNIQUE (email),
  CONSTRAINT users_tier_valid        CHECK (tier IN ('free', 'premium')),
  CONSTRAINT users_stripe_cust_unique UNIQUE (stripe_customer_id)
);

-- ─── Playlists ────────────────────────────────────────────────────────────────

CREATE TABLE playlists (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  featured       BOOLEAN     NOT NULL DEFAULT false,
  featured_order INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT playlists_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX playlists_user_id_idx ON playlists (user_id);

-- ─── Playlist songs ───────────────────────────────────────────────────────────

CREATE TABLE playlist_songs (
  playlist_id UUID    NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id     TEXT    NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (playlist_id, song_id),
  CONSTRAINT playlist_songs_position_nonneg CHECK (position >= 0)
);

CREATE INDEX playlist_songs_playlist_id_idx ON playlist_songs (playlist_id);

-- ─── Song plays ───────────────────────────────────────────────────────────────

CREATE TABLE song_plays (
  id        BIGSERIAL   PRIMARY KEY,
  user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  song_id   TEXT        NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX song_plays_song_id_idx   ON song_plays (song_id);
CREATE INDEX song_plays_user_id_idx   ON song_plays (user_id);
CREATE INDEX song_plays_played_at_idx ON song_plays (played_at);

-- Aggregate view for display (total plays per song)
CREATE VIEW song_play_counts AS
  SELECT song_id, COUNT(*) AS play_count
  FROM song_plays
  GROUP BY song_id;

-- ─── Permanent download purchases ────────────────────────────────────────────

-- One row per completed purchase. UNIQUE on stripe_session_id makes INSERT ... ON CONFLICT DO NOTHING
-- safe to call from both the webhook and the fulfill redirect (whichever fires first wins).
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

-- ─── Instrumental license purchases ──────────────────────────────────────────

-- One row per completed license purchase. ON CONFLICT DO NOTHING handles
-- duplicate webhook/redirect deliveries safely.
CREATE TABLE instrumental_licenses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id           TEXT        NOT NULL,        -- Contentful song entry ID
  song_title        TEXT        NOT NULL,
  stripe_session_id TEXT        NOT NULL UNIQUE,
  amount_total      INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, song_id)
);

CREATE INDEX instrumental_licenses_user_id_idx ON instrumental_licenses (user_id);

-- ─── Physical CD purchases ────────────────────────────────────────────────────

-- UNIQUE(cd_id) enforces the one-sale-per-CD inventory limit at the DB level.
-- ON CONFLICT DO NOTHING in the fulfill path handles duplicate webhook/redirect deliveries safely.
CREATE TABLE cd_orders (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cd_id             TEXT        NOT NULL UNIQUE,  -- shopData product ID
  stripe_session_id TEXT        NOT NULL UNIQUE,
  amount_total      INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX cd_orders_user_id_idx ON cd_orders (user_id);
