import { useState, useEffect } from 'react'
import { StarIcon, CheckIcon } from './Icons'
import { SHOP_PRODUCTS, type ShopCategory, type ShopProduct } from '../shopData'
import { formatPrice } from '../utils/format'

interface ShopProps {
  isPremium: boolean
  token: string | null
  hasPurchased: (contentfulId: string) => boolean
  onUpgradeSuccess: () => void
}

type Filter = 'all' | ShopCategory

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'membership', label: 'Memberships' },
  { id: 'cd', label: 'CDs' },
  { id: 'download', label: 'Downloads' },
  { id: 'license', label: 'Licenses' },
]

const CATEGORY_LABELS: Record<string, string> = {
  membership: 'Membership',
  cd: 'CD',
  download: 'Download',
  license: 'License',
}

export default function Shop({ isPremium, token, hasPurchased, onUpgradeSuccess }: ShopProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setCheckoutStatus('success')
      window.history.replaceState({}, '', window.location.pathname)
      const sessionId = params.get('session_id')
      if (sessionId && token) {
        fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'fulfill', sessionId }),
        }).finally(() => onUpgradeSuccess())
      } else {
        onUpgradeSuccess()
      }
    } else if (params.get('checkout') === 'cancelled') {
      setCheckoutStatus('cancelled')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [onUpgradeSuccess, token])

  async function handleBuy(product: ShopProduct) {
    if (!token || !product.priceId) return
    setLoading(product.id)
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          priceId: product.priceId,
          mode: product.mode,
          ...(product.contentfulId && { contentfulId: product.contentfulId }),
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error ?? 'Checkout failed')
      window.location.href = data.url
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const visible = SHOP_PRODUCTS.filter(p => filter === 'all' || p.category === filter)

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Shop</h1>
        </div>
      </div>

      {checkoutStatus === 'success' && (
        <div className="shop-banner shop-banner--success">
          <CheckIcon size={16} />
          <span>Purchase complete — thank you!</span>
          <button className="shop-banner__close" onClick={() => setCheckoutStatus(null)}>✕</button>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="shop-banner shop-banner--cancelled">
          <span>Checkout cancelled.</span>
          <button className="shop-banner__close" onClick={() => setCheckoutStatus(null)}>✕</button>
        </div>
      )}

      <div className="shop-filters">
        {FILTER_LABELS.map(({ id, label }) => (
          <button
            key={id}
            className={`shop-filter ${filter === id ? 'shop-filter--active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="scroll-area">
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛍</div>
            <p className="empty-title">Nothing here yet</p>
            <p className="empty-hint">Check back soon.</p>
          </div>
        ) : (
          <ul className="shop-grid">
            {visible.map(product => {
              const isMembership = product.category === 'membership'
              const alreadyOwned = (isMembership && isPremium)
                || (product.category === 'download' && !!product.contentfulId && hasPurchased(product.contentfulId))
              const isLoading = loading === product.id

              return (
                <li key={product.id} className={`shop-card ${isMembership ? 'shop-card--featured' : ''}`}>
                  <div className="shop-card__img-wrap">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="shop-card__img" />
                    ) : (
                      <div className="shop-card__img-placeholder">
                        {isMembership ? <StarIcon size={32} /> : '♪'}
                      </div>
                    )}
                    <span className="shop-card__category-tag">
                      {CATEGORY_LABELS[product.category] ?? product.category}
                    </span>
                  </div>

                  <div className="shop-card__body">
                    <div className="shop-card__header">
                      <span className="shop-card__name">{product.name}</span>
                      <span className="shop-card__price">
                        {product.contact ? 'Negotiable' : product.price != null ? formatPrice(product.price) : '—'}
                        {product.mode === 'subscription' && <span className="shop-card__period">/mo</span>}
                      </span>
                    </div>
                    <p className="shop-card__desc">{product.description}</p>

                    {alreadyOwned ? (
                      <div className="shop-card__active">
                        <CheckIcon size={14} />
                        <span>Active</span>
                      </div>
                    ) : product.contact ? (
                      <a
                        className="shop-card__cta"
                        href={`mailto:jaxsen@jxsen.com?subject=${encodeURIComponent('Commercial License Inquiry')}`}
                      >
                        Contact to License
                      </a>
                    ) : (
                      <button
                        className="shop-card__cta"
                        onClick={() => handleBuy(product)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Redirecting…' : isMembership ? 'Upgrade to Premium' : 'Buy'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
