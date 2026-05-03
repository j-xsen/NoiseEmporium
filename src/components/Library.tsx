import CoverArt from './CoverArt'
import { PlayIcon } from './Icons'
import type { Release, Song } from '../types'

interface LibraryProps {
  releases: Release[]
  currentSongId: string | undefined
  onSelectRelease: (id: string) => void
  onPlayRelease: (release: Release) => void
}

export default function Library({ releases, currentSongId, onSelectRelease, onPlayRelease }: LibraryProps) {
  return (
    <div className="screen-layout">
      <div className="screen-header">
        <h1 className="screen-title">Library</h1>
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
          <ul className="release-list">
            {releases.map(release => {
              const year = release.date ? new Date(release.date).getFullYear() : null
              const count = release.songs.length
              const isActive = release.songs.some(s => s.id === currentSongId)
              return (
                <li key={release.id} className={`release-row ${isActive ? 'release-row--active' : ''}`}>
                  <button className="release-row__main" onClick={() => onSelectRelease(release.id)}>
                    <CoverArt song={release.songs[0] ?? ({ cover: release.cover } as Song)} size={56} className="release-row__art" />
                    <div className="release-row__info">
                      <span className="release-row__name">{release.name}</span>
                      <span className="release-row__meta">
                        {year && <span>{year}</span>}
                        {year && <span className="release-row__dot">·</span>}
                        <span>{count} {count === 1 ? 'track' : 'tracks'}</span>
                      </span>
                    </div>
                  </button>
                  <button
                    className="release-row__play"
                    onClick={e => { e.stopPropagation(); onPlayRelease(release) }}
                    aria-label={`Play ${release.name}`}
                  >
                    <PlayIcon size={16} />
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
