import { CheckIcon, DownloadIcon, LockIcon, MoreIcon, RetryIcon } from './Icons'
import { formatTime, songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Song } from '../types'

interface SongTrackProps {
  song: Song
  displayNum: number
  isActive: boolean
  isPlaying: boolean
  locked?: boolean
  dlStatus: DlStatus
  onPlay: () => void
  onDownload: () => void
  onRemoveDownload: () => void
  onAddToPlaylist: () => void
}

export default function SongTrack({
  song, displayNum, isActive, isPlaying, locked = false,
  dlStatus, onPlay, onDownload, onRemoveDownload, onAddToPlaylist,
}: SongTrackProps) {
  return (
    <li className={`song-track${isActive ? ' song-track--active' : ''}${locked ? ' song-track--locked' : ''}`}>
      <button className="song-track__main" onClick={() => !locked && onPlay()} disabled={locked}>
        <span className="song-track__num">
          {locked
            ? <LockIcon size={13} />
            : isActive && isPlaying
              ? <span className="song-row__bars"><span /><span /><span /></span>
              : displayNum
          }
        </span>
        <div className="song-track__info">
          <span className="song-track__title">{song.title}</span>
          {songSubtitle(song) && <span className="song-track__subtitle">{songSubtitle(song)}</span>}
        </div>
      </button>
      {!locked && (
        <div className="song-track__actions">
          {song.duration != null && (
            <span className="song-track__duration">{formatTime(song.duration)}</span>
          )}
          <button
            className={`song-track__dl-btn song-track__dl-btn--${dlStatus}`}
            onClick={e => {
              e.stopPropagation()
              if (dlStatus === 'done') onRemoveDownload()
              else if (dlStatus !== 'downloading') onDownload()
            }}
            aria-label={dlStatus === 'done' ? 'Remove download' : dlStatus === 'downloading' ? 'Downloading…' : 'Download for offline'}
          >
            {dlStatus === 'downloading' && <span className="dl-spinner" />}
            {dlStatus === 'done' && <CheckIcon size={14} />}
            {dlStatus === 'error' && <RetryIcon size={14} />}
            {dlStatus === 'none' && <DownloadIcon size={14} />}
          </button>
          <button
            className="song-track__more"
            onClick={e => { e.stopPropagation(); onAddToPlaylist() }}
            aria-label="More options"
          >
            <MoreIcon size={16} />
          </button>
        </div>
      )}
    </li>
  )
}
