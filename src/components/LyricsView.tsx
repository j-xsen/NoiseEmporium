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
        <button
          className="header-action"
          onClick={() => isPlaying ? player.togglePlay() : onPlay(song)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
      </div>

      <div className="scroll-area">
        <div className="lyrics-hero">
          <CoverArt song={song} className="lyrics-hero__art" />
        </div>

        {song.lyrics ? (
          <div className="lyrics-body">
            {song.lyrics.split('\n').map((line, i) =>
              line.trim() === ''
                ? <div key={i} className="lyrics-gap" />
                : <p key={i} className="lyrics-line">{line}</p>
            )}
          </div>
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
