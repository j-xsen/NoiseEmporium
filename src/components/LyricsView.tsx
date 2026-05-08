// LyricsView.tsx — full-screen lyrics page for a single song.
//
// Rendered as a tab-independent overlay in App.tsx (no tab === check), so it
// can be opened from any screen. Navigating back just clears lyricsSong state.
//
// Auto-starts playback on mount if the song isn't already the active track,
// so tapping "Lyrics" from the meatball menu also starts the song.
//
// lyrics is HTML from Contentful's rich-text field. dangerouslySetInnerHTML is
// safe here because Contentful is a trusted internal CMS, not user input.

import { useEffect } from 'react'
import { ChevronLeftIcon, PlayIcon, PauseIcon } from './Icons'
import CoverArt from './CoverArt'
import type { Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface LyricsViewProps {
  song: Song
  player: PlayerAPI
  onBack: () => void
  onPlay: (song: Song) => void
}

export default function LyricsView({ song, player, onBack, onPlay }: LyricsViewProps) {
  const isActive = player.currentSong?.id === song.id
  const isPlaying = isActive && player.isPlaying

  // Auto-play when the view opens for a song that isn't already loaded.
  useEffect(() => {
    if (!isActive) onPlay(song)
  }, [song.id])

  return (
    <div className="screen-layout">
      <div className="screen-header screen-header--with-back">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen-header__center">
          <h1 className="screen-title">{song.title}</h1>
          {song.album && <span className="screen-subtitle">{song.album}</span>}
        </div>
        <div className="header-action-placeholder" />
      </div>

      <div className="scroll-area">
        <div className="lyrics-hero">
          <CoverArt song={song} className="lyrics-hero__art" />
        </div>

        <div className="lyrics-controls">
          <button
            className="lyrics-play-btn"
            onClick={() => isPlaying ? player.togglePlay() : onPlay(song)}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
          </button>
        </div>

        {song.lyrics ? (
          <div className="lyrics-body" dangerouslySetInnerHTML={{ __html: song.lyrics }} />
        ) : (
          <div className="empty-state">
            <p className="empty-title">No lyrics</p>
            <p className="empty-hint">Add a lyrics field to this song in Contentful</p>
          </div>
        )}
      </div>
    </div>
  )
}
