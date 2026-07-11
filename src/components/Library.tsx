// Library.tsx — home screen showing releases, singles, collections, and playlists.
//
// Releases are split by releaseType: albums/EPs render as art cards; singles
// render as a compact list so they don't take up full card real estate.

import { memo, useEffect, useState } from 'react'
import CoverArt from './CoverArt'
import AccountArea from './AccountArea'
import { ChevronDownIcon, LockIcon } from './Icons'
import { contentfulImageUrl } from '../lib/contentful'
import type { Playlist, Release, Song } from '../types'

function useSectionOpen(key: string, defaultOpen = true) {
  const lsKey = `noise-section-${key}`
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(lsKey)
    return stored === null ? defaultOpen : stored === 'true'
  })
  const toggle = () => setOpen(v => {
    localStorage.setItem(lsKey, String(!v))
    return !v
  })
  return [open, toggle] as const
}

interface LibraryProps {
  releases: Release[]
  featuredPlaylists: Playlist[]
  isPremium: boolean
  userEmail: string
  currentSongId: string | undefined
  onSelectRelease: (id: string) => void
  onSelectFeaturedPlaylist: (id: string) => void
  onOpenAccount: () => void
  onSignIn?: () => void
}

function Library({
  releases, featuredPlaylists, isPremium, userEmail, currentSongId,
  onSelectRelease, onSelectFeaturedPlaylist, onOpenAccount, onSignIn,
}: LibraryProps) {
  const albums      = releases.filter(r => r.releaseType === 'album' || r.releaseType === 'ep')
  const singles     = releases.filter(r => r.releaseType === 'single')
  const collections = releases.filter(r => r.releaseType === 'collection')

  const [releasesOpen, toggleReleases]    = useSectionOpen('releases')
  const [singlesOpen, toggleSingles]      = useSectionOpen('singles')
  const [collectionsOpen, toggleCollections] = useSectionOpen('collections')

  useEffect(() => {
    if (window.location.hash === '#collections') {
      document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const hasFeatured = collections.length > 0 || featuredPlaylists.length > 0
  const hasMultipleSections = (albums.length > 0 ? 1 : 0) + (singles.length > 0 ? 1 : 0) + (hasFeatured ? 1 : 0) > 1

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Home</h1>
        </div>
        {userEmail
          ? <AccountArea email={userEmail} onClick={onOpenAccount} />
          : <button className="sign-in-btn" onClick={onSignIn}>Sign In</button>
        }
      </div>

      <div className="scroll-area">
        {releases.length === 0 && !hasFeatured ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No releases yet</p>
            <p className="empty-hint">Add releases to your Contentful space</p>
          </div>
        ) : (
          <>
            {/* ── Albums & EPs ── */}
            {albums.length > 0 && (
              <section className={hasMultipleSections ? 'home-section' : undefined}>
                {hasMultipleSections && (
                  <h2 className="home-section__title">
                    <button className="home-section__toggle" onClick={toggleReleases} aria-expanded={releasesOpen}>
                      Releases
                      <ChevronDownIcon size={14} className={releasesOpen ? undefined : 'section-chevron--collapsed'} />
                    </button>
                  </h2>
                )}
                <div className={`home-section__body${releasesOpen ? '' : ' home-section__body--collapsed'}`}>
                  <ul className="music-grid">
                    {albums.map(release => {
                      const year = release.date ? new Date(release.date).getFullYear() : null
                      const count = release.songs.length
                      const isActive = release.songs.some(s => s.id === currentSongId)
                      return (
                        <li key={release.id} className={`music-card ${isActive ? 'music-card--active' : ''}`}>
                          <button className="music-card__select" onClick={() => onSelectRelease(release.id)}>
                            <div className="music-card__art-wrap">
                              <CoverArt song={release.songs[0] ?? ({ cover: release.cover } as Song)} className="music-card__art" />
                            </div>
                            <div className="music-card__info">
                              <span className="music-card__name">{release.name}</span>
                              <span className="music-card__meta">
                                {release.releaseType === 'ep' ? 'EP · ' : ''}{year}{year ? ' · ' : ''}{count} {count === 1 ? 'track' : 'tracks'}
                              </span>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            )}

            {/* ── Singles ── */}
            {singles.length > 0 && (
              <section className="home-section">
                <h2 className="home-section__title">
                  <button className="home-section__toggle" onClick={toggleSingles} aria-expanded={singlesOpen}>
                    Singles
                    <ChevronDownIcon size={14} className={singlesOpen ? undefined : 'section-chevron--collapsed'} />
                  </button>
                </h2>
                <div className={`home-section__body${singlesOpen ? '' : ' home-section__body--collapsed'}`}>
                  <ul className="music-grid">
                    {singles.map(release => {
                      const year = release.date ? new Date(release.date).getFullYear() : null
                      const isActive = release.songs.some(s => s.id === currentSongId)
                      return (
                        <li key={release.id} className={`music-card ${isActive ? 'music-card--active' : ''}`}>
                          <button className="music-card__select" onClick={() => onSelectRelease(release.id)}>
                            <div className="music-card__art-wrap">
                              <CoverArt song={release.songs[0] ?? ({ cover: release.cover } as Song)} className="music-card__art" />
                            </div>
                            <div className="music-card__info">
                              <span className="music-card__name">{release.name}</span>
                              <span className="music-card__meta">Single{year ? ` · ${year}` : ''}</span>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            )}

            {/* ── Collections & playlists ── */}
            {hasFeatured && (
              <section id="collections" className="home-section">
                <h2 className="home-section__title">
                  <button className="home-section__toggle" onClick={toggleCollections} aria-expanded={collectionsOpen}>
                    Collections
                    <ChevronDownIcon size={14} className={collectionsOpen ? undefined : 'section-chevron--collapsed'} />
                  </button>
                </h2>
                <div className={`home-section__body${collectionsOpen ? '' : ' home-section__body--collapsed'}`}>
                  <ul className="music-grid">
                    {collections.map(r => {
                      const locked = r.premiumOnly && !isPremium
                      const freeCount = r.songs.filter(s => !s.memberOnly).length
                      const showFullStats = isPremium || r.name === 'Unreleased'
                      const collectionMeta = locked
                        ? 'Members only'
                        : showFullStats
                          ? `${r.songs.length} ${r.songs.length === 1 ? 'track' : 'tracks'}`
                          : freeCount > 0
                            ? `${freeCount} free ${freeCount === 1 ? 'track' : 'tracks'}`
                            : ''
                      return (
                        <li key={r.id} className="music-card">
                          <button className="music-card__select" onClick={() => onSelectRelease(r.id)}>
                            <div className="music-card__art-wrap">
                              {r.cover
                                ? <img
                                    src={contentfulImageUrl(r.cover, 300)}
                                    alt={r.name}
                                    className="music-card__art"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                : <CoverArt song={{ id: r.id, title: r.name, src: '' }} className="music-card__art" />
                              }
                              {locked && (
                                <div className="music-card__lock">
                                  <LockIcon size={14} />
                                </div>
                              )}
                            </div>
                            <div className="music-card__info">
                              <span className="music-card__name">{r.name}</span>
                              <span className="music-card__meta">{collectionMeta}</span>
                            </div>
                          </button>
                        </li>
                      )
                    })}

                    {featuredPlaylists.map(playlist => (
                      <li key={playlist.id} className="music-card">
                        <button className="music-card__select" onClick={() => onSelectFeaturedPlaylist(playlist.id)}>
                          <div className="music-card__art-wrap">
                            <CoverArt song={{ id: playlist.id, title: playlist.name, src: '' }} className="music-card__art" />
                          </div>
                          <div className="music-card__info">
                            <span className="music-card__name">{playlist.name}</span>
                            <span className="music-card__meta">
                              {playlist.songIds.length} {playlist.songIds.length === 1 ? 'song' : 'songs'}
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default memo(Library)
