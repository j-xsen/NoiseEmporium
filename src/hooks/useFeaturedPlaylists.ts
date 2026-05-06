import { useState, useEffect } from 'react'
import type { Playlist } from '../types'

export function useFeaturedPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  useEffect(() => {
    fetch('/api/playlists/featured')
      .then(r => r.json())
      .then(data => setPlaylists(data.playlists ?? []))
      .catch(console.error)
  }, [])

  return playlists
}
