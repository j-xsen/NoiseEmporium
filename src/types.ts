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
}

export interface Release {
  id: string
  name: string
  date: string
  cover?: string
  spotify?: string
  songs: Song[]
}

export interface Playlist {
  id: string
  name: string
  songIds: string[]
  createdAt: number
}

export type LoopMode = 'off' | 'one' | 'all'
export type Tab = 'library' | 'player' | 'playlists'
