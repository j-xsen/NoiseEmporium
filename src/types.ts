export interface Song {
  id: string
  title: string
  artist?: string
  album?: string
  /** Path relative to public/, e.g. '/music/track.mp3' */
  src: string
  /** Optional cover image path, e.g. '/covers/album.jpg'. Falls back to generated art. */
  cover?: string
  /** If true, only premium members can play this track. */
  memberOnly?: boolean
  /** Song lyrics as HTML from Contentful. */
  lyrics?: string
  /** Duration in seconds from Contentful. */
  duration?: number
}

export interface Release {
  id: string
  slug: string
  name: string
  /** Contentful field: 'album' | 'ep' | 'single'. Defaults to 'album' if unset. */
  releaseType: 'album' | 'ep' | 'single'
  date: string
  cover?: string
  spotify?: string
  /** URL to the high-fidelity ZIP download (WAV/FLAC), stored in Contentful downloadUrl field, hosted on Vercel Blob. */
  downloadFile?: string
  songs: Song[]
}

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
}

export interface Collection {
  id: string
  slug: string
  title: string
  description?: string
  cover?: string
  premiumOnly: boolean
  tracks: Song[]
}

export type LoopMode = 'off' | 'one' | 'all'
export type Tab = 'home' | 'player' | 'library' | 'shop'
