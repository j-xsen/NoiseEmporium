import { useState } from 'react'
import './App.css'
import { useSongs } from './hooks/useSongs'
import { useAudio } from './hooks/useAudio'
import { usePlaylists } from './hooks/usePlaylists'
import Library from './components/Library'
import NowPlaying from './components/NowPlaying'
import Playlists from './components/Playlists'
import PlaylistDetail from './components/PlaylistDetail'
import MiniPlayer from './components/MiniPlayer'
import BottomNav from './components/BottomNav'
import { XIcon, PlusIcon } from './components/Icons'
import type { Tab, Playlist } from './types'

// ── Loading / Error screens ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="splash">
      <div className="splash-spinner" />
      <p className="splash-text">Loading library…</p>
    </div>
  )
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <div className="splash">
      <div className="empty-icon" style={{ fontSize: 40 }}>⚠</div>
      <p className="empty-title">Couldn't load songs</p>
      <p className="empty-hint">{message ?? 'Check your Contentful credentials in .env.local'}</p>
    </div>
  )
}

// ── Add-to-playlist bottom sheet ─────────────────────────────────────────────

interface SheetProps {
  songId: string
  playlists: Playlist[]
  onAdd: (playlistId: string) => void
  onCreate: (name: string) => void
  onClose: () => void
}

function AddToPlaylistSheet({ songId: _songId, playlists, onAdd, onCreate, onClose }: SheetProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function handleCreate() {
    if (!name.trim()) return
    onCreate(name.trim())
    setName('')
    setCreating(false)
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">Add to playlist</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </div>
        <div className="sheet-body">
          {playlists.length > 0 && (
            <ul className="sheet-list">
              {playlists.map(p => (
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
                <button className="btn-accent" onClick={handleCreate} disabled={!name.trim()}>Create</button>
              </div>
            </div>
          ) : (
            <button className="sheet-new" onClick={() => setCreating(true)}>
              <PlusIcon size={16} />
              <span>New playlist</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { songs, status, error } = useSongs()
  const player = useAudio()
  const pm = usePlaylists()
  const [tab, setTab] = useState<Tab>('library')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [addSongId, setAddSongId] = useState<string | null>(null)

  function changeTab(t: Tab) {
    setSelectedPlaylistId(null)
    setTab(t)
  }

  const selectedPlaylist = pm.playlists.find(p => p.id === selectedPlaylistId) ?? null
  if (status === 'loading') return <LoadingScreen />
  if (status === 'error') return <ErrorScreen message={error} />

  const miniPlayerVisible = !!player.currentSong && tab !== 'player'
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0

  return (
    <div className="app">
      <div className="screen">
        {tab === 'library' && (
          <Library
            songs={songs}
            currentSongId={player.currentSong?.id}
            isPlaying={player.isPlaying}
            onPlay={s => player.playSong(s, songs)}
            onAddToPlaylist={setAddSongId}
          />
        )}
        {tab === 'player' && (
          <NowPlaying player={player} />
        )}
        {tab === 'playlists' && !selectedPlaylist && (
          <Playlists
            playlists={pm.playlists}
            songs={songs}
            onCreate={pm.createPlaylist}
            onSelect={setSelectedPlaylistId}
            onDelete={pm.deletePlaylist}
          />
        )}
        {tab === 'playlists' && selectedPlaylist && (
          <PlaylistDetail
            playlist={selectedPlaylist}
            songs={songs}
            player={player}
            onBack={() => setSelectedPlaylistId(null)}
            onRemoveSong={pm.removeFromPlaylist}
            onAddToPlaylist={setAddSongId}
          />
        )}
      </div>

      {miniPlayerVisible && (
        <MiniPlayer
          song={player.currentSong!}
          isPlaying={player.isPlaying}
          progress={progress}
          onToggle={player.togglePlay}
          onExpand={() => changeTab('player')}
        />
      )}

      <BottomNav tab={tab} onChange={changeTab} hasSong={!!player.currentSong} />

      {addSongId && (
        <AddToPlaylistSheet
          songId={addSongId}
          playlists={pm.playlists}
          onAdd={playlistId => pm.addToPlaylist(playlistId, addSongId)}
          onCreate={name => {
            const p = pm.createPlaylist(name)
            pm.addToPlaylist(p.id, addSongId)
          }}
          onClose={() => setAddSongId(null)}
        />
      )}
    </div>
  )
}
