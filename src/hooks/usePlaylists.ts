// usePlaylists.ts — user playlist CRUD backed by the /api/playlists API.
//
// All mutations use optimistic updates: local state is changed immediately and
// the API call happens in the background. On error, the previous state is restored.

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
    const prev = playlists
    setPlaylists(ps => ps.filter(p => p.id !== id))
    try {
      await fetch(`/api/playlists/${id}`, { method: 'DELETE', headers: authHeaders })
    } catch (err) {
      setPlaylists(prev)
      throw err
    }
  }, [authHeaders, playlists])

  const renamePlaylist = useCallback(async (id: string, name: string) => {
    const prev = playlists
    setPlaylists(ps => ps.map(p => p.id === id ? { ...p, name } : p))
    try {
      await fetch(`/api/playlists/${id}`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name }),
      })
    } catch (err) {
      setPlaylists(prev)
      throw err
    }
  }, [authHeaders, playlists])

  const addToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    const prev = playlists
    // Guard against duplicates client-side; the server also enforces uniqueness.
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId && !p.songIds.includes(songId)
        ? { ...p, songIds: [...p.songIds, songId] }
        : p
    ))
    try {
      await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ songId }),
      })
    } catch (err) {
      setPlaylists(prev)
      throw err
    }
  }, [authHeaders, playlists])

  const removeFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    const prev = playlists
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId ? { ...p, songIds: p.songIds.filter(id => id !== songId) } : p
    ))
    try {
      await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE', headers: authHeaders,
      })
    } catch (err) {
      setPlaylists(prev)
      throw err
    }
  }, [authHeaders, playlists])

  return { playlists, createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist }
}
