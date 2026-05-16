import { memo, useState, useEffect, useLayoutEffect, useRef, type ReactNode, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GradientTexture, Environment, Clouds, Cloud } from '@react-three/drei'
import { useDrag } from '@use-gesture/react'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'
import * as THREE from 'three'

// ── Desktop: camera at z=26 ──────────────────────────────────────────────────
const COL_SPACING = 4.5
const ROW_Y: [number, number, number] = [5.0, 0.0, -5.0]

// ── Mobile: three independent carousels, camera at z=10 y=1.2 ───────────────
const MOBILE_BREAKPOINT = 640
const MOBILE_ROW_Y: [number, number, number] = [1.2, -8.0, -17.2]
const MOBILE_SPACING = 5.5
// Amplify pixel→world conversion on mobile so a short swipe snaps to the next bubble
const MOBILE_DRAG_SENSITIVITY = 2.0

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
    camera.position.y += (ty.current - camera.position.y) * 0.09
    camera.position.z += (tz.current - camera.position.z) * 0.09
  })
  return null
}

// ── World-units-per-pixel calculator ─────────────────────────────────────────
// Reads the live camera + viewport from R3F and writes to a ref so the HTML
// drag handler (outside the Canvas) can convert pixel movement to world units.
function WorldScaleProbe({ scaleRef }: { scaleRef: MutableRefObject<number> }) {
  const { camera, size } = useThree()
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    scaleRef.current = (2 * cam.position.z * Math.tan((cam.fov * Math.PI) / 360)) / size.height
  })
  return null
}

// ── Y-scroll group (shifts rows without moving camera) ────────────────────────
function ScrollGroup({ targetOffsetY, children }: { targetOffsetY: number; children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)
  const ty = useRef(targetOffsetY)

  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.position.y = targetOffsetY
    ty.current = targetOffsetY
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { ty.current = targetOffsetY }, [targetOffsetY])

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.y += (ty.current - groupRef.current.position.y) * 0.09
  })

  return <group ref={groupRef}>{children}</group>
}

// ── Spring-animated carousel row ──────────────────────────────────────────────
export interface CarouselApi {
  drag: (worldX: number) => void
  settle: (page: number) => void
  snap: (page: number) => void   // immediate — no animation
}

interface CarouselRowProps {
  items: Item[]
  page: number
  rowY: number
  spacing: number
  phaseBase: number
  apiRef: MutableRefObject<CarouselApi | null>
  rowFocused: boolean
}

function CarouselRow({ items, page, rowY, spacing, phaseBase, apiRef, rowFocused }: CarouselRowProps) {
  const groupRef = useRef<THREE.Group>(null)
  const targetX = useRef(-page * spacing)
  const currentX = useRef(-page * spacing)

  // Keep target in sync when page changes via buttons / arrows
  useEffect(() => {
    targetX.current = -page * spacing
  }, [page, spacing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expose API — drag is gated so unfocused rows never move
  useEffect(() => {
    apiRef.current = {
      drag: (worldX) => {
        if (!rowFocused) return
        const x = -page * spacing + worldX
        targetX.current = x
        currentX.current = x   // immediate — no lerp lag during drag
        if (groupRef.current) groupRef.current.position.x = x
      },
      settle: (newPage) => {
        targetX.current = -newPage * spacing  // useFrame lerps there smoothly
      },
      snap: (newPage) => {
        const x = -newPage * spacing
        targetX.current = x
        currentX.current = x
        if (groupRef.current) groupRef.current.position.x = x
      },
    }
  }, [page, spacing, rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Snap to correct position when row goes OFF-screen (mobile row switch)
  const prevRowFocusedRef = useRef(rowFocused)
  useEffect(() => {
    const wasRowFocused = prevRowFocusedRef.current
    prevRowFocusedRef.current = rowFocused
    if (!rowFocused && wasRowFocused) {
      const x = -page * spacing
      targetX.current = x
      currentX.current = x
    }
  }, [rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    if (!groupRef.current) return
    currentX.current += (targetX.current - currentX.current) * 0.12
    groupRef.current.position.x = currentX.current
  })

  return (
    <group ref={groupRef}>
      {items.map((item, i) => {
        if (Math.abs(i - page) > 2) return null
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
          />
        )
      })}
    </group>
  )
}

// ── SVG arrows ────────────────────────────────────────────────────────────────
function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
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
  { seed: 22, x:  -45, y: 14.5, z: -22, dx: 0.40, bounds: [7, 2, 2] as [number,number,number] },
  { seed: 77, x:  -20, y: 16.0, z: -24, dx: 0.28, bounds: [8, 2, 2] as [number,number,number] },
  { seed: 11, x:    5, y: 15.2, z: -23, dx: 0.35, bounds: [6, 2, 2] as [number,number,number] },
  { seed: 44, x:   30, y: 15.8, z: -25, dx: 0.22, bounds: [9, 2, 2] as [number,number,number] },
  { seed: 63, x:   55, y: 14.8, z: -21, dx: 0.32, bounds: [7, 2, 2] as [number,number,number] },
]

const CLOUD_SCALE = 2.8
const CLOUD_BUFFER = 20  // world units past screen edge before wrapping

function ScrollingClouds() {
  const refs = useRef<(THREE.Group | null)[]>(CLOUD_DEFS.map(() => null))
  const { camera, size } = useThree()

  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera
    refs.current.forEach((ref, i) => {
      if (!ref) return
      const def = CLOUD_DEFS[i]
      ref.position.x += def.dx * delta

      const dist = cam.position.z - def.z
      const halfH = Math.tan((cam.fov * Math.PI) / 360) * dist
      const halfW = halfH * (size.width / size.height)

      if (ref.position.x > halfW + CLOUD_BUFFER) {
        ref.position.x = -(halfW + CLOUD_BUFFER)
      }
    })
  })

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
          segments={20}
          opacity={0.80}
          speed={0.1}
          color="#ffffff"
          concentrate="inside"
        />
      ))}
    </Clouds>
  )
}

interface BubbleWorldProps {
  releases: Release[]
  collections: Collection[]
  currentSongId?: string
}


// ── BubbleWorld ───────────────────────────────────────────────────────────────
function BubbleWorld({ releases, collections, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()
  const [pageRow0, setPageRow0] = useState(0)
  const [pageRow1, setPageRow1] = useState(0)
  const [pageRow2, setPageRow2] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  const [focusedRow, setFocusedRow] = useState(() => rowForHash(window.location.hash))

  // hash ↔ focusedRow sync
  useEffect(() => {
    const onHash = () => setFocusedRow(rowForHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const hash = hashForRow(focusedRow)
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash || window.location.pathname)
    }
  }, [focusedRow])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    setPageRow0(0)
    setPageRow1(0)
    setPageRow2(0)
    setFocusedRow(rowForHash(window.location.hash))
  }, [isMobile])

  const row0: Item[] = releases
    .filter(r => r.releaseType === 'album' || r.releaseType === 'ep')
    .map(r => ({
      id: r.id,
      name: r.name,
      label: `${r.name} — ${r.releaseType.charAt(0).toUpperCase() + r.releaseType.slice(1)}`,
      cover: r.cover,
      radius: r.releaseType === 'album' ? 2.0 : 1.5,
      isActive: r.songs.some(s => s.id === currentSongId),
      onClick: () => navigate(`/${r.releaseType}/${r.slug}`),
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
      onClick: () => navigate(`/single/${r.slug}`),
    }))

  const row2: Item[] = collections.map(c => ({
    id: c.id,
    name: c.title,
    label: `${c.title} — Collection`,
    cover: c.cover,
    radius: 1.1,
    isActive: c.tracks.some(s => s.id === currentSongId),
    onClick: () => navigate(`/collection/${c.slug}`),
  }))

  const row0MaxPage = Math.max(0, row0.length - 1)
  const row1MaxPage = Math.max(0, row1.length - 1)
  const row2MaxPage = Math.max(0, row2.length - 1)

  // Carousel APIs exposed by CarouselRow children — written to from useDrag
  const row0Api = useRef<CarouselApi | null>(null)
  const row1Api = useRef<CarouselApi | null>(null)
  const row2Api = useRef<CarouselApi | null>(null)
  // Refs so the useDrag closure always reads current values (avoids stale captures)
  const focusedRowRef = useRef(focusedRow)
  const pageRow0Ref   = useRef(pageRow0)
  const pageRow1Ref   = useRef(pageRow1)
  const pageRow2Ref   = useRef(pageRow2)
  useEffect(() => { focusedRowRef.current = focusedRow }, [focusedRow])
  useEffect(() => { pageRow0Ref.current   = pageRow0   }, [pageRow0])
  useEffect(() => { pageRow1Ref.current   = pageRow1   }, [pageRow1])
  useEffect(() => { pageRow2Ref.current   = pageRow2   }, [pageRow2])
  // World-units-per-pixel, updated every frame by WorldScaleProbe
  const worldScaleRef = useRef(0.024)
  const canvasRef = useRef<HTMLDivElement>(null)
  // Accumulates wheel delta so both mice (big jumps) and trackpads (small increments) feel smooth
  const wheelAccumRef = useRef(0)
  // Tracks normalised mouse Y (0=top, 1=bottom) inside the canvas
  const mouseYRef = useRef(0.25)
  // Row targeted at drag-start — stays locked for the whole gesture
  const dragRowRef = useRef(0)

  const rowApis  = [row0Api,    row1Api,    row2Api]
  const rowMaxes = [row0MaxPage, row1MaxPage, row2MaxPage]

  function getPageForRow(row: number) {
    if (row === 0) return pageRow0
    if (row === 1) return pageRow1
    return pageRow2
  }
  function getPageRefForRow(row: number) {
    if (row === 0) return pageRow0Ref.current
    if (row === 1) return pageRow1Ref.current
    return pageRow2Ref.current
  }
  function setPageForRow(row: number, page: number) {
    if (row === 0) setPageRow0(page)
    else if (row === 1) setPageRow1(page)
    else setPageRow2(page)
  }

  function advanceRow(row: number, dir: number) {
    const np = Math.max(0, Math.min(getPageForRow(row) + dir, rowMaxes[row]))
    setPageForRow(row, np)
    rowApis[row].current?.settle(np)
  }

  // Map mouseY (0=top, 1=bottom) to a row index across 3 rows
  function rowFromMouseY(y: number): number {
    if (y < 0.36) return 0
    if (y < 0.67) return 1
    return 2
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

  // ── Drag gesture ────────────────────────────────────────────────────────────
  const bind = useDrag(
    ({ movement: [mx], first, last, velocity: [vx] }) => {
      const worldDx = mx * worldScaleRef.current

      if (isMobile) {
        const fr        = focusedRowRef.current
        const activeApi = rowApis[fr]
        const activePage = getPageRefForRow(fr)
        const maxPage   = rowMaxes[fr]
        const mobileDx  = worldDx * MOBILE_DRAG_SENSITIVITY

        if (!last) {
          activeApi.current?.drag(mobileDx)
        } else {
          let newPage: number
          if (Math.abs(vx) > 0.3 || Math.abs(mx) > 40) {
            const dir = mx < 0 ? 1 : -1
            newPage = Math.max(0, Math.min(activePage + dir, maxPage))
          } else {
            const projected = mobileDx + vx * worldScaleRef.current * MOBILE_DRAG_SENSITIVITY * 200
            newPage = Math.max(0, Math.min(Math.round(activePage - projected / MOBILE_SPACING), maxPage))
          }
          setPageForRow(fr, newPage)
          activeApi.current?.settle(newPage)
        }
      } else {
        if (first) dragRowRef.current = rowFromMouseY(mouseYRef.current)
        const dr = dragRowRef.current
        const activeApi = rowApis[dr]
        const activePage = getPageForRow(dr)
        const maxPage = rowMaxes[dr]

        if (!last) {
          activeApi.current?.drag(worldDx)
        } else {
          const projected = worldDx + vx * worldScaleRef.current * 200
          const newPage = Math.max(0, Math.min(Math.round(activePage - projected / COL_SPACING), maxPage))
          setPageForRow(dr, newPage)
          activeApi.current?.settle(newPage)
        }
      }
    },
    { filterTaps: true, threshold: 8 }
  )

  return (
    <div className="bubble-world" role="region" aria-label="Music library">

      {/* ── Accessible navigation (visually hidden) ───────────────────────── */}
      <nav aria-label="Browse music" className="sr-only">
        {row0.length > 0 && (
          <section aria-labelledby="bw-albums-heading">
            <h2 id="bw-albums-heading">Albums & EPs</h2>
            <ul>
              {row0.map(item => (
                <li key={item.id}><button onClick={item.onClick}>{item.label}</button></li>
              ))}
            </ul>
          </section>
        )}
        {row1.length > 0 && (
          <section aria-labelledby="bw-singles-heading">
            <h2 id="bw-singles-heading">Singles</h2>
            <ul>
              {row1.map(item => (
                <li key={item.id}><button onClick={item.onClick}>{item.label}</button></li>
              ))}
            </ul>
          </section>
        )}
        {row2.length > 0 && (
          <section aria-labelledby="bw-collections-heading">
            <h2 id="bw-collections-heading">Collections</h2>
            <ul>
              {row2.map(item => (
                <li key={item.id}><button onClick={item.onClick}>{item.label}</button></li>
              ))}
            </ul>
          </section>
        )}
      </nav>

      {/* ── 3-D scene ────────────────────────────────────────────────────── */}
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
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <CameraController targetY={isMobile ? MOBILE_ROW_Y[0] : 0.75} targetZ={isMobile ? 13 : 26} />
          <WorldScaleProbe scaleRef={worldScaleRef} />

          <mesh position={[0, 0, -30]} scale={[220, 60, 1]}>
            <planeGeometry />
            <meshBasicMaterial toneMapped={false}>
              <GradientTexture
                stops={[0, 0.25, 0.6, 1]}
                colors={['#1a5c8a', '#2e8ab5', '#5ab8d4', '#8dd4e8']}
              />
            </meshBasicMaterial>
          </mesh>

          <ambientLight intensity={0.7} color="#ddeeff" />
          <directionalLight position={[5, 10, 3]} intensity={1.2} color="#fff8e0" />
          <hemisphereLight color="#87ceeb" groundColor="#6a9e5a" intensity={0.5} />
          <Environment preset="dawn" background={false} />

          <ScrollingClouds />

          {isMobile ? (
            <ScrollGroup targetOffsetY={MOBILE_ROW_Y[0] - MOBILE_ROW_Y[focusedRow]}>
              <CarouselRow
                items={row0}
                page={pageRow0}
                rowY={MOBILE_ROW_Y[0]}
                spacing={MOBILE_SPACING}
                phaseBase={0}
                apiRef={row0Api}
                rowFocused={focusedRow === 0}
              />
              <CarouselRow
                items={row1}
                page={pageRow1}
                rowY={MOBILE_ROW_Y[1]}
                spacing={MOBILE_SPACING}
                phaseBase={1.5}
                apiRef={row1Api}
                rowFocused={focusedRow === 1}
              />
              <CarouselRow
                items={row2}
                page={pageRow2}
                rowY={MOBILE_ROW_Y[2]}
                spacing={MOBILE_SPACING}
                phaseBase={3.0}
                apiRef={row2Api}
                rowFocused={focusedRow === 2}
              />
            </ScrollGroup>
          ) : (
            <>
              <CarouselRow
                items={row0}
                page={pageRow0}
                rowY={ROW_Y[0]}
                spacing={COL_SPACING}
                phaseBase={0}
                apiRef={row0Api}
                rowFocused={true}
              />
              <CarouselRow
                items={row1}
                page={pageRow1}
                rowY={ROW_Y[1]}
                spacing={COL_SPACING}
                phaseBase={1.5}
                apiRef={row1Api}
                rowFocused={true}
              />
              <CarouselRow
                items={row2}
                page={pageRow2}
                rowY={ROW_Y[2]}
                spacing={COL_SPACING}
                phaseBase={3.0}
                apiRef={row2Api}
                rowFocused={true}
              />
            </>
          )}

          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} />
        </Canvas>
      </div>

      {/* ── Mobile: row toggle arrows ─────────────────────────────────────── */}
      {isMobile && (() => {
        const ROW_NAMES = ['Albums & EPs', 'Singles', 'Collections']
        const nextRow = ((focusedRow + 1) % 3) as 0 | 1 | 2
        const prevRow = ((focusedRow + 2) % 3) as 0 | 1 | 2
        return (
          <>
            <button
              className="bubble-row-toggle bubble-row-toggle--left"
              onClick={() => { focusedRowRef.current = prevRow; setFocusedRow(prevRow) }}
              aria-label={`View ${ROW_NAMES[prevRow]}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
              <span>{ROW_NAMES[prevRow]}</span>
            </button>
            <button
              className="bubble-row-toggle bubble-row-toggle--right"
              onClick={() => { focusedRowRef.current = nextRow; setFocusedRow(nextRow) }}
              aria-label={`View ${ROW_NAMES[nextRow]}`}
            >
              <span>{ROW_NAMES[nextRow]}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </>
        )
      })()}

      {/* ── Mobile: side arrows ───────────────────────────────────────────── */}
      {isMobile && focusedRow === 0 && row0.length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPageRow0(p => p - 1)} disabled={pageRow0 === 0} aria-label="Previous album or EP"><ChevronLeft /></button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPageRow0(p => p + 1)} disabled={pageRow0 === row0.length - 1} aria-label="Next album or EP"><ChevronRight /></button>
        </>
      )}
      {isMobile && focusedRow === 1 && row1.length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPageRow1(p => p - 1)} disabled={pageRow1 === 0} aria-label="Previous single"><ChevronLeft /></button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPageRow1(p => p + 1)} disabled={pageRow1 === row1.length - 1} aria-label="Next single"><ChevronRight /></button>
        </>
      )}
      {isMobile && focusedRow === 2 && row2.length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPageRow2(p => p - 1)} disabled={pageRow2 === 0} aria-label="Previous collection"><ChevronLeft /></button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPageRow2(p => p + 1)} disabled={pageRow2 === row2.length - 1} aria-label="Next collection"><ChevronRight /></button>
        </>
      )}

      {/* ── Desktop: per-row nav ─────────────────────────────────────────── */}
      {!isMobile && (
        <div className="bubble-nav-dual">
          {row0.length > 1 && (
            <nav className="bubble-nav bubble-nav--inline" aria-label="Albums & EPs pages">
              <button className="bubble-nav__arrow" onClick={() => advanceRow(0, -1)} disabled={pageRow0 === 0} aria-label="Previous album or EP"><ChevronLeft /></button>
              <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
                <span className="sr-only">Albums & EPs page </span>{pageRow0 + 1}/{row0.length}
              </span>
              <button className="bubble-nav__arrow" onClick={() => advanceRow(0, 1)} disabled={pageRow0 === row0MaxPage} aria-label="Next album or EP"><ChevronRight /></button>
            </nav>
          )}
          {row1.length > 1 && (
            <nav className="bubble-nav bubble-nav--inline" aria-label="Singles pages">
              <button className="bubble-nav__arrow" onClick={() => advanceRow(1, -1)} disabled={pageRow1 === 0} aria-label="Previous single"><ChevronLeft /></button>
              <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
                <span className="sr-only">Singles page </span>{pageRow1 + 1}/{row1.length}
              </span>
              <button className="bubble-nav__arrow" onClick={() => advanceRow(1, 1)} disabled={pageRow1 === row1MaxPage} aria-label="Next single"><ChevronRight /></button>
            </nav>
          )}
          {row2.length > 1 && (
            <nav className="bubble-nav bubble-nav--inline" aria-label="Collections pages">
              <button className="bubble-nav__arrow" onClick={() => advanceRow(2, -1)} disabled={pageRow2 === 0} aria-label="Previous collection"><ChevronLeft /></button>
              <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
                <span className="sr-only">Collection page </span>{pageRow2 + 1}/{row2.length}
              </span>
              <button className="bubble-nav__arrow" onClick={() => advanceRow(2, 1)} disabled={pageRow2 === row2MaxPage} aria-label="Next collection"><ChevronRight /></button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(BubbleWorld)
