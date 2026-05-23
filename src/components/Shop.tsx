import { useState, useEffect } from 'react'
import { StarIcon, CheckIcon, PlayIcon, PauseIcon } from './Icons'
import { SHOP_PRODUCTS, INSTRUMENTAL_LICENSE, type ShopCategory, type ShopProduct, type InstrumentalLicenseType } from '../shopData'
import { formatPrice } from '../utils/format'
import type { Song } from '../types'

interface ShopProps {
  isPremium: boolean
  token: string | null
  hasPurchased: (contentfulId: string) => boolean
  onUpgradeSuccess: () => void
  songs: Song[]
  onPreview?: (song: Song, queue: Song[]) => void
  onPause?: () => void
  currentSongId?: string
  isPlaying?: boolean
}

type Filter = 'all' | ShopCategory

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'membership', label: 'Memberships' },
  { id: 'cd', label: 'CDs' },
  { id: 'download', label: 'Downloads' },
  { id: 'license', label: 'Licenses' },
]

export default function Shop({ isPremium, token, hasPurchased, onUpgradeSuccess, songs, onPreview, onPause, currentSongId, isPlaying }: ShopProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedInstrumentalId, setSelectedInstrumentalId] = useState('')
  const [licenseType, setLicenseType] = useState<InstrumentalLicenseType>('personal')

  function toggleSection(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

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
    const tier = INSTRUMENTAL_LICENSE[licenseType]
    try {
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          priceId: tier.priceId,
          mode: 'payment',
          songId: song.id,
          songTitle: song.title,
          licenseType,
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

  const instrumentals = [...new Map(
    songs.filter(s => s.instrumental).map(s => [s.id, s])
  ).values()]

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
                <button className="shop-section__title" onClick={() => toggleSection('membership')}>
                  Membership
                  <span className={`shop-section__chevron${collapsed['membership'] ? '' : ' shop-section__chevron--open'}`}>›</span>
                </button>
                {!collapsed['membership'] && membershipProducts.map(product => {
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
                <button className="shop-section__title" onClick={() => toggleSection('cd')}>
                  CDs
                  <span className={`shop-section__chevron${collapsed['cd'] ? '' : ' shop-section__chevron--open'}`}>›</span>
                </button>
                {!collapsed['cd'] && cdProducts.map(product => {
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
                <button className="shop-section__title" onClick={() => toggleSection('download')}>
                  Downloads
                  <span className={`shop-section__chevron${collapsed['download'] ? '' : ' shop-section__chevron--open'}`}>›</span>
                </button>
                {!collapsed['download'] && downloadProducts.map(product => {
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
                <button className="shop-section__title" onClick={() => toggleSection('license')}>
                  Licenses
                  <span className={`shop-section__chevron${collapsed['license'] ? '' : ' shop-section__chevron--open'}`}>›</span>
                </button>
                {!collapsed['license'] && (instrumentals.length === 0 ? (
                  <p className="shop-section__empty">No instrumental tracks available for licensing yet.</p>
                ) : (
                  <div className="shop-row shop-row--license">
                    <div className="shop-row__icon">♩</div>
                    <div className="shop-row__info">
                      <div className="shop-row__name">Instrumental License</div>
                      <div className="shop-row__license-types">
                        {(Object.keys(INSTRUMENTAL_LICENSE) as InstrumentalLicenseType[]).map(type => (
                          <label key={type} className="shop-row__license-type">
                            <input
                              type="radio"
                              name="licenseType"
                              value={type}
                              checked={licenseType === type}
                              onChange={() => setLicenseType(type)}
                            />
                            <span className="shop-row__license-type-label">{INSTRUMENTAL_LICENSE[type].label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="shop-row__desc">{INSTRUMENTAL_LICENSE[licenseType].description}</div>
                      <div className="shop-row__select-row">
                        <select
                          className="shop-row__select"
                          value={selectedInstrumentalId}
                          onChange={e => setSelectedInstrumentalId(e.target.value)}
                        >
                          <option value="">Choose a track…</option>
                          {instrumentals.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        {(() => {
                          const selected = instrumentals.find(s => s.id === selectedInstrumentalId)
                          const isThisPlaying = !!selected && selected.id === currentSongId && isPlaying
                          return (
                            <button
                              className="shop-row__preview-btn"
                              disabled={!selected}
                              onClick={() => {
                                if (!selected) return
                                if (isThisPlaying) onPause?.()
                                else onPreview?.(selected, instrumentals)
                              }}
                              title={isThisPlaying ? 'Pause' : 'Preview track'}
                            >
                              {isThisPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
                            </button>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="shop-row__right">
                      <span className="shop-row__price">{formatPrice(INSTRUMENTAL_LICENSE[licenseType].priceCents)}</span>
                      {(() => {
                        const selected = instrumentals.find(s => s.id === selectedInstrumentalId)
                        const isLoading = !!selected && loading === `license-${selected.id}`
                        return (
                          <button
                            className="shop-row__btn"
                            onClick={() => selected && handleLicense(selected)}
                            disabled={!selected || isLoading}
                          >
                            {isLoading ? '…' : 'Purchase'}
                          </button>
                        )
                      })()}
                    </div>
                  </div>
                ))}
                {!collapsed['license'] && <p className="shop-contact-hint">
                  Need a vocal or full-release license?{' '}
                  <a href={`mailto:jaxsen@jxsen.com?subject=${encodeURIComponent('License Inquiry')}`}>
                    Contact →
                  </a>
                </p>}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
