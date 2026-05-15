// useFeaturedPlaylists.ts — loads curator-managed playlists from the API.
//
// Featured playlists are set via the database (featured = true on a playlist
// row) and are publicly readable without auth. They appear on the home screen
// and can be browsed — and optionally saved — by any logged-in user.

import { useState, useEffect } from 'react'
import type { Playlist } from '../types'

export function useFeaturedPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  useEffect(() => {
    fetch('/api/playlists/featured')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setPlaylists(data.playlists ?? []))
      .catch(console.error)
  }, [])

  return playlists
}
