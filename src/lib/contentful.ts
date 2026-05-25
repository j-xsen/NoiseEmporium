// contentful.ts — fetches music content from the Contentful CMS.
//
// Contentful is the source of truth for songs, releases, and collections.
// Content is managed in the Contentful dashboard; the schema below must stay
// in sync with the actual content model or fields will silently be undefined.
//
// To add a new field: add it to the relevant interface below, the mapping in
// fetchReleases(), and the Song/Release types in types.ts.

import { createClient } from 'contentful'
import type { Release, Song } from '../types'
import { slugify } from '../utils/format'

export const contentfulClient = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
})

// ── Contentful field interfaces ───────────────────────────────────────────────
// These describe the resolved (include:2) shape returned by the Contentful SDK.
// Nested assets and entries are inlined by the SDK when include >= 1.

interface CfAsset {
  fields?: {
    file?: {
      url?: string
      details?: { size?: number }
    }
  }
}

interface CfSongFields {
  name?: string
  file?: CfAsset
  memberOnly?: boolean
  lyrics?: string
  duration?: number
  instrumental?: boolean
  pos?: number
  artist?: string
}

interface CfSongEntry {
  sys: { id: string }
  fields?: CfSongFields
}

// Contentful schema — Release (content type: "release")
//   name         — Symbol   (album/release title, display field)
//   releaseType  — Symbol   ('album' | 'ep' | 'single'; defaults to 'album' if absent)
//   artist       — Symbol   (optional; defaults to 'jaxsen' if absent)
//   date         — Date
//   cover        — Asset    (image — shared cover art for all tracks)
//   spotify      — Symbol
//   downloadUrl  — Symbol   (Vercel Blob URL for high-fidelity ZIP download; optional)
//   tracks       — Array of Links → Song entries (ordered by pos field)
interface CfReleaseFields {
  name?: string
  releaseType?: string
  artist?: string
  cover?: CfAsset
  date?: string
  spotify?: string
  downloadUrl?: string
  downloadFile?: CfAsset
  tracks?: CfSongEntry[]
  price?: number
  memberPrice?: number
}

// Contentful schema — Collection (content type: "collection")
//   title       — Symbol   (display field)
//   description — Symbol   (optional subtitle)
//   coverImage  — Asset    (optional cover art)
//   premiumOnly — Boolean  (if true, only premium users can access)
//   sortOrder   — Integer  (optional; lower = earlier; ties broken by title)
//   downloadUrl — Symbol   (Vercel Blob URL for high-fidelity ZIP download; optional)
//   tracks      — Array of Links → Song entries (order controlled in Contentful editor)
interface CfCollectionFields {
  title?: string
  artist?: string
  coverImage?: CfAsset
  description?: string
  premiumOnly?: boolean
  sortOrder?: number
  downloadUrl?: string
  tracks?: CfSongEntry[]
  price?: number
  memberPrice?: number
}

// Contentful schema — Song (content type: "song")
//   pos        — Integer  (sort order within release)
//   name       — Symbol   (track title, display field)
//   file       — Asset    (audio — must be M4A for preview system)
//   memberOnly — Boolean  (if true, only premium members can stream)
//   lyrics     — Long text (optional; line breaks preserved)

// ── Utilities ─────────────────────────────────────────────────────────────────

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

// Appends Contentful Image API transform params to a CDN URL.
// Only applies to ctfassets.net URLs — passes other URLs through unchanged.
export function contentfulImageUrl(
  url: string | undefined,
  width: number,
  quality = 85,
): string | undefined {
  if (!url) return undefined
  if (!url.includes('ctfassets.net')) return url
  return `${url}?w=${width}&fm=webp&q=${quality}&fit=fill`
}

function mapTracks(
  rawTracks: CfSongEntry[],
  artist: string,
  coverUrl: string | undefined,
  memberOnly_releaseId?: string,
): Song[] {
  const songs: Song[] = []
  for (const track of rawTracks) {
    if (!track?.fields) continue
    const tf = track.fields
    const memberOnly = tf.memberOnly === true
    const src = memberOnly
      ? `/api/plays?stream=${track.sys.id}${memberOnly_releaseId ? `&releaseId=${memberOnly_releaseId}` : ''}`
      : (assetUrl(tf.file?.fields?.file?.url) ?? '')
    if (!src) continue
    songs.push({
      id: track.sys.id,
      title: tf.name ?? 'Untitled',
      artist: tf.artist ?? artist,
      src,
      cover: coverUrl,
      memberOnly,
      lyrics: tf.lyrics,
      duration: tf.duration,
      instrumental: tf.instrumental === true,
    })
  }
  return songs
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

const CONTENTFUL_TIMEOUT_MS = 10_000
const PAGE_LIMIT = 200

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllEntries(contentType: string, query: Record<string, unknown>): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = []
  let skip = 0
  while (true) {
    const res = await contentfulClient.getEntries({ content_type: contentType, ...query, limit: PAGE_LIMIT, skip })
    items.push(...res.items)
    if (items.length >= res.total || res.items.length < PAGE_LIMIT) break
    skip += PAGE_LIMIT
  }
  return items
}

export async function fetchReleases(): Promise<Release[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Contentful request timed out')), CONTENTFUL_TIMEOUT_MS)
  )

  const [releaseItems, collectionItems] = await Promise.race([
    Promise.all([
      fetchAllEntries('release', { order: ['-fields.date'], include: 2 }),
      fetchAllEntries('collection', { order: ['fields.sortOrder', 'fields.title'], include: 2 }),
    ]),
    timeout,
  ])

  // Shim into the shape the rest of the function expects.
  const releaseRes = { items: releaseItems }
  const collectionRes = { items: collectionItems }

  const releases: Release[] = []

  for (const entry of releaseRes.items) {
    const rf = entry.fields as unknown as CfReleaseFields
    const name = rf.name ?? 'Untitled'
    const rawType = rf.releaseType?.toLowerCase()
    const releaseType: Release['releaseType'] =
      rawType === 'single' ? 'single' : rawType === 'ep' ? 'ep' : 'album'
    const artist = rf.artist ?? 'jaxsen'
    const coverUrl = assetUrl(rf.cover?.fields?.file?.url)
    const downloadFile = rf.downloadUrl ?? assetUrl(rf.downloadFile?.fields?.file?.url)
    const downloadFileSize = rf.downloadFile?.fields?.file?.details?.size
    const rawTracks = (rf.tracks ?? []) as CfSongEntry[]
    const sorted = rawTracks.filter(t => t?.fields).sort((a, b) => (a.fields?.pos ?? 0) - (b.fields?.pos ?? 0))
    const songs = mapTracks(sorted, artist, coverUrl, entry.sys.id)
    songs.forEach(s => { s.album = name })
    releases.push({
      id: entry.sys.id, slug: slugify(name), name, releaseType,
      date: rf.date,
      cover: coverUrl, spotify: rf.spotify,
      downloadFile,
      downloadFileSize,
      price: rf.price,
      memberPrice: rf.memberPrice,
      songs,
    })
  }

  for (const entry of collectionRes.items) {
    const f = entry.fields as unknown as CfCollectionFields
    const name = f.title ?? 'Untitled'
    const artist = f.artist ?? 'jaxsen'
    const coverUrl = assetUrl(f.coverImage?.fields?.file?.url)
    const songs = mapTracks((f.tracks ?? []) as CfSongEntry[], artist, coverUrl)
    releases.push({
      id: entry.sys.id, slug: slugify(name), name, releaseType: 'collection',
      cover: coverUrl,
      description: f.description,
      premiumOnly: f.premiumOnly === true,
      downloadFile: f.downloadUrl,
      price: f.price,
      memberPrice: f.memberPrice,
      songs,
    })
  }

  // Resolve file sizes for blob-URL releases (no Contentful asset size metadata available).
  const needsSize = releases.filter(r => r.downloadFile && !r.downloadFileSize)
  if (needsSize.length > 0) {
    await Promise.allSettled(needsSize.map(async r => {
      try {
        const res = await fetch(`/api/downloads?size=${encodeURIComponent(r.id)}`)
        if (res.ok) {
          const { size } = await res.json()
          if (typeof size === 'number') r.downloadFileSize = size
        }
      } catch {
        // size stays undefined — not critical
      }
    }))
  }

  return releases
}

export async function fetchSongs(): Promise<Song[]> {
  const releases = await fetchReleases()
  return releases.flatMap(r => r.songs)
}
