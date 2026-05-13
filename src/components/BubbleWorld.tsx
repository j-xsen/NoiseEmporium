import { useState, useEffect, useLayoutEffect, useRef, type ReactNode, type MutableRefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GradientTexture, Environment } from '@react-three/drei'
import { useSpring, animated } from '@react-spring/three'
import { useDrag } from '@use-gesture/react'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'
import * as THREE from 'three'

// ── Desktop: 3 columns, camera at z=26 ───────────────────────────────────────
const COLS = 3
const COL_SPACING = 4.5
const ROW_Y: [number, number] = [4.0, -2.5]

// ── Mobile: two independent carousels, camera at z=10 y=1.2 ─────────────────
const MOBILE_BREAKPOINT = 640
const MOBILE_ROW_Y: [number, number] = [1.2, -8.0]
const MOBILE_SPACING = 3.8

function colX(i: number): number {
  return (i - (COLS - 1) / 2) * COL_SPACING
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
}

interface CarouselRowProps {
  items: Item[]
  page: number
  rowY: number
  spacing: number
  defaultRadius: number
  phaseBase: number
  apiRef: MutableRefObject<CarouselApi | null>
}

function CarouselRow({ items, page, rowY, spacing, defaultRadius, phaseBase, apiRef }: CarouselRowProps) {
  const [spring, api] = useSpring(() => ({
    x: -page * spacing,
    config: { tension: 95, friction: 16, mass: 1.3 },
  }))

  // Expose the spring API to the HTML drag layer through the ref.
  // Re-register whenever page changes so settle() closes over the latest value.
  useEffect(() => {
    apiRef.current = {
      drag:   (worldX) => api.start({ x: -page * spacing + worldX, immediate: true }),
      settle: (newPage) => api.start({ x: -newPage * spacing, immediate: false }),
    }
  }, [page, spacing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep spring in sync when page changes via buttons / arrow keys
  useEffect(() => {
    api.start({ x: -page * spacing })
  }, [page, spacing]) // eslint-disable-line react-hooks/exhaustive-deps

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

interface BubbleWorldProps {
  releases: Release[]
  collections: Collection[]
  currentSongId?: string
}

// ── BubbleWorld ───────────────────────────────────────────────────────────────
export default function BubbleWorld({ releases, collections, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
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
    setPage(0)
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
    radius: 1.8,
    isActive: c.tracks.some(s => s.id === currentSongId),
    onClick: () => navigate(`/collection/${c.slug}`),
  }))

  const desktopMaxPage = Math.max(0, Math.ceil(Math.max(row0.length, row1.length) / COLS) - 1)
  const hasPrev = page > 0
  const hasNext = page < desktopMaxPage
  const visibleRow0 = row0.slice(page * COLS, (page + 1) * COLS)
  const visibleRow1 = row1.slice(page * COLS, (page + 1) * COLS)

  // Spring APIs exposed by CarouselRow children — written to from useDrag
  const row0Api = useRef<CarouselApi | null>(null)
  const row1Api = useRef<CarouselApi | null>(null)
  // World-units-per-pixel, updated every frame by WorldScaleProbe
  const worldScaleRef = useRef(0.024)
  const canvasRef = useRef<HTMLDivElement>(null)

  // ── Drag gesture ────────────────────────────────────────────────────────────
  // filterTaps suppresses click-sized drags; threshold ignores micro-movements.
  const bind = useDrag(
    ({ movement: [mx], down, last, velocity: [vx], direction: [dx] }) => {
      const worldDx = mx * worldScaleRef.current

      if (isMobile) {
        const activeApi = focusedRow === 0 ? row0Api : row1Api
        const activePage = focusedRow === 0 ? pageRow0 : pageRow1
        const maxPage = focusedRow === 0 ? row0.length - 1 : row1.length - 1

        if (!last) {
          activeApi.current?.drag(worldDx)
        } else {
          // Flick or drag past 60px → advance page
          const flick = Math.abs(vx) > 0.4
          let newPage = activePage
          if (flick || Math.abs(mx) > 60) {
            newPage = dx < 0
              ? Math.min(activePage + 1, maxPage)
              : Math.max(activePage - 1, 0)
          }
          if (focusedRow === 0) setPageRow0(newPage)
          else setPageRow1(newPage)
          activeApi.current?.settle(newPage)
        }
      } else {
        // Desktop: both rows share one page
        if (!last) {
          row0Api.current?.drag(worldDx)
          row1Api.current?.drag(worldDx)
        } else {
          const flick = Math.abs(vx) > 0.4
          let newPage = page
          if (flick || Math.abs(mx) > 60) {
            newPage = dx < 0
              ? Math.min(page + 1, desktopMaxPage)
              : Math.max(page - 1, 0)
          }
          setPage(newPage)
          row0Api.current?.settle(newPage)
          row1Api.current?.settle(newPage)
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
      <div ref={canvasRef} className="bubble-world__canvas" aria-hidden="true" {...bind()}>
        <Canvas
          camera={{ position: [0, 0.75, 26], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <CameraController targetY={isMobile ? MOBILE_ROW_Y[0] : 0.75} targetZ={isMobile ? 10 : 26} />
          <WorldScaleProbe scaleRef={worldScaleRef} />

          <mesh position={[0, 0, -30]} scale={[80, 55, 1]}>
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

          {isMobile ? (
            <ScrollGroup targetOffsetY={focusedRow === 0 ? 0 : MOBILE_ROW_Y[0] - MOBILE_ROW_Y[1]}>
              <CarouselRow
                items={row0}
                page={pageRow0}
                rowY={MOBILE_ROW_Y[0]}
                spacing={MOBILE_SPACING}
                defaultRadius={2.0}
                phaseBase={0}
                apiRef={row0Api}
              />
              <CarouselRow
                items={row1}
                page={pageRow1}
                rowY={MOBILE_ROW_Y[1]}
                spacing={MOBILE_SPACING}
                defaultRadius={1.8}
                phaseBase={1.5}
                apiRef={row1Api}
              />
            </ScrollGroup>
          ) : (
            <>
              <CarouselRow
                items={visibleRow0}
                page={0}
                rowY={ROW_Y[0]}
                spacing={COL_SPACING}
                defaultRadius={2.0}
                phaseBase={0}
                apiRef={row0Api}
              />
              <CarouselRow
                items={visibleRow1}
                page={0}
                rowY={ROW_Y[1]}
                spacing={COL_SPACING}
                defaultRadius={1.8}
                phaseBase={1.5}
                apiRef={row1Api}
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
          onClick={() => setFocusedRow(r => r === 0 ? 1 : 0)}
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

      {/* ── Desktop: row labels ──────────────────────────────────────────── */}
      {!isMobile && (
        <>
          <span className="bubble-row-label bubble-row-label--top">Releases</span>
          <span className="bubble-row-label bubble-row-label--bottom">Collections</span>
        </>
      )}

      {/* ── Desktop: page nav ────────────────────────────────────────────── */}
      {!isMobile && desktopMaxPage > 0 && (
        <nav className="bubble-nav" aria-label="Music pages">
          <button className="bubble-nav__arrow" onClick={() => setPage(p => p - 1)} disabled={!hasPrev} aria-label="Previous page"><ChevronLeft /></button>
          <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
            <span className="sr-only">Page </span>
            {page + 1} / {desktopMaxPage + 1}
          </span>
          <button className="bubble-nav__arrow" onClick={() => setPage(p => p + 1)} disabled={!hasNext} aria-label="Next page"><ChevronRight /></button>
        </nav>
      )}
    </div>
  )
}
