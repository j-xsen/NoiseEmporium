import { useState, useCallback } from 'react'
import './App.css'
import { useSongs } from './hooks/useSongs'
import { useAudio } from './hooks/useAudio'
import { usePlaylists } from './hooks/usePlaylists'
import { useFeaturedPlaylists } from './hooks/useFeaturedPlaylists'
import { useDownloads } from './hooks/useDownloads'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import Library from './components/Library'
import NowPlaying from './components/NowPlaying'
import Playlists from './components/Playlists'
import PlaylistDetail from './components/PlaylistDetail'
import ReleaseDetail from './components/ReleaseDetail'
import CollectionDetail from './components/CollectionDetail'
import LyricsView from './components/LyricsView'
import MiniPlayer from './components/MiniPlayer'
import BottomNav from './components/BottomNav'
import { DownloadIcon, MinusCircleIcon, PlusIcon, XIcon } from './components/Icons'
import type { DlStatus } from './hooks/useDownloads'
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
  dlStatus: DlStatus
  onAdd: (playlistId: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
  onRemove: (() => Promise<void>) | null
  onDownload: () => void
  onRemoveDownload: () => void
  onClose: () => void
}

function SongActionsSheet({ playlists, fromPlaylist, dlStatus, onAdd, onCreate, onRemove, onDownload, onRemoveDownload, onClose }: SongActionsSheetProps) {
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
  const { songs, releases, collections, status, error } = useSongs()

  const recordPlay = useCallback((songId: string) => {
    if (!auth.token) return
    fetch('/api/plays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ songId }),
    }).catch(console.error)
  }, [auth.token])

  const player = useAudio(recordPlay)
  const pm = usePlaylists(auth.token)
  const featuredPlaylists = useFeaturedPlaylists()
  const dl = useDownloads()
  const [tab, setTab] = useState<Tab>('home')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedFeaturedPlaylistId, setSelectedFeaturedPlaylistId] = useState<string | null>(null)
  const [lyricsSong, setLyricsSong] = useState<Song | null>(null)
  const [songSheet, setSongSheet] = useState<SongSheet>(null)

  const isPremium = auth.user?.tier === 'premium'

  const handlePlay = useCallback(async (song: Song, queue?: Song[]) => {
    if (!isPremium && song.memberOnly) return
    const q = (queue ?? [song]).filter(s => isPremium || !s.memberOnly)
    if (q.length === 0) return
    const resolved = await Promise.all(q.map(async s => {
      const localSrc = await dl.getLocalSrc(s.id)
      return localSrc ? { ...s, src: localSrc } : s
    }))
    const target = resolved.find(s => s.id === song.id) ?? resolved[0]
    player.playSong(target, resolved)
  }, [dl.getLocalSrc, player.playSong, isPremium])

  function changeTab(t: Tab) {
    setSelectedPlaylistId(null)
    setSelectedReleaseId(null)
    setSelectedCollectionId(null)
    setSelectedFeaturedPlaylistId(null)
    setLyricsSong(null)
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
  const selectedCollection = collections.find(c => c.id === selectedCollectionId) ?? null
  const selectedFeaturedPlaylist =
    pm.playlists.find(p => p.id === selectedFeaturedPlaylistId) ??
    featuredPlaylists.find(p => p.id === selectedFeaturedPlaylistId) ??
    null
  const userOwnsFeaturedPlaylist = pm.playlists.some(p => p.id === selectedFeaturedPlaylistId)
  const miniPlayerVisible = !!player.currentSong && tab !== 'player'
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0

  // Sheet callbacks
  const sheetFromPlaylist = songSheet?.fromPlaylistId
    ? (pm.playlists.find(p => p.id === songSheet.fromPlaylistId) ?? null)
    : null

  return (
    <div className="app">
      <div className="screen">
        {tab === 'home' && !selectedRelease && !selectedCollection && !selectedFeaturedPlaylist && !lyricsSong && (
          <Library
            releases={releases}
            collections={collections}
            featuredPlaylists={featuredPlaylists}
            isPremium={auth.user?.tier === 'premium'}
            userEmail={auth.user?.email ?? ''}
            currentSongId={player.currentSong?.id}
            onSelectRelease={setSelectedReleaseId}
            onSelectCollection={setSelectedCollectionId}
            onSelectFeaturedPlaylist={setSelectedFeaturedPlaylistId}
            onLogout={auth.logout}
          />
        )}
        {tab === 'home' && selectedFeaturedPlaylist && !lyricsSong && (
          <PlaylistDetail
            playlist={selectedFeaturedPlaylist}
            songs={songs}
            player={player}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onBack={() => setSelectedFeaturedPlaylistId(null)}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: selectedFeaturedPlaylist.id })}
            onRename={userOwnsFeaturedPlaylist
              ? name => pm.renamePlaylist(selectedFeaturedPlaylist.id, name)
              : undefined}
          />
        )}
        {tab === 'home' && selectedRelease && (
          <ReleaseDetail
            release={selectedRelease}
            player={player}
            isPremium={auth.user?.tier === 'premium'}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onBack={() => setSelectedReleaseId(null)}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: null })}
          />
        )}
        {tab === 'home' && selectedCollection && !lyricsSong && (
          <CollectionDetail
            collection={selectedCollection}
            player={player}
            isPremium={auth.user?.tier === 'premium'}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onOpenLyrics={song => { if (isPremium || !song.memberOnly) setLyricsSong(song) }}
            onBack={() => setSelectedCollectionId(null)}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: null })}
          />
        )}
        {tab === 'home' && lyricsSong && (
          <LyricsView
            song={lyricsSong}
            player={player}
            onBack={() => setLyricsSong(null)}
            onPlay={song => handlePlay(song, selectedCollection?.tracks ?? [song])}
          />
        )}
        {tab === 'player' && (
          <NowPlaying player={player} onLogout={auth.logout} />
        )}
        {tab === 'library' && !selectedPlaylist && (
          <Playlists
            playlists={pm.playlists}
            songs={songs}
            onCreate={pm.createPlaylist}
            onSelect={setSelectedPlaylistId}
            onDelete={pm.deletePlaylist}
            onRename={pm.renamePlaylist}
          />
        )}
        {tab === 'library' && selectedPlaylist && (
          <PlaylistDetail
            playlist={selectedPlaylist}
            songs={songs}
            player={player}
            dlStatuses={dl.statuses}
            onPlay={handlePlay}
            onBack={() => setSelectedPlaylistId(null)}
            onAddToPlaylist={songId => setSongSheet({ songId, fromPlaylistId: selectedPlaylist.id })}
            onRename={name => pm.renamePlaylist(selectedPlaylist.id, name)}
          />
        )}
        <div className="grass-divider" aria-hidden="true" />
      </div>

      {miniPlayerVisible && (
        <MiniPlayer
          song={player.currentSong!}
          isPlaying={player.isPlaying}
          progress={progress}
          volume={player.volume}
          onToggle={player.togglePlay}
          onExpand={() => changeTab('player')}
          onVolumeChange={player.setVolume}
        />
      )}

      <BottomNav tab={tab} onChange={changeTab} hasSong={!!player.currentSong} />

      {songSheet && (
        <SongActionsSheet
          playlists={pm.playlists}
          fromPlaylist={sheetFromPlaylist}
          dlStatus={dl.statuses[songSheet.songId] ?? 'none'}
          onAdd={playlistId => pm.addToPlaylist(playlistId, songSheet.songId)}
          onCreate={async name => {
            const p = await pm.createPlaylist(name)
            await pm.addToPlaylist(p.id, songSheet.songId)
          }}
          onRemove={sheetFromPlaylist
            ? () => pm.removeFromPlaylist(sheetFromPlaylist.id, songSheet.songId)
            : null
          }
          onDownload={() => {
            const song = songs.find(s => s.id === songSheet.songId)
            if (song) dl.download(song)
          }}
          onRemoveDownload={() => dl.remove(songSheet.songId)}
          onClose={() => setSongSheet(null)}
        />
      )}
    </div>
  )
}
