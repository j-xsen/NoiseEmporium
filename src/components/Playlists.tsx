import { useState } from 'react'
import { PlusIcon, TrashIcon } from './Icons'
import type { Playlist, Song } from '../types'

interface PlaylistsProps {
  playlists: Playlist[]
  songs: Song[]
  onCreate: (name: string) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export default function Playlists({ playlists, songs, onCreate, onSelect, onDelete }: PlaylistsProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  function handleCreate() {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setCreating(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') { setCreating(false); setNewName('') }
  }

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <h1 className="screen-title">Playlists</h1>
        <button className="header-action" onClick={() => setCreating(true)} aria-label="New playlist">
          <PlusIcon size={20} />
        </button>
      </div>

      <div className="scroll-area">
        {creating && (
          <div className="playlist-create">
            <input
              autoFocus
              className="playlist-create__input"
              placeholder="Playlist name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="playlist-create__actions">
              <button className="btn-ghost" onClick={() => { setCreating(false); setNewName('') }}>Cancel</button>
              <button className="btn-accent" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
            </div>
          </div>
        )}

        {playlists.length === 0 && !creating ? (
          <div className="empty-state">
            <div className="empty-icon">☰</div>
            <p className="empty-title">No playlists yet</p>
            <p className="empty-hint">Tap + to create your first playlist</p>
          </div>
        ) : (
          <ul className="playlist-list">
            {playlists.map(p => {
              const count = p.songIds.length
              return (
                <li key={p.id} className="playlist-row">
                  <button className="playlist-row__main" onClick={() => onSelect(p.id)}>
                    <div className="playlist-row__swatch">
                      {count > 0 ? (
                        <span className="playlist-row__count">{count}</span>
                      ) : (
                        <span className="playlist-row__empty-swatch">♪</span>
                      )}
                    </div>
                    <div className="playlist-row__info">
                      <span className="playlist-row__name">{p.name}</span>
                      <span className="playlist-row__meta">
                        {count} {count === 1 ? 'song' : 'songs'}
                        {count > 0 && (() => {
                          const labels = songs
                            .filter(s => p.songIds.includes(s.id))
                            .map(s => s.artist ?? s.album)
                            .filter((a): a is string => !!a)
                            .filter((a, i, arr) => arr.indexOf(a) === i)
                            .slice(0, 2)
                          return labels.length ? ` · ${labels.join(', ')}` : ''
                        })()}
                      </span>
                    </div>
                  </button>
                  <button
                    className="playlist-row__delete"
                    onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                    aria-label="Delete playlist"
                  >
                    <TrashIcon size={17} />
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
