import { createClient } from 'contentful'
import type { Song } from '../types'

export const contentfulClient = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID ?? '',
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN ?? '',
})

// Contentful content type: "song"
//   pos      — Integer        (sort order)
//   name     — Symbol         (song title, display field)
//   file     — Asset/audio    (audio file)
//   embed    — Link → bandcampEmbed entry (ignored for player)
//   lyrics   — Text           (ignored for player)
//   spotify  — Symbol         (ignored for player)

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('//') ? 'https:' + url : url
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(entry: any): Song {
  const f = entry.fields
  return {
    id: entry.sys.id,
    title: f.name ?? 'Untitled',
    src: assetUrl(f.file?.fields?.file?.url) ?? '',
  }
}

export async function fetchSongs(): Promise<Song[]> {
  const res = await contentfulClient.getEntries({
    content_type: 'song',
    order: ['fields.pos'],
    limit: 1000,
  })
  return res.items.map(mapEntry).filter(s => s.src)
}
