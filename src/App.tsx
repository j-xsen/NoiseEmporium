// App.tsx — root component.
//
// Navigation model: React Router v7.
//   /             → Library (home tab)
//   /album/:slug  → Album/EP/Single/Collection detail (all use ReleaseDetail)
//   /ep/:slug     → (same)
//   /single/:slug → (same)
//   /collection/:slug → (same)
//   /playlist/:id → Featured playlist detail
//   /player       → Now playing
//   /library      → User playlists
//   /library/playlist/:id → User playlist detail
//   /shop         → Shop
//
// LyricsView remains state-based (full-screen overlay, not a distinct page).

import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import './App.css'
import { useSongs } from './hooks/useSongs'
import { useAudio } from './hooks/useAudio'
import { usePlaylists } from './hooks/usePlaylists'
import { useFeaturedPlaylists } from './hooks/useFeaturedPlaylists'
import { useDownloads } from './hooks/useDownloads'
import { useAuth } from './hooks/useAuth'
import { usePurchases } from './hooks/usePurchases'
import AuthScreen from './components/AuthScreen'
import BubbleWorld from './components/BubbleWorld'
import Library from './components/Library'
import NowPlaying from './components/NowPlaying'
import Playlists from './components/Playlists'
import PlaylistDetail from './components/PlaylistDetail'
import ReleaseDetail from './components/ReleaseDetail'
import LyricsView from './components/LyricsView'
import MiniPlayer from './components/MiniPlayer'
import BottomNav from './components/BottomNav'
import Shop from './components/Shop'
import AccountModal from './components/AccountModal'
import AccountButton from './components/AccountButton'
import { ChevronLeftIcon, DownloadIcon, MinusCircleIcon, PlusIcon, XIcon } from './components/Icons'
import type { DlStatus } from './hooks/useDownloads'
import type { Song, Tab, Playlist, Release } from './types'

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

interface SongActionsSheetProps {
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

function SongActionsSheet({ songTitle, playlists, fromPlaylist, dlStatus, onAdd, onCreate, onRemove, onDownload, onRemoveDownload, onViewLyrics, onClose }: SongActionsSheetProps) {
  const [view, setView] = useState<'main' | 'playlists'>('main')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    if (!name.trim() || submitting) return
    setSubmitting(true)
    await onCreate(name.trim())
    setName('')
    setCreating(false)
    setSubmitting(false)
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
            <button className="sheet-back" onClick={() => { setView('main'); setCreating(false); setName('') }} aria-label="Back">
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

// ── Route wrapper components ─────────────────────────────────────────────────
// These live outside App so they can call useParams/useNavigate as hooks.
// All data is passed as props from App.

type AudioPlayer = ReturnType<typeof useAudio>

interface ReleaseRouteProps {
  releases: Release[]
  player: AudioPlayer
  isPremium: boolean
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue?: Song[]) => void
  onAddToPlaylist: (songId: string) => void
  onDownload: (song: Song) => void
  onDownloadAll: (songs: Song[]) => void
  onRemoveDownload: (songId: string) => void
  hasPurchased: (contentfulId: string) => boolean
  onBuyRelease: (contentfulId: string) => void
  onDownloadWav: (contentfulId: string) => void
}

function ReleaseDetailRoute({ releases, player, isPremium, dlStatuses, onPlay, onAddToPlaylist, onDownload, onDownloadAll, onRemoveDownload, hasPurchased, onBuyRelease, onDownloadWav }: ReleaseRouteProps) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const release = releases.find(r => r.slug === slug)
  if (!release) return <Navigate to="/" replace />
  return (
    <ReleaseDetail
      release={release}
      player={player}
      isPremium={isPremium}
      hasPurchasedRelease={hasPurchased(release.id)}
      dlStatuses={dlStatuses}
      onPlay={onPlay}
      onBack={() => navigate('/')}
      onAddToPlaylist={onAddToPlaylist}
      onDownload={onDownload}
      onDownloadAll={onDownloadAll}
      onRemoveDownload={onRemoveDownload}
      onBuyRelease={onBuyRelease}
      onDownloadWav={onDownloadWav}
    />
  )
}


interface FeaturedPlaylistRouteProps {
  allPlaylists: Playlist[]
  userPlaylistIds: Set<string>
  songs: Song[]
  player: AudioPlayer
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue?: Song[]) => void
  onAddToPlaylist: (songId: string, fromPlaylistId: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDownload: (song: Song) => void
  onRemoveDownload: (songId: string) => void
}

function FeaturedPlaylistRoute({ allPlaylists, userPlaylistIds, songs, player, dlStatuses, onPlay, onAddToPlaylist, onRename, onDownload, onRemoveDownload }: FeaturedPlaylistRouteProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playlist = allPlaylists.find(p => p.id === id)
  if (!playlist) return <Navigate to="/" replace />
  const userOwns = userPlaylistIds.has(playlist.id)
  return (
    <PlaylistDetail
      playlist={playlist}
      songs={songs}
      player={player}
      dlStatuses={dlStatuses}
      onPlay={onPlay}
      onBack={() => navigate('/')}
      onAddToPlaylist={songId => onAddToPlaylist(songId, playlist.id)}
      onRename={userOwns ? name => onRename(playlist.id, name) : undefined}
      onDownload={onDownload}
      onRemoveDownload={onRemoveDownload}
    />
  )
}

interface LibraryPlaylistRouteProps {
  playlists: Playlist[]
  songs: Song[]
  player: AudioPlayer
  dlStatuses: Record<string, DlStatus>
  onPlay: (song: Song, queue?: Song[]) => void
  onAddToPlaylist: (songId: string, fromPlaylistId: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDownload: (song: Song) => void
  onRemoveDownload: (songId: string) => void
}

function LibraryPlaylistRoute({ playlists, songs, player, dlStatuses, onPlay, onAddToPlaylist, onRename, onDownload, onRemoveDownload }: LibraryPlaylistRouteProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const playlist = playlists.find(p => p.id === id)
  if (!playlist) return <Navigate to="/library" replace />
  return (
    <PlaylistDetail
      playlist={playlist}
      songs={songs}
      player={player}
      dlStatuses={dlStatuses}
      onPlay={onPlay}
      onBack={() => navigate('/library')}
      onAddToPlaylist={songId => onAddToPlaylist(songId, playlist.id)}
      onRename={name => onRename(playlist.id, name)}
      onDownload={onDownload}
      onRemoveDownload={onRemoveDownload}
    />
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

type SongSheet = { songId: string; fromPlaylistId: string | null } | null

export default function App() {
  const auth = useAuth()
  const { songs, releases, status, error } = useSongs()

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
  const purchases = usePurchases(auth.token)

  const [lyricsSong, setLyricsSong] = useState<Song | null>(null)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [songSheet, setSongSheet] = useState<SongSheet>(null)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(() =>
    (localStorage.getItem('noise-view-mode') as '3d' | '2d') ?? '2d'
  )

  useEffect(() => {
    localStorage.setItem('noise-view-mode', viewMode)
  }, [viewMode])

  const navigate = useNavigate()
  const location = useLocation()

  const isPremium = auth.user?.tier === 'premium'

  // Derive active tab from the URL for BottomNav highlighting.
  const tab: Tab = location.pathname.startsWith('/player') ? 'player'
    : location.pathname.startsWith('/library') ? 'library'
    : location.pathname.startsWith('/shop') ? 'shop'
    : 'home'

  function changeTab(t: Tab) {
    setLyricsSong(null)
    navigate(t === 'home' ? '/' : `/${t}`)
  }

  // Extracts the releaseId param embedded in member-only stream proxy URLs.
  // Format: /api/plays?stream=<songId>&releaseId=<releaseId>
  function releaseIdFromSrc(src: string): string | undefined {
    if (!src.includes('releaseId=')) return undefined
    return new URLSearchParams(src.split('?')[1] ?? '').get('releaseId') ?? undefined
  }

  const handlePlay = useCallback(async (song: Song, queue?: Song[]) => {
    const canPlay = (s: Song) => {
      if (!s.memberOnly) return true
      if (isPremium) return true
      const rId = releaseIdFromSrc(s.src)
      return rId ? purchases.hasPurchased(rId) : false
    }
    if (!canPlay(song)) return
    const q = (queue ?? [song]).filter(canPlay)
    if (q.length === 0) return
    const resolved = await Promise.all(q.map(async s => {
      const localSrc = await dl.getLocalSrc(s.id)
      if (localSrc) return { ...s, src: localSrc }
      // Append the auth token so the stream proxy can verify identity without headers.
      if (s.memberOnly && s.src.startsWith('/api/plays?stream=') && auth.token) {
        return { ...s, src: `${s.src}&token=${auth.token}` }
      }
      return s
    }))
    const target = resolved.find(s => s.id === song.id) ?? resolved[0]
    player.playSong(target, resolved)
  }, [dl.getLocalSrc, player.playSong, isPremium, auth.token, purchases.hasPurchased])

  // Stable callbacks for Library — memoized so Library/BubbleWorld don't re-render
  // every ~250 ms when useAudio's currentTime ticks.
  const handleSelectRelease = useCallback((id: string) => {
    const r = releases.find(r => r.id === id)
    if (r) navigate(`/${r.releaseType}/${r.slug}`)
  }, [releases, navigate])

const handleSelectFeaturedPlaylist = useCallback((id: string) => {
    navigate(`/playlist/${id}`)
  }, [navigate])

  const handleOpenAccount = useCallback(() => {
    setAccountModalOpen(true)
  }, [])

  const handleBuyRelease = useCallback(async (contentfulId: string) => {
    if (!auth.token) return
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ mode: 'payment', contentfulId }),
      })
      const data = await r.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Buy release failed:', err)
    }
  }, [auth.token])

  const handleDownloadWav = useCallback(async (contentfulId: string) => {
    if (!auth.token) return
    try {
      const r = await fetch(`/api/downloads?release=${encodeURIComponent(contentfulId)}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (!r.ok) return
      const { url } = await r.json()
      if (url) window.location.href = url
    } catch (err) {
      console.error('WAV download failed:', err)
    }
  }, [auth.token])

  // Handle Stripe checkout redirect: ?tab=shop → /shop
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'shop') navigate('/shop', { replace: true })
  }, [])

  if (auth.loading) return <LoadingScreen />
  if (!auth.user) return <AuthScreen onLogin={auth.login} onRegister={auth.register} />
  if (status === 'loading') return <LoadingScreen />
  if (status === 'error') return <ErrorScreen message={error} />

  // Combined playlist list for featured playlist routes (user may have cloned them).
  const allPlaylists = [
    ...pm.playlists,
    ...featuredPlaylists.filter(fp => !pm.playlists.some(up => up.id === fp.id)),
  ]
  const userPlaylistIds = new Set(pm.playlists.map(p => p.id))

  const miniPlayerVisible = !!player.currentSong && tab !== 'player'
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0

  const sheetFromPlaylist = songSheet?.fromPlaylistId
    ? (pm.playlists.find(p => p.id === songSheet.fromPlaylistId) ?? null)
    : null

  const releaseRouteProps: ReleaseRouteProps = {
    releases,
    player,
    isPremium,
    dlStatuses: dl.statuses,
    onPlay: handlePlay,
    onAddToPlaylist: songId => setSongSheet({ songId, fromPlaylistId: null }),
    onDownload: song => dl.download(song, auth.token ?? undefined),
    onDownloadAll: songs => dl.downloadAll(songs, auth.token ?? undefined),
    onRemoveDownload: dl.remove,
    hasPurchased: purchases.hasPurchased,
    onBuyRelease: handleBuyRelease,
    onDownloadWav: handleDownloadWav,
  }

return (
    <div className="app">
      <div className="screen">
        {tab === 'home' && !lyricsSong && location.pathname === '/' && (
          <div className="view-toggle" role="group" aria-label="Choose view mode">
            <button
              className={`view-toggle__opt${viewMode === '3d' ? ' view-toggle__opt--active' : ''}`}
              onClick={() => setViewMode('3d')}
              aria-pressed={viewMode === '3d'}
            >3D</button>
            <button
              className={`view-toggle__opt${viewMode === '2d' ? ' view-toggle__opt--active' : ''}`}
              onClick={() => setViewMode('2d')}
              aria-pressed={viewMode === '2d'}
            >2D</button>
          </div>
        )}

        {tab === 'home' && !lyricsSong && !(viewMode === '2d' && location.pathname === '/') && auth.user && (
          <div className="account-btn-overlay">
            <AccountButton email={auth.user.email} onClick={handleOpenAccount} />
          </div>
        )}

        {lyricsSong ? (
          <LyricsView
            song={lyricsSong}
            player={player}
            onBack={() => setLyricsSong(null)}
            onPlay={song => handlePlay(song)}
          />
        ) : (
          <>
            {/* Persistent canvas — stays mounted across detail routes so WebGL context and textures survive navigation.
                Only unmounts when the user explicitly switches to 2D mode. */}
            {viewMode === '3d' && (
              <div
                aria-hidden={location.pathname !== '/'}
                style={location.pathname !== '/' ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
              >
                <BubbleWorld
                  releases={releases}
                  currentSongId={player.currentSong?.id}
                />
              </div>
            )}
            {/* Persistent 2D home screen — kept mounted so scroll position survives back-navigation.
                display:none hides it from layout without removing the DOM node, preserving scrollTop. */}
            {viewMode === '2d' && (
              <div style={location.pathname !== '/' ? { display: 'none' } : undefined}>
                <Library
                  releases={releases}
                  featuredPlaylists={featuredPlaylists}
                  isPremium={isPremium}
                  userEmail={auth.user?.email ?? ''}
                  currentSongId={player.currentSong?.id}
                  onSelectRelease={handleSelectRelease}
                  onSelectFeaturedPlaylist={handleSelectFeaturedPlaylist}
                  onOpenAccount={handleOpenAccount}
                />
              </div>
            )}
          <Routes>
            <Route path="/" element={null} />

            <Route path="/ep/:slug" element={<ReleaseDetailRoute {...releaseRouteProps} />} />
            <Route path="/album/:slug" element={<ReleaseDetailRoute {...releaseRouteProps} />} />
            <Route path="/single/:slug" element={<ReleaseDetailRoute {...releaseRouteProps} />} />

            <Route path="/collection/:slug" element={<ReleaseDetailRoute {...releaseRouteProps} />} />

            <Route path="/playlist/:id" element={
              <FeaturedPlaylistRoute
                allPlaylists={allPlaylists}
                userPlaylistIds={userPlaylistIds}
                songs={songs}
                player={player}
                dlStatuses={dl.statuses}
                onPlay={handlePlay}
                onAddToPlaylist={(songId, fromPlaylistId) => setSongSheet({ songId, fromPlaylistId })}
                onRename={pm.renamePlaylist}
                onDownload={song => dl.download(song, auth.token ?? undefined)}
                onRemoveDownload={dl.remove}
              />
            } />

            <Route path="/player" element={
              <NowPlaying
                player={player}
                onViewLyrics={player.currentSong?.lyrics ? () => setLyricsSong(player.currentSong!) : undefined}
              />
            } />

            <Route path="/library" element={
              <Playlists
                playlists={pm.playlists}
                songs={songs}
                onCreate={pm.createPlaylist}
                onSelect={id => navigate(`/library/playlist/${id}`)}
                onDelete={pm.deletePlaylist}
                onRename={pm.renamePlaylist}
              />
            } />

            <Route path="/library/playlist/:id" element={
              <LibraryPlaylistRoute
                playlists={pm.playlists}
                songs={songs}
                player={player}
                dlStatuses={dl.statuses}
                onPlay={handlePlay}
                onAddToPlaylist={(songId, fromPlaylistId) => setSongSheet({ songId, fromPlaylistId })}
                onRename={pm.renamePlaylist}
                onDownload={song => dl.download(song, auth.token ?? undefined)}
                onRemoveDownload={dl.remove}
              />
            } />

            <Route path="/shop" element={
              <Shop
                isPremium={isPremium}
                token={auth.token}
                hasPurchased={purchases.hasPurchased}
                onUpgradeSuccess={() => { auth.refreshUser(); purchases.refresh() }}
                songs={songs}
                onPreview={handlePlay}
                onPause={player.togglePlay}
                currentSongId={player.currentSong?.id}
                isPlaying={player.isPlaying}
              />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </>
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

      <BottomNav tab={tab} onChange={changeTab} />

      {accountModalOpen && auth.user && auth.token && (
        <AccountModal
          user={auth.user}
          token={auth.token}
          onClose={() => setAccountModalOpen(false)}
          onLogout={() => { setAccountModalOpen(false); auth.logout() }}
          onGoToShop={() => { setAccountModalOpen(false); changeTab('shop') }}
        />
      )}

      {songSheet && (
        <SongActionsSheet
          songTitle={songs.find(s => s.id === songSheet.songId)?.title ?? ''}
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
            if (song) dl.download(song, auth.token ?? undefined)
          }}
          onRemoveDownload={() => dl.remove(songSheet.songId)}
          onViewLyrics={(() => {
            const song = songs.find(s => s.id === songSheet.songId)
            return song?.lyrics ? () => { setLyricsSong(song); setSongSheet(null) } : undefined
          })()}
          onClose={() => setSongSheet(null)}
        />
      )}
    </div>
  )
}
