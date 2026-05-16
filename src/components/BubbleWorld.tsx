import { memo, useState, useEffect, useLayoutEffect, useRef, type ReactNode, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GradientTexture, Environment, Clouds, Cloud } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useDrag } from '@use-gesture/react'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'
import * as THREE from 'three'

// ── Desktop: camera at z=26 ──────────────────────────────────────────────────
const COL_SPACING = 4.5
const ROW_Y: [number, number] = [4.0, -2.5]

// ── Mobile: two independent carousels, camera at z=10 y=1.2 ─────────────────
const MOBILE_BREAKPOINT = 640
const MOBILE_ROW_Y: [number, number] = [1.2, -8.0]
const MOBILE_SPACING = 5.5
// Amplify pixel→world conversion on mobile so a short swipe snaps to the next bubble
const MOBILE_DRAG_SENSITIVITY = 2.0


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
  const [spring, api] = useSpring(() => ({
    x: -page * spacing,
    config: { tension: 58, friction: 22, mass: 1.1 },
  }))

  // Expose the spring API — drag is gated so unfocused rows never move.
  useEffect(() => {
    apiRef.current = {
      drag:   (worldX)  => { if (!rowFocused) return; api.start({ x: -page * spacing + worldX, immediate: true }) },
      settle: (newPage) => api.start({ x: -newPage * spacing, immediate: false }),
      snap:   (newPage) => api.start({ x: -newPage * spacing, immediate: true }),
    }
  }, [page, spacing, rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep spring in sync when page changes via buttons / arrow keys
  useEffect(() => {
    api.start({ x: -page * spacing })
  }, [page, spacing]) // eslint-disable-line react-hooks/exhaustive-deps

  // When a row goes OFF-screen (mobile row switch), stop any in-progress animation
  // so it isn't seen mid-slide. Skip on mount and skip when becoming focused —
  // the [page, spacing] effect above already positions the spring correctly.
  const prevRowFocusedRef = useRef(rowFocused)
  useEffect(() => {
    const wasRowFocused = prevRowFocusedRef.current
    prevRowFocusedRef.current = rowFocused
    if (!rowFocused && wasRowFocused) {
      api.start({ x: -page * spacing, immediate: true })
    }
  }, [rowFocused]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <animated.group position-x={spring.x}>
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
    </animated.group>
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  const [focusedRow, setFocusedRow] = useState(() =>
    window.location.hash === '#collections' ? 1 : 0
  )

  // hash ↔ focusedRow sync
  useEffect(() => {
    const onHash = () => setFocusedRow(window.location.hash === '#collections' ? 1 : 0)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const hash = focusedRow === 1 ? '#collections' : ''
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
    setFocusedRow(window.location.hash === '#collections' ? 1 : 0)
  }, [isMobile])


  const row0: Item[] = releases.map(r => ({
    id: r.id,
    name: r.name,
    label: `${r.name} — ${r.releaseType.charAt(0).toUpperCase() + r.releaseType.slice(1)}`,
    cover: r.cover,
    radius: r.releaseType === 'album' ? 2.0 : r.releaseType === 'ep' ? 1.5 : 1.2,
    isActive: r.songs.some(s => s.id === currentSongId),
    onClick: () => navigate(`/${r.releaseType}/${r.slug}`),
  }))

  const row1: Item[] = collections.map(c => ({
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

  // Spring APIs exposed by CarouselRow children — written to from useDrag
  const row0Api = useRef<CarouselApi | null>(null)
  const row1Api = useRef<CarouselApi | null>(null)
  // Refs so the useDrag closure always reads current values (avoids stale captures)
  const focusedRowRef = useRef(focusedRow)
  const pageRow0Ref   = useRef(pageRow0)
  const pageRow1Ref   = useRef(pageRow1)
  useEffect(() => { focusedRowRef.current = focusedRow }, [focusedRow])
  useEffect(() => { pageRow0Ref.current   = pageRow0   }, [pageRow0])
  useEffect(() => { pageRow1Ref.current   = pageRow1   }, [pageRow1])
  // World-units-per-pixel, updated every frame by WorldScaleProbe
  const worldScaleRef = useRef(0.024)
  const canvasRef = useRef<HTMLDivElement>(null)
  // Accumulates wheel delta so both mice (big jumps) and trackpads (small increments) feel smooth
  const wheelAccumRef = useRef(0)
  // Tracks normalised mouse Y (0=top, 1=bottom) inside the canvas
  const mouseYRef = useRef(0.25)
  // Row targeted at drag-start — stays locked for the whole gesture
  const dragRowRef = useRef(0)

  function advanceRow(row: 0 | 1, dir: number) {
    if (row === 0) {
      const np = Math.max(0, Math.min(pageRow0 + dir, row0MaxPage))
      setPageRow0(np)
      row0Api.current?.settle(np)
    } else {
      const np = Math.max(0, Math.min(pageRow1 + dir, row1MaxPage))
      setPageRow1(np)
      row1Api.current?.settle(np)
    }
  }

  function handleWheel(e: React.WheelEvent) {
    if (isMobile) return
    e.preventDefault()
    wheelAccumRef.current += e.deltaY
    // Fire once per ~80px of accumulated scroll so trackpads feel continuous
    // and mice (which send ~100px per tick) advance one step per notch
    if (Math.abs(wheelAccumRef.current) >= 80) {
      const dir = wheelAccumRef.current > 0 ? 1 : -1
      wheelAccumRef.current = 0
      advanceRow(mouseYRef.current < 0.52 ? 0 : 1, dir)
    }
  }

  // ── Drag gesture ────────────────────────────────────────────────────────────
  // filterTaps suppresses click-sized drags; threshold ignores micro-movements.
  const bind = useDrag(
    ({ movement: [mx], first, last, velocity: [vx] }) => {
      const worldDx = mx * worldScaleRef.current

      if (isMobile) {
        const fr        = focusedRowRef.current
        const activeApi = fr === 0 ? row0Api : row1Api
        const activePage = fr === 0 ? pageRow0Ref.current : pageRow1Ref.current
        const maxPage   = fr === 0 ? row0MaxPage : row1MaxPage
        const mobileDx  = worldDx * MOBILE_DRAG_SENSITIVITY

        if (!last) {
          activeApi.current?.drag(mobileDx)
        } else {
          let newPage: number
          // vx from use-gesture is unsigned (speed, not signed velocity), so always use mx for direction.
          // Treat as a deliberate page-change if fast flick OR moved > 40px.
          if (Math.abs(vx) > 0.3 || Math.abs(mx) > 40) {
            const dir = mx < 0 ? 1 : -1
            newPage = Math.max(0, Math.min(activePage + dir, maxPage))
          } else {
            // Slow deliberate drag: project forward by 200ms of velocity, snap to nearest
            const projected = mobileDx + vx * worldScaleRef.current * MOBILE_DRAG_SENSITIVITY * 200
            newPage = Math.max(0, Math.min(Math.round(activePage - projected / MOBILE_SPACING), maxPage))
          }
          if (fr === 0) setPageRow0(newPage)
          else setPageRow1(newPage)
          activeApi.current?.settle(newPage)
        }
      } else {
        if (first) dragRowRef.current = mouseYRef.current < 0.52 ? 0 : 1
        const activeApi = dragRowRef.current === 0 ? row0Api : row1Api
        const activePage = dragRowRef.current === 0 ? pageRow0 : pageRow1
        const maxPage = dragRowRef.current === 0 ? row0MaxPage : row1MaxPage

        if (!last) {
          activeApi.current?.drag(worldDx)
        } else {
          const projected = worldDx + vx * worldScaleRef.current * 200
          const newPage = Math.max(0, Math.min(Math.round(activePage - projected / COL_SPACING), maxPage))
          if (dragRowRef.current === 0) setPageRow0(newPage)
          else setPageRow1(newPage)
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
          <section aria-labelledby="bw-releases-heading">
            <h2 id="bw-releases-heading">Releases</h2>
            <ul>
              {row0.map(item => (
                <li key={item.id}><button onClick={item.onClick}>{item.label}</button></li>
              ))}
            </ul>
          </section>
        )}
        {row1.length > 0 && (
          <section aria-labelledby="bw-collections-heading">
            <h2 id="bw-collections-heading">Collections</h2>
            <ul>
              {row1.map(item => (
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
          <CameraController targetY={isMobile ? MOBILE_ROW_Y[0] : 0.75} targetZ={isMobile ? (row1.length > 0 ? 13 : 10) : 26} />
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
            <ScrollGroup targetOffsetY={focusedRow === 0 ? 0 : MOBILE_ROW_Y[0] - MOBILE_ROW_Y[1]}>
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
            </>
          )}

          <OrbitControls enablePan={false} enableRotate={false} enableZoom={false} />
        </Canvas>
      </div>

      {/* ── Mobile: row toggle arrow ──────────────────────────────────────── */}
      {isMobile && (
        <button
          className="bubble-row-toggle"
          onClick={() => {
            const next = focusedRowRef.current === 0 ? 1 : 0
            focusedRowRef.current = next   // synchronous — no gap before drag handler reads it
            setFocusedRow(next)
          }}
          aria-label={focusedRow === 0 ? 'View Collections' : 'View Releases'}
        >
          {focusedRow === 0 ? (
            <>
              <span>Collections</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
              <span>Releases</span>
            </>
          )}
        </button>
      )}

      {/* ── Mobile: side arrows ───────────────────────────────────────────── */}
      {isMobile && focusedRow === 0 && row0.length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPageRow0(p => p - 1)} disabled={pageRow0 === 0} aria-label="Previous release"><ChevronLeft /></button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPageRow0(p => p + 1)} disabled={pageRow0 === row0.length - 1} aria-label="Next release"><ChevronRight /></button>
        </>
      )}
      {isMobile && focusedRow === 1 && row1.length > 1 && (
        <>
          <button className="bubble-side-arrow bubble-side-arrow--left" onClick={() => setPageRow1(p => p - 1)} disabled={pageRow1 === 0} aria-label="Previous collection"><ChevronLeft /></button>
          <button className="bubble-side-arrow bubble-side-arrow--right" onClick={() => setPageRow1(p => p + 1)} disabled={pageRow1 === row1.length - 1} aria-label="Next collection"><ChevronRight /></button>
        </>
      )}

      {/* ── Desktop: per-row nav ─────────────────────────────────────────── */}
      {!isMobile && (
        <div className="bubble-nav-dual">
          {row0.length > 1 && (
            <nav className="bubble-nav bubble-nav--inline" aria-label="Releases pages">
              <button className="bubble-nav__arrow" onClick={() => advanceRow(0, -1)} disabled={pageRow0 === 0} aria-label="Previous release"><ChevronLeft /></button>
              <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
                <span className="sr-only">Release page </span>{pageRow0 + 1}/{row0.length}
              </span>
              <button className="bubble-nav__arrow" onClick={() => advanceRow(0, 1)} disabled={pageRow0 === row0MaxPage} aria-label="Next release"><ChevronRight /></button>
            </nav>
          )}
          {row1.length > 1 && (
            <nav className="bubble-nav bubble-nav--inline" aria-label="Collections pages">
              <button className="bubble-nav__arrow" onClick={() => advanceRow(1, -1)} disabled={pageRow1 === 0} aria-label="Previous collection"><ChevronLeft /></button>
              <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
                <span className="sr-only">Collection page </span>{pageRow1 + 1}/{row1.length}
              </span>
              <button className="bubble-nav__arrow" onClick={() => advanceRow(1, 1)} disabled={pageRow1 === row1MaxPage} aria-label="Next collection"><ChevronRight /></button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(BubbleWorld)
