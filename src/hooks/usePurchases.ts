import { useState, useCallback, useEffect } from 'react'

export interface PurchaseDetail {
  contentful_id: string
  amount_total: number
  created_at: string
}

export interface LicenseDetail {
  song_id: string
  song_title: string
  amount_total: number
  created_at: string
}

export function usePurchases(token: string | null) {
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([])
  const [licenses, setLicenses] = useState<LicenseDetail[]>([])

  const refresh = useCallback(() => {
    if (!token) return
    fetch('/api/downloads?purchases', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { purchases: [], licenses: [] })
      .then(({ purchases, licenses }: { purchases: PurchaseDetail[]; licenses: LicenseDetail[] }) => {
        setPurchasedIds(new Set(purchases.map(p => p.contentful_id)))
        setPurchaseDetails(purchases)
        setLicenses(licenses ?? [])
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasPurchased = useCallback(
    (contentfulId: string) => purchasedIds.has(contentfulId),
    [purchasedIds]
  )

  return { hasPurchased, purchaseDetails, licenses, refresh }
}
