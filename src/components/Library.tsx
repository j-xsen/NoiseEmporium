import CoverArt from './CoverArt'
import type { Release, Song } from '../types'

interface LibraryProps {
  releases: Release[]
  currentSongId: string | undefined
  onSelectRelease: (id: string) => void
}

export default function Library({ releases, currentSongId, onSelectRelease }: LibraryProps) {
  return (
    <div className="screen-layout">
      <div className="screen-header">
        <h1 className="screen-title">Home</h1>
        <span className="screen-subtitle">{releases.length} {releases.length === 1 ? 'release' : 'releases'}</span>
      </div>

      <div className="scroll-area">
        {releases.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No releases yet</p>
            <p className="empty-hint">Add releases to your Contentful space</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
