// NowPlaying.tsx — full-screen player shown on the "player" tab.
//
// onViewLyrics is only passed from App.tsx when the current song has a lyrics
// field; the button is hidden otherwise. Tapping it sets lyricsSong in App,
// which renders LyricsView as an overlay on top of this screen.

import CoverArt from './CoverArt'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, LoopIcon } from './Icons'
import { formatTime, songSubtitle } from '../utils/format'
import type { PlayerAPI } from '../hooks/useAudio'

interface NowPlayingProps {
  player: PlayerAPI
  onViewLyrics?: () => void
}

const loopLabel: Record<string, string> = { off: 'Off', one: '1×', all: 'All' }

export default function NowPlaying({ player, onViewLyrics }: NowPlayingProps) {
  const { currentSong, isPlaying, currentTime, duration, loopMode } = player
  const progress = duration > 0 ? currentTime / duration : 0

  if (!currentSong) {
    return (
      <div className="now-playing now-playing--empty">
        <div className="np-empty-icon">♪</div>
        <p className="np-empty-text">Nothing playing</p>
        <p className="np-empty-hint">Pick a song from the library</p>
      </div>
    )
  }

  return (
    <div className="now-playing">
      <div className="np-art-wrap">
        <CoverArt song={currentSong} className="np-art" />
      </div>

      <div className="np-meta">
        {songSubtitle(currentSong) && <p className="np-artist">{songSubtitle(currentSong)}</p>}
        <h2 className="np-title">{currentSong.title}</h2>
      </div>

      <div className="np-progress-wrap">
        <input
          type="range"
          className="np-scrubber"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={e => player.seek(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--accent) ${progress * 100}%, var(--border) ${progress * 100}%)`
          }}
        />
        <div className="np-times">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="np-controls">
        <button className="np-btn np-btn--skip" onClick={player.skipPrev} aria-label="Previous">
          <SkipBackIcon size={28} />
        </button>
        <button className="np-btn np-btn--play" onClick={player.togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
        </button>
        <button className="np-btn np-btn--skip" onClick={player.skipNext} aria-label="Next">
          <SkipForwardIcon size={28} />
        </button>
      </div>

      <div className="np-volume-wrap">
        <input
          type="range"
          className="np-volume"
          min={0}
          max={1}
          step={0.01}
          value={player.volume}
          onChange={e => player.setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          style={{
            background: `linear-gradient(to right, var(--text-dim) ${player.volume * 100}%, var(--border) ${player.volume * 100}%)`
          }}
        />
      </div>

      <button
        className={`np-loop ${loopMode !== 'off' ? 'np-loop--active' : ''}`}
        onClick={player.cycleLoop}
        aria-label={`Loop: ${loopMode}`}
      >
        <LoopIcon size={18} />
        <span>{loopLabel[loopMode]}</span>
      </button>

      {onViewLyrics && (
        <button className="np-lyrics-btn" onClick={onViewLyrics}>
          Lyrics
        </button>
      )}
    </div>
  )
}
