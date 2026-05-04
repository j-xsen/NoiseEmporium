import { createClient } from 'contentful'
import type { Release, Song } from '../types'

export const contentfulClient = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
})

// Contentful schema:
//
// Release (content type: "release")
//   name       — Symbol   (album/release title, display field)
//   date       — Date
//   cover      — Asset    (image — shared cover art for all tracks)
//   spotify    — Symbol
//   tracks     — Array of Links → Song entries (ordered)
//
// Song (content type: "song")
//   pos        — Integer  (sort order within release)
//   name       — Symbol   (track title, display field)
//   file       — Asset    (audio)
//   memberOnly — Boolean  (if true, only premium members can stream)

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

export async function fetchReleases(): Promise<Release[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await contentfulClient.getEntries<any>({
    content_type: 'release',
    order: ['fields.date'],
    include: 2,
    limit: 200,
  })

  const releases: Release[] = []

  for (const release of res.items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rf = release.fields as any
    const coverUrl = assetUrl(rf.cover?.fields?.file?.url as string | undefined)
    const name: string = (rf.name as string | undefined) ?? 'Untitled'
    const date: string = (rf.date as string | undefined) ?? ''
    const spotify: string | undefined = rf.spotify as string | undefined

    const tracks: unknown[] = (rf.tracks as unknown[]) ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolved = tracks.filter((t: any) => t?.fields) as any[]
    resolved.sort((a, b) => (a.fields.pos ?? 0) - (b.fields.pos ?? 0))

    const songs: Song[] = []
    for (const track of resolved) {
      const tf = track.fields
      const src = assetUrl(tf.file?.fields?.file?.url)
      if (!src) continue
      songs.push({
        id: track.sys.id,
        title: tf.name ?? 'Untitled',
        album: name,
        cover: coverUrl,
        src,
        memberOnly: tf.memberOnly === true,
      })
    }

    releases.push({ id: release.sys.id, name, date, cover: coverUrl, spotify, songs })
  }

  return releases
}

export async function fetchSongs(): Promise<Song[]> {
  const releases = await fetchReleases()
  return releases.flatMap(r => r.songs)
}
