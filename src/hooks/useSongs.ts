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
