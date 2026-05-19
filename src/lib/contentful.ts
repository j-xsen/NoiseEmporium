// contentful.ts — fetches music content from the Contentful CMS.
//
// Contentful is the source of truth for songs, releases, and collections.
// Content is managed in the Contentful dashboard; the schema below must stay
// in sync with the actual content model or fields will silently be undefined.
//
// To add a new field: add it to the schema comment, the mapping below, and
// the Song/Release/Collection interface in types.ts.

import { createClient } from 'contentful'
import type { Release, Song } from '../types'
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
//   downloadUrl  — Symbol   (Vercel Blob URL for high-fidelity ZIP download; optional)
//   tracks       — Array of Links → Song entries (ordered)
//
// Collection (content type: "collection")
//   title       — Symbol   (display field)
//   description — Symbol   (optional subtitle)
//   coverImage  — Asset    (optional cover art)
//   premiumOnly — Boolean  (if true, only non-premium users without a purchase see the release locked)
//   sortOrder   — Integer  (optional; lower = earlier; ties broken by title)
//   downloadUrl — Symbol   (Vercel Blob URL for high-fidelity ZIP download; optional)
//   tracks      — Array of Links → Song entries (ordered)
//
// Song (content type: "song")
//   pos        — Integer  (sort order within release)
//   name       — Symbol   (track title, display field)
//   file       — Asset    (audio)
//   memberOnly — Boolean  (if true, only premium members can stream)
//   lyrics     — Long text (optional; rendered as HTML)

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

function mapTracks(rawTracks: unknown[], entryId: string, artist: string, coverUrl: string | undefined, memberOnly_releaseId?: string): Song[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolved = (rawTracks as any[]).filter(t => t?.fields)
  const songs: Song[] = []
  for (const track of resolved) {
    const tf = track.fields
    const memberOnly = tf.memberOnly === true
    const src = memberOnly
      ? `/api/plays?stream=${track.sys.id}${memberOnly_releaseId ? `&releaseId=${memberOnly_releaseId}` : ''}`
      : (assetUrl(tf.file?.fields?.file?.url) ?? '')
    if (!src) continue
    songs.push({
      id: track.sys.id,
      title: tf.name ?? 'Untitled',
      artist,
      src,
      cover: coverUrl,
      memberOnly,
      lyrics: tf.lyrics as string | undefined,
      duration: tf.duration as number | undefined,
    })
  }
  return songs
}

export async function fetchReleases(): Promise<Release[]> {
  const [releaseRes, collectionRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentfulClient.getEntries<any>({ content_type: 'release', order: ['-fields.date'], include: 2, limit: 200 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentfulClient.getEntries<any>({ content_type: 'collection', order: ['fields.sortOrder', 'fields.title'], include: 2, limit: 200 }),
  ])

  const releases: Release[] = []

  for (const entry of releaseRes.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = entry.fields as any
    const name: string = (rf.name as string | undefined) ?? 'Untitled'
    const rawType = (rf.releaseType as string | undefined)?.toLowerCase()
    const releaseType: Release['releaseType'] =
      rawType === 'single' ? 'single' : rawType === 'ep' ? 'ep' : 'album'
    const artist: string = (rf.artist as string | undefined) ?? 'jaxsen'
    const coverUrl = assetUrl(rf.cover?.fields?.file?.url as string | undefined)
    const downloadFile = (rf.downloadUrl as string | undefined)
      ?? assetUrl(rf.downloadFile?.fields?.file?.url as string | undefined)
    const rawTracks: unknown[] = (rf.tracks as unknown[]) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sorted = (rawTracks as any[]).filter(t => t?.fields).sort((a, b) => (a.fields.pos ?? 0) - (b.fields.pos ?? 0))
    const songs = mapTracks(sorted, entry.sys.id, artist, coverUrl, entry.sys.id)
    songs.forEach(s => { s.album = name })
    releases.push({
      id: entry.sys.id, slug: slugify(name), name, releaseType,
      date: rf.date as string | undefined,
      cover: coverUrl, spotify: rf.spotify as string | undefined,
      downloadFile, songs,
    })
  }

  for (const entry of collectionRes.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = entry.fields as any
    const name: string = (f.title as string | undefined) ?? 'Untitled'
    const artist: string = (f.artist as string | undefined) ?? 'jaxsen'
    const coverUrl = assetUrl(f.coverImage?.fields?.file?.url as string | undefined)
    const songs = mapTracks((f.tracks as unknown[]) ?? [], entry.sys.id, artist, coverUrl)
    releases.push({
      id: entry.sys.id, slug: slugify(name), name, releaseType: 'collection',
      cover: coverUrl,
      description: f.description as string | undefined,
      premiumOnly: f.premiumOnly === true,
      downloadFile: f.downloadUrl as string | undefined,
      songs,
    })
  }

  return releases
}

export async function fetchSongs(): Promise<Song[]> {
  const releases = await fetchReleases()
  return releases.flatMap(r => r.songs)
}
