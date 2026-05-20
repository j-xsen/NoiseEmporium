import { useState, useEffect } from 'react'
import { StarIcon, CheckIcon } from './Icons'
import { SHOP_PRODUCTS, INSTRUMENTAL_LICENSE, type ShopCategory, type ShopProduct } from '../shopData'
import { formatPrice } from '../utils/format'
import type { Song } from '../types'

interface ShopProps {
  isPremium: boolean
  token: string | null
  hasPurchased: (contentfulId: string) => boolean
  onUpgradeSuccess: () => void
  songs: Song[]
}

type Filter = 'all' | ShopCategory

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'membership', label: 'Memberships' },
  { id: 'cd', label: 'CDs' },
  { id: 'download', label: 'Downloads' },
  { id: 'license', label: 'Licenses' },
]

export default function Shop({ isPremium, token, hasPurchased, onUpgradeSuccess, songs }: ShopProps) {
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

  async function handleLicense(song: Song) {
    if (!token) return
    setLoading(`license-${song.id}`)
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          priceId: INSTRUMENTAL_LICENSE.priceId,
          mode: 'payment',
          songId: song.id,
          songTitle: song.title,
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

  const instrumentals = songs.filter(s => s.instrumental)

  const membershipProducts = SHOP_PRODUCTS.filter(p => p.category === 'membership')
  const cdProducts = SHOP_PRODUCTS.filter(p => p.category === 'cd')
  const downloadProducts = SHOP_PRODUCTS.filter(p => p.category === 'download')

  const showMembership = filter === 'all' || filter === 'membership'
  const showCd = filter === 'all' || filter === 'cd'
  const showDownload = filter === 'all' || filter === 'download'
  const showLicense = filter === 'all' || filter === 'license'

  const hasContent =
    (showMembership && membershipProducts.length > 0) ||
    (showCd && cdProducts.length > 0) ||
    (showDownload && downloadProducts.length > 0) ||
    (showLicense && instrumentals.length > 0)

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Instrumental Licenses</h1>
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
        {!hasContent ? (
          <div className="empty-state">
            <div className="empty-icon">🛍</div>
            <p className="empty-title">Nothing here yet</p>
            <p className="empty-hint">Check back soon.</p>
          </div>
        ) : (
          <div className="shop-list">
            {showMembership && membershipProducts.length > 0 && (
              <section className="shop-section">
                <h2 className="shop-section__title">Membership</h2>
                {membershipProducts.map(product => {
                  const owned = isPremium
                  const isLoading = loading === product.id
                  return (
                    <div key={product.id} className="shop-row shop-row--featured">
                      <div className="shop-row__icon shop-row__icon--featured">
                        <StarIcon size={16} />
                      </div>
                      <div className="shop-row__info">
                        <div className="shop-row__name">{product.name}</div>
                        <div className="shop-row__desc">{product.description}</div>
                      </div>
                      <div className="shop-row__right">
                        <span className="shop-row__price">
                          {formatPrice(product.price ?? 0)}
                          <span className="shop-row__period">/mo</span>
                        </span>
                        {owned ? (
                          <span className="shop-row__active">
                            <CheckIcon size={12} />
                            Active
                          </span>
                        ) : (
                          <button
                            className="shop-row__btn shop-row__btn--featured"
                            onClick={() => handleBuy(product)}
                            disabled={isLoading}
                          >
                            {isLoading ? '…' : 'Upgrade'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            )}

            {showCd && cdProducts.length > 0 && (
              <section className="shop-section">
                <h2 className="shop-section__title">CDs</h2>
                {cdProducts.map(product => {
                  const owned = !!product.contentfulId && hasPurchased(product.contentfulId)
                  const isLoading = loading === product.id
                  return (
                    <div key={product.id} className="shop-row">
                      <div className="shop-row__icon">💿</div>
                      <div className="shop-row__info">
                        <div className="shop-row__name">{product.name}</div>
                        <div className="shop-row__desc">{product.description}</div>
                      </div>
                      <div className="shop-row__right">
                        <span className="shop-row__price">{product.price != null ? formatPrice(product.price) : '—'}</span>
                        {owned ? (
                          <span className="shop-row__active"><CheckIcon size={12} />Owned</span>
                        ) : (
                          <button className="shop-row__btn" onClick={() => handleBuy(product)} disabled={isLoading}>
                            {isLoading ? '…' : 'Buy'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            )}

            {showDownload && downloadProducts.length > 0 && (
              <section className="shop-section">
                <h2 className="shop-section__title">Downloads</h2>
                {downloadProducts.map(product => {
                  const owned = !!product.contentfulId && hasPurchased(product.contentfulId)
                  const isLoading = loading === product.id
                  return (
                    <div key={product.id} className="shop-row">
                      <div className="shop-row__icon">⬇︎</div>
                      <div className="shop-row__info">
                        <div className="shop-row__name">{product.name}</div>
                        <div className="shop-row__desc">{product.description}</div>
                      </div>
                      <div className="shop-row__right">
                        <span className="shop-row__price">{product.price != null ? formatPrice(product.price) : '—'}</span>
                        {owned ? (
                          <span className="shop-row__active"><CheckIcon size={12} />Owned</span>
                        ) : (
                          <button className="shop-row__btn" onClick={() => handleBuy(product)} disabled={isLoading}>
                            {isLoading ? '…' : 'Buy'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            )}

            {showLicense && (
              <section className="shop-section">
                <h2 className="shop-section__title">Licenses</h2>
                {instrumentals.length === 0 ? (
                  <p className="shop-section__empty">No instrumental tracks available for licensing yet.</p>
                ) : (
                  instrumentals.map(song => {
                    const isLoading = loading === `license-${song.id}`
                    return (
                      <div key={song.id} className="shop-row">
                        <div className="shop-row__icon">♩</div>
                        <div className="shop-row__info">
                          <div className="shop-row__name">{song.title}</div>
                          {song.album && <div className="shop-row__desc">{song.album}</div>}
                        </div>
                        <div className="shop-row__right">
                          <span className="shop-row__price">{formatPrice(INSTRUMENTAL_LICENSE.priceCents)}</span>
                          <button
                            className="shop-row__btn"
                            onClick={() => handleLicense(song)}
                            disabled={isLoading}
                          >
                            {isLoading ? '…' : 'License'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
                <p className="shop-contact-hint">
                  Need a vocal or full-release license?{' '}
                  <a href={`mailto:jaxsen@jxsen.com?subject=${encodeURIComponent('License Inquiry')}`}>
                    Contact →
                  </a>
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
