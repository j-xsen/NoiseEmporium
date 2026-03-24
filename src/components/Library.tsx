import CoverArt from './CoverArt'
import { MoreIcon } from './Icons'
import type { Song } from '../types'

interface LibraryProps {
  songs: Song[]
  currentSongId: string | undefined
  isPlaying: boolean
  onPlay: (song: Song) => void
  onAddToPlaylist: (songId: string) => void
}

export default function Library({ songs, currentSongId, isPlaying, onPlay, onAddToPlaylist }: LibraryProps) {
  return (
    <div className="screen-layout">
      <div className="screen-header">
        <h1 className="screen-title">Library</h1>
        <span className="screen-subtitle">{songs.length} {songs.length === 1 ? 'song' : 'songs'}</span>
      </div>

      <div className="scroll-area">
        {songs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">No songs yet</p>
            <p className="empty-hint">
              Add audio files to <code>public/music/</code><br />
              then edit <code>src/data/songs.ts</code>
            </p>
          </div>
        ) : (
          <ul className="song-list">
            {songs.map((song, i) => {
              const isActive = song.id === currentSongId
              return (
                <li key={song.id} className={`song-row ${isActive ? 'song-row--active' : ''}`}>
                  <button className="song-row__play" onClick={() => onPlay(song)}>
                    <span className="song-row__index">
                      {isActive && isPlaying ? (
                        <span className="song-row__bars">
                          <span /><span /><span />
                        </span>
                      ) : (
                        <span className="song-row__num">{i + 1}</span>
                      )}
                    </span>
                    <CoverArt song={song} size={44} className="song-row__art" />
                    <div className="song-row__info">
                      <span className="song-row__title">{song.title}</span>
                      {song.artist && <span className="song-row__artist">{song.artist}</span>}
                    </div>
                  </button>
                  <button
                    className="song-row__more"
                    onClick={e => { e.stopPropagation(); onAddToPlaylist(song.id) }}
                    aria-label="Add to playlist"
                  >
                    <MoreIcon size={18} />
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
