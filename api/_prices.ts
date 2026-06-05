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

export const INSTRUMENTAL_LICENSE_PRICES: Record<string, { full: number; member: number }> = {
  personal:   { full: 500,  member: 250  },
  commercial: { full: 5000, member: 2500 },
}

// Physical CD prices — keyed by shopData product ID.
// maxQuantity: 1 means one-of-one; the UNIQUE(cd_id) constraint in cd_orders enforces this at the DB level.
export const CD_PRICES: Record<string, { full: number; member: number; maxQuantity: number; name: string }> = {
  'cd-oo-1': { full: 2000, member: 1200, maxQuantity: 1, name: 'Snowball Edition' },
  'cd-oo-2': { full: 2000, member: 1200, maxQuantity: 1, name: 'Daydream Edition' },
  'cd-oo-3': { full: 2000, member: 1200, maxQuantity: 1, name: 'Gray Edition' },
}
