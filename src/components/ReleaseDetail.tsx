import DownloadButton from './DownloadButton'
import { ChevronLeftIcon, LockIcon, MoreIcon, PlayIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Release, Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface ReleaseDetailProps {
  release: Release
  player: PlayerAPI
  isPremium: boolean
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue: Song[]) => void
  onBack: () => void
  onDownload: (song: Song) => void
  onRemoveDownload: (id: string) => void
  onAddToPlaylist: (songId: string) => void
}

export default function ReleaseDetail({
  release, player, isPremium, dlStatuses,
  onPlay, onBack, onDownload, onRemoveDownload, onAddToPlaylist,
}: ReleaseDetailProps) {
  const year = release.date ? new Date(release.date).getFullYear() : null
  const publicSongs = release.songs.filter(s => !s.memberOnly)
  const memberSongs = release.songs.filter(s => s.memberOnly)
  // Queue for "play all" only includes songs the user can actually play
  const playableSongs = isPremium ? release.songs : publicSongs

  function renderTrack(song: Song, displayNum: number, locked: boolean) {
    const isActive = song.id === player.currentSong?.id
    return (
      <li key={song.id} className={`song-track ${isActive ? 'song-track--active' : ''} ${locked ? 'song-track--locked' : ''}`}>
        <button
          className="song-track__main"
          onClick={() => !locked && onPlay(song, playableSongs)}
          disabled={locked}
        >
          <span className="song-track__num">
            {locked
              ? <LockIcon size={13} />
              : isActive && player.isPlaying
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
        )}
      </li>
    )
  }

  const count = release.songs.length

  return (
    <div className="screen-layout">
      <div className="screen-header screen-header--with-back">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen-header__center" />
        <div className="header-action-placeholder" />
      </div>

      <div className="scroll-area">
        <div className="release-hero">
          {release.cover && (
            <img src={release.cover} alt={release.name} className="release-hero__img" />
          )}
          <h1 className="release-hero__name">{release.name}</h1>
          <p className="release-hero__meta">
            {[year, `${count} ${count === 1 ? 'track' : 'tracks'}`].filter(Boolean).join(' · ')}
          </p>
          {playableSongs.length > 0 && (
            <button
              className="release-hero__play"
              onClick={() => onPlay(playableSongs[0], playableSongs)}
              aria-label="Play all"
            >
              <PlayIcon size={20} />
              <span>Play</span>
            </button>
          )}
        </div>

        {release.songs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No tracks</p>
          </div>
        ) : (
          <ul className="song-track-list">
            {publicSongs.map((song, i) => renderTrack(song, i + 1, false))}

            {memberSongs.length > 0 && (
              <>
                <li className="song-track-section">
                  <LockIcon size={12} />
                  <span>Members Only</span>
                </li>
                {memberSongs.map((song, i) =>
                  renderTrack(song, publicSongs.length + i + 1, !isPremium)
                )}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
