import { useState } from 'react'
import { CheckIcon, ChevronLeftIcon, MoreIcon, PencilIcon, PlayIcon } from './Icons'
import { songSubtitle } from '../utils/format'
import type { DlStatus } from '../hooks/useDownloads'
import type { Playlist, Song } from '../types'
import type { PlayerAPI } from '../hooks/useAudio'

interface PlaylistDetailProps {
  playlist: Playlist
  songs: Song[]
  player: PlayerAPI
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue: Song[]) => void
  onBack: () => void
  onAddToPlaylist: (songId: string) => void
  onRename?: (name: string) => void
}

export default function PlaylistDetail({
  playlist, songs, player, dlStatuses,
  onPlay, onBack, onAddToPlaylist, onRename,
}: PlaylistDetailProps) {
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(playlist.name)

  const playlistSongs = playlist.songIds
    .map(id => songs.find(s => s.id === id))
    .filter(Boolean) as Song[]

  function commitRename() {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== playlist.name) onRename?.(trimmed)
    setRenaming(false)
  }

  return (
    <div className="screen-layout">
      <div className="screen-header screen-header--with-back">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen-header__center">
          {renaming ? (
            <input
              autoFocus
              className="playlist-rename-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setNameInput(playlist.name); setRenaming(false) }
              }}
              onBlur={commitRename}
            />
          ) : (
            <h1 className="screen-title">{playlist.name}</h1>
          )}
          <span className="screen-subtitle">{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</span>
        </div>
        <div className="header-actions">
          {onRename && (
            <button
              className="header-action"
              onClick={() => { setNameInput(playlist.name); setRenaming(true) }}
              aria-label="Rename playlist"
            >
              <PencilIcon size={17} />
            </button>
          )}
          {playlistSongs.length > 0 && (
            <button className="header-action" onClick={() => onPlay(playlistSongs[0], playlistSongs)} aria-label="Play all">
              <PlayIcon size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="scroll-area">
        {playlistSongs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♪</div>
            <p className="empty-title">Empty playlist</p>
            <p className="empty-hint">Add songs from the library using ···</p>
          </div>
        ) : (
          <ul className="song-track-list">
            {playlistSongs.map((song, i) => {
              const isActive = song.id === player.currentSong?.id
              return (
                <li key={song.id} className={`song-track ${isActive ? 'song-track--active' : ''}`}>
                  <button className="song-track__main" onClick={() => onPlay(song, playlistSongs)}>
                    <span className="song-track__num">
                      {isActive && player.isPlaying
                        ? <span className="song-row__bars"><span /><span /><span /></span>
                        : i + 1
                      }
                    </span>
                    <div className="song-track__info">
                      <span className="song-track__title">{song.title}</span>
                      {songSubtitle(song) && <span className="song-track__subtitle">{songSubtitle(song)}</span>}
                    </div>
                  </button>
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
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
