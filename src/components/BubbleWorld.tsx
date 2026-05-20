import { memo, useState, useEffect, useLayoutEffect, useRef, useCallback, type ReactNode, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GradientTexture, Environment, Clouds, Cloud, useTexture, useProgress } from '@react-three/drei'
import { useDrag } from '@use-gesture/react'
import ReleaseBubble from './ReleaseBubble'
import type { Release } from '../types'
import * as THREE from 'three'

// Desktop layout: camera at z=26
const COL_SPACING = 4.5
const ROW_Y: [number, number, number] = [6.0, 0.0, -6.0]

// Mobile layout: stacked rows scrolled via ScrollGroup, camera at z=13
const MOBILE_BREAKPOINT = 640
const MOBILE_ROW_Y: [number, number, number] = [1.2, -8.0, -17.2]
const MOBILE_SPACING = 5.5
const MOBILE_DRAG_SENSITIVITY = 2.0  // amplifies pixel→world so a short swipe snaps to next bubble

const ROW_NAMES = ['EPs', 'Singles', 'Collections'] as const
const ROW_ITEM_LABELS = ['EP', 'single', 'collection'] as const

function hashForRow(row: number): string {
  if (row === 1) return '#singles'
  if (row === 2) return '#collections'
  return ''
}

function rowForHash(hash: string): number {
  if (hash === '#singles') return 1
  if (hash === '#collections') return 2
  return 0
}

// ── Camera controller ─────────────────────────────────────────────────────────
function CameraController({ targetY, targetZ }: { targetY: number; targetZ: number }) {
  const { camera } = useThree()
  const ty = useRef(targetY)
  const tz = useRef(targetZ)

  useLayoutEffect(() => {
    camera.position.y = targetY
    camera.position.z = targetZ
    ty.current = targetY
    tz.current = targetZ
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ty.current = targetY
    tz.current = targetZ
  }, [targetY, targetZ])

  useFrame(() => {
    const dy = ty.current - camera.position.y
    const dz = tz.current - camera.position.z
    if (Math.abs(dy) < 0.001 && Math.abs(dz) < 0.001) return
    camera.position.y += dy * 0.09
    camera.position.z += dz * 0.09
  })
  return null
}

// ── World-units-per-pixel calculator ─────────────────────────────────────────
// Writes to a ref each frame so the HTML drag handler (outside Canvas) can
// convert pixel deltas to world units without triggering React re-renders.
function WorldScaleProbe({ scaleRef }: { scaleRef: MutableRefObject<number> }) {
  const { camera, size } = useThree()
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    scaleRef.current = (2 * cam.position.z * Math.tan((cam.fov * Math.PI) / 360)) / size.height
  })
  return null
}

// ── Y-scroll group (shifts all rows together without moving the camera) ───────
interface ScrollGroupApi {
  dragBy: (extraY: number) => void
}

function ScrollGroup({ targetOffsetY, children, apiRef }: { targetOffsetY: number; children: ReactNode; apiRef?: MutableRefObject<ScrollGroupApi | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const ty = useRef(targetOffsetY)
  const baseY = useRef(targetOffsetY)  // anchor for drag — updated only when focusedRow settles

  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.position.y = targetOffsetY
    ty.current = targetOffsetY
    baseY.current = targetOffsetY
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ty.current = targetOffsetY
    baseY.current = targetOffsetY
  }, [targetOffsetY])

  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      dragBy: (extraY) => {
        ty.current = baseY.current + extraY
        if (groupRef.current) groupRef.current.position.y = ty.current
      },
    }
  })

  useFrame(() => {
    if (!groupRef.current) return
    const dy = ty.current - groupRef.current.position.y
    if (Math.abs(dy) < 0.001) return
    groupRef.current.position.y += dy * 0.18
  })

  return <group ref={groupRef}>{children}</group>
}

// ── Spring-animated carousel row ──────────────────────────────────────────────
export interface CarouselApi {
  drag: (worldX: number) => void
  settle: (page: number) => void
  snap: (page: number) => void  // immediate, no lerp
}

interface CarouselRowProps {
  items: Item[]
  page: number
  rowY: number
  spacing: number
  phaseBase: number
  apiRef: MutableRefObject<CarouselApi | null>
  rowFocused: boolean
  isMobile: boolean
}

function CarouselRow({ items, page, rowY, spacing, phaseBase, apiRef, rowFocused, isMobile }: CarouselRowProps) {
  const groupRef = useRef<THREE.Group>(null)
  const targetX = useRef(-page * spacing)
  const currentX = useRef(-page * spacing)

  useEffect(() => {
    targetX.current = -page * spacing
  }, [page, spacing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiRef.current = {
      drag: (worldX) => {
        if (!rowFocused) return
        const x = -page * spacing + worldX
        targetX.current = x
        currentX.current = x
        if (groupRef.current) groupRef.current.position.x = x
      },
      settle: (newPage) => {
        targetX.current = -newPage * spacing
      },
      snap: (newPage) => {
        const x = -newPage * spacing
        targetX.current = x
        currentX.current = x
        if (groupRef.current) groupRef.current.position.x = x
      },
    }
  }, [page, spacing, rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  // When a row leaves focus on mobile, snap it back so it's in the right place if revisited
  const prevRowFocusedRef = useRef(rowFocused)
  useEffect(() => {
    const was = prevRowFocusedRef.current
    prevRowFocusedRef.current = rowFocused
    if (!rowFocused && was) {
      const x = -page * spacing
      targetX.current = x
      currentX.current = x
    }
  }, [rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!groupRef.current) return
    const dx = targetX.current - currentX.current
    if (Math.abs(dx) < 0.001) return
    currentX.current += dx * 0.12
    groupRef.current.position.x = currentX.current
  })

  // Show 3 neighbours on desktop, 1 on mobile to limit draw calls
  const visRange = isMobile ? 1 : 2

  return (
    <group ref={groupRef}>
      {items.map((item, i) => {
        if (Math.abs(i - page) > visRange) return null
        return (
          <ReleaseBubble
            key={item.id}
            position={[i * spacing, rowY, 0]}
            radius={item.radius}
            cover={item.cover}
            name={item.name}
            isActive={item.isActive}
            isFocused={i === page && rowFocused}
            resetKey={page}
            phaseOffset={i * 0.7 + phaseBase}
            onClick={item.onClick}
            isMobile={isMobile}
          />
        )
      })}
    </group>
  )
}

// ── Chevron SVG ───────────────────────────────────────────────────────────────
const CHEVRON_POINTS = { left: '15 18 9 12 15 6', right: '9 18 15 12 9 6', up: '18 15 12 9 6 15', down: '6 9 12 15 18 9' }
function Chevron({ dir, size = 18 }: { dir: keyof typeof CHEVRON_POINTS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={CHEVRON_POINTS[dir]} />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Item {
  id: string
  name: string
  label: string
  cover?: string
  radius: number
  isActive: boolean
  onClick: () => void
}

// ── Scrolling clouds ──────────────────────────────────────────────────────────
const CLOUD_DEFS = [
  { seed: 22, x:  -80, y: 14.5, z: -22, dx: 0.40, bounds: [7, 2, 2] as [number,number,number] },
  { seed: 77, x:  -42, y: 16.0, z: -24, dx: 0.28, bounds: [8, 2, 2] as [number,number,number] },
  { seed: 11, x:   -4, y: 15.2, z: -23, dx: 0.35, bounds: [6, 2, 2] as [number,number,number] },
  { seed: 44, x:   36, y: 15.8, z: -25, dx: 0.22, bounds: [9, 2, 2] as [number,number,number] },
  { seed: 63, x:   80, y: 14.8, z: -21, dx: 0.32, bounds: [7, 2, 2] as [number,number,number] },
]
const CLOUD_SCALE = 2.8
const CLOUD_BUFFER = 55  // world units past screen edge before wrapping

function ScrollingClouds({ isMobile }: { isMobile: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>(CLOUD_DEFS.map(() => null))
  const { camera, size } = useThree()
  const halfWRef = useRef(0)

  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera
    // Recompute half-width only when camera z changes meaningfully
    const dist = cam.position.z - CLOUD_DEFS[0].z
    halfWRef.current = Math.tan((cam.fov * Math.PI) / 360) * dist * (size.width / size.height)
    refs.current.forEach((ref, i) => {
      if (!ref) return
      ref.position.x += CLOUD_DEFS[i].dx * delta
      if (ref.position.x > halfWRef.current + CLOUD_BUFFER) ref.position.x = -(halfWRef.current + CLOUD_BUFFER)
    })
  })

  const segments = isMobile ? 8 : 20

  return (
    <Clouds material={THREE.MeshBasicMaterial}>
      {CLOUD_DEFS.map((c, i) => (
        <Cloud
          key={c.seed}
          ref={el => { refs.current[i] = el }}
          seed={c.seed}
          bounds={c.bounds}
          position={[c.x, c.y, c.z]}
          scale={CLOUD_SCALE}
          segments={segments}
          opacity={0.80}
          speed={0.1}
          color="#ffffff"
          concentrate="inside"
        />
      ))}
    </Clouds>
  )
}

// ── Scene ready probe ─────────────────────────────────────────────────────────
// Fires onReady on the first frame where useProgress.active is false, meaning
// the loading manager has no more pending items (fonts, env map, initial textures).
function ReadyProbe({ onReady }: { onReady: () => void }) {
  const { active } = useProgress()
  const activeRef = useRef(active)
  const firedRef = useRef(false)
  useEffect(() => { activeRef.current = active }, [active])
  useFrame(() => {
    if (firedRef.current || activeRef.current) return
    firedRef.current = true
    onReady()
  })
  return null
}

// Preloads every cover in a row into Three.js texture cache so Suspense boundaries
// resolve immediately as the user scrolls to each bubble.
function preloadRowCovers(items: Item[]) {
  items.forEach(item => { if (item.cover) useTexture.preload(item.cover) })
}

interface BubbleWorldProps {
  releases: Release[]
  currentSongId?: string
}

// ── BubbleWorld ───────────────────────────────────────────────────────────────
function BubbleWorld({ releases, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()
  const [pageRow0, setPageRow0] = useState(() => {
    try {
      const slug = sessionStorage.getItem('bw-restore-slug')
      if (!slug || sessionStorage.getItem('bw-restore-row') !== '0') return 0
      const idx = releases.filter(r => r.releaseType === 'album' || r.releaseType === 'ep').findIndex(r => r.slug === slug)
      return idx >= 0 ? idx : 0
    } catch { return 0 }
  })
  const [pageRow1, setPageRow1] = useState(() => {
    try {
      const slug = sessionStorage.getItem('bw-restore-slug')
      if (!slug || sessionStorage.getItem('bw-restore-row') !== '1') return 0
      const idx = releases.filter(r => r.releaseType === 'single').findIndex(r => r.slug === slug)
      return idx >= 0 ? idx : 0
    } catch { return 0 }
  })
  const [pageRow2, setPageRow2] = useState(() => {
    try {
      const slug = sessionStorage.getItem('bw-restore-slug')
      if (!slug || sessionStorage.getItem('bw-restore-row') !== '2') return 0
      const idx = releases.filter(r => r.releaseType === 'collection').findIndex(r => r.slug === slug)
      return idx >= 0 ? idx : 0
    } catch { return 0 }
  })
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  const [focusedRow, setFocusedRow] = useState(() => {
    const fromHash = rowForHash(window.location.hash)
    if (fromHash !== 0) return fromHash
    try {
      const saved = parseInt(sessionStorage.getItem('bw-restore-focused-row') ?? '0', 10)
      return (saved >= 0 && saved <= 2) ? saved : 0
    } catch { return 0 }
  })
  const [sceneReady, setSceneReady] = useState(false)
  const handleSceneReady = useCallback(() => setSceneReady(true), [])

  // hash ↔ focusedRow sync
  useEffect(() => {
    const onHash = () => setFocusedRow(rowForHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const hash = hashForRow(focusedRow)
    if (window.location.hash !== hash) history.replaceState(null, '', hash || window.location.pathname)
  }, [focusedRow])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isMobilePrevRef = useRef(isMobile)
  useEffect(() => {
    if (isMobilePrevRef.current === isMobile) return
    isMobilePrevRef.current = isMobile
    setPageRow0(0); setPageRow1(0); setPageRow2(0)
    setFocusedRow(rowForHash(window.location.hash))
  }, [isMobile])

  // Preload all covers in the focused row so bubbles load ahead of scrolling
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { preloadRowCovers(rows[focusedRow]) }, [focusedRow])

  // ── Row data ─────────────────────────────────────────────────────────────────
  const row0: Item[] = releases
    .filter(r => r.releaseType === 'album' || r.releaseType === 'ep')
    .map(r => ({
      id: r.id,
      name: r.name,
      label: `${r.name} — ${r.releaseType.charAt(0).toUpperCase() + r.releaseType.slice(1)}`,
      cover: r.cover,
      radius: r.releaseType === 'album' ? 2.0 : 1.5,
      isActive: r.songs.some(s => s.id === currentSongId),
      onClick: () => {
        sessionStorage.setItem('bw-restore-slug', r.slug)
        sessionStorage.setItem('bw-restore-row', '0')
        sessionStorage.setItem('bw-restore-focused-row', focusedRowRef.current.toString())
        navigate(`/${r.releaseType}/${r.slug}`)
      },
    }))

  const row1: Item[] = releases
    .filter(r => r.releaseType === 'single')
    .map(r => ({
      id: r.id,
      name: r.name,
      label: `${r.name} — Single`,
      cover: r.cover,
      radius: 1.2,
      isActive: r.songs.some(s => s.id === currentSongId),
      onClick: () => {
        sessionStorage.setItem('bw-restore-slug', r.slug)
        sessionStorage.setItem('bw-restore-row', '1')
        sessionStorage.setItem('bw-restore-focused-row', focusedRowRef.current.toString())
        navigate(`/single/${r.slug}`)
      },
    }))

  const row2: Item[] = releases
    .filter(r => r.releaseType === 'collection')
    .map(r => ({
      id: r.id,
      name: r.name,
      label: `${r.name} — Collection`,
      cover: r.cover,
      radius: 1.1,
      isActive: r.songs.some(s => s.id === currentSongId),
      onClick: () => {
        sessionStorage.setItem('bw-restore-slug', r.slug)
        sessionStorage.setItem('bw-restore-row', '2')
        sessionStorage.setItem('bw-restore-focused-row', focusedRowRef.current.toString())
        navigate(`/collection/${r.slug}`)
      },
    }))

  // Arrays indexed by row number — eliminates parallel state helpers
  const rows = [row0, row1, row2]
  const pages = [pageRow0, pageRow1, pageRow2]
  const setPages = [setPageRow0, setPageRow1, setPageRow2]
  const rowMaxes = rows.map(r => Math.max(0, r.length - 1))

  const row0Api = useRef<CarouselApi | null>(null)
  const row1Api = useRef<CarouselApi | null>(null)
  const row2Api = useRef<CarouselApi | null>(null)
  const rowApis = [row0Api, row1Api, row2Api]

  // Refs mirror state so drag closures always read current values without stale captures
  const focusedRowRef = useRef(focusedRow)
  const pageRow0Ref   = useRef(pageRow0)
  const pageRow1Ref   = useRef(pageRow1)
  const pageRow2Ref   = useRef(pageRow2)
  useEffect(() => { focusedRowRef.current = focusedRow }, [focusedRow])
  useEffect(() => { pageRow0Ref.current   = pageRow0   }, [pageRow0])
  useEffect(() => { pageRow1Ref.current   = pageRow1   }, [pageRow1])
  useEffect(() => { pageRow2Ref.current   = pageRow2   }, [pageRow2])
  const pageRefs = [pageRow0Ref, pageRow1Ref, pageRow2Ref]

  const worldScaleRef    = useRef(0.024)         // world-units-per-pixel, written each frame by WorldScaleProbe
  const canvasRef        = useRef<HTMLDivElement>(null)
  const wheelAccumRef    = useRef(0)             // accumulated deltaY; smooths mice and trackpads alike
  const mouseYRef        = useRef(0.25)          // normalised Y inside canvas (0=top, 1=bottom)
  const dragRowRef       = useRef(0)             // desktop: row locked at gesture start
  const dragAxisRef      = useRef<'x' | 'y'>('x') // mobile: axis locked at gesture start
  const scrollGroupApiRef = useRef<ScrollGroupApi | null>(null)

  function advanceRow(row: number, dir: number) {
    const np = Math.max(0, Math.min(pages[row] + dir, rowMaxes[row]))
    setPages[row](np)
    rowApis[row].current?.settle(np)
  }

  // Maps normalised mouse Y to a row index (desktop, 3 equal bands)
  function rowFromMouseY(y: number): number {
    return y < 0.36 ? 0 : y < 0.67 ? 1 : 2
  }

  function handleWheel(e: React.WheelEvent) {
    if (isMobile) return
    e.preventDefault()
    wheelAccumRef.current += e.deltaY
    if (Math.abs(wheelAccumRef.current) >= 80) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1
      wheelAccumRef.current = 0
      advanceRow(rowFromMouseY(mouseYRef.current), dir)
    }
  }

  function switchRow(newRow: 0 | 1 | 2) {
    focusedRowRef.current = newRow
    setFocusedRow(newRow)
  }

  // ── Drag gesture ─────────────────────────────────────────────────────────────
  const bind = useDrag(
    ({ movement: [mx, my], first, last, velocity: [vx, vy] }) => {
      const worldDx = mx * worldScaleRef.current

      if (isMobile) {
        // Lock axis on first frame; also kick off preloading for the whole row
        if (first) {
          dragAxisRef.current = Math.abs(my) > Math.abs(mx) ? 'y' : 'x'
          preloadRowCovers(rows[focusedRowRef.current])
        }

        if (dragAxisRef.current === 'y') {
          // Vertical swipe — shift the scroll group, then snap to adjacent row on release
          // my < 0 = finger moved up → next row (higher index = lower in world Y)
          const worldDy = -my * worldScaleRef.current * MOBILE_DRAG_SENSITIVITY
          const baseY = MOBILE_ROW_Y[0] - MOBILE_ROW_Y[focusedRowRef.current]
          const maxOff = MOBILE_ROW_Y[0] - MOBILE_ROW_Y[2]
          scrollGroupApiRef.current?.dragBy(Math.max(-baseY, Math.min(worldDy, maxOff - baseY)))

          if (last) {
            const fr = focusedRowRef.current
            const newRow = (Math.abs(vy) > 0.3 || Math.abs(my) > 40)
              ? Math.max(0, Math.min(fr + (my < 0 ? 1 : -1), 2)) as 0 | 1 | 2
              : fr as 0 | 1 | 2
            switchRow(newRow)
          }
          return
        }

        // Horizontal swipe — scroll within the focused row
        const fr = focusedRowRef.current
        const activePage = pageRefs[fr].current
        const maxPage = rowMaxes[fr]
        const mobileDx = worldDx * MOBILE_DRAG_SENSITIVITY

        if (!last) {
          rowApis[fr].current?.drag(mobileDx)
        } else {
          const newPage = (Math.abs(vx) > 0.3 || Math.abs(mx) > 40)
            ? Math.max(0, Math.min(activePage + (mx < 0 ? 1 : -1), maxPage))
            : Math.max(0, Math.min(Math.round(activePage - (mobileDx + vx * worldScaleRef.current * MOBILE_DRAG_SENSITIVITY * 200) / MOBILE_SPACING), maxPage))
          setPages[fr](newPage)
          rowApis[fr].current?.settle(newPage)
        }
      } else {
        if (first) {
          dragRowRef.current = rowFromMouseY(mouseYRef.current)
          preloadRowCovers(rows[dragRowRef.current])
        }
        const dr = dragRowRef.current

        if (!last) {
          rowApis[dr].current?.drag(worldDx)
        } else {
          const projected = worldDx + vx * worldScaleRef.current * 200
          const newPage = Math.max(0, Math.min(Math.round(pages[dr] - projected / COL_SPACING), rowMaxes[dr]))
          setPages[dr](newPage)
          rowApis[dr].current?.settle(newPage)
        }
      }
    },
    { filterTaps: true, threshold: 8 }
  )

  return (
    <div className="bubble-world" role="region" aria-label="Music library">

      {/* Loading overlay — fades out once the scene's first frame is idle */}
      <div className={`bw-loading${sceneReady ? ' bw-loading--ready' : ''}`} aria-hidden="true">
        <div className="bw-loading__dots">
          <div className="bw-loading__dot" />
          <div className="bw-loading__dot" />
          <div className="bw-loading__dot" />
        </div>
      </div>

      {/* Accessible navigation (visually hidden) */}
      <nav aria-label="Browse music" className="sr-only">
        {rows.map((items, i) => items.length > 0 && (
          <section key={i} aria-labelledby={`bw-row${i}-heading`}>
            <h2 id={`bw-row${i}-heading`}>{ROW_NAMES[i]}</h2>
            <ul>{items.map(item => <li key={item.id}><button onClick={item.onClick}>{item.label}</button></li>)}</ul>
          </section>
        ))}
      </nav>

      {/* 3-D scene */}
      <div
        ref={canvasRef}
        className="bubble-world__canvas"
        aria-hidden="true"
        onWheel={handleWheel}
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect()
          if (rect) mouseYRef.current = (e.clientY - rect.top) / rect.height
        }}
        {...bind()}
      >
        <Canvas
          camera={{ position: [0, 0.75, 26], fov: 50 }}
          dpr={isMobile ? [1, 1] : [1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          performance={{ min: 0.5 }}
        >
          <CameraController targetY={isMobile ? MOBILE_ROW_Y[0] : 0.75} targetZ={isMobile ? 13 : 26} />
          <WorldScaleProbe scaleRef={worldScaleRef} />
          <ReadyProbe onReady={handleSceneReady} />

          <mesh position={[0, 0, -30]} scale={[220, 60, 1]}>
            <planeGeometry />
            <meshBasicMaterial toneMapped={false}>
              <GradientTexture stops={[0, 0.25, 0.6, 1]} colors={['#1a5c8a', '#2e8ab5', '#5ab8d4', '#8dd4e8']} />
            </meshBasicMaterial>
          </mesh>

          <ambientLight intensity={0.7} color="#ddeeff" />
          <directionalLight position={[5, 10, 3]} intensity={1.2} color="#fff8e0" />
          <hemisphereLight color="#87ceeb" groundColor="#6a9e5a" intensity={0.5} />
          {!isMobile && <Environment preset="dawn" background={false} />}
          <ScrollingClouds isMobile={isMobile} />

          {isMobile ? (
            <ScrollGroup targetOffsetY={MOBILE_ROW_Y[0] - MOBILE_ROW_Y[focusedRow]} apiRef={scrollGroupApiRef}>
              {rows.map((items, i) => (
                <CarouselRow key={i} items={items} page={pages[i]} rowY={MOBILE_ROW_Y[i]} spacing={MOBILE_SPACING} phaseBase={i * 1.5} apiRef={rowApis[i]} rowFocused={focusedRow === i} isMobile={true} />
              ))}
            </ScrollGroup>
          ) : (
            <>
              {rows.map((items, i) => (
                <CarouselRow key={i} items={items} page={pages[i]} rowY={ROW_Y[i]} spacing={COL_SPACING} phaseBase={i * 1.5} apiRef={rowApis[i]} rowFocused={true} isMobile={false} />
              ))}
            </>
          )}

          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} />
        </Canvas>
      </div>

      {/* Mobile: row toggle arrows */}
      {isMobile && (() => {
        const nextRow = ((focusedRow + 1) % 3) as 0 | 1 | 2
        const prevRow = ((focusedRow + 2) % 3) as 0 | 1 | 2
        return (
          <>
            <button className="bubble-row-toggle bubble-row-toggle--left" onClick={() => switchRow(prevRow)} aria-label={`View ${ROW_NAMES[prevRow]}`}>
              <Chevron dir="up" size={14} />
              <span>{ROW_NAMES[prevRow]}</span>
            </button>
            <button className="bubble-row-toggle bubble-row-toggle--right" onClick={() => switchRow(nextRow)} aria-label={`View ${ROW_NAMES[nextRow]}`}>
              <span>{ROW_NAMES[nextRow]}</span>
              <Chevron dir="down" size={14} />
            </button>
          </>
        )
      })()}

      {/* Mobile: side arrows for the focused row */}
      {isMobile && rows[focusedRow].length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPages[focusedRow](p => p - 1)} disabled={pages[focusedRow] === 0} aria-label={`Previous ${ROW_ITEM_LABELS[focusedRow]}`}>
            <Chevron dir="left" />
          </button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPages[focusedRow](p => p + 1)} disabled={pages[focusedRow] === rowMaxes[focusedRow]} aria-label={`Next ${ROW_ITEM_LABELS[focusedRow]}`}>
            <Chevron dir="right" />
          </button>
        </>
      )}

      {/* Desktop: per-row nav */}
      {!isMobile && rows.map((row, i) => row.length > 1 && (
        <nav key={i} className={`bw-rnav bw-rnav--${i}`} aria-label={`${ROW_NAMES[i]} pages`}>
          <button className="bw-rnav__arrow bw-rnav__arrow--prev" onClick={() => advanceRow(i, -1)} disabled={pages[i] === 0} aria-label={`Previous ${ROW_ITEM_LABELS[i]}`}><Chevron dir="left" /></button>
          <button className="bw-rnav__arrow bw-rnav__arrow--next" onClick={() => advanceRow(i, 1)} disabled={pages[i] === rowMaxes[i]} aria-label={`Next ${ROW_ITEM_LABELS[i]}`}><Chevron dir="right" /></button>
        </nav>
      ))}
    </div>
  )
}

export default memo(BubbleWorld)
