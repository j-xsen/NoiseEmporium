import CoverArt from './CoverArt'
import { LockIcon } from './Icons'
import type { Collection, Release, Song } from '../types'

interface LibraryProps {
  releases: Release[]
  collections: Collection[]
  isPremium: boolean
  currentSongId: string | undefined
  onSelectRelease: (id: string) => void
  onSelectCollection: (id: string) => void
  onLogout: () => void
}

export default function Library({ releases, collections, isPremium, currentSongId, onSelectRelease, onSelectCollection, onLogout }: LibraryProps) {
  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Home</h1>
          <span className="screen-subtitle">{releases.length} {releases.length === 1 ? 'release' : 'releases'}</span>
        </div>
        <button className="signout-btn" onClick={onLogout}>Sign out</button>
      </div>

      <div className="scroll-area">
        {collections.length > 0 && (
          <section className="home-section">
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
            </ul>
          </section>
        )}

        {releases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No releases yet</p>
            <p className="empty-hint">Add releases to your Contentful space</p>
          </div>
        ) : (
          <section className={collections.length > 0 ? 'home-section' : undefined}>
            {collections.length > 0 && <h2 className="home-section__title">Releases</h2>}
            <ul className="release-grid">
              {releases.map(release => {
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
                          {year}{year ? ' · ' : ''}{count} {count === 1 ? 'track' : 'tracks'}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
