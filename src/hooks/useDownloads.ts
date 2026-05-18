import { useState, useRef, useEffect, useCallback } from 'react'
import type { Song } from '../types'

export type DlStatus = 'none' | 'downloading' | 'done' | 'error'

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

const dbPromise: Promise<IDBDatabase> = new Promise((resolve, reject) => {
  const req = indexedDB.open('noise-emporium-dl', 1)
  req.onupgradeneeded = () => req.result.createObjectStore('blobs')
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

function idbOp<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

async function dbAllKeys(): Promise<string[]> {
  const db = await dbPromise
  return idbOp(db.transaction('blobs').objectStore('blobs').getAllKeys()) as Promise<string[]>
}

async function dbPut(id: string, blob: Blob): Promise<void> {
  const db = await dbPromise
  await idbOp(db.transaction('blobs', 'readwrite').objectStore('blobs').put(blob, id))
}

async function dbGet(id: string): Promise<Blob | undefined> {
  const db = await dbPromise
  return idbOp(db.transaction('blobs').objectStore('blobs').get(id))
}

async function dbDel(id: string): Promise<void> {
  const db = await dbPromise
  await idbOp(db.transaction('blobs', 'readwrite').objectStore('blobs').delete(id))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDownloads() {
  const [statuses, setStatuses] = useState<Record<string, DlStatus>>({})
  // statusesRef lets async functions read the latest status without stale closures
  const statusesRef = useRef<Record<string, DlStatus>>({})
  // In-memory cache of blob object URLs — avoids re-creating them on every play
  const urlCache = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    statusesRef.current = statuses
  }, [statuses])

  // On mount: find out which songs are already saved
  useEffect(() => {
    dbAllKeys()
      .then(ids => {
        const s: Record<string, DlStatus> = {}
        for (const id of ids) s[id] = 'done'
        setStatuses(s)
      })
      .catch(console.error)

    return () => {
      for (const url of urlCache.current.values()) URL.revokeObjectURL(url)
      urlCache.current.clear()
    }
  }, [])

  const download = useCallback(async (song: Song, token?: string) => {
    if (statusesRef.current[song.id] === 'downloading') return
    setStatuses(s => ({ ...s, [song.id]: 'downloading' }))
    // Member-only tracks use a server proxy that requires the JWT as a query param
    const src = token && song.src.startsWith('/api/plays?stream=')
      ? `${song.src}&token=${token}`
      : song.src
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      await dbPut(song.id, blob)
      // Cache the URL immediately so playback can use it right away
      const url = URL.createObjectURL(blob)
      urlCache.current.set(song.id, url)
      setStatuses(s => ({ ...s, [song.id]: 'done' }))
    } catch (err) {
      console.error('Download failed:', err)
      setStatuses(s => ({ ...s, [song.id]: 'error' }))
    }
  }, [])

  // Downloads songs one at a time — concurrent large fetches overwhelm iOS WebKit
  const downloadAll = useCallback(async (songs: Song[], token?: string) => {
    for (const song of songs) {
      if (statusesRef.current[song.id] === 'done') continue
      await download(song, token)
    }
  }, [download])

  const remove = useCallback(async (songId: string) => {
    await dbDel(songId)
    const url = urlCache.current.get(songId)
    if (url) { URL.revokeObjectURL(url); urlCache.current.delete(songId) }
    setStatuses(s => ({ ...s, [songId]: 'none' }))
  }, [])

  // Returns a local blob URL for a downloaded song, or null.
  // Uses the in-memory cache; falls back to IndexedDB on first access after reload.
  const getLocalSrc = useCallback(async (songId: string): Promise<string | null> => {
    if (statusesRef.current[songId] !== 'done') return null
    if (urlCache.current.has(songId)) return urlCache.current.get(songId)!
    try {
      const blob = await dbGet(songId)
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      urlCache.current.set(songId, url)
      return url
    } catch {
      return null
    }
  }, [])

  return { statuses, download, downloadAll, remove, getLocalSrc }
}
