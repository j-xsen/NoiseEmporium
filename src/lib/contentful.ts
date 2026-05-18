// contentful.ts — fetches music content from the Contentful CMS.
//
// Contentful is the source of truth for songs, releases, and collections.
// Content is managed in the Contentful dashboard; the schema below must stay
// in sync with the actual content model or fields will silently be undefined.
//
// To add a new field: add it to the schema comment, the mapping below, and
// the Song/Release/Collection interface in types.ts.

import { createClient } from 'contentful'
import type { Collection, Release, Song } from '../types'
import { slugify } from '../utils/format'

export const contentfulClient = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
})

// Contentful schema:
//
// Release (content type: "release")
//   name         — Symbol   (album/release title, display field)
//   releaseType  — Symbol   ('album' | 'ep' | 'single'; defaults to 'album' if absent)
//   artist       — Symbol   (optional; defaults to "Jaxsen Honeycutt" if absent)
//   date         — Date
//   cover        — Asset    (image — shared cover art for all tracks)
//   spotify      — Symbol
//   downloadFile — Asset    (ZIP file for high-fidelity download; optional)
//   tracks       — Array of Links → Song entries (ordered)
//
// Song (content type: "song")
//   pos        — Integer  (sort order within release)
//   name       — Symbol   (track title, display field)
//   file       — Asset    (audio)
//   memberOnly — Boolean  (if true, only premium members can stream)
//   lyrics     — Long text (optional; rendered as HTML)
//
// Collection (content type: "collection")
//   title       — Symbol   (display field)
//   description — Symbol   (optional subtitle)
//   coverImage  — Asset    (optional cover art)
//   premiumOnly — Boolean  (if true, only premium members can enter)
//   sortOrder   — Integer  (optional; lower = earlier; ties broken by title)
//   tracks      — Array of Links → Song entries (ordered)

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

export async function fetchReleases(): Promise<Release[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await contentfulClient.getEntries<any>({
    content_type: 'release',
    order: ['-fields.date'],
    include: 2,
    limit: 200,
  })

  const releases: Release[] = []

  for (const release of res.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = release.fields as any
    const coverUrl = assetUrl(rf.cover?.fields?.file?.url as string | undefined)
    const name: string = (rf.name as string | undefined) ?? 'Untitled'
    const rawType = (rf.releaseType as string | undefined)?.toLowerCase()
    const releaseType: Release['releaseType'] =
      rawType === 'single' ? 'single' : rawType === 'ep' ? 'ep' : 'album'
    const artist: string = (rf.artist as string | undefined) ?? 'jaxsen'
    const date: string = (rf.date as string | undefined) ?? ''
    const spotify: string | undefined = rf.spotify as string | undefined
    const downloadFile = assetUrl(rf.downloadFile?.fields?.file?.url as string | undefined)

    const tracks: unknown[] = (rf.tracks as unknown[]) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolved = tracks.filter((t: any) => t?.fields) as any[]
    resolved.sort((a, b) => (a.fields.pos ?? 0) - (b.fields.pos ?? 0))

    const songs: Song[] = []
    for (const track of resolved) {
      const tf = track.fields
      const memberOnly = tf.memberOnly === true
      // For member-only tracks, use the server-side stream proxy so the real CDN
      // URL is never sent to the client. The token is appended at play time in
      // App.tsx once we know the user is authenticated and premium.
      // releaseId is embedded so the proxy can also check purchase rights.
      const src = memberOnly
        ? `/api/plays?stream=${track.sys.id}&releaseId=${release.sys.id}`
        : (assetUrl(tf.file?.fields?.file?.url) ?? '')
      if (!src) continue
      songs.push({
        id: track.sys.id,
        title: tf.name ?? 'Untitled',
        artist,
        album: name,
        cover: coverUrl,
        src,
        memberOnly,
        lyrics: tf.lyrics as string | undefined,
        duration: tf.duration as number | undefined,
      })
    }

    releases.push({ id: release.sys.id, slug: slugify(name), name, releaseType, date, cover: coverUrl, spotify, downloadFile, songs })
  }

  return releases
}

export async function fetchSongs(): Promise<Song[]> {
  const releases = await fetchReleases()
  return releases.flatMap(r => r.songs)
}

export async function fetchCollections(): Promise<Collection[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await contentfulClient.getEntries<any>({
    content_type: 'collection',
    order: ['fields.sortOrder', 'fields.title'],
    include: 2,
    limit: 200,
  })

  const collections: Collection[] = []

  for (const entry of res.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = entry.fields as any
    const title: string = (f.title as string | undefined) ?? 'Untitled'
    const collectionArtist: string = (f.artist as string | undefined) ?? 'jaxsen'
    const description: string | undefined = f.description as string | undefined
    const coverUrl = assetUrl(f.coverImage?.fields?.file?.url as string | undefined)
    const premiumOnly: boolean = f.premiumOnly === true

    const rawTracks: unknown[] = (f.tracks as unknown[]) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolved = rawTracks.filter((t: any) => t?.fields) as any[]

    const tracks: Song[] = []
    for (const track of resolved) {
      const tf = track.fields
      const memberOnly = tf.memberOnly === true
      const src = memberOnly
        ? `/api/plays?stream=${track.sys.id}`
        : (assetUrl(tf.file?.fields?.file?.url) ?? '')
      if (!src) continue
      tracks.push({
        id: track.sys.id,
        title: tf.name ?? 'Untitled',
        artist: (tf.artist as string | undefined) ?? collectionArtist,
        src,
        cover: coverUrl,
        memberOnly,
        lyrics: tf.lyrics as string | undefined,
        duration: tf.duration as number | undefined,
      })
    }

    collections.push({ id: entry.sys.id, slug: slugify(title), title, description, cover: coverUrl, premiumOnly, tracks })
  }

  return collections
}
