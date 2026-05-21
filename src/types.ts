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
  /** If true, this track is an instrumental and available for licensing in the shop. */
  instrumental?: boolean
}

export interface Release {
  id: string
  slug: string
  name: string
  releaseType: 'album' | 'ep' | 'single' | 'collection'
  date?: string
  cover?: string
  spotify?: string
  description?: string
  /** If true, non-premium users without a purchase see the full release locked. */
  premiumOnly?: boolean
  /** URL to the high-fidelity ZIP download (WAV/FLAC), stored in Contentful downloadUrl field, hosted on Vercel Blob. */
  downloadFile?: string
  /** One-time purchase price in cents for non-members. Falls back to type-based default if unset. */
  price?: number
  /** One-time purchase price in cents for premium members. Falls back to type-based default if unset. */
  memberPrice?: number
  songs: Song[]
}

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
}

export type LoopMode = 'off' | 'one' | 'all'
export type Tab = 'home' | 'player' | 'library' | 'shop'
