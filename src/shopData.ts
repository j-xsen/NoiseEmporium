// shopData.ts — product definitions for the shop.
// Replace the priceId values with real Stripe Price IDs from your dashboard.
// Membership uses mode:'subscription'; CDs and downloads use mode:'payment'.

export type ShopCategory = 'membership' | 'cd' | 'download' | 'license'

export interface ShopProduct {
  id: string
  category: ShopCategory
  name: string
  description: string
  /** Price in cents (e.g. 500 = $5.00). Omit for negotiable/contact products. */
  price?: number
  /** Stripe Price ID — from your Stripe dashboard. Omit for contact-only products. */
  priceId?: string
  mode: 'payment' | 'subscription'
  image?: string
  /** If true, shows a "Contact to License" button instead of routing through Stripe. */
  contact?: boolean
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'membership-tier-1',
    category: 'membership',
    name: 'Tier 1',
    description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
    price: 500,
    priceId: 'price_1TWopFKHXukW25xlfG3qRJea',
    mode: 'subscription',
  },
  // Tier 2 and Tier 3 hidden until ready
  // {
  //   id: 'membership-tier-2',
  //   category: 'membership',
  //   name: 'Tier 2',
  //   description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
  //   price: 1000,
  //   priceId: 'price_1TWopTKHXukW25xlSDVvHEl5',
  //   mode: 'subscription',
  // },
  // {
  //   id: 'membership-tier-3',
  //   category: 'membership',
  //   name: 'Tier 3',
  //   description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
  //   price: 1500,
  //   priceId: 'price_1TWopcKHXukW25xlLoiFSlmW',
  //   mode: 'subscription',
  // },
  // ── CDs ───────────────────────────────────────────────────────────────────
  // Add one entry per physical CD you sell. Set priceId to the Stripe Price ID.
  // {
  //   id: 'cd-album-name',
  //   category: 'cd',
  //   name: 'Album Name — CD',
  //   description: 'Physical CD with full artwork and liner notes.',
  //   price: 1200,
  //   priceId: 'price_REPLACE_CD',
  //   mode: 'payment',
  //   image: '/covers/album.jpg',
  // },
  // ── Downloads ─────────────────────────────────────────────────────────────
  // Add one entry per digital download product.
  // {
  //   id: 'dl-album-name',
  //   category: 'download',
  //   name: 'Album Name — Digital Download',
  //   description: 'High-quality MP3 + FLAC download. Delivered via email.',
  //   price: 700,
  //   priceId: 'price_REPLACE_DOWNLOAD',
  //   mode: 'payment',
  //   image: '/covers/album.jpg',
  // },
  // ── Licenses ──────────────────────────────────────────────────────────────
  {
    id: 'license-instrumental',
    category: 'license',
    name: 'Instrumental License',
    description: 'Perpetual, non-exclusive license for any instrumental track. Use in YouTube videos, podcasts, streams, or personal projects. No expiration.',
    price: 5000,
    priceId: 'price_1TYLmpKHXukW25xlEcAHahta',
    mode: 'payment',
  },
  {
    id: 'license-release',
    category: 'license',
    name: 'Release License',
    description: 'Want to use one of my full releases (vocals included)? Reach out and we\'ll figure out something fair.',
    mode: 'payment',
    contact: true,
  },
]
