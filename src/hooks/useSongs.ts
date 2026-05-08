// useSongs.ts — fetches all music content from Contentful on mount.
//
// Contentful is the single source of truth for songs, releases, and
// collections. The database only stores user data (accounts, playlists, plays).
// songs is a flat list derived from releases and is used by playlist screens
// to look up song metadata by ID.

import { useState, useEffect } from 'react'
import { fetchCollections, fetchReleases } from '../lib/contentful'
import type { Collection, Release, Song } from '../types'

type Status = 'loading' | 'ready' | 'error'

export function useSongs() {
  const [releases, setReleases] = useState<Release[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchReleases(), fetchCollections()])
      .then(([releaseData, collectionData]) => {
        setReleases(releaseData)
        // Flat song list for O(1) lookups by ID elsewhere in the app.
        setSongs(releaseData.flatMap(r => r.songs))
        setCollections(collectionData)
        setStatus('ready')
      })
      .catch(err => {
        console.error('Contentful fetch failed:', err)
        setError(err?.message ?? 'Failed to load songs')
        setStatus('error')
      })
  }, [])

  return { songs, releases, collections, status, error }
}
