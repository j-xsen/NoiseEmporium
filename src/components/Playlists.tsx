import { useState } from 'react'
import { PencilIcon, PlusIcon, TrashIcon } from './Icons'
import type { Playlist, Song, Release } from '../types'
import type { PurchaseDetail, LicenseDetail } from '../hooks/usePurchases'
import { formatFileSize } from '../utils/format'

interface PlaylistsProps {
  playlists: Playlist[]
  songs: Song[]
  purchases: PurchaseDetail[]
  licenses: LicenseDetail[]
  releases: Release[]
  onCreate: (name: string) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onSelectRelease: (contentfulId: string) => void
  onDownloadWav: (contentfulId: string) => void
}

type LibraryFilter = 'all' | 'playlists' | 'downloads' | 'licenses'

const FILTER_LABELS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'licenses', label: 'Licenses' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function Playlists({ playlists, songs, purchases, licenses, releases, onCreate, onSelect, onDelete, onRename, onSelectRelease, onDownloadWav }: PlaylistsProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function toggleSection(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleCreate() {
    if (!newName.trim()) return
    onCreate(newName.trim())
    setNewName('')
    setCreating(false)
  }

  function startRename(p: Playlist, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingId(p.id)
    setRenameValue(p.name)
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== playlists.find(p => p.id === id)?.name) {
      onRename(id, trimmed)
    }
    setRenamingId(null)
  }

  const showDownloads = filter === 'all' || filter === 'downloads'
  const showLicenses = filter === 'all' || filter === 'licenses'
  const showPlaylists = filter === 'all' || filter === 'playlists'

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <h1 className="screen-title">Library</h1>
        {showPlaylists && (
          <button className="header-action" onClick={() => setCreating(true)} aria-label="New playlist">
            <PlusIcon size={20} />
          </button>
        )}
      </div>

      <div className="library-filters">
        {FILTER_LABELS.map(({ id, label }) => (
          <button
            key={id}
            className={`library-filter${filter === id ? ' library-filter--active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="scroll-area">
        <div className="library-list">

          {/* ── Playlists ── */}
          {showPlaylists && (
            <section className="library-section">
              <button className="library-section__title" onClick={() => toggleSection('playlists')}>
                Playlists
                <span className={`library-section__chevron${collapsed['playlists'] ? '' : ' library-section__chevron--open'}`}>›</span>
              </button>
              {!collapsed['playlists'] && (
                <>
                  {creating && (
                    <div className="playlist-create">
                      <input
                        autoFocus
                        className="playlist-create__input"
                        placeholder="Playlist name…"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreate()
                          if (e.key === 'Escape') { setCreating(false); setNewName('') }
                        }}
                      />
                      <div className="playlist-create__actions">
                        <button className="btn-ghost" onClick={() => { setCreating(false); setNewName('') }}>Cancel</button>
                        <button className="btn-accent" onClick={handleCreate} disabled={!newName.trim()}>Create</button>
                      </div>
                    </div>
                  )}
                  {playlists.length === 0 && !creating ? (
                    <p className="library-section__empty">No playlists yet — tap + to create one</p>
                  ) : (
                    <ul className="playlist-list">
                      {playlists.map(p => {
                        const count = p.songIds.length
                        const isRenaming = renamingId === p.id
                        return (
                          <li key={p.id} className="playlist-row">
                            <button className="playlist-row__main" onClick={() => !isRenaming && onSelect(p.id)}>
                              <div className="playlist-row__swatch">
                                {count > 0 ? (
                                  <span className="playlist-row__count">{count}</span>
                                ) : (
                                  <span className="playlist-row__empty-swatch">♪</span>
                                )}
                              </div>
                              <div className="playlist-row__info">
                                {isRenaming ? (
                                  <input
                                    autoFocus
                                    className="playlist-row__rename-input"
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { e.stopPropagation(); commitRename(p.id) }
                                      if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
                                    }}
                                    onBlur={() => commitRename(p.id)}
                                  />
                                ) : (
                                  <span className="playlist-row__name">{p.name}</span>
                                )}
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
                              className="playlist-row__action"
                              onClick={e => startRename(p, e)}
                              aria-label="Rename playlist"
                            >
                              <PencilIcon size={15} />
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
                </>
              )}
            </section>
          )}

          {/* ── Purchased Downloads ── */}
          {showDownloads && (
            <section className="library-section">
              <button className="library-section__title" onClick={() => toggleSection('downloads')}>
                Purchased Downloads
                <span className={`library-section__chevron${collapsed['downloads'] ? '' : ' library-section__chevron--open'}`}>›</span>
              </button>
              {!collapsed['downloads'] && (
                purchases.length === 0 ? (
                  <p className="library-section__empty">No purchases yet</p>
                ) : (
                  <ul className="playlist-list">
                    {purchases.map(p => {
                      const release = releases.find(r => r.id === p.contentful_id)
                      const title = release?.name ?? p.contentful_id
                      const cover = release?.cover
                      const hasWav = !!release?.downloadFile
                      const fileSize = release?.downloadFileSize
                      return (
                        <li key={p.contentful_id} className="playlist-row">
                          <button className="playlist-row__main" onClick={() => onSelectRelease(p.contentful_id)}>
                            <div className="playlist-row__swatch playlist-row__swatch--cover">
                              {cover
                                ? <img src={cover} alt="" className="playlist-row__cover-img" />
                                : <span className="playlist-row__empty-swatch">♪</span>
                              }
                            </div>
                            <div className="playlist-row__info">
                              <span className="playlist-row__name">{title}</span>
                              <span className="playlist-row__meta">
                                {release?.releaseType ?? 'release'} · {formatDate(p.created_at)}
                              </span>
                            </div>
                          </button>
                          {hasWav && (
                            <div className="playlist-row__dl">
                              {fileSize && <span className="playlist-row__filesize">{formatFileSize(fileSize)}</span>}
                              <button
                                className="playlist-row__action"
                                onClick={e => { e.stopPropagation(); onDownloadWav(p.contentful_id) }}
                                aria-label="Download Files"
                                title="Download Files"
                              >
                                ↓
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )
              )}
            </section>
          )}

          {/* ── Instrumental Licenses ── */}
          {showLicenses && (
            <section className="library-section">
              <button className="library-section__title" onClick={() => toggleSection('licenses')}>
                Instrumental Licenses
                <span className={`library-section__chevron${collapsed['licenses'] ? '' : ' library-section__chevron--open'}`}>›</span>
              </button>
              {!collapsed['licenses'] && (
                licenses.length === 0 ? (
                  <p className="library-section__empty">No licenses yet</p>
                ) : (
                  <ul className="playlist-list">
                    {licenses.map(l => (
                      <li key={l.song_id} className="playlist-row">
                        <div className="playlist-row__main playlist-row__main--static">
                          <div className="playlist-row__swatch">
                            <span className="playlist-row__empty-swatch">♩</span>
                          </div>
                          <div className="playlist-row__info">
                            <span className="playlist-row__name">{l.song_title}</span>
                            <span className="playlist-row__meta">
                              Licensed · {formatDate(l.created_at)}
                            </span>
                          </div>
                        </div>
                        <span className="library-section__badge">Licensed</span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
