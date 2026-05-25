export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Default prices in cents. Override per-entry via Contentful price/memberPrice fields.
const DEFAULT_PRICES = {
  single:  { full: 200, member: 100 },
  default: { full: 700, member: 500 },
} as const

export function releasePrice(
  release: { releaseType: string; price?: number; memberPrice?: number },
  isPremium: boolean,
): number {
  const def = release.releaseType === 'single' ? DEFAULT_PRICES.single : DEFAULT_PRICES.default
  return isPremium
    ? (release.memberPrice ?? def.member)
    : (release.price ?? def.full)
}

export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Returns the best available subtitle: artist, then album, then empty string. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export function songSubtitle(song: { artist?: string; album?: string }): string {
  return song.artist ?? song.album ?? ''
}

export function songGradient(title: string, artist?: string): string {
  const h = hashStr(title + (artist ?? ''))
  const hue1 = h % 360
  const hue2 = (hue1 + 137) % 360
  const cx = 20 + ((h >> 8) % 50)
  const cy = 15 + ((h >> 16) % 45)
  return `radial-gradient(ellipse at ${cx}% ${cy}%, hsl(${hue1}, 58%, 36%) 0%, hsl(${hue2}, 68%, 16%) 100%)`
}
