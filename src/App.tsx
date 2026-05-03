import { useState, useCallback } from 'react'
import './App.css'
import { useSongs } from './hooks/useSongs'
import { useAudio } from './hooks/useAudio'
import { usePlaylists } from './hooks/usePlaylists'
import { useDownloads } from './hooks/useDownloads'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import Library from './components/Library'
import NowPlaying from './components/NowPlaying'
import Playlists from './components/Playlists'
import PlaylistDetail from './components/PlaylistDetail'
import ReleaseDetail from './components/ReleaseDetail'
import MiniPlayer from './components/MiniPlayer'
import BottomNav from './components/BottomNav'
import { MinusCircleIcon, PlusIcon, XIcon } from './components/Icons'
import type { Song, Tab, Playlist } from './types'

// ── Loading / Error screens ───────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="splash">
      <div className="splash-spinner" />
      <p className="splash-text">Loading…</p>
    </div>
  )
}

function ErrorScreen({ message }: { message: string | null }) {
  return (
    <div className="splash">
      <div className="empty-icon" style={{ fontSize: 40 }}>⚠</div>
      <p className="empty-title">Couldn't load songs</p>
      <p className="empty-hint">{message ?? 'Check your Contentful credentials'}</p>
    </div>
  )
}

// ── Song actions bottom sheet ─────────────────────────────────────────────────
// Context-aware: shows "Remove from playlist" when opened from within a playlist.

interface SongActionsSheetProps {
  playlists: Playlist[]
  fromPlaylist: Playlist | null
  onAdd: (playlistId: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  onRemove: (() => Promise<void>) | null
  onClose: () => void
}

function SongActionsSheet({ playlists, fromPlaylist, onAdd, onCreate, onRemove, onClose }: SongActionsSheetProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    await onCreate(name.trim())
    setName('')
    setCreating(false)
  }

  // Playlists available to add to (exclude current playlist if any)
  const addablePlaylists = fromPlaylist
    ? playlists.filter(p => p.id !== fromPlaylist.id)
    : playlists

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">Add to playlist</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
        </div>
        <div className="sheet-body">
          {onRemove && (
            <button
              className="sheet-remove"
              onClick={async () => { await onRemove(); onClose() }}
            >
              <MinusCircleIcon size={16} />
              <span>Remove from {fromPlaylist?.name ?? 'playlist'}</span>
            </button>
          )}
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

// Tracks which song opened the sheet and from what context
type SongSheet = { songId: string; fromPlaylistId: string | null } | null

export default function App() {
  const auth = useAuth()
  const { songs, releases, status, error } = useSongs()
  const player = useAudio()
  const pm = usePlaylists(auth.token)
  const dl = useDownloads()
  const [tab, setTab] = useState<Tab>('library')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null)
  const [songSheet, setSongSheet] = useState<SongSheet>(null)

  const handlePlay = useCallback(async (song: Song, queue?: Song[]) => {
    const q = queue ?? [song]
    const resolved = await Promise.all(q.map(async s => {
      const localSrc = await dl.getLocalSrc(s.id)
      return localSrc ? { ...s, src: localSrc } : s
    }))
    const target = resolved.find(s => s.id === song.id) ?? resolved[0]
    player.playSong(target, resolved)
  }, [dl.getLocalSrc, player.playSong])

  function changeTab(t: Tab) {
    setSelectedPlaylistId(null)
    setSelectedReleaseId(null)
    setTab(t)
  }

  // Auth loading
  if (auth.loading) return <LoadingScreen />

  // Not logged in → show auth screen
  if (!auth.user) return <AuthScreen onLogin={auth.login} onRegister={auth.register} />

  // Songs loading / error
  if (status === 'loading') return <LoadingScreen />
  if (status === 'error') return <ErrorScreen message={error} />

  const selectedPlaylist = pm.playlists.find(p => p.id === selectedPlaylistId) ?? null
  const selectedRelease = releases.find(r => r.id === selectedReleaseId) ?? null
  const miniPlayerVisible = !!player.currentSong && tab !== 'player'
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0

  // Sheet callbacks
  const sheetFromPlaylist = songSheet?.fromPlaylistId
    ? (pm.playlists.find(p => p.id === songSheet.fromPlaylistId) ?? null)
    : null

  return (
    <div className="app">
      <div className="screen">
        {tab === 'library' && !selectedRelease && (
          <Library
            releases={releases}
            currentSongId={player.currentSong?.id}
            onSelectRelease={setSelectedReleaseId}
            onPlayRelease={r => handlePlay(r.songs[0], r.songs)}
          />
        )}
        {tab === 'library' && selectedRelease && (
          <ReleaseDetail
            release={selectedRelease}
            player={player}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onBack={() => setSelectedReleaseId(null)}
            onDownload={dl.download}
            onRemoveDownload={dl.remove}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: null })}
          />
        )}
        {tab === 'player' && (
          <NowPlaying player={player} onLogout={auth.logout} />
        )}
        {tab === 'playlists' && !selectedPlaylist && (
          <Playlists
            playlists={pm.playlists}
            songs={songs}
            onCreate={pm.createPlaylist}
            onSelect={setSelectedPlaylistId}
            onDelete={pm.deletePlaylist}
            onRename={pm.renamePlaylist}
          />
        )}
        {tab === 'playlists' && selectedPlaylist && (
          <PlaylistDetail
            playlist={selectedPlaylist}
            songs={songs}
            player={player}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onBack={() => setSelectedPlaylistId(null)}
            onDownload={dl.download}
            onRemoveDownload={dl.remove}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: selectedPlaylist.id })}
            onRename={name => pm.renamePlaylist(selectedPlaylist.id, name)}
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

      {songSheet && (
        <SongActionsSheet
          playlists={pm.playlists}
          fromPlaylist={sheetFromPlaylist}
          onAdd={playlistId => pm.addToPlaylist(playlistId, songSheet.songId)}
          onCreate={async name => {
            const p = await pm.createPlaylist(name)
            await pm.addToPlaylist(p.id, songSheet.songId)
          }}
          onRemove={sheetFromPlaylist
            ? () => pm.removeFromPlaylist(sheetFromPlaylist.id, songSheet.songId)
            : null
          }
          onClose={() => setSongSheet(null)}
        />
      )}
    </div>
  )
}
