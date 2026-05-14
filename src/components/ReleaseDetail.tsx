// ReleaseDetail.tsx — track list for a single release (album / EP / single).
// Free users see public tracks normally and locked tracks greyed out with a lock icon.
// Premium users see and can play everything.

import { CheckIcon, ChevronLeftIcon, LockIcon, MoreIcon, PlayIcon } from './Icons'
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
  onAddToPlaylist: (songId: string) => void
}

export default function ReleaseDetail({
  release, player, isPremium, dlStatuses,
  onPlay, onBack, onAddToPlaylist,
}: ReleaseDetailProps) {
  const formattedDate = release.date
    ? new Date(release.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).replace(/(\w+) (\d+), (\d+)/, '$1. $2, $3')
    : null
  const publicSongs = release.songs.filter(s => !s.memberOnly)
  const memberSongs = release.songs.filter(s => s.memberOnly)
  // Queue passed to onPlay excludes locked tracks for free users so auto-advance skips them.
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
            {dlStatuses[song.id] === 'done' && <CheckIcon size={13} className="song-track__dl-check" />}
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
  }

  const count = release.songs.length

  return (
    <div className={`release-detail-ps2${release.cover ? '' : ' release-detail-ps2--no-cover'}`}>
      {release.cover && (
        <div className="rps2-bg" style={{ backgroundImage: `url(${release.cover})` }} />
      )}
      <button className="rps2-back" onClick={onBack} aria-label="Back">
        <ChevronLeftIcon size={22} />
      </button>

      {release.cover && (
        <div className="rps2-cover-col">
          <img src={release.cover} alt={release.name} className="rps2-cover" />
        </div>
      )}

      <div className="rps2-info-col">
        <div className="rps2-header">
          <h1 className="rps2-title">{release.name}</h1>
          <p className="rps2-meta">
            {[formattedDate, `${count} ${count === 1 ? 'track' : 'tracks'}`].filter(Boolean).join(' · ')}
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

        <div className="rps2-tracks-scroll">
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
    </div>
  )
}
