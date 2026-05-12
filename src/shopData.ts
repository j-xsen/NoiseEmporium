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
    id: 'membership-supporter',
    category: 'membership',
    name: 'Supporter',
    description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
    price: 100,
    priceId: 'price_1TW1bOKHXukW25xldpJMrnCb',
    mode: 'subscription',
  },
  {
    id: 'membership-enthusiast',
    category: 'membership',
    name: 'Enthusiast',
    description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
    price: 500,
    priceId: 'price_REPLACE_ENTHUSIAST',
    mode: 'subscription',
  },
  {
    id: 'membership-champion',
    category: 'membership',
    name: 'Champion',
    description: 'Full access to all member-only tracks and exclusive content. Billed monthly.',
    price: 1000,
    priceId: 'price_REPLACE_CHAMPION',
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
