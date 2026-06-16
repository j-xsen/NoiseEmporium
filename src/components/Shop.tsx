import { useState, useEffect } from 'react'
import { StarIcon, CheckIcon, PlayIcon, PauseIcon } from './Icons'
import { SHOP_PRODUCTS, INSTRUMENTAL_LICENSE, type ShopCategory, type ShopProduct, type InstrumentalLicenseType } from '../shopData'
import { formatPrice, releasePrice } from '../utils/format'
import { api } from '../lib/api'
import { track } from '../lib/umami'
import type { Song, Release } from '../types'

interface ShopProps {
  isPremium: boolean
  cancelAtPeriodEnd?: boolean
  subscriptionEndsAt?: string | null
  token: string | null
  hasPurchased: (contentfulId: string) => boolean
  onUpgradeSuccess: () => void
  onCancelSubscription?: () => Promise<string>
  onSignIn: () => void
  songs: Song[]
  releases: Release[]
  onBuyRelease: (contentfulId: string) => Promise<void> | void
  onDownloadWav: (contentfulId: string) => Promise<void> | void
  downloadingReleaseId?: string | null
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

export default function Shop({ isPremium, cancelAtPeriodEnd, subscriptionEndsAt: _subscriptionEndsAt, token, hasPurchased, onUpgradeSuccess, onCancelSubscription, onSignIn, songs, releases, onBuyRelease, onDownloadWav, downloadingReleaseId, onPreview, onPause, currentSongId, isPlaying }: ShopProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState<string | null>(null)
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancelled' | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedInstrumentalId, setSelectedInstrumentalId] = useState('')
  const [licenseType, setLicenseType] = useState<InstrumentalLicenseType>('personal')
  const [membershipPriceId, setMembershipPriceId] = useState<string | null>(null)
  const [cdSoldIds, setCdSoldIds] = useState<string[]>([])
  const [cancelLoading, setCancelLoading] = useState(false)

  function fetchShopInfo() {
    return api.get<{ membershipPriceId: string | null; cdSoldIds: string[] }>('/api/stripe/checkout')
      .then(data => {
        setMembershipPriceId(data.membershipPriceId)
        setCdSoldIds(data.cdSoldIds ?? [])
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchShopInfo()
  }, [])

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
        api.post('/api/stripe/checkout', { action: 'fulfill', sessionId }, token)
          .finally(() => {
            onUpgradeSuccess()
            fetchShopInfo()
          })
      } else {
        onUpgradeSuccess()
      }
    } else if (params.get('checkout') === 'cancelled') {
      setCheckoutStatus('cancelled')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [onUpgradeSuccess, token])

  async function handleBuy(product: ShopProduct) {
    if (!token) { onSignIn(); return }

    if (product.category === 'cd') {
      setLoading(product.id)
      try {
        const { url } = await api.post<{ url: string }>('/api/stripe/checkout', {
          mode: 'payment',
          cdId: product.id,
        }, token)
        track('purchase_start', { type: 'cd', product: product.name })
        window.location.href = url
      } catch (err: unknown) {
        console.error(err)
        const msg = err instanceof Error ? err.message : ''
        alert(msg.includes('Sold out') ? 'Sorry — this CD just sold out.' : 'Something went wrong. Please try again.')
      } finally {
        setLoading(null)
      }
      return
    }

    const priceId = product.mode === 'subscription' ? membershipPriceId : product.priceId
    if (!priceId) return
    setLoading(product.id)
    try {
      const { url } = await api.post<{ url: string }>('/api/stripe/checkout', {
        priceId,
        mode: product.mode,
        ...(product.contentfulId ? { contentfulId: product.contentfulId } : {}),
      }, token)
      track('purchase_start', { type: product.category, product: product.name })
      window.location.href = url
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function handleLicense(song: Song) {
    if (!token) { onSignIn(); return }
    setLoading(`license-${song.id}`)
    try {
      const { url } = await api.post<{ url: string }>('/api/stripe/checkout', {
        mode: 'payment',
        songId: song.id,
        songTitle: song.title,
        licenseType,
      }, token)
      track('purchase_start', { type: 'license', licenseType, song: song.title })
      window.location.href = url
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
  const RELEASE_TYPE_ORDER = ['ep', 'single', 'collection', 'album']
  const downloadableReleases = releases
    .filter(r => r.downloadFile)
    .sort((a, b) => RELEASE_TYPE_ORDER.indexOf(a.releaseType) - RELEASE_TYPE_ORDER.indexOf(b.releaseType))

  const showMembership = filter === 'all' || filter === 'membership'
  const showCd = filter === 'all' || filter === 'cd'
  const showDownload = filter === 'all' || filter === 'download'
  const showLicense = filter === 'all' || filter === 'license'

  const hasContent =
    (showMembership && membershipProducts.length > 0) ||
    (showCd && cdProducts.length > 0) ||
    (showDownload && downloadableReleases.length > 0) ||
    (showLicense && instrumentals.length > 0)

  return (
    <div className="screen-layout">
      <div className="screen-header">
        <div className="screen-header__center">
          <h1 className="screen-title">Shop</h1>
        </div>
      </div>

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
                          <div className="shop-row__active-col">
                            <span className="shop-row__active">
                              <CheckIcon size={12} />
                              Active
                            </span>
                            {cancelAtPeriodEnd ? (
                              <span className="shop-row__cancels">Cancelled</span>
                            ) : onCancelSubscription && (
                              <button
                                className="shop-row__cancel-btn"
                                onClick={async () => {
                                  if (!confirm('Cancel your membership? Access stays active until the end of the billing period.')) return
                                  setCancelLoading(true)
                                  try { await onCancelSubscription() } catch { /* handled upstream */ }
                                  finally { setCancelLoading(false) }
                                }}
                                disabled={cancelLoading}
                              >
                                {cancelLoading ? '…' : 'Cancel'}
                              </button>
                            )}
                          </div>
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
                {!collapsed['cd'] && <p className="shop-contact-hint">Free shipping in the US · $20 international</p>}
                {!collapsed['cd'] && cdProducts.map(product => {
                  const isSoldOut = cdSoldIds.includes(product.id)
                  const isLoading = loading === product.id
                  const memberPrice = product.memberPrice
                  const displayPrice = isPremium && memberPrice != null ? memberPrice : (product.price ?? 0)
                  const isDiscounted = isPremium && memberPrice != null && product.price != null && memberPrice < product.price
                  return (
                    <div key={product.id} className="shop-row">
                      {product.image
                        ? <img src={product.image} alt={product.name} className="shop-row__cover" />
                        : <div className="shop-row__icon">💿</div>
                      }
                      <div className="shop-row__info">
                        <div className="shop-row__name">{product.name}</div>
                        <div className="shop-row__desc">{product.description}</div>
                      </div>
                      <div className="shop-row__right">
                        {!isSoldOut && (
                          <span className="shop-row__price">
                            {isDiscounted && <span className="shop-row__price-original">{formatPrice(product.price!)}</span>}
                            <span className={isDiscounted ? 'shop-row__price-discounted' : ''}>{formatPrice(displayPrice)}</span>
                            {!isPremium && memberPrice != null && memberPrice < (product.price ?? 0) && (
                              <span className="shop-row__price-enthusiast">Enthusiast {formatPrice(memberPrice)}</span>
                            )}
                          </span>
                        )}
                        {isSoldOut ? (
                          <span className="shop-row__sold-out">Sold Out</span>
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

            {showDownload && downloadableReleases.length > 0 && (
              <section className="shop-section">
                <button className="shop-section__title" onClick={() => toggleSection('download')}>
                  Downloads
                  <span className={`shop-section__chevron${collapsed['download'] ? '' : ' shop-section__chevron--open'}`}>›</span>
                </button>
                {!collapsed['download'] && downloadableReleases.map(release => {
                  const owned = hasPurchased(release.id)
                  const isDownloading = downloadingReleaseId === release.id
                  const isBuying = loading === `download-${release.id}`
                  const fullPrice = releasePrice(release, false)
                  const price = releasePrice(release, isPremium)
                  const isDiscounted = isPremium && price < fullPrice
                  return (
                    <div key={release.id} className="shop-row">
                      {release.cover
                        ? <img src={release.cover} alt={release.name} className="shop-row__cover" />
                        : <div className="shop-row__icon">⬇︎</div>
                      }
                      <div className="shop-row__info">
                        <div className="shop-row__name">{release.name}</div>
                        <div className="shop-row__desc">{release.releaseType === 'ep' ? 'EP' : release.releaseType.charAt(0).toUpperCase() + release.releaseType.slice(1)}</div>
                      </div>
                      <div className="shop-row__right">
                        {!owned && (
                          <span className="shop-row__price">
                            {isDiscounted && <span className="shop-row__price-original">{formatPrice(fullPrice)}</span>}
                            <span className={isDiscounted ? 'shop-row__price-discounted' : ''}>{formatPrice(price)}</span>
                            {!isPremium && fullPrice > releasePrice(release, true) && (
                              <span className="shop-row__price-enthusiast">Enthusiast {formatPrice(releasePrice(release, true))}</span>
                            )}
                          </span>
                        )}
                        {owned ? (
                          <button
                            className="shop-row__btn"
                            onClick={() => onDownloadWav(release.id)}
                            disabled={isDownloading}
                          >
                            {isDownloading ? '…' : 'Download'}
                          </button>
                        ) : (
                          <button
                            className="shop-row__btn"
                            onClick={async () => {
                              setLoading(`download-${release.id}`)
                              try { await onBuyRelease(release.id) } finally { setLoading(null) }
                            }}
                            disabled={isBuying}
                          >
                            {isBuying ? '…' : 'Buy'}
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
                      <span className="shop-row__price">
                        {isPremium && (
                          <span className="shop-row__price--original">
                            {formatPrice(INSTRUMENTAL_LICENSE[licenseType].priceCents)}
                          </span>
                        )}
                        {formatPrice(isPremium
                          ? Math.floor(INSTRUMENTAL_LICENSE[licenseType].priceCents / 2)
                          : INSTRUMENTAL_LICENSE[licenseType].priceCents
                        )}
                        {!isPremium && (
                          <span className="shop-row__price-enthusiast">Enthusiast {formatPrice(Math.floor(INSTRUMENTAL_LICENSE[licenseType].priceCents / 2))}</span>
                        )}
                      </span>
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
      {checkoutStatus === 'success' && (
        <div className="shop-toast shop-toast--success">
          <CheckIcon size={14} />
          <span>Purchase complete — thank you!</span>
          <button className="shop-toast__close" onClick={() => setCheckoutStatus(null)}>✕</button>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="shop-toast shop-toast--cancelled">
          <span>Checkout cancelled.</span>
          <button className="shop-toast__close" onClick={() => setCheckoutStatus(null)}>✕</button>
        </div>
      )}
    </div>
  )
}
