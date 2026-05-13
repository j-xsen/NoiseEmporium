import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GradientTexture } from '@react-three/drei'
import ReleaseBubble from './ReleaseBubble'
import type { Release, Collection } from '../types'

// ── Desktop: 3 columns, camera at z=26 ───────────────────────────────────────
const COLS = 3
const COL_SPACING = 4.5
const ROW_Y: [number, number] = [4.0, -2.5]

// ── Mobile: two independent carousels, camera at z=10 y=1.2 ─────────────────
// z=10 fov=50 portrait 9:16: half-height≈4.66, half-width≈2.62.
// Row 0 at y=1.2 (= camera y) → centered on screen.
// Row 1 at y=-4.54 → top of bubble peeks ~20% (0.72 units) at bottom of screen.
// Neighbor spacing 3.8 → inner edge at 1.8, visible: 2.62-1.8=0.82 (20% peek).
const MOBILE_BREAKPOINT = 640
const MOBILE_ROW_Y: [number, number] = [1.2, -8.0]
const MOBILE_SPACING = 3.8

function colX(i: number): number {
  return (i - (COLS - 1) / 2) * COL_SPACING
}

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

// Animates a group's Y offset — used to scroll mobile bubble rows without
// moving the camera (OrbitControls always targets the origin).
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

export default function BubbleWorld({ releases, collections, currentSongId }: BubbleWorldProps) {
  const navigate = useNavigate()
  // Desktop: shared page across both rows
  const [page, setPage] = useState(0)
  // Mobile: independent page per row
  const [pageRow0, setPageRow0] = useState(0)
  const [pageRow1, setPageRow1] = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  // Mobile: which row the camera is centered on (0=releases, 1=collections)
  const [focusedRow, setFocusedRow] = useState(() =>
    window.location.hash === '#collections' ? 1 : 0
  )

  // Sync hash → focusedRow on back/forward navigation
  useEffect(() => {
    const onHash = () => setFocusedRow(window.location.hash === '#collections' ? 1 : 0)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Sync focusedRow → hash
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

  // Desktop pagination
  const desktopMaxPage = Math.max(0, Math.ceil(Math.max(row0.length, row1.length) / COLS) - 1)
  const hasPrev = page > 0
  const hasNext = page < desktopMaxPage
  const visibleRow0 = row0.slice(page * COLS, (page + 1) * COLS)
  const visibleRow1 = row1.slice(page * COLS, (page + 1) * COLS)

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

      {/* ── 3-D scene (visual only) ───────────────────────────────────────── */}
      <div className="bubble-world__canvas" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0.75, 26], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          <CameraController targetY={isMobile ? MOBILE_ROW_Y[0] : 0.75} targetZ={isMobile ? 10 : 26} />

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

          {isMobile ? (
            // Mobile: ScrollGroup shifts all bubbles so the focused row lands
            // at MOBILE_ROW_Y[0] (where the camera is pointed).
            <ScrollGroup targetOffsetY={focusedRow === 0 ? 0 : MOBILE_ROW_Y[0] - MOBILE_ROW_Y[1]}>
              {/* Mobile row 0 — releases carousel */}
              {row0.map((item, i) => {
                if (Math.abs(i - pageRow0) > 1) return null
                return (
                  <ReleaseBubble
                    key={item.id}
                    position={[(i - pageRow0) * MOBILE_SPACING, MOBILE_ROW_Y[0], 0]}
                    radius={2.0}
                    cover={item.cover}
                    name={item.name}
                    isActive={item.isActive}
                    phaseOffset={i * 0.7}
                    onClick={item.onClick}
                  />
                )
              })}
              {/* Mobile row 1 — collections carousel */}
              {row1.map((item, i) => {
                if (Math.abs(i - pageRow1) > 1) return null
                return (
                  <ReleaseBubble
                    key={item.id}
                    position={[(i - pageRow1) * MOBILE_SPACING, MOBILE_ROW_Y[1], 0]}
                    radius={1.8}
                    cover={item.cover}
                    name={item.name}
                    isActive={item.isActive}
                    phaseOffset={i * 0.7 + 1.5}
                    onClick={item.onClick}
                  />
                )
              })}
            </ScrollGroup>
          ) : (
            <>
              {visibleRow0.map((item, i) => (
                <ReleaseBubble
                  key={item.id}
                  position={[colX(i), ROW_Y[0], 0]}
                  radius={item.radius}
                  cover={item.cover}
                  name={item.name}
                  isActive={item.isActive}
                  phaseOffset={i * 0.7}
                  onClick={item.onClick}
                />
              ))}
              {visibleRow1.map((item, i) => (
                <ReleaseBubble
                  key={item.id}
                  position={[colX(i), ROW_Y[1], 0]}
                  radius={item.radius}
                  cover={item.cover}
                  name={item.name}
                  isActive={item.isActive}
                  phaseOffset={i * 0.7 + 1.5}
                  onClick={item.onClick}
                />
              ))}
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

      {/* ── Mobile: independent side arrows per row ───────────────────────── */}
      {isMobile && focusedRow === 0 && row0.length > 1 && (
        <>
          <button
            className="bubble-side-arrow bubble-side-arrow--left"
            onClick={() => setPageRow0(p => p - 1)}
            disabled={pageRow0 === 0}
            aria-label="Previous release"
          ><ChevronLeft /></button>
          <button
            className="bubble-side-arrow bubble-side-arrow--right"
            onClick={() => setPageRow0(p => p + 1)}
            disabled={pageRow0 === row0.length - 1}
            aria-label="Next release"
          ><ChevronRight /></button>
        </>
      )}
      {isMobile && focusedRow === 1 && row1.length > 1 && (
        <>
          <button
            className="bubble-side-arrow bubble-side-arrow--left"
            onClick={() => setPageRow1(p => p - 1)}
            disabled={pageRow1 === 0}
            aria-label="Previous collection"
          ><ChevronLeft /></button>
          <button
            className="bubble-side-arrow bubble-side-arrow--right"
            onClick={() => setPageRow1(p => p + 1)}
            disabled={pageRow1 === row1.length - 1}
            aria-label="Next collection"
          ><ChevronRight /></button>
        </>
      )}

      {/* ── Desktop: row labels ──────────────────────────────────────────── */}
      {!isMobile && (
        <>
          <span className="bubble-row-label bubble-row-label--top">Releases</span>
          <span className="bubble-row-label bubble-row-label--bottom">Collections</span>
        </>
      )}

      {/* ── Desktop: shared bottom nav ────────────────────────────────────── */}
      {!isMobile && desktopMaxPage > 0 && (
        <nav className="bubble-nav" aria-label="Music pages">
          <button
            className="bubble-nav__arrow"
            onClick={() => setPage(p => p - 1)}
            disabled={!hasPrev}
            aria-label="Previous page"
          ><ChevronLeft /></button>
          <span className="bubble-nav__page" aria-live="polite" aria-atomic="true">
            <span className="sr-only">Page </span>
            {page + 1} / {desktopMaxPage + 1}
          </span>
          <button
            className="bubble-nav__arrow"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            aria-label="Next page"
          ><ChevronRight /></button>
        </nav>
      )}
    </div>
  )
}
