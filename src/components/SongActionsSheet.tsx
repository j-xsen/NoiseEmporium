// SongActionsSheet.tsx — bottom sheet for per-song actions.
//
// Actions: view lyrics, download/remove download, remove from playlist,
// add to an existing playlist or a newly created one.
// The 'playlists' view is shown inline (not a new route) to keep the nav stack
// shallow — users navigate back to 'main' with the back button.

import { useState } from 'react'
import { ChevronLeftIcon, DownloadIcon, MinusCircleIcon, PlusIcon, XIcon } from './Icons'
import type { DlStatus } from '../hooks/useDownloads'
import type { Playlist } from '../types'

export interface SongActionsSheetProps {
  songTitle: string
  playlists: Playlist[]
  fromPlaylist: Playlist | null
  dlStatus: DlStatus
  onAdd: (playlistId: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  onRemove: (() => Promise<void>) | null
  onDownload: () => void
  onRemoveDownload: () => void
  onViewLyrics?: () => void
  onClose: () => void
}

export default function SongActionsSheet({
  songTitle, playlists, fromPlaylist, dlStatus,
  onAdd, onCreate, onRemove, onDownload, onRemoveDownload, onViewLyrics, onClose,
}: SongActionsSheetProps) {
  const [view, setView] = useState<'main' | 'playlists'>('main')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    try {
      await onCreate(name.trim())
      setName('')
      setCreating(false)
    } finally {
      setSubmitting(false)
    }
  }

  const addablePlaylists = fromPlaylist
    ? playlists.filter(p => p.id !== fromPlaylist.id)
    : playlists

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          {view === 'playlists' && (
            <button
              className="sheet-back"
              onClick={() => { setView('main'); setCreating(false); setName('') }}
              aria-label="Back"
            >
              <ChevronLeftIcon size={18} />
            </button>
          )}
          <h3 className="sheet-title">{view === 'main' ? songTitle : 'Add to playlist'}</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </div>
        <div className="sheet-body">
          {view === 'main' ? (
            <>
              {onViewLyrics && (
                <button className="sheet-new" onClick={() => { onViewLyrics(); onClose() }}>
                  <span>Lyrics</span>
                </button>
              )}
              {dlStatus === 'done' ? (
                <button className="sheet-remove" onClick={() => { onRemoveDownload(); onClose() }}>
                  <XIcon size={16} />
                  <span>Remove Download</span>
                </button>
              ) : (
                <button
                  className="sheet-new"
                  onClick={() => { onDownload(); onClose() }}
                  disabled={dlStatus === 'downloading'}
                >
                  <DownloadIcon size={16} />
                  <span>{dlStatus === 'downloading' ? 'Downloading…' : 'Download'}</span>
                </button>
              )}
              {onRemove && (
                <button
                  className="sheet-remove"
                  onClick={async () => { await onRemove(); onClose() }}
                >
                  <MinusCircleIcon size={16} />
                  <span>Remove from {fromPlaylist?.name ?? 'playlist'}</span>
                </button>
              )}
              <button className="sheet-new" onClick={() => setView('playlists')}>
                <PlusIcon size={16} />
                <span>Add to playlist</span>
              </button>
            </>
          ) : (
            <>
              {addablePlaylists.length > 0 && (
                <ul className="sheet-list">
                  {addablePlaylists.map(p => (
                    <li key={p.id}>
                      <button className="sheet-item" onClick={() => { onAdd(p.id); onClose() }}>
                        <span className="sheet-item__name">{p.name}</span>
                        <span className="sheet-item__count">{p.songIds.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {creating ? (
                <div className="sheet-create">
                  <input
                    autoFocus
                    className="sheet-input"
                    placeholder="Playlist name…"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreate()
                      if (e.key === 'Escape') { setCreating(false); setName('') }
                    }}
                  />
                  <div className="sheet-create__btns">
                    <button className="btn-ghost" onClick={() => { setCreating(false); setName('') }}>Cancel</button>
                    <button className="btn-accent" onClick={handleCreate} disabled={!name.trim() || submitting}>Create</button>
                  </div>
                </div>
              ) : (
                <button className="sheet-new" onClick={() => setCreating(true)}>
                  <PlusIcon size={16} />
                  <span>New playlist</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
