import { CheckIcon, ChevronLeftIcon, DownloadIcon, LockIcon, MoreIcon, PlayIcon, RetryIcon } from './Icons'
import { formatTime, songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Collection, Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface CollectionDetailProps {
  collection: Collection
  player: PlayerAPI
  isPremium: boolean
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue: Song[]) => void
  onBack: () => void
  onAddToPlaylist: (songId: string) => void
  onDownload: (song: Song) => void
  onRemoveDownload: (songId: string) => void
}

export default function CollectionDetail({
  collection, player, isPremium, dlStatuses,
  onPlay, onBack, onAddToPlaylist, onDownload, onRemoveDownload,
}: CollectionDetailProps) {
  const locked = collection.premiumOnly && !isPremium
  const downloadableTracks = collection.tracks.filter(s => !s.memberOnly || isPremium)
  const allDone = downloadableTracks.length > 0 && downloadableTracks.every(s => dlStatuses[s.id] === 'done')
  const anyDownloading = downloadableTracks.some(s => dlStatuses[s.id] === 'downloading')

  function handleDownloadAll() {
    if (allDone) {
      downloadableTracks.forEach(s => onRemoveDownload(s.id))
    } else {
      downloadableTracks.filter(s => dlStatuses[s.id] !== 'done').forEach(s => onDownload(s))
    }
  }

  return (
    <div className={`release-detail-ps2${collection.cover ? '' : ' release-detail-ps2--no-cover'}`}>
      {collection.cover && (
        <div className="rps2-bg" style={{ backgroundImage: `url(${collection.cover})` }} />
      )}
      <button className="rps2-back" onClick={onBack} aria-label="Back">
        <ChevronLeftIcon size={22} />
      </button>

      {collection.cover && (
        <div className="rps2-cover-col">
          <img src={collection.cover} alt={collection.title} className="rps2-cover" />
        </div>
      )}

      <div className="rps2-info-col">
        <div className="rps2-header">
          <h1 className="rps2-title">{collection.title}</h1>
          {!locked && (
            <p className="rps2-meta">
              {collection.tracks.length} {collection.tracks.length === 1 ? 'track' : 'tracks'}
            </p>
          )}
          {!locked && collection.tracks.length > 0 && (
            <div className="rps2-header-actions">
              <button
                className="release-hero__play"
                onClick={() => onPlay(collection.tracks[0], collection.tracks)}
                aria-label="Play all"
              >
                <PlayIcon size={20} />
                <span>Play</span>
              </button>
              <button
                className={`release-hero__dl-all${allDone ? ' release-hero__dl-all--done' : ''}`}
                onClick={handleDownloadAll}
                disabled={anyDownloading}
                aria-label={allDone ? 'Remove all downloads' : anyDownloading ? 'Downloading…' : 'Download all for offline'}
              >
                {anyDownloading ? <span className="dl-spinner" /> : allDone ? <CheckIcon size={16} /> : <DownloadIcon size={16} />}
                <span>{allDone ? 'Downloaded' : anyDownloading ? 'Downloading…' : 'Download All'}</span>
              </button>
            </div>
          )}
          {collection.description && !locked && (
            <p className="rps2-description">{collection.description}</p>
          )}
        </div>

        <div className="rps2-tracks-scroll">
          {locked ? (
            <div className="empty-state">
              <div className="empty-icon"><LockIcon size={32} /></div>
              <p className="empty-title">Members Only</p>
              <p className="empty-hint">Upgrade to a premium membership to access this collection.</p>
            </div>
          ) : collection.tracks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">♪</div>
              <p className="empty-title">No tracks yet</p>
            </div>
          ) : (
            <ul className="song-track-list">
              {collection.tracks.map((song, i) => {
                const isActive = song.id === player.currentSong?.id
                const trackLocked = song.memberOnly && !isPremium
                const dlStatus = dlStatuses[song.id] ?? 'none'
                return (
                  <li key={song.id} className={`song-track ${isActive ? 'song-track--active' : ''} ${trackLocked ? 'song-track--locked' : ''}`}>
                    <button className="song-track__main" onClick={() => !trackLocked && onPlay(song, collection.tracks)} disabled={trackLocked}>
                      <span className="song-track__num">
                        {trackLocked
                          ? <LockIcon size={13} />
                          : isActive && player.isPlaying
                            ? <span className="song-row__bars"><span /><span /><span /></span>
                            : i + 1
                        }
                      </span>
                      <div className="song-track__info">
                        <span className="song-track__title">{song.title}</span>
                        {songSubtitle(song) && <span className="song-track__subtitle">{songSubtitle(song)}</span>}
                      </div>
                    </button>
                    {!trackLocked && (
                      <div className="song-track__actions">
                        {song.duration != null && (
                          <span className="song-track__duration">{formatTime(song.duration)}</span>
                        )}
                        <button
                          className={`song-track__dl-btn song-track__dl-btn--${dlStatus}`}
                          onClick={e => {
                            e.stopPropagation()
                            if (dlStatus === 'done') onRemoveDownload(song.id)
                            else if (dlStatus !== 'downloading') onDownload(song)
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
                          onClick={e => { e.stopPropagation(); onAddToPlaylist(song.id) }}
                          aria-label="More options"
                        >
                          <MoreIcon size={16} />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
