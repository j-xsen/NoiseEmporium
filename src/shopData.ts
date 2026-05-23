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
  /** Contentful release entry ID — required for 'download' category products. Links
   *  the shop product to a release for purchase gating and WAV delivery. */
  contentfulId?: string
}

/** Per-song instrumental licenses — priceId shared across all songs for each tier. */
export const INSTRUMENTAL_LICENSE = {
  personal: {
    priceId: 'price_1TZJb3KHXukW25xlr8A5C18i',
    priceCents: 500,
    label: 'Personal',
    description: 'Non-commercial videos, podcasts, personal projects, and hobby content.',
  },
  commercial: {
    priceId: 'price_1TYLmpKHXukW25xlEcAHahta',
    priceCents: 5000,
    label: 'Commercial',
    description: 'Ads, brand content, client work, and monetized YouTube channels.',
  },
} as const

export type InstrumentalLicenseType = keyof typeof INSTRUMENTAL_LICENSE

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: 'membership-tier-1',
    category: 'membership',
    name: 'Premium Membership',
    description: 'Full access to all member-only tracks, plus discounted prices on all downloads.',
    price: 500,
    priceId: 'price_1TWopFKHXukW25xlfG3qRJea',
    mode: 'subscription',
  },
  // Tier 2 and Tier 3 hidden until ready
  // {
  //   id: 'membership-tier-2',
  //   category: 'membership',
  //   name: 'Tier 2',
  //   price: 1000,
  //   priceId: 'price_1TWopTKHXukW25xlSDVvHEl5',
  //   mode: 'subscription',
  // },
  // {
  //   id: 'membership-tier-3',
  //   category: 'membership',
  //   name: 'Tier 3',
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
  // Release download products are driven entirely by Contentful — no entry
  // needed here. To make a release purchasable:
  //   1. Upload the WAV ZIP to Vercel Blob (private).
  //   2. Set the `downloadUrl` field on the Contentful release entry.
  //   3. Optionally set `price` / `memberPrice` (cents) on the entry.
  // The Buy button appears automatically on the release detail page.
  // ── Licenses ──────────────────────────────────────────────────────────────
  // Per-song instrumental licenses are generated dynamically from Contentful
  // songs that have `instrumental: true`. See INSTRUMENTAL_LICENSE above for the
  // shared Stripe Price ID. No entries needed here.
]
