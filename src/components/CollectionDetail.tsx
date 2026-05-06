import DownloadButton from './DownloadButton'
import { ChevronLeftIcon, LockIcon, MoreIcon, PlayIcon } from './Icons'
import { songSubtitle } from '../utils/format'
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
  onDownload: (song: Song) => void
  onRemoveDownload: (id: string) => void
  onAddToPlaylist: (songId: string) => void
}

export default function CollectionDetail({
  collection, player, isPremium, dlStatuses,
  onPlay, onBack, onDownload, onRemoveDownload, onAddToPlaylist,
}: CollectionDetailProps) {
  const locked = collection.premiumOnly && !isPremium

  return (
    <div className="screen-layout">
      <div className="screen-header screen-header--with-back">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen-header__center">
          <h1 className="screen-title">{collection.title}</h1>
          {!locked && (
            <span className="screen-subtitle">
              {collection.tracks.length} {collection.tracks.length === 1 ? 'track' : 'tracks'}
            </span>
          )}
        </div>
        {!locked && collection.tracks.length > 0 && (
          <button
            className="header-action"
            onClick={() => onPlay(collection.tracks[0], collection.tracks)}
            aria-label="Play all"
          >
            <PlayIcon size={18} />
          </button>
        )}
      </div>

      <div className="scroll-area">
        {collection.cover && (
          <div className="release-hero">
            <img src={collection.cover} alt={collection.title} className="release-hero__img" />
          </div>
        )}

        {collection.description && !locked && (
          <p className="collection-description">{collection.description}</p>
        )}

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
              return (
                <li key={song.id} className={`song-track ${isActive ? 'song-track--active' : ''}`}>
                  <button className="song-track__main" onClick={() => onPlay(song, collection.tracks)}>
                    <span className="song-track__num">
                      {isActive && player.isPlaying
                        ? <span className="song-row__bars"><span /><span /><span /></span>
                        : i + 1
                      }
                    </span>
                    <div className="song-track__info">
                      <span className="song-track__title">{song.title}</span>
                      {songSubtitle(song) && <span className="song-track__subtitle">{songSubtitle(song)}</span>}
                    </div>
                  </button>
                  <div className="song-track__actions">
                    <DownloadButton
                      song={song}
                      status={dlStatuses[song.id] ?? 'none'}
                      onDownload={onDownload}
                      onRemove={onRemoveDownload}
                    />
                    <button
                      className="song-track__more"
                      onClick={e => { e.stopPropagation(); onAddToPlaylist(song.id) }}
                      aria-label="More options"
                    >
                      <MoreIcon size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
