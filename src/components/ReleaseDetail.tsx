import DownloadButton from './DownloadButton'
import { ChevronLeftIcon, MoreIcon, PlayIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Release, Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface ReleaseDetailProps {
  release: Release
  player: PlayerAPI
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue: Song[]) => void
  onBack: () => void
  onDownload: (song: Song) => void
  onRemoveDownload: (id: string) => void
  onAddToPlaylist: (songId: string) => void
}

export default function ReleaseDetail({
  release, player, dlStatuses,
  onPlay, onBack, onDownload, onRemoveDownload, onAddToPlaylist,
}: ReleaseDetailProps) {
  const year = release.date ? new Date(release.date).getFullYear() : null

  return (
    <div className="screen-layout">
      <div className="screen-header screen-header--with-back">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen-header__center">
          <h1 className="screen-title">{release.name}</h1>
          <span className="screen-subtitle">
            {year && `${year} · `}{release.songs.length} {release.songs.length === 1 ? 'track' : 'tracks'}
          </span>
        </div>
        {release.songs.length > 0 && (
          <button
            className="header-action"
            onClick={() => onPlay(release.songs[0], release.songs)}
            aria-label="Play all"
          >
            <PlayIcon size={18} />
          </button>
        )}
      </div>

      <div className="scroll-area">
        {release.cover && (
          <div className="release-hero">
            <img src={release.cover} alt={release.name} className="release-hero__img" />
            {release.spotify && (
              <a
                href={release.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="release-hero__spotify"
              >
                Open on Spotify
              </a>
            )}
          </div>
        )}

        {release.songs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No tracks</p>
          </div>
        ) : (
          <ul className="song-track-list">
            {release.songs.map((song, i) => {
              const isActive = song.id === player.currentSong?.id
              return (
                <li key={song.id} className={`song-track ${isActive ? 'song-track--active' : ''}`}>
                  <button className="song-track__main" onClick={() => onPlay(song, release.songs)}>
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
                      aria-label="Add to playlist"
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
