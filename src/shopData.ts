// shopData.ts — product definitions for the shop.
// Replace the priceId values with real Stripe Price IDs from your dashboard.
// Membership uses mode:'subscription'; CDs and downloads use mode:'payment'.

export type ShopCategory = 'membership' | 'cd' | 'download'

export interface ShopProduct {
  id: string
  category: ShopCategory
  name: string
  description: string
  /** Price in cents (e.g. 500 = $5.00) */
  price: number
  /** Stripe Price ID — from your Stripe dashboard */
  priceId: string
  mode: 'payment' | 'subscription'
  image?: string
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'premium-membership',
    category: 'membership',
    name: 'Premium Membership',
    description: 'Unlock all member-only tracks, offline downloads, and exclusive collections. Billed monthly.',
    price: 500,
    priceId: 'price_REPLACE_MEMBERSHIP',
    mode: 'subscription',
  },
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
]
