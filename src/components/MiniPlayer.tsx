import { useState, useRef, useEffect } from 'react'
import CoverArt from './CoverArt'
import { PlayIcon, PauseIcon, VolumeIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { Song } from '../types'

interface MiniPlayerProps {
  song: Song
  isPlaying: boolean
  progress: number
  volume: number
  onToggle: () => void
  onExpand: () => void
  onVolumeChange: (v: number) => void
}

export default function MiniPlayer({ song, isPlaying, progress, volume, onToggle, onExpand, onVolumeChange }: MiniPlayerProps) {
  const [volumeOpen, setVolumeOpen] = useState(false)
  const volBtnRef = useRef<HTMLButtonElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!volumeOpen) return
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (!volBtnRef.current?.contains(target) && !sliderRef.current?.contains(target)) {
        setVolumeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [volumeOpen])

  return (
    <div className="mini-player" onClick={onExpand}>
      <div className="mini-player__progress" style={{ width: `${progress * 100}%` }} />
      <CoverArt song={song} size={42} className="mini-player__art" />

      {volumeOpen ? (
        <input
          ref={sliderRef}
          className="mini-player__volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          onClick={e => e.stopPropagation()}
          style={{ '--vol': `${volume * 100}%` } as React.CSSProperties}
          aria-label="Volume"
        />
      ) : (
        <div className="mini-player__info">
          <span className="mini-player__title">{song.title}</span>
          {songSubtitle(song) && <span className="mini-player__artist">{songSubtitle(song)}</span>}
        </div>
      )}

      <button
        ref={volBtnRef}
        className="mini-player__vol-btn"
        onClick={e => { e.stopPropagation(); setVolumeOpen(v => !v) }}
        aria-label="Volume"
      >
        <VolumeIcon size={18} />
      </button>
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
