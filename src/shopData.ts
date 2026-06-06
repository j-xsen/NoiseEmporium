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
  /** Member (Enthusiast) price in cents — shown as a discounted rate for premium users. */
  memberPrice?: number
  /** Stripe Price ID — from your Stripe dashboard. Omit for contact-only products. */
  priceId?: string
  mode: 'payment' | 'subscription'
  image?: string
  /** If true, shows a "Contact to License" button instead of routing through Stripe. */
  contact?: boolean
  /** Contentful release entry ID — required for 'download' category products. Links
   *  the shop product to a release for purchase gating and WAV delivery. */
  contentfulId?: string
  /** Maximum units available. Server enforces this; UI shows "Sold Out" when reached. */
  maxQuantity?: number
}

/** Per-song instrumental licenses — prices computed server-side from api/_prices.ts. */
export const INSTRUMENTAL_LICENSE = {
  personal: {
    priceCents: 500,
    label: 'Personal',
    description: 'Non-commercial videos, podcasts, personal projects, and hobby content.',
  },
  commercial: {
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
    name: 'Emporium Enthusiast',
    description: 'Full access to all member-only tracks, plus discounted prices on all downloads.',
    price: 500,
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
  // One-of-one physical CDs. Prices and maxQuantity are enforced server-side in api/_prices.ts.
  // Place CD photos in public/images/ and update the image paths below.
  {
    id: 'cd-oo-1',
    category: 'cd',
    name: 'Snowball Edition',
    description: 'One-of-one physical CD.',
    price: 2000,
    memberPrice: 1200,
    mode: 'payment',
    maxQuantity: 1,
    image: '/images/cd-oo-1.avif',
  },
  {
    id: 'cd-oo-2',
    category: 'cd',
    name: 'Daydream Edition',
    description: 'One-of-one physical CD.',
    price: 2000,
    memberPrice: 1200,
    mode: 'payment',
    maxQuantity: 1,
    image: '/images/cd-oo-2.avif',
  },
  {
    id: 'cd-oo-3',
    category: 'cd',
    name: 'Gray Edition',
    description: 'One-of-one physical CD.',
    price: 2000,
    memberPrice: 1200,
    mode: 'payment',
    maxQuantity: 1,
    image: '/images/cd-oo-3.avif',
  },
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
