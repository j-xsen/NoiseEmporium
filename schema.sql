-- Noise Emporium — full schema
-- Run in the Neon SQL editor on a fresh database.

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_email_lower CHECK (email = lower(email)),
  CONSTRAINT users_email_unique UNIQUE (email)
);

-- ─── Playlists ────────────────────────────────────────────────────────────────

CREATE TABLE playlists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

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
