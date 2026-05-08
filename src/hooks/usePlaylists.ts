// usePlaylists.ts — user playlist CRUD backed by the /api/playlists API.
//
// All mutations use optimistic updates: local state is changed immediately and
// the API call happens in the background. This keeps the UI instant.
// If an API call fails the state will be out of sync until the next reload,
// which is acceptable for a personal playlist use case.

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Playlist } from '../types'

export function usePlaylists(token: string | null) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  // Memoised so it doesn't invalidate useCallback/useEffect deps on every render.
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  }), [token])

  // Fetch playlists whenever the auth token changes (login / logout).
  // On logout token is null, so we clear local state immediately.
  useEffect(() => {
    if (!token) { setPlaylists([]); return }
    fetch('/api/playlists', { headers: authHeaders })
      .then(r => r.json())
      .then(d => setPlaylists(d.playlists ?? []))
      .catch(console.error)
  }, [token, authHeaders])

  const createPlaylist = useCallback(async (name: string): Promise<Playlist> => {
    const r = await fetch('/api/playlists', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ name }),
    })
    const { playlist } = await r.json()
    setPlaylists(ps => [...ps, playlist])
    return playlist
  }, [authHeaders])

  const deletePlaylist = useCallback(async (id: string) => {
    // Optimistic: remove from UI first, then delete on server.
    setPlaylists(ps => ps.filter(p => p.id !== id))
    await fetch(`/api/playlists/${id}`, { method: 'DELETE', headers: authHeaders })
  }, [authHeaders])

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    setPlaylists(ps => ps.map(p => p.id === id ? { ...p, name } : p))
    await fetch(`/api/playlists/${id}`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name }),
    })
  }, [authHeaders])

  const addToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    // Guard against duplicates client-side; the server also enforces uniqueness.
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId && !p.songIds.includes(songId)
        ? { ...p, songIds: [...p.songIds, songId] }
        : p
    ))
    await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ songId }),
    })
  }, [authHeaders])

  const removeFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId ? { ...p, songIds: p.songIds.filter(id => id !== songId) } : p
    ))
    await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
      method: 'DELETE', headers: authHeaders,
    })
  }, [authHeaders])

  return { playlists, createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist }
}
