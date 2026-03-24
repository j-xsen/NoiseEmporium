import CoverArt from './CoverArt'
import DownloadButton from './DownloadButton'
import { MoreIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Song } from '../types'

interface LibraryProps {
  songs: Song[]
  currentSongId: string | undefined
  isPlaying: boolean
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song) => void
  onDownload: (song: Song) => void
  onRemoveDownload: (id: string) => void
  onAddToPlaylist: (songId: string) => void
}

export default function Library({
  songs, currentSongId, isPlaying, dlStatuses,
  onPlay, onDownload, onRemoveDownload, onAddToPlaylist,
}: LibraryProps) {
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
            <p className="empty-hint">Add songs to your Contentful space</p>
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
                        <span className="song-row__bars"><span /><span /><span /></span>
                      ) : (
                        <span className="song-row__num">{i + 1}</span>
                      )}
                    </span>
                    <CoverArt song={song} size={44} className="song-row__art" />
                    <div className="song-row__info">
                      <span className="song-row__title">{song.title}</span>
                      {songSubtitle(song) && <span className="song-row__artist">{songSubtitle(song)}</span>}
                    </div>
                  </button>
                  <DownloadButton
                    song={song}
                    status={dlStatuses[song.id] ?? 'none'}
                    onDownload={onDownload}
                    onRemove={onRemoveDownload}
                  />
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
