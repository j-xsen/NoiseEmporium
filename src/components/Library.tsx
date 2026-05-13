// Library.tsx — home screen showing releases, singles, collections, and playlists.
//
// Releases are split by releaseType: albums/EPs render as art cards; singles
// render as a compact list so they don't take up full card real estate.

import { useEffect } from 'react'
import CoverArt from './CoverArt'
import { LockIcon } from './Icons'
import type { Collection, Playlist, Release, Song } from '../types'

interface LibraryProps {
  releases: Release[]
  collections: Collection[]
  featuredPlaylists: Playlist[]
  isPremium: boolean
  userEmail: string
  currentSongId: string | undefined
  onSelectRelease: (id: string) => void
  onSelectCollection: (id: string) => void
  onSelectFeaturedPlaylist: (id: string) => void
  onOpenAccount: () => void
}

export default function Library({
  releases, collections, featuredPlaylists, isPremium, userEmail, currentSongId,
  onSelectRelease, onSelectCollection, onSelectFeaturedPlaylist, onOpenAccount,
}: LibraryProps) {
  const albums  = releases.filter(r => r.releaseType !== 'single')
  const singles = releases.filter(r => r.releaseType === 'single')

  useEffect(() => {
    if (window.location.hash === '#collections') {
      document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const hasCollections = collections.length > 0 || featuredPlaylists.length > 0
  const hasMultipleSections = (albums.length > 0 ? 1 : 0) + (singles.length > 0 ? 1 : 0) + (hasCollections ? 1 : 0) > 1

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Home</h1>
        </div>
        <button className="account-trigger" onClick={onOpenAccount} aria-label="Account settings">
          <span className="signout-email">{userEmail}</span>
        </button>
      </div>

      <div className="scroll-area">
        {releases.length === 0 && !hasCollections ? (
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
                {hasMultipleSections && <h2 className="home-section__title">Releases</h2>}
                <ul className="release-grid">
                  {albums.map(release => {
                    const year = release.date ? new Date(release.date).getFullYear() : null
                    const count = release.songs.length
                    const isActive = release.songs.some(s => s.id === currentSongId)
                    return (
                      <li key={release.id} className={`release-card ${isActive ? 'release-card--active' : ''}`}>
                        <button className="release-card__select" onClick={() => onSelectRelease(release.id)}>
                          <div className="release-card__art-wrap">
                            <CoverArt song={release.songs[0] ?? ({ cover: release.cover } as Song)} className="release-card__art" />
                          </div>
                          <div className="release-card__info">
                            <span className="release-card__name">{release.name}</span>
                            <span className="release-card__meta">
                              {release.releaseType === 'ep' ? 'EP · ' : ''}{year}{year ? ' · ' : ''}{count} {count === 1 ? 'track' : 'tracks'}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* ── Singles ── */}
            {singles.length > 0 && (
              <section className="home-section">
                <h2 className="home-section__title">Singles</h2>
                <ul className="singles-list">
                  {singles.map(release => {
                    const year = release.date ? new Date(release.date).getFullYear() : null
                    const isActive = release.songs.some(s => s.id === currentSongId)
                    return (
                      <li key={release.id} className={`single-row ${isActive ? 'single-row--active' : ''}`}>
                        <button className="single-row__btn" onClick={() => onSelectRelease(release.id)}>
                          <div className="single-row__art-wrap">
                            <CoverArt song={release.songs[0] ?? ({ cover: release.cover } as Song)} className="single-row__art" />
                          </div>
                          <span className="single-row__name">{release.name}</span>
                          {year && <span className="single-row__year">{year}</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* ── Collections & playlists ── */}
            {hasCollections && (
              <section id="collections" className="home-section">
                <h2 className="home-section__title">Collections</h2>
                <ul className="release-grid">
                  {collections.map(collection => {
                    const locked = collection.premiumOnly && !isPremium
                    return (
                      <li key={collection.id} className="release-card">
                        <button className="release-card__select" onClick={() => onSelectCollection(collection.id)}>
                          <div className="release-card__art-wrap">
                            {collection.cover
                              ? <img src={collection.cover} alt={collection.title} className="release-card__art" />
                              : <CoverArt song={{ id: collection.id, title: collection.title, src: '' }} className="release-card__art" />
                            }
                            {locked && (
                              <div className="release-card__lock">
                                <LockIcon size={14} />
                              </div>
                            )}
                          </div>
                          <div className="release-card__info">
                            <span className="release-card__name">{collection.title}</span>
                            <span className="release-card__meta">
                              {locked ? 'Members only' : `${collection.tracks.length} ${collection.tracks.length === 1 ? 'track' : 'tracks'}`}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}

                  {featuredPlaylists.map(playlist => (
                    <li key={playlist.id} className="release-card">
                      <button className="release-card__select" onClick={() => onSelectFeaturedPlaylist(playlist.id)}>
                        <div className="release-card__art-wrap">
                          <CoverArt song={{ id: playlist.id, title: playlist.name, src: '' }} className="release-card__art" />
                        </div>
                        <div className="release-card__info">
                          <span className="release-card__name">{playlist.name}</span>
                          <span className="release-card__meta">
                            {playlist.songIds.length} {playlist.songIds.length === 1 ? 'song' : 'songs'}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
