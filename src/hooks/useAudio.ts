// useAudio.ts — single HTMLAudioElement that owns all playback state.
//
// Design notes:
// - A single <Audio> element is created once in a useEffect and shared for the
//   entire session. React state drives the UI; refs drive the audio element
//   directly to avoid stale-closure issues inside event handlers.
// - Queue/index/loopMode are stored in refs so the 'ended' and 'timeupdate'
//   handlers always see current values without needing to be re-registered.
// - The Media Session API hooks let the OS lock screen and hardware keys control
//   playback. Without it, Safari suspends background audio on iOS.

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Song, LoopMode } from '../types'

export interface PlayerAPI {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  loopMode: LoopMode
  isShuffle: boolean
  volume: number
  previewEnded: boolean
  playSong: (song: Song, queue?: Song[]) => void
  pause: () => void
  seekToEnd: () => void
  togglePlay: () => void
  seek: (time: number) => void
  skipNext: () => void
  skipPrev: () => void
  cycleLoop: () => void
  toggleShuffle: () => void
  setVolume: (v: number) => void
  setPreview: (duration: number | null) => void
}

const MS = 'mediaSession' in navigator
// A play is counted only after this many seconds of actual forward listening.
const PLAY_THRESHOLD = 15

export function useAudio(onCountPlay?: (songId: string) => void): PlayerAPI {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Refs for event-handler access — avoids stale closures on loopMode, queue, etc.
  const loopRef = useRef<LoopMode>('off')
  const shuffleRef = useRef(false)
  const queueRef = useRef<Song[]>([])
  const qiRef = useRef(-1) // index of the currently playing song in queueRef

  // Guards against double-advance when both 'ended' and the timeupdate fallback fire.
  const endFiredRef = useRef(false)

  // Preview cap: when set, playback auto-pauses at this many seconds of audio time.
  const previewDurationRef = useRef<number | null>(null)
  // True after a preview cap fires — blocks togglePlay from resuming.
  const previewEndedRef = useRef(false)

  // Play-count tracking — accumulates forward-only deltas to exclude seeks.
  const listenedRef = useRef(0)        // cumulative seconds listened for current song
  const lastTimeRef = useRef(0)        // previous currentTime sample
  const countedRef = useRef(false)     // true once the play has been reported
  const currentSongIdRef = useRef<string | null>(null)
  const onCountPlayRef = useRef(onCountPlay)
  onCountPlayRef.current = onCountPlay

  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loopMode, setLoopModeState] = useState<LoopMode>('off')
  const [isShuffle, setIsShuffle] = useState(false)
  const [volume, setVolumeState] = useState(1)
  const [previewEnded, setPreviewEndedState] = useState(false)
  const [previewCap, setPreviewCap] = useState<number | null>(null)

  const loadAndPlay = useCallback((song: Song, qi: number, queue: Song[]) => {
    const el = audioRef.current
    if (!el) return
    endFiredRef.current = false
    previewDurationRef.current = null
    previewEndedRef.current = false
    setPreviewEndedState(false)
    setPreviewCap(null)
    // Reset listen-time counters for the new song.
    listenedRef.current = 0
    lastTimeRef.current = 0
    countedRef.current = false
    currentSongIdRef.current = song.id
    el.src = song.src
    el.loop = loopRef.current === 'one'
    // iOS requires an explicit load() call after changing src.
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

  // Create the audio element and attach all event listeners once on mount.
  // Media Session handlers live here too because they share the same refs.
  useEffect(() => {
    const el = new Audio()
    el.preload = 'metadata'
    audioRef.current = el

    const onMeta = () => setDuration(isNaN(el.duration) ? 0 : el.duration)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    const pickNext = (q: Song[], qi: number): number | null => {
      if (shuffleRef.current && q.length > 1) {
        let r = qi
        while (r === qi) r = Math.floor(Math.random() * q.length)
        return r
      }
      const next = qi + 1
      if (next < q.length) return next
      if (loopRef.current === 'all' && q.length > 0) return 0
      return null
    }

    // Shared advance logic — the endFiredRef guard prevents both 'ended' and the
    // timeupdate fallback from advancing the queue simultaneously.
    const advance = () => {
      if (endFiredRef.current) return
      endFiredRef.current = true
      const mode = loopRef.current
      const q = queueRef.current
      const qi = qiRef.current
      if (mode === 'one') return // el.loop = true handles repeat-one
      const next = pickNext(q, qi)
      if (next !== null) {
        loadAndPlay(q[next], next, q)
      } else {
        setIsPlaying(false)
      }
    }

    const onEnded = () => advance()

    // iOS PWA: the 'ended' event doesn't always fire when the screen is locked.
    // The timeupdate handler acts as a fallback: advance when < 0.3 s remain.
    const onTime = () => {
      // After a preview cap fires we seek el.currentTime to el.duration, which fires
      // another timeupdate. The guard below prevents that seek from overwriting state.
      if (previewEndedRef.current) return

      const now = el.currentTime
      // Only accumulate small forward increments — seeks produce large deltas
      // that would artificially inflate the listen time.
      const delta = now - lastTimeRef.current
      if (delta > 0 && delta < 1.5) {
        listenedRef.current += delta
        if (!countedRef.current && listenedRef.current >= PLAY_THRESHOLD) {
          countedRef.current = true
          const id = currentSongIdRef.current
          if (id) onCountPlayRef.current?.(id)
        }
      }
      lastTimeRef.current = now
      setCurrentTime(now)

      // Preview cap: stop at the declared preview duration.
      const cap = previewDurationRef.current
      if (cap !== null && now >= cap) {
        el.pause()
        // Use cap (not el.duration) as the end position so currentTime === previewCap
        // exactly, giving progress = cap/cap = 1.0 regardless of frame-aligned duration.
        el.currentTime = cap  // fires another timeupdate, caught by early-return above
        setCurrentTime(cap)   // overrides setCurrentTime(now) above (React batches)
        previewEndedRef.current = true
        previewDurationRef.current = null
        setPreviewEndedState(true)
        return
      }

      // Don't auto-advance while a preview cap is pending — the cap fires first.
      if (!previewDurationRef.current && !endFiredRef.current && el.duration > 0 && (el.duration - el.currentTime) < 0.3) {
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
    if (MS) {
      navigator.mediaSession.setActionHandler('play', () => el.play().catch(console.error))
      navigator.mediaSession.setActionHandler('pause', () => el.pause())
      navigator.mediaSession.setActionHandler('stop', () => el.pause())
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const q = queueRef.current
        const qi = qiRef.current
        const next = pickNext(q, qi)
        if (next !== null) loadAndPlay(q[next], next, q)
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        // Pressing "previous" within the first 3 s restarts the track; after
        // that it goes to the previous song (matches Spotify behaviour).
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

  // Keep the OS lock-screen "Now Playing" card in sync when the song changes.
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

  // Keep lock-screen play/pause indicator in sync with actual playback state.
  useEffect(() => {
    if (!MS) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  const playSong = useCallback((song: Song, queue?: Song[]) => {
    const q = queue ?? [song]
    const qi = q.findIndex(s => s.id === song.id)
    loadAndPlay(song, qi >= 0 ? qi : 0, q)
  }, [loadAndPlay])

  // pause() and seekToEnd() are stable (no deps) — safe to call from setTimeout.
  const pause = useCallback(() => { audioRef.current?.pause() }, [])
  const seekToEnd = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    const d = isNaN(el.duration) ? 0 : el.duration
    el.currentTime = d
    setCurrentTime(d)
  }, [])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el || !currentSong) return
    if (previewEndedRef.current) return
    if (el.paused) el.play().catch(console.error)
    else el.pause()
  }, [currentSong])

  const setPreview = useCallback((durationSec: number | null) => {
    previewDurationRef.current = durationSec
    if (durationSec !== null) {
      previewEndedRef.current = false
      setPreviewEndedState(false)
      setPreviewCap(durationSec)
    }
  }, [])

  const seek = useCallback((time: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = time
    setCurrentTime(time)
  }, [])

  const skipNext = useCallback(() => {
    const q = queueRef.current
    const qi = qiRef.current
    if (shuffleRef.current && q.length > 1) {
      let next = qi
      while (next === qi) next = Math.floor(Math.random() * q.length)
      loadAndPlay(q[next], next, q)
      return
    }
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
    // Mirror the Media Session previoustrack behaviour: restart if past 3 s.
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

  const toggleShuffle = useCallback(() => {
    shuffleRef.current = !shuffleRef.current
    setIsShuffle(shuffleRef.current)
  }, [])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    if (audioRef.current) audioRef.current.volume = clamped
    setVolumeState(clamped)
  }, [])

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration: previewCap ?? duration,
    loopMode,
    isShuffle,
    volume,
    previewEnded,
    playSong,
    pause,
    seekToEnd,
    togglePlay,
    seek,
    skipNext,
    skipPrev,
    cycleLoop,
    toggleShuffle,
    setVolume,
    setPreview,
  }
}
