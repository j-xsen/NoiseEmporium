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
