import { useState, useEffect, useCallback } from 'react'
import type { Playlist } from '../types'

const STORAGE_KEY = 'noise-emporium-playlists'

function load(): Playlist[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists))
  }, [playlists])

  const createPlaylist = useCallback((name: string): Playlist => {
    const p: Playlist = { id: Date.now().toString(), name: name.trim() || 'Untitled', songIds: [], createdAt: Date.now() }
    setPlaylists(ps => [...ps, p])
    return p
  }, [])

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(ps => ps.filter(p => p.id !== id))
  }, [])

  const renamePlaylist = useCallback((id: string, name: string) => {
    setPlaylists(ps => ps.map(p => p.id === id ? { ...p, name } : p))
  }, [])

  const addToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId && !p.songIds.includes(songId)
        ? { ...p, songIds: [...p.songIds, songId] }
        : p
    ))
  }, [])

  const removeFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(ps => ps.map(p =>
      p.id === playlistId
        ? { ...p, songIds: p.songIds.filter(id => id !== songId) }
        : p
    ))
  }, [])

  return { playlists, createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist }
}
