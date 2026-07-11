import { songGradient } from '../utils/format'
import { contentfulImageUrl } from '../lib/contentful'
import type { Song } from '../types'

interface CoverArtProps {
  song: Song
  size?: number | string
  className?: string
  style?: React.CSSProperties
}

export default function CoverArt({ song, size, className, style }: CoverArtProps) {
  const sizeStyle = size !== undefined ? { width: size, height: size } : {}

  if (song.cover) {
    return (
      <img
        src={contentfulImageUrl(song.cover, 300)}
        alt={song.album ?? song.title}
        className={className}
        style={{ objectFit: 'cover', ...sizeStyle, ...style }}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <div
      className={className}
      style={{ background: songGradient(song.title, song.artist), ...sizeStyle, ...style }}
    />
  )
}
