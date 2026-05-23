// api/_prices.ts — release download price defaults (cents).
//
// Must stay in sync with src/utils/format.ts DEFAULT_PRICES (client-side copy).
// Cannot share a module across the server/client boundary, so this is the
// server-side copy. Update both files when prices change.

export const DEFAULT_RELEASE_PRICES: Record<string, { full: number; member: number }> = {
  single:     { full: 200, member: 100 },
  album:      { full: 700, member: 500 },
  ep:         { full: 700, member: 500 },
  collection: { full: 700, member: 500 },
}
