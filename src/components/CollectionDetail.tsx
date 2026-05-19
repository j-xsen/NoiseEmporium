import { CheckIcon, ChevronLeftIcon, DownloadIcon, LockIcon, PlayIcon } from './Icons'
import { formatTime } from '../utils/format'
import SongTrack from './SongTrack'
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
  onDownloadAll: (songs: Song[]) => void
  onRemoveDownload: (songId: string) => void
}

export default function CollectionDetail({
  collection, player, isPremium, dlStatuses,
  onPlay, onBack, onAddToPlaylist, onDownload, onDownloadAll, onRemoveDownload,
}: CollectionDetailProps) {
  const locked = collection.premiumOnly && !isPremium
  const downloadableTracks = collection.tracks.filter(s => !s.memberOnly || isPremium)
  const allDone = downloadableTracks.length > 0 && downloadableTracks.every(s => dlStatuses[s.id] === 'done')
  const anyDownloading = downloadableTracks.some(s => dlStatuses[s.id] === 'downloading')

  function handleDownloadAll() {
    if (allDone) {
      downloadableTracks.forEach(s => onRemoveDownload(s.id))
    } else {
      onDownloadAll(downloadableTracks.filter(s => dlStatuses[s.id] !== 'done'))
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
          {collection.description && (
            <p className="rps2-description">{collection.description}</p>
          )}
          {!locked && (
            <p className="rps2-meta">
              {collection.tracks.length} {collection.tracks.length === 1 ? 'track' : 'tracks'}
              {(() => {
                const total = collection.tracks.reduce((sum, s) => sum + (s.duration ?? 0), 0)
                return total > 0 ? ` · ${formatTime(total)}` : ''
              })()}
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
              {collection.tracks.map((song, i) => (
                <SongTrack
                  key={song.id}
                  song={song}
                  displayNum={i + 1}
                  isActive={song.id === player.currentSong?.id}
                  isPlaying={player.isPlaying}
                  locked={song.memberOnly && !isPremium}
                  dlStatus={dlStatuses[song.id] ?? 'none'}
                  onPlay={() => onPlay(song, collection.tracks)}
                  onDownload={() => onDownload(song)}
                  onRemoveDownload={() => onRemoveDownload(song.id)}
                  onAddToPlaylist={() => onAddToPlaylist(song.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
