import { useState, useEffect } from 'react'
import { fetchSongs } from '../lib/contentful'
import type { Song } from '../types'

type Status = 'loading' | 'ready' | 'error'

export function useSongs() {
  const [songs, setSongs] = useState<Song[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSongs()
      .then(data => { setSongs(data); setStatus('ready') })
      .catch(err => {
        console.error('Contentful fetch failed:', err)
        setError(err?.message ?? 'Failed to load songs')
        setStatus('error')
      })
  }, [])

  return { songs, status, error }
}
