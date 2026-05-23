// ReleaseDetail.tsx — track list for a single release (album / EP / single).
// Free users see public tracks normally and locked tracks greyed out with a lock icon.
// Premium users see and can play everything.

import { useState, useRef, useEffect } from 'react'
import { CheckIcon, ChevronLeftIcon, DownloadIcon, LockIcon, PlayIcon } from './Icons'
import { formatPrice, releasePrice } from '../utils/format'
import SongTrack from './SongTrack'
import type { DlStatus } from '../hooks/useDownloads'
import type { Release, Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface ReleaseDetailProps {
  release: Release
  player: PlayerAPI
  isPremium: boolean
  hasPurchasedRelease: boolean
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue: Song[]) => void
  onBack: () => void
  onAddToPlaylist: (songId: string) => void
  onDownload: (song: Song) => void
  onDownloadAll: (songs: Song[]) => void
  onRemoveDownload: (songId: string) => void
  onBuyRelease: (contentfulId: string) => void
  onDownloadWav: (contentfulId: string) => void
}

export default function ReleaseDetail({
  release, player, isPremium, hasPurchasedRelease, dlStatuses,
  onPlay, onBack, onAddToPlaylist, onDownload, onDownloadAll, onRemoveDownload,
  onBuyRelease, onDownloadWav,
}: ReleaseDetailProps) {
  const fullPrice = releasePrice(release, false)
  const discountedPrice = releasePrice(release, true)
  const hasDiscount = fullPrice > discountedPrice

  const formattedDate = release.date
    ? new Date(release.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).replace(/(\w+) (\d+), (\d+)/, '$1. $2, $3')
    : null
  const hasFullAccess = isPremium || hasPurchasedRelease
  const locked = release.premiumOnly && !hasFullAccess
  const publicSongs = release.songs.filter(s => !s.memberOnly)
  const memberSongs = release.songs.filter(s => s.memberOnly)
  const playableSongs = hasFullAccess ? release.songs : publicSongs

  const count = release.songs.length
  const totalSeconds = release.songs.reduce((sum, s) => sum + (s.duration ?? 0), 0)
  const durationLabel = (() => {
    if (totalSeconds === 0) return null
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    if (h > 0) return `${h} hr ${m} min ${s} sec`
    return m > 0 ? `${m} min ${s} sec` : `${s} sec`
  })()
  const allDone = playableSongs.length > 0 && playableSongs.every(s => dlStatuses[s.id] === 'done')
  const anyDownloading = playableSongs.some(s => dlStatuses[s.id] === 'downloading')

  const [isScrolled, setIsScrolled] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const transientRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    const el = transientRef.current
    if (!container || !el) return
    function check() {
      setIsScrolled(el!.getBoundingClientRect().bottom <= 0)
    }
    container.addEventListener('scroll', check, { passive: true })
    return () => container.removeEventListener('scroll', check)
  }, [])

  function handleDownloadAll() {
    if (allDone) {
      playableSongs.forEach(s => onRemoveDownload(s.id))
    } else {
      onDownloadAll(playableSongs.filter(s => dlStatuses[s.id] !== 'done'))
    }
  }

  return (
    <div ref={scrollContainerRef} className={`release-detail-ps2${release.cover ? '' : ' release-detail-ps2--no-cover'}`}>
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
          {release.description && (
            <p className="rps2-description">{release.description}</p>
          )}
          <p className="rps2-meta">
            {[formattedDate, `${count} ${count === 1 ? 'track' : 'tracks'}`, durationLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        {!locked && (
          <>
            <div className="rps2-actions-wrapper">
              <div ref={transientRef} className={`rps2-transient-actions${isScrolled ? ' rps2-transient-actions--hidden' : ''}`}>
                {playableSongs.length > 0 && (
                  <button
                    className={`release-hero__dl-all${allDone ? ' release-hero__dl-all--done' : ''}`}
                    onClick={handleDownloadAll}
                    disabled={anyDownloading}
                    aria-label={allDone ? 'Remove all downloads' : anyDownloading ? 'Downloading…' : 'Download all for offline'}
                  >
                    {anyDownloading ? <span className="dl-spinner" /> : allDone ? <CheckIcon size={16} /> : <DownloadIcon size={16} />}
                    <span>{allDone ? 'Downloaded' : anyDownloading ? 'Downloading…' : 'Download All'}</span>
                  </button>
                )}
                {hasPurchasedRelease && (
                  <button
                    className="release-hero__wav-dl"
                    onClick={() => onDownloadWav(release.id)}
                    aria-label="Download WAV ZIP"
                  >
                    <DownloadIcon size={16} />
                    <span>Download WAV</span>
                  </button>
                )}
                {!hasPurchasedRelease && release.downloadFile && (
                  <button
                    className="release-hero__buy"
                    onClick={() => onBuyRelease(release.id)}
                    aria-label="Buy permanent download"
                  >
                    {hasDiscount && <span className="release-hero__buy-was">{formatPrice(fullPrice)}</span>}
                    <span>Buy {formatPrice(discountedPrice)}</span>
                  </button>
                )}
              </div>
              {playableSongs.length > 0 && (
                <div className={`rps2-inline-play${isScrolled ? ' rps2-inline-play--hidden' : ''}`}>
                  <button
                    className="release-hero__play"
                    onClick={() => onPlay(playableSongs[0], playableSongs)}
                    aria-label="Play all"
                  >
                    <PlayIcon size={20} />
                    <span>Play</span>
                  </button>
                </div>
              )}
            </div>
            {playableSongs.length > 0 && (
              <div className={`rps2-header-actions${isScrolled ? ' rps2-header-actions--scrolled' : ''}`}>
                <span className="rps2-sticky-name">{release.name}</span>
                <button
                  className="release-hero__play"
                  onClick={() => onPlay(playableSongs[0], playableSongs)}
                  aria-label="Play all"
                >
                  <PlayIcon size={20} />
                  <span>Play</span>
                </button>
              </div>
            )}
          </>
        )}

        <div className="rps2-tracks-scroll">
          {locked ? (
            <div className="empty-state">
              <div className="empty-icon"><LockIcon size={32} /></div>
              <p className="empty-title">Members Only</p>
              <p className="empty-hint">
                {release.downloadFile
                  ? 'Purchase this release for permanent access, or upgrade to a premium membership.'
                  : 'Upgrade to a premium membership to access this collection.'}
              </p>
              {release.downloadFile && (
                <button
                  className="release-hero__buy"
                  onClick={() => onBuyRelease(release.id)}
                  aria-label="Buy permanent download"
                >
                  {hasDiscount && <span className="release-hero__buy-was">{formatPrice(fullPrice)}</span>}
                  <span>Buy {formatPrice(discountedPrice)}</span>
                </button>
              )}
            </div>
          ) : release.songs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">♪</div>
              <p className="empty-title">No tracks</p>
            </div>
          ) : (
            <ul className="song-track-list">
              {hasFullAccess ? (
                release.songs.map((song, i) => (
                  <SongTrack
                    key={song.id}
                    song={song}
                    displayNum={i + 1}
                    isActive={song.id === player.currentSong?.id}
                    isPlaying={player.isPlaying}
                    locked={false}
                    dlStatus={dlStatuses[song.id] ?? 'none'}
                    onPlay={() => onPlay(song, playableSongs)}
                    onDownload={() => onDownload(song)}
                    onRemoveDownload={() => onRemoveDownload(song.id)}
                    onAddToPlaylist={() => onAddToPlaylist(song.id)}
                  />
                ))
              ) : (
                <>
                  {publicSongs.map((song, i) => (
                    <SongTrack
                      key={song.id}
                      song={song}
                      displayNum={i + 1}
                      isActive={song.id === player.currentSong?.id}
                      isPlaying={player.isPlaying}
                      locked={false}
                      dlStatus={dlStatuses[song.id] ?? 'none'}
                      onPlay={() => onPlay(song, playableSongs)}
                      onDownload={() => onDownload(song)}
                      onRemoveDownload={() => onRemoveDownload(song.id)}
                      onAddToPlaylist={() => onAddToPlaylist(song.id)}
                    />
                  ))}
                  {memberSongs.length > 0 && (
                    <>
                      <li className="song-track-section">
                        <LockIcon size={12} />
                        <span>Members Only</span>
                      </li>
                      {memberSongs.map((song, i) => (
                        <SongTrack
                          key={song.id}
                          song={song}
                          displayNum={publicSongs.length + i + 1}
                          isActive={song.id === player.currentSong?.id}
                          isPlaying={player.isPlaying}
                          locked={false}
                          dlStatus={dlStatuses[song.id] ?? 'none'}
                          onPlay={() => onPlay(song, playableSongs)}
                          onDownload={() => onDownload(song)}
                          onRemoveDownload={() => onRemoveDownload(song.id)}
                          onAddToPlaylist={() => onAddToPlaylist(song.id)}
                        />
                      ))}
                    </>
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
