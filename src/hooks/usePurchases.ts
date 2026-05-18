import { useState, useCallback, useEffect } from 'react'

export function usePurchases(token: string | null) {
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => {
    if (!token) return
    fetch('/api/downloads?purchases', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { purchases: [] })
      .then(({ purchases }: { purchases: string[] }) => setPurchasedIds(new Set(purchases)))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const hasPurchased = useCallback(
    (contentfulId: string) => purchasedIds.has(contentfulId),
    [purchasedIds]
  )

  return { hasPurchased, refresh }
}
