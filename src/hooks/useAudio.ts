import { useState, useRef, useEffect, useCallback } from 'react'
import type { Song, LoopMode } from '../types'

export interface PlayerAPI {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  loopMode: LoopMode
  playSong: (song: Song, queue?: Song[]) => void
  togglePlay: () => void
  seek: (time: number) => void
  skipNext: () => void
  skipPrev: () => void
  cycleLoop: () => void
}

const MS = 'mediaSession' in navigator

export function useAudio(): PlayerAPI {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Refs for event handler access — avoids stale closures
  const loopRef = useRef<LoopMode>('off')
  const queueRef = useRef<Song[]>([])
  const qiRef = useRef(-1)
  // Guards against double-advance when both 'ended' and the timeupdate fallback fire
  const endFiredRef = useRef(false)

  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loopMode, setLoopModeState] = useState<LoopMode>('off')

  const loadAndPlay = useCallback((song: Song, qi: number, queue: Song[]) => {
    const el = audioRef.current
    if (!el) return
    endFiredRef.current = false
    el.src = song.src
    el.loop = loopRef.current === 'one'
    // iOS requires an explicit load() call after changing src
    el.load()
    qiRef.current = qi
    queueRef.current = queue
    setCurrentSong(song)
    setCurrentTime(0)
    setDuration(0)
    el.play().catch(err => {
      if (err.name !== 'AbortError') console.error('Playback error:', err)
    })
  }, [])

  // Core audio element + Media Session action handlers (both live here to share refs)
  useEffect(() => {
    const el = new Audio()
    el.preload = 'metadata'
    audioRef.current = el

    const onMeta = () => setDuration(isNaN(el.duration) ? 0 : el.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    // Shared advance logic — guarded so timeupdate fallback and 'ended' can't both fire
    const advance = () => {
      if (endFiredRef.current) return
      endFiredRef.current = true
      const mode = loopRef.current
      const q = queueRef.current
      const qi = qiRef.current
      if (mode === 'one') return // el.loop = true handles this
      const next = qi + 1
      if (next < q.length) {
        loadAndPlay(q[next], next, q)
      } else if (mode === 'all' && q.length > 0) {
        loadAndPlay(q[0], 0, q)
      } else {
        setIsPlaying(false)
      }
    }

    const onEnded = () => advance()

    // iOS PWA: the 'ended' event doesn't always fire. Fall back to timeupdate.
    const onTime = () => {
      setCurrentTime(el.currentTime)
      if (!endFiredRef.current && el.duration > 0 && (el.duration - el.currentTime) < 0.3) {
        advance()
      }
    }

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)

    // Media Session API — required for iOS background / lock-screen playback.
    // Without this, Safari suspends audio when the screen locks.
    if (MS) {
      navigator.mediaSession.setActionHandler('play', () => el.play().catch(console.error))
      navigator.mediaSession.setActionHandler('pause', () => el.pause())
      navigator.mediaSession.setActionHandler('stop', () => el.pause())
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const q = queueRef.current
        const qi = qiRef.current
        const next = qi + 1
        if (next < q.length) loadAndPlay(q[next], next, q)
        else if (loopRef.current === 'all' && q.length > 0) loadAndPlay(q[0], 0, q)
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (el.currentTime > 3) { el.currentTime = 0; return }
        const q = queueRef.current
        const qi = qiRef.current
        if (qi > 0) loadAndPlay(q[qi - 1], qi - 1, q)
        else el.currentTime = 0
      })
    }

    return () => {
      el.pause()
      el.src = ''
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [loadAndPlay])

  // Update lock-screen Now Playing metadata when song changes
  useEffect(() => {
    if (!MS || !currentSong) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist ?? currentSong.album ?? '',
      album: currentSong.album ?? '',
      artwork: currentSong.cover
        ? [{ src: currentSong.cover, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
  }, [currentSong])

  // Keep lock-screen play/pause indicator in sync
  useEffect(() => {
    if (!MS) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  const playSong = useCallback((song: Song, queue?: Song[]) => {
    const q = queue ?? [song]
    const qi = q.findIndex(s => s.id === song.id)
    loadAndPlay(song, qi >= 0 ? qi : 0, q)
  }, [loadAndPlay])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !currentSong) return
    if (el.paused) el.play().catch(console.error)
    else el.pause()
  }, [currentSong])

  const seek = useCallback((time: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = time
    setCurrentTime(time)
  }, [])

  const skipNext = useCallback(() => {
    const q = queueRef.current
    const qi = qiRef.current
    const next = qi + 1
    if (next < q.length) {
      loadAndPlay(q[next], next, q)
    } else if (loopRef.current === 'all' && q.length > 0) {
      loadAndPlay(q[0], 0, q)
    }
  }, [loadAndPlay])

  const skipPrev = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.currentTime > 3) {
      el.currentTime = 0
      setCurrentTime(0)
      return
    }
    const q = queueRef.current
    const qi = qiRef.current
    if (qi > 0) {
      loadAndPlay(q[qi - 1], qi - 1, q)
    } else {
      el.currentTime = 0
      setCurrentTime(0)
    }
  }, [loadAndPlay])

  const cycleLoop = useCallback(() => {
    const modes: LoopMode[] = ['off', 'one', 'all']
    const next = modes[(modes.indexOf(loopRef.current) + 1) % modes.length]
    loopRef.current = next
    if (audioRef.current) audioRef.current.loop = next === 'one'
    setLoopModeState(next)
  }, [])

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    loopMode,
    playSong,
    togglePlay,
    seek,
    skipNext,
    skipPrev,
    cycleLoop,
  }
}
