// useSongs.ts — fetches all music content from Contentful on mount.
//
// Contentful is the single source of truth for songs and releases (which
// includes collections — same type, releaseType === 'collection').
// The database only stores user data (accounts, playlists, plays).
// songs is a flat list derived from releases and is used by playlist screens
// to look up song metadata by ID.

import { useState, useEffect } from 'react'
import { fetchReleases } from '../lib/contentful'
import type { Release, Song } from '../types'

type Status = 'loading' | 'ready' | 'error'

export function useSongs() {
  const [releases, setReleases] = useState<Release[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReleases()
      .then(data => {
        setReleases(data)
        setSongs(data.flatMap(r => r.songs))
        setStatus('ready')
      })
      .catch(err => {
        console.error('Contentful fetch failed:', err)
        setError(err?.message ?? 'Failed to load songs')
        setStatus('error')
      })
  }, [])

  return { songs, releases, status, error }
}
