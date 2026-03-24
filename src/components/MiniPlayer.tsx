import CoverArt from './CoverArt'
import { PlayIcon, PauseIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { Song } from '../types'

interface MiniPlayerProps {
  song: Song
  isPlaying: boolean
  progress: number
  onToggle: () => void
  onExpand: () => void
}

export default function MiniPlayer({ song, isPlaying, progress, onToggle, onExpand }: MiniPlayerProps) {
  return (
    <div className="mini-player" onClick={onExpand}>
      <div className="mini-player__progress" style={{ width: `${progress * 100}%` }} />
      <CoverArt song={song} size={42} className="mini-player__art" />
      <div className="mini-player__info">
        <span className="mini-player__title">{song.title}</span>
        {songSubtitle(song) && <span className="mini-player__artist">{songSubtitle(song)}</span>}
      </div>
      <button
        className="mini-player__toggle"
        onClick={e => { e.stopPropagation(); onToggle() }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>
    </div>
  )
}
